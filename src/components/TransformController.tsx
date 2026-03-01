import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    normalizeSnapTargets,
    evaluateMoveSnap,
    evaluateResizeSnap,
    type MoveSnapLock,
    type ResizeSnapLock,
} from '../utils/snapUtils';

const RESIZE_CURSORS = ['n-resize', 'ne-resize', 'e-resize', 'se-resize', 's-resize', 'sw-resize', 'w-resize', 'nw-resize'];

const getResizeCursor = (handle: string, rotation: number) => {
    const baseAngles: Record<string, number> = {
        t: 0, tr: 45, r: 90, br: 135, b: 180, bl: 225, l: 270, tl: 315
    };
    const angle = (baseAngles[handle] + rotation) % 360;
    const index = Math.round(angle / 45) % 8;
    const finalIndex = index < 0 ? index + 8 : index;
    return RESIZE_CURSORS[finalIndex];
};

const getRotateCursor = (corner: string, rotation: number) => {
    const baseAngles: Record<string, number> = {
        tl: 0, tr: 90, br: 180, bl: 270
    };
    const angle = Math.round((baseAngles[corner] + rotation));
    
    // Quadrant-aware arc that "hugs" the corner handle
    const svg = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g transform="rotate(${angle} 16 16)">
    <path d="M8 16C8 11.5817 11.5817 8 16 8" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8 16C8 11.5817 11.5817 8 16 8" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 8H16V12" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M12 8H16V12" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8 12V16H12" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8 12V16H12" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`.trim();
    
    return `url('data:image/svg+xml;base64,${btoa(svg)}') 16 16, alias`;
};

interface TransformControllerProps {
    layer: { id: string; x: number; y: number; width: number; height: number; rotation: number };
    onUpdate: (updates: { x?: number; y?: number; width?: number; height?: number; rotation?: number }, isBatch?: boolean, altKey?: boolean) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    onDoubleClick?: (e: React.MouseEvent) => void;
    /** Mousedown anında çağrılır; anchor (x,y,rotation) + actionType (move|rotate|tl|tr|bl|br|t|b|l|r) – mouse up'a kadar bu işlem kilitlenir */
    onDragStart?: (payload: { x: number; y: number; rotation: number; actionType: string }) => void;
    disableResize?: boolean;
    zoom: number;
    isSnapEnabled?: boolean;
    snapTargets?: Array<{ x?: number, y?: number, label?: string }>;
    onSnap?: (snap: { x: number | null, y: number | null, labelX?: string, labelY?: string }) => void;
    onComplete?: () => void;
    lockAspectRatio?: boolean;
    onHover?: (id: string | null) => void;
    cursor?: string;
    isSelectionActiveGroup?: boolean;
    onClick?: (e: React.MouseEvent) => void;
}

interface DragState {
    type: string;
    startX: number;
    startY: number;
    initialLayerX: number;
    initialLayerY: number;
    initialWidth: number;
    initialHeight: number;
    initialRotation: number;
    initialScrollX: number;
    initialScrollY: number;
    clickAngle: number;
}

const TransformController: React.FC<TransformControllerProps> = ({ 
    layer, onUpdate, onContextMenu, onDoubleClick, onDragStart, disableResize, zoom, 
    isSnapEnabled, snapTargets = [], onSnap, onComplete, lockAspectRatio, onHover, cursor,
    isSelectionActiveGroup, onClick
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const ignoreClickRef = useRef(false);
    
    // UI State for highlights
    const [actionState, setActionState] = useState<string | null>(null);
    const [snapActiveX, setSnapActiveX] = useState<number | null>(null);
    const [snapActiveY, setSnapActiveY] = useState<number | null>(null);

    // Operational Refs for high-speed tracking and interval stability
    const dragStateRef = useRef<DragState | null>(null);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const scrollIntervalRef = useRef<any>(null);
    const activeScrollRef = useRef<{ dirX: string | null, dirY: string | null, factor: number } | null>(null);
    const propsRef = useRef({ onUpdate, onSnap, onComplete, onDragStart, zoom, isSnapEnabled, snapTargets, layer, isShiftPressed: false, isAltPressed: false, lockAspectRatio, onHover });
    const moveSnapLockRef = useRef<MoveSnapLock | null>(null);
    const resizeSnapLockRef = useRef<ResizeSnapLock | null>(null);
    const lastSnapRef = useRef<{ x: number | null; y: number | null; labelX?: string; labelY?: string }>({ x: null, y: null });

    useEffect(() => {
        propsRef.current = { onUpdate, onSnap, onComplete, onDragStart, zoom, isSnapEnabled, snapTargets, layer, isShiftPressed, isAltPressed, lockAspectRatio, onHover };
    });



    const normalizedTargets = React.useMemo(() => {
        return normalizeSnapTargets(snapTargets);
    }, [snapTargets]);

    const handleUpdate = useCallback((clientX: number, clientY: number, state: DragState, scrollX: number, scrollY: number) => {
        const { zoom, isSnapEnabled, snapTargets } = propsRef.current;
        // Content delta: screen movement -> content (÷zoom); scroll change is already in content units
        const dx = (clientX - state.startX) / zoom + (scrollX - state.initialScrollX);
        const dy = (clientY - state.startY) / zoom + (scrollY - state.initialScrollY);
        
        if (isNaN(dx) || isNaN(dy)) return;
        
        let currentSnapX: number | null = null;
        let currentSnapY: number | null = null;
        let currentLabelX: string | undefined;
        let currentLabelY: string | undefined;

        if (state.type === 'move') {
            const w = state.initialWidth;
            const h = state.initialHeight;
            const centerX = state.initialLayerX + dx + w / 2;
            const centerY = state.initialLayerY + dy + h / 2;

            const moveResult = evaluateMoveSnap(
                centerX,
                centerY,
                w,
                h,
                state.initialRotation,
                normalizedTargets,
                zoom,
                moveSnapLockRef.current,
                !!isSnapEnabled
            );

            moveSnapLockRef.current = moveResult.newLock;
            currentSnapX = moveResult.snapX;
            currentSnapY = moveResult.snapY;
            currentLabelX = moveResult.labelX;
            currentLabelY = moveResult.labelY;

            propsRef.current.onUpdate({ x: moveResult.finalX, y: moveResult.finalY }, true, propsRef.current.isAltPressed);
        } else if (state.type === 'rotate') {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                
                const angle = Math.atan2(clientY - cy, clientX - cx);
                const currentDeg = (angle * 180) / Math.PI;
                
                // Calculate delta from the initial click angle to support rotation from any handle (top or corners)
                const delta = currentDeg - state.clickAngle;
                let newRotation = state.initialRotation + delta;
                
                // Rotation snapping (e.g., 15 degree steps if shift is pressed, or default to 1 degree steps)
                
                // Handle Shift key for 15-deg snapping
                const isShiftPressed = (window.event as any)?.shiftKey;
                if (isShiftPressed) {
                    newRotation = Math.round(newRotation / 15) * 15;
                } else {
                    // Regular snapping to 1 degree for smoothness but preventing noisy floating points
                    newRotation = Math.round(newRotation);
                }

                propsRef.current.onUpdate({ rotation: newRotation }, true, propsRef.current.isAltPressed);
            }
        } else {
            const rad = state.initialRotation * (Math.PI / 180);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const halfW = state.initialWidth / 2;
            const halfH = state.initialHeight / 2;
            const centerX = state.initialLayerX + halfW;
            const centerY = state.initialLayerY + halfH;

            let hlx = halfW;
            let hly = halfH;
            if (state.type === 'r' || state.type === 'l') {
                hlx = state.type === 'r' ? state.initialWidth : 0;
                hly = halfH;
            } else if (state.type === 't' || state.type === 'b') {
                hlx = halfW;
                hly = state.type === 'b' ? state.initialHeight : 0;
            } else {
                if (state.type.includes('l')) hlx = 0;
                else if (state.type.includes('r')) hlx = state.initialWidth;
                if (state.type.includes('t')) hly = 0;
                else if (state.type.includes('b')) hly = state.initialHeight;
            }
            const hw_start_x = centerX + (hlx - halfW) * cos - (hly - halfH) * sin;
            const hw_start_y = centerY + (hlx - halfW) * sin + (hly - halfH) * cos;
            const hw_prop_x = hw_start_x + dx;
            const hw_prop_y = hw_start_y + dy;

            const resizeResult = evaluateResizeSnap(
                hw_start_x,
                hw_start_y,
                hw_prop_x,
                hw_prop_y,
                normalizedTargets,
                zoom,
                resizeSnapLockRef.current,
                !!isSnapEnabled
            );

            resizeSnapLockRef.current = resizeResult.newLock;
            const snappedDx = resizeResult.snappedDx;
            const snappedDy = resizeResult.snappedDy;
            currentSnapX = resizeResult.snapX;
            currentSnapY = resizeResult.snapY;
            currentLabelX = resizeResult.labelX;
            currentLabelY = resizeResult.labelY;

            let ldx = snappedDx * cos + snappedDy * sin;
            let ldy = -snappedDx * sin + snappedDy * cos;

            let newWidth = state.initialWidth;
            let newHeight = state.initialHeight;
            let localOffX = 0;
            let localOffY = 0;

            let currentWidth = state.initialWidth;
            let currentHeight = state.initialHeight;

            const isAltActive = propsRef.current.isAltPressed;
            if (state.type.includes('r')) currentWidth = state.initialWidth + (isAltActive ? ldx * 2 : ldx);
            if (state.type.includes('l')) currentWidth = state.initialWidth - (isAltActive ? ldx * 2 : ldx);
            if (state.type.includes('b')) currentHeight = state.initialHeight + (isAltActive ? ldy * 2 : ldy);
            if (state.type.includes('t')) currentHeight = state.initialHeight - (isAltActive ? ldy * 2 : ldy);

            const isShiftActive = propsRef.current.isShiftPressed;
            const isLockActive = propsRef.current.lockAspectRatio;
            const isCorner = ['tl', 'tr', 'bl', 'br'].includes(state.type);

            if (isShiftActive || isLockActive) {
                const ratio = state.initialWidth / state.initialHeight;
                if (isCorner) {
                    const wDiff = Math.abs(currentWidth - state.initialWidth);
                    const hDiff = Math.abs(currentHeight - state.initialHeight);
                    if (wDiff > hDiff) {
                        currentHeight = currentWidth / ratio;
                    } else {
                        currentWidth = currentHeight * ratio;
                    }
                } else {
                    // Edge handles
                    if (state.type === 'l' || state.type === 'r') {
                        currentHeight = currentWidth / ratio;
                    } else if (state.type === 't' || state.type === 'b') {
                        currentWidth = currentHeight * ratio;
                    }
                }
            }

            newWidth = Math.max(10, currentWidth);
            if (isLine) {
                newHeight = state.initialHeight;
            } else {
                newHeight = Math.max(10, currentHeight);
            }

            if (state.type.includes('r')) localOffX = isAltActive ? 0 : (newWidth - state.initialWidth) / 2;
            if (state.type.includes('l')) localOffX = isAltActive ? 0 : -(newWidth - state.initialWidth) / 2;
            if (state.type.includes('b')) localOffY = isAltActive ? 0 : (newHeight - state.initialHeight) / 2;
            if (state.type.includes('t')) localOffY = isAltActive ? 0 : -(newHeight - state.initialHeight) / 2;

            const worldOffX = localOffX * cos - localOffY * sin;
            const worldOffY = localOffX * sin + localOffY * cos;
            const newCenterX = state.initialLayerX + state.initialWidth / 2 + worldOffX;
            const newCenterY = state.initialLayerY + state.initialHeight / 2 + worldOffY;
            let newTopLeftX = newCenterX - (newWidth / 2) * cos + (newHeight / 2) * sin;
            let newTopLeftY = newCenterY - (newWidth / 2) * sin - (newHeight / 2) * cos;

            propsRef.current.onUpdate({ 
                width: newWidth, 
                height: newHeight, 
                x: newTopLeftX, 
                y: newTopLeftY 
            }, false, propsRef.current.isAltPressed);
        }

        const nextSnap = { x: currentSnapX, y: currentSnapY, labelX: currentLabelX, labelY: currentLabelY };
        const prev = lastSnapRef.current;
        const changed =
            prev.x !== nextSnap.x ||
            prev.y !== nextSnap.y ||
            prev.labelX !== nextSnap.labelX ||
            prev.labelY !== nextSnap.labelY;
        if (changed) {
            lastSnapRef.current = nextSnap;
            propsRef.current.onSnap?.(nextSnap);
            setSnapActiveX(currentSnapX);
            setSnapActiveY(currentSnapY);
        }
    }, [normalizedTargets]);

    const startAction = (e: React.MouseEvent, type: string) => {
        if (e.button !== 0) return; // Only left click for transform actions
        e.stopPropagation();
        e.preventDefault();
        
        const container = document.getElementById('workspace-container');
        if (!container) return;

        let clickAngle = 0;
        
        if (type === 'rotate') {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const angle = Math.atan2(e.clientY - cy, e.clientX - cx);
                clickAngle = (angle * 180) / Math.PI;
            }
        }

        const state = {
            type,
            startX: e.clientX,
            startY: e.clientY,
            initialLayerX: propsRef.current.layer.x,
            initialLayerY: propsRef.current.layer.y,
            initialWidth: propsRef.current.layer.width,
            initialHeight: propsRef.current.layer.height,
            initialRotation: propsRef.current.layer.rotation,
            initialScrollX: container.scrollLeft,
            initialScrollY: container.scrollTop,
            clickAngle
        };
        dragStateRef.current = state;

        propsRef.current.onDragStart?.({
            x: state.initialLayerX,
            y: state.initialLayerY,
            rotation: state.initialRotation,
            actionType: type
        });

        setActionState(type);
    };

    useEffect(() => {
        if (!actionState) return;

        const container = document.getElementById('workspace-container');
        if (!container) return;

        const startAutoScroll = (dirX: 'left' | 'right' | null, dirY: 'top' | 'bottom' | null, speedFactor: number) => {
            // Only restart if direction or speed factor changed significantly (prevents stuttering)
            if (activeScrollRef.current?.dirX === dirX && 
                activeScrollRef.current?.dirY === dirY && 
                Math.abs(activeScrollRef.current.factor - speedFactor) < 0.2) return;

            activeScrollRef.current = { dirX, dirY, factor: speedFactor };
            if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
            
            scrollIntervalRef.current = setInterval(() => {
                const container = document.getElementById('workspace-container');
                if (!container || !dragStateRef.current) {
                    stopAutoScroll();
                    return;
                }

                const baseSpeed = 8;
                const actualSpeed = baseSpeed * speedFactor;
                const preLeft = container.scrollLeft;
                const preTop = container.scrollTop;

                if (dirX) container.scrollLeft += dirX === 'right' ? actualSpeed : -actualSpeed;
                if (dirY) container.scrollTop += dirY === 'bottom' ? actualSpeed : -actualSpeed;
                
                if (container.scrollLeft === preLeft && container.scrollTop === preTop && (dirX || dirY)) {
                    stopAutoScroll();
                }

                handleUpdate(mousePosRef.current.x, mousePosRef.current.y, dragStateRef.current, container.scrollLeft, container.scrollTop);
            }, 16);
        };

        const stopAutoScroll = () => {
            activeScrollRef.current = null;
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
            
            // Safety: If mouse button is NOT pressed but we think we are dragging, stop immediately.
            if (e.buttons === 0 && dragStateRef.current) {
                onMouseUp();
                return;
            }

            if (dragStateRef.current) {
                const rect = container.getBoundingClientRect();
                const threshold = 40; 
                
                let dirX: 'left' | 'right' | null = null;
                let dirY: 'top' | 'bottom' | null = null;
                let maxDist = 0;

                // Threshold checks relative to the container, but only if mouse is within it
                if (e.clientX > rect.right - threshold && container.scrollLeft < container.scrollWidth - container.clientWidth) {
                    dirX = 'right';
                    maxDist = Math.max(maxDist, e.clientX - (rect.right - threshold));
                } else if (e.clientX < rect.left + threshold && container.scrollLeft > 0) {
                    dirX = 'left';
                    maxDist = Math.max(maxDist, (rect.left + threshold) - e.clientX);
                }

                if (e.clientY > rect.bottom - threshold && container.scrollTop < container.scrollHeight - container.clientHeight) {
                    dirY = 'bottom';
                    maxDist = Math.max(maxDist, e.clientY - (rect.bottom - threshold));
                } else if (e.clientY < rect.top + threshold && container.scrollTop > 0) {
                    dirY = 'top';
                    maxDist = Math.max(maxDist, (rect.top + threshold) - e.clientY);
                }

                if (dirX || dirY) {
                    const factor = Math.min(4, Math.max(1, maxDist / 10));
                    startAutoScroll(dirX, dirY, factor);
                } else {
                    stopAutoScroll();
                }
                
                handleUpdate(e.clientX, e.clientY, dragStateRef.current, container.scrollLeft, container.scrollTop);
            }
        };

        const onMouseUp = (e?: MouseEvent) => {
            if (e && dragStateRef.current) {
                const dist = Math.hypot(e.clientX - dragStateRef.current.startX, e.clientY - dragStateRef.current.startY);
                // If it was a click (not a drag), try to pass through to elements below
                if (dist < 5 && dragStateRef.current.type === 'move') {
                    const moveHandle = containerRef.current?.querySelector('.cursor-move') as HTMLElement;
                    if (moveHandle) {
                        const originalPointerEvents = moveHandle.style.pointerEvents;
                        moveHandle.style.pointerEvents = 'none';
                        const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
                        moveHandle.style.pointerEvents = originalPointerEvents;

                        if (elementBelow) {
                            // Re-dispatch the event to the element below
                            elementBelow.dispatchEvent(new MouseEvent('mousedown', {
                                bubbles: true,
                                cancelable: true,
                                clientX: e.clientX,
                                clientY: e.clientY,
                                shiftKey: e.shiftKey,
                                altKey: e.altKey,
                                metaKey: e.metaKey,
                                ctrlKey: e.ctrlKey,
                                buttons: e.buttons
                            }));
                            elementBelow.dispatchEvent(new MouseEvent('mouseup', {
                                bubbles: true,
                                cancelable: true,
                                clientX: e.clientX,
                                clientY: e.clientY,
                                shiftKey: e.shiftKey,
                                altKey: e.altKey,
                                metaKey: e.metaKey,
                                ctrlKey: e.ctrlKey,
                                buttons: 0 // released
                            }));
                            elementBelow.dispatchEvent(new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                clientX: e.clientX,
                                clientY: e.clientY,
                                shiftKey: e.shiftKey,
                                altKey: e.altKey,
                                metaKey: e.metaKey,
                                ctrlKey: e.ctrlKey,
                                buttons: e.buttons
                            }));
                        }
                    }
                }
            }

            stopAutoScroll();
            setActionState(null);
            dragStateRef.current = null;
            moveSnapLockRef.current = null;
            resizeSnapLockRef.current = null;
            lastSnapRef.current = { x: null, y: null };
            propsRef.current.onSnap?.({ x: null, y: null });
            propsRef.current.onComplete?.();
            setSnapActiveX(null);
            setSnapActiveY(null);
            ignoreClickRef.current = true;
        };

        const onBlur = () => {
            onMouseUp();
        };

        const onWheel = (e: WheelEvent) => {
            if (dragStateRef.current) {
                // IMPORTANT: prevent browser default during drag wheel to avoid fighting
                e.preventDefault();
                container.scrollLeft += e.deltaX;
                container.scrollTop += e.deltaY;
                handleUpdate(mousePosRef.current.x, mousePosRef.current.y, dragStateRef.current, container.scrollLeft, container.scrollTop);
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onBlur);
        window.addEventListener('wheel', onWheel, { passive: false });
        
        return () => {
            stopAutoScroll();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onBlur);
            window.removeEventListener('wheel', onWheel);
        };
    }, [actionState, handleUpdate]);

    const [isShiftPressed, setIsShiftPressed] = useState(false);
    const [isAltPressed, setIsAltPressed] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftPressed(true);
            if (e.key === 'Alt') setIsAltPressed(true);
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') setIsShiftPressed(false);
            if (e.key === 'Alt') setIsAltPressed(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Parse metadata for layout handling
    const meta = JSON.parse((layer as any).variant || '{}');
    const layout = meta.layoutType || 'none';
    const isLine = (layer as any).type === 'shape' && meta.shapeType === 'line';
    const isAutoHeight = layout === 'autoHeight';
    const showResizeHandles = !disableResize && layout !== 'auto';
    const showHeightHandles = !isAutoHeight && !isLine;

    // Wrapper that counter-scales so transform UI (outline, handles) stays fixed on screen regardless of stage zoom
    const fixedScaleStyle = {
        width: `${zoom * 100}%`,
        height: `${zoom * 100}%`,
        transform: `scale(${1 / zoom})`,
        transformOrigin: '0 0',
    };

    // Calculate rotation handle dimensions dynamically based on zoom
    // By default 48px size / 24px distance, but when zoomed out (e.g. 0.5), it scales down to stay visually proportional.
    // Minimum interactable size is 24px. Maximum bounds is optionally unconstrained but let's cap at 64px.
    const rotSize = Math.max(24, Math.min(64, 48 * zoom));
    const rotOffset = -rotSize / 2;

    return (
        <div 
            ref={containerRef} 
            className="absolute inset-0 pointer-events-none"
            onClickCapture={(e) => {
                if (ignoreClickRef.current) {
                    e.stopPropagation();
                    ignoreClickRef.current = false;
                }
            }}
        >
            {/* Move overlay: full layer hit area, not scaled (so drag works in stage coords) */}
            <div 
                className={`absolute inset-0 z-0 ${isShiftPressed || isSelectionActiveGroup ? 'pointer-events-none' : 'pointer-events-auto'}`}
                style={{ cursor: cursor || 'move' }}
                onMouseDown={(e) => startAction(e, 'move')}
                onMouseMove={(e) => {
                    if (dragStateRef.current) return;
                    const target = e.currentTarget;
                    const originalPointerEvents = target.style.pointerEvents;
                    target.style.pointerEvents = 'none';
                    const hovered = document.elementFromPoint(e.clientX, e.clientY);
                    target.style.pointerEvents = originalPointerEvents;
                    if (hovered) {
                        const layerEl = hovered.closest('[id]');
                        if (layerEl && layerEl.id) {
                            propsRef.current.onHover?.(layerEl.id);
                        } else {
                            propsRef.current.onHover?.(null);
                        }
                    }
                }}
                onMouseLeave={() => propsRef.current.onHover?.(null)}
                onClick={(e) => onClick ? onClick(e) : e.stopPropagation()}
                onDoubleClick={(e) => onDoubleClick?.(e)}
                onContextMenu={(e) => onContextMenu?.(e)}
            />

            {/* Fixed-size transform UI: outline, handles, center dot — zoom'dan etkilenmez. pointer-events-none ki tıklamalar move overlay'e geçsin; sadece tutamaclar pointer-events-auto. */}
            <div
                className="absolute left-0 top-0 pointer-events-none"
                style={fixedScaleStyle}
            >
                <div 
                    className={`absolute inset-0 border-solid pointer-events-none`} 
                    style={{ 
                        boxSizing: 'border-box',
                        borderStyle: 'solid',
                        borderColor: '#0C8CE9',
                        borderWidth: '2px',
                    }} 
                />
                {/* Corner Rotation Handles */}
                {showResizeHandles && (
                    <>
                        <div className="absolute rounded-full pointer-events-auto" style={{ top: rotOffset, left: rotOffset, width: rotSize, height: rotSize, cursor: getRotateCursor('tl', layer.rotation) }} onMouseDown={(e) => startAction(e, 'rotate')} />
                        <div className="absolute rounded-full pointer-events-auto" style={{ top: rotOffset, right: rotOffset, width: rotSize, height: rotSize, cursor: getRotateCursor('tr', layer.rotation) }} onMouseDown={(e) => startAction(e, 'rotate')} />
                        <div className="absolute rounded-full pointer-events-auto" style={{ bottom: rotOffset, left: rotOffset, width: rotSize, height: rotSize, cursor: getRotateCursor('bl', layer.rotation) }} onMouseDown={(e) => startAction(e, 'rotate')} />
                        <div className="absolute rounded-full pointer-events-auto" style={{ bottom: rotOffset, right: rotOffset, width: rotSize, height: rotSize, cursor: getRotateCursor('br', layer.rotation) }} onMouseDown={(e) => startAction(e, 'rotate')} />
                    </>
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-white border-2 border-[#0C8CE9] rounded-full shadow-sm pointer-events-none z-30" />
                {showResizeHandles && (
                    <div className="absolute inset-0 pointer-events-none z-10">
                        {(() => {
                            const sizeClass = zoom <= 0.25 ? 'size-2' : 'size-3.5';
                            const handleStyle = { 
                                borderColor: '#0C8CE9',
                                borderWidth: '2px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            };
                            return (
                                <>
                                    {showHeightHandles && (
                                        <>
                                            <div className="absolute top-0 left-0 w-full h-2 pointer-events-auto" style={{ cursor: getResizeCursor('t', layer.rotation) }} onMouseDown={(e) => startAction(e, 't')} />
                                            <div className="absolute bottom-0 left-0 w-full h-2 pointer-events-auto" style={{ cursor: getResizeCursor('b', layer.rotation) }} onMouseDown={(e) => startAction(e, 'b')} />
                                        </>
                                    )}
                                    <div className="absolute left-0 top-0 h-full w-2 pointer-events-auto" style={{ cursor: getResizeCursor('l', layer.rotation) }} onMouseDown={(e) => startAction(e, 'l')} />
                                    <div className="absolute right-0 top-0 h-full w-2 pointer-events-auto" style={{ cursor: getResizeCursor('r', layer.rotation) }} onMouseDown={(e) => startAction(e, 'r')} />

                                    {showHeightHandles && (
                                        <>
                                            <div className={`absolute top-0 left-0 ${sizeClass} -translate-x-1/2 -translate-y-1/2 bg-white border pointer-events-auto shadow-sm z-20`} style={{ ...handleStyle, cursor: getResizeCursor('tl', layer.rotation) }} onMouseDown={(e) => startAction(e, 'tl')} />
                                            <div className={`absolute top-0 right-0 ${sizeClass} translate-x-1/2 -translate-y-1/2 bg-white border pointer-events-auto shadow-sm z-20`} style={{ ...handleStyle, cursor: getResizeCursor('tr', layer.rotation) }} onMouseDown={(e) => startAction(e, 'tr')} />
                                            <div className={`absolute bottom-0 left-0 ${sizeClass} -translate-x-1/2 translate-y-1/2 bg-white border pointer-events-auto shadow-sm z-20`} style={{ ...handleStyle, cursor: getResizeCursor('bl', layer.rotation) }} onMouseDown={(e) => startAction(e, 'bl')} />
                                            <div className={`absolute bottom-0 right-0 ${sizeClass} translate-x-1/2 translate-y-1/2 bg-white border pointer-events-auto shadow-sm z-20`} style={{ ...handleStyle, cursor: getResizeCursor('br', layer.rotation) }} onMouseDown={(e) => startAction(e, 'br')} />
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransformController;
