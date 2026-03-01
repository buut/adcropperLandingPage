import React, { useState, useEffect, useCallback, useRef } from 'react';
import { snapTime } from '../utils/animations';

interface Segment {
    start: number;
    duration: number;
}

interface TimeLineItemAnimationProps {
    entry: Segment;
    main: Segment;
    exit: Segment;
    entryName?: string;
    mainName?: string;
    exitName?: string;
    onUpdate: (updates: { 
        entry?: Partial<Segment>, 
        main?: Partial<Segment>, 
        exit?: Partial<Segment> 
    }) => void;
    duration: number;
    isSelected?: boolean;
    className?: string;
    zoom?: number;
    onRightClick?: (e: React.MouseEvent, type: 'entry' | 'main' | 'exit') => void;
    onClick?: (e: React.MouseEvent, type: 'entry' | 'main' | 'exit') => void;
    onEmptyRightClick?: (e: React.MouseEvent) => void;
    keyframes?: Array<{ id: string; time: number; props: any }>;
    onUpdateKeyframes?: (keyframes: any[]) => void;
    onUpdateMultipleKeyframes?: (updates: Array<{ id: string, time: number }>) => void;
    onKeyframeClick?: (e: React.MouseEvent, keyframeId: string) => void;
    selectedKeyframeIds?: string[];
    onKeyframeRightClick?: (e: React.MouseEvent, keyframeId: string) => void;
    onEmptyClick?: (e: React.MouseEvent) => void;
    snapTargets?: number[];
    isTransforming?: boolean;
    label?: string;
    labelColor?: string;
}

type DragTarget = 'entry' | 'main' | 'exit';
type DragType = 'move' | 'resize-start' | 'resize-end';

const TimeLineItemAnimation: React.FC<TimeLineItemAnimationProps> = ({
    entry,
    main,
    exit,
    entryName,
    mainName,
    exitName,
    onUpdate,
    duration,
    isSelected,
    className = "",
    zoom = 1,
    onRightClick,
    onClick,
    onEmptyRightClick,
    onEmptyClick,
    keyframes = [],
    onUpdateKeyframes,
    onUpdateMultipleKeyframes,
    onKeyframeClick,
    selectedKeyframeIds = [],
    onKeyframeRightClick,
    snapTargets = [],
    isTransforming = false,
    label,
    labelColor = "text-primary/40"
}) => {
    const [dragState, setDragState] = useState<{
        target: DragTarget;
        type: DragType;
        startX: number;
        startY: number;
        container: HTMLElement;
        initialScrollLeft: number;
        initialScrollTop: number;
        initialEntry: Segment;
        initialMain: Segment;
        initialExit: Segment;
        hasMoved: boolean;
    } | null>(null);

    // Persist refs to latest values to avoid re-triggering effects
    const onUpdateRef = useRef(onUpdate);
    const mousePosRef = useRef({ x: 0, y: 0 });
    const clickPreventedRef = useRef(false);
    const scrollIntervalRef = useRef<any>(null);

    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    const handleMouseDown = (e: React.MouseEvent, target: DragTarget, type: DragType) => {
        e.stopPropagation();
        const container = (e.currentTarget as HTMLElement).closest('.timeline-scroll-container') as HTMLElement;
        if (!container) {
            console.error('Could not find .timeline-scroll-container');
            return;
        }

        mousePosRef.current = { x: e.clientX, y: e.clientY };
        
        setDragState({
            target,
            type,
            startX: e.clientX,
            startY: e.clientY,
            container,
            initialScrollLeft: container.scrollLeft,
            initialScrollTop: container.scrollTop,
            initialEntry: { ...entry },
            initialMain: { ...main },
            initialExit: { ...exit },
            hasMoved: false
        });
    };

    const handleUpdate = useCallback((clientX: number, currentScrollLeft: number, state: any) => {
        if (!state) return;
        
        const deltaX = (clientX - state.startX) + (currentScrollLeft - state.initialScrollLeft);
        // Correct delta for zoom level to maintain base-unit precision
        const scaledDelta = deltaX / zoom;
        
        const { target, type, initialEntry, initialMain, initialExit } = state;
        const maxTime = duration * 100;
        
        const updates: any = {};

        if (target === 'entry') {
            const current = { ...initialEntry };
            if (type === 'move') {
                const rawStart = initialEntry.start + scaledDelta;
                current.start = snapTime(rawStart, zoom, duration, snapTargets);
                
                if (current.start + current.duration > initialMain.start) {
                    current.start = initialMain.start - current.duration;
                }
            } else if (type === 'resize-start') {
                const rawStart = initialEntry.start + scaledDelta;
                const newStart = snapTime(rawStart, zoom, duration, snapTargets);
                const newDuration = (initialEntry.start + initialEntry.duration) - newStart;
                if (newDuration >= 10) {
                    current.start = newStart;
                    current.duration = newDuration;
                }
            } else if (type === 'resize-end') {
                const rawEnd = initialEntry.start + initialEntry.duration + scaledDelta;
                const newEnd = snapTime(rawEnd, zoom, duration, snapTargets);
                current.duration = Math.max(10, newEnd - current.start);
                
                if (current.start + current.duration > initialMain.start) {
                    current.duration = initialMain.start - current.start;
                }
            }
            updates.entry = current;
        } else if (target === 'main') {
            const current = { ...initialMain };
            if (type === 'move') {
                const rawStart = initialMain.start + scaledDelta;
                current.start = snapTime(rawStart, zoom, duration, snapTargets);

                const minStart = initialEntry.start + initialEntry.duration;
                const maxEnd = initialExit.start;
                
                if (current.start < minStart) {
                    current.start = minStart;
                }
                if (current.start + current.duration > maxEnd) {
                    current.start = maxEnd - current.duration;
                }
            } else if (type === 'resize-start') {
                const rawStart = initialMain.start + scaledDelta;
                const newStart = snapTime(rawStart, zoom, duration, snapTargets);
                
                const minStart = initialEntry.start + initialEntry.duration;
                if (newStart >= minStart) {
                    const newDuration = (initialMain.start + initialMain.duration) - newStart;
                    if (newDuration >= 10) {
                        current.start = newStart;
                        current.duration = newDuration;
                    }
                } else {
                    current.start = minStart;
                    current.duration = (initialMain.start + initialMain.duration) - minStart;
                }
            } else if (type === 'resize-end') {
                const rawEnd = initialMain.start + initialMain.duration + scaledDelta;
                const newEnd = snapTime(rawEnd, zoom, duration, snapTargets);
                current.duration = Math.max(10, newEnd - current.start);
                
                const maxEnd = initialExit.start;
                if (current.start + current.duration > maxEnd) {
                    current.duration = maxEnd - current.start;
                }
            }
            updates.main = current;
        } else if (target === 'exit') {
            const current = { ...initialExit };
            if (type === 'move') {
                const rawStart = initialExit.start + scaledDelta;
                current.start = snapTime(rawStart, zoom, duration, snapTargets);

                const minStart = initialMain.start + initialMain.duration;
                if (current.start < minStart) {
                    current.start = minStart;
                }
                if (current.start + current.duration > maxTime) {
                    current.start = maxTime - current.duration;
                }
            } else if (type === 'resize-start') {
                const rawStart = initialExit.start + scaledDelta;
                const newStart = snapTime(rawStart, zoom, duration, snapTargets);
                
                const minStart = initialMain.start + initialMain.duration;
                if (newStart >= minStart) {
                    const newDuration = (initialExit.start + initialExit.duration) - newStart;
                    if (newDuration >= 10) {
                        current.start = newStart;
                        current.duration = newDuration;
                    }
                } else {
                    current.start = minStart;
                    current.duration = (initialExit.start + initialExit.duration) - minStart;
                }
            } else if (type === 'resize-end') {
                const rawEnd = initialExit.start + initialExit.duration + scaledDelta;
                const newEnd = snapTime(rawEnd, zoom, duration, snapTargets);
                current.duration = Math.max(10, newEnd - current.start);
                
                if (current.start + current.duration > maxTime) {
                    current.duration = maxTime - current.start;
                }
            }
            updates.exit = current;
        }

        if (Object.keys(updates).length > 0) {
            onUpdateRef.current(updates);
        }
    }, [duration, zoom]);

    useEffect(() => {
        if (!dragState) return;

        const startAutoScroll = (dirX: 'left' | 'right' | null, dirY: 'top' | 'bottom' | null, speedFactor: number) => {
            if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
            
            const { container } = dragState;

            scrollIntervalRef.current = setInterval(() => {
                const baseSpeed = 10;
                const actualSpeed = baseSpeed * speedFactor;

                if (dirX) {
                    container.scrollLeft += dirX === 'right' ? actualSpeed : -actualSpeed;
                }
                if (dirY) {
                    container.scrollTop += dirY === 'bottom' ? actualSpeed : -actualSpeed;
                }
                
                handleUpdate(mousePosRef.current.x, container.scrollLeft, dragState);
            }, 16);
        };

        const stopAutoScroll = () => {
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
        };

        const onMouseMove = (e: MouseEvent) => {
            mousePosRef.current = { x: e.clientX, y: e.clientY };
            const { container } = dragState;
            if (container) {
                const rect = container.getBoundingClientRect();
                const threshold = 50;
                
                let dirX: 'left' | 'right' | null = null;
                let dirY: 'top' | 'bottom' | null = null;
                let maxDist = 0;

                if (e.clientX > rect.right - threshold) {
                    dirX = 'right';
                    maxDist = Math.max(maxDist, e.clientX - (rect.right - threshold));
                } else if (e.clientX < rect.left + threshold) {
                    dirX = 'left';
                    maxDist = Math.max(maxDist, (rect.left + threshold) - e.clientX);
                }

                if (e.clientY > rect.bottom - threshold) {
                    dirY = 'bottom';
                    maxDist = Math.max(maxDist, e.clientY - (rect.bottom - threshold));
                } else if (e.clientY < rect.top + threshold) {
                    dirY = 'top';
                    maxDist = Math.max(maxDist, (rect.top + threshold) - e.clientY);
                }

                if (dirX || dirY) {
                    const speedFactor = Math.min(3, Math.max(1, maxDist / 10));
                    startAutoScroll(dirX, dirY, speedFactor);
                } else {
                    stopAutoScroll();
                }
                
                const dist = Math.sqrt(Math.pow(e.clientX - dragState.startX, 2) + Math.pow(e.clientY - dragState.startY, 2));
                if (!dragState.hasMoved && dist > 3) {
                    setDragState(prev => prev ? { ...prev, hasMoved: true } : null);
                }
                
                handleUpdate(e.clientX, container.scrollLeft, dragState);
            }
        };

        const onMouseUp = (e: MouseEvent) => {
            if (dragState.hasMoved) {
                clickPreventedRef.current = true;
                setTimeout(() => {
                    clickPreventedRef.current = false;
                }, 100);
            }
            stopAutoScroll();
            setDragState(null);
        };

        const onWheel = (e: WheelEvent) => {
            const { container } = dragState;
            if (container) {
                e.preventDefault();
                container.scrollLeft += e.deltaX;
                container.scrollTop += e.deltaY;
                handleUpdate(mousePosRef.current.x, container.scrollLeft, dragState);
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('wheel', onWheel, { passive: false });

        return () => {
            stopAutoScroll();
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('wheel', onWheel);
        };
    }, [dragState, duration, handleUpdate, onClick]);

    return (
        <div 
            className={`h-8 relative flex items-center group transition-colors ${isSelected ? 'bg-primary/5' : ''} ${className}`}
            data-timeline-track="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onEmptyClick?.(e);
                }
            }}
            onContextMenu={(e) => {
                if (e.target === e.currentTarget) {
                    onEmptyRightClick?.(e);
                }
            }}
        >
            <div className="absolute inset-0 pointer-events-none border-b border-gray-100/50"></div>
            {label && (
                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-40 z-0`}>
                    <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${labelColor}`}>{label}</span>
                </div>
            )}
            
            {/* IN Segment */}
            {entry.duration > 0 && (
                <div 
                    className="absolute h-6 bg-blue-500/20 border border-blue-500/30 rounded-md flex items-center justify-center overflow-hidden cursor-move z-[40] anim-segment"
                    style={{ left: `${entry.start * zoom}px`, width: `${entry.duration * zoom}px` }}
                    onMouseDown={(e) => handleMouseDown(e, 'entry', 'move')}
                    onClick={(e) => {
                        if (clickPreventedRef.current) return;
                        e.stopPropagation();
                        onClick?.(e, 'entry');
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        onRightClick?.(e, 'entry');
                    }}
                >
                    <div 
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-500/40 z-10" 
                        onMouseDown={(e) => handleMouseDown(e, 'entry', 'resize-start')} 
                    />
                    <div 
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-blue-500/40 z-10" 
                        onMouseDown={(e) => handleMouseDown(e, 'entry', 'resize-end')} 
                    />
                    <span className="text-[7px] font-black text-blue-700/80 uppercase select-none pointer-events-none whitespace-nowrap px-1 flex items-center gap-0.5 relative z-0">
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>login</span>
                        {entryName?.replace(/-/g, ' ') || 'In'}
                    </span>
                </div>
            )}

            {/* MAIN Segment */}
            {main.duration > 0 && (
                <div 
                    className="absolute h-6 bg-primary/20 border border-primary/30 rounded-md flex items-center justify-center overflow-hidden cursor-move z-[40] anim-segment"
                    style={{ left: `${main.start * zoom}px`, width: `${main.duration * zoom}px` }}
                    onMouseDown={(e) => handleMouseDown(e, 'main', 'move')}
                    onClick={(e) => {
                        if (clickPreventedRef.current) return;
                        e.stopPropagation();
                        onClick?.(e, 'main');
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        onRightClick?.(e, 'main');
                    }}
                >
                    <div 
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/40 z-10" 
                        onMouseDown={(e) => handleMouseDown(e, 'main', 'resize-start')} 
                    />
                    <div 
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/40 z-10" 
                        onMouseDown={(e) => handleMouseDown(e, 'main', 'resize-end')} 
                    />
                    <span className="text-[7px] font-black text-primary uppercase select-none pointer-events-none whitespace-nowrap px-1 flex items-center gap-0.5 relative z-0">
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>sync</span>
                        {mainName?.replace(/-/g, ' ') || 'Main'}
                    </span>
                </div>
            )}

            {/* OUT Segment */}
            {exit.duration > 0 && (
                <div 
                    className="absolute h-6 bg-orange-500/20 border border-orange-500/30 rounded-md flex items-center justify-center overflow-hidden cursor-move z-[40] anim-segment"
                    style={{ left: `${exit.start * zoom}px`, width: `${exit.duration * zoom}px` }}
                    onMouseDown={(e) => handleMouseDown(e, 'exit', 'move')}
                    onClick={(e) => {
                        if (clickPreventedRef.current) return;
                        e.stopPropagation();
                        onClick?.(e, 'exit');
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        onRightClick?.(e, 'exit');
                    }}
                >
                    <div 
                        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-orange-500/40 z-10" 
                        onMouseDown={(e) => handleMouseDown(e, 'exit', 'resize-start')} 
                    />
                    <div 
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-orange-500/40 z-10" 
                        onMouseDown={(e) => handleMouseDown(e, 'exit', 'resize-end')} 
                    />
                    <span className="text-[7px] font-black text-orange-700/80 uppercase select-none pointer-events-none whitespace-nowrap px-1 flex items-center gap-0.5 relative z-0">
                        <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>logout</span>
                        {exitName?.replace(/-/g, ' ') || 'Out'}
                    </span>
                </div>
            )}

            {/* Keyframes */}
            {keyframes.map((kf) => (
                <div 
                    key={kf.id}
                    className={`absolute top-0 bottom-0 flex items-center justify-center z-[60] keyframe-wrapper ${
                        isTransforming && selectedKeyframeIds.includes(kf.id) ? 'pointer-events-none' : ''
                    }`}
                    style={{ left: `${kf.time * zoom - 10}px`, width: '20px' }}
                    onMouseDown={(e) => {
                        if (isTransforming && selectedKeyframeIds.includes(kf.id)) return;
                        e.stopPropagation();
                        // Drag logic for keyframes
                        const startX = e.clientX;
                        const startTime = kf.time;
                        const isThisSelected = selectedKeyframeIds.includes(kf.id);
                        
                        // If selected, we might move all selected kfs
                        const selectedKfsToMove = isThisSelected ? keyframes.filter(k => selectedKeyframeIds.includes(k.id)) : [kf];
                        const startTimes = selectedKfsToMove.map(k => ({ id: k.id, time: k.time }));

                        const handleMouseMove = (em: MouseEvent) => {
                            const dx = (em.clientX - startX) / zoom;
                            
                            if (isThisSelected && onUpdateMultipleKeyframes) {
                                const nextUpdates = startTimes.map(st => {
                                    const rawTime = st.time + dx;
                                    const snapped = snapTime(rawTime, zoom, duration, snapTargets);
                                    return {
                                        id: st.id,
                                        time: snapped
                                    };
                                });
                                onUpdateMultipleKeyframes(nextUpdates);
                            } else {
                                const rawTime = startTime + dx;
                                const nextTime = snapTime(rawTime, zoom, duration, snapTargets);
                                const nextKfs = keyframes.map(k => k.id === kf.id ? { ...k, time: nextTime } : k);
                                onUpdateKeyframes?.(nextKfs.sort((a, b) => a.time - b.time));
                            }
                        };
                        
                        const handleMouseUp = () => {
                            window.removeEventListener('mousemove', handleMouseMove);
                            window.removeEventListener('mouseup', handleMouseUp);
                        };
                        
                        window.addEventListener('mousemove', handleMouseMove);
                        window.addEventListener('mouseup', handleMouseUp);

                        if (onKeyframeClick) onKeyframeClick(e, kf.id);
                    }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onKeyframeRightClick?.(e, kf.id);
                    }}
                >
                    <div 
                        className={`size-3 bg-white border-2 rotate-45 hover:scale-125 shadow-sm flex items-center justify-center ${selectedKeyframeIds.includes(kf.id) ? 'border-primary ring-2 ring-primary/30' : 'border-gray-400 opacity-80'}`}
                        title={`Keyframe at ${(kf.time/100).toFixed(2)}s`}
                    >
                        <div className={`size-1 rounded-full ${selectedKeyframeIds.includes(kf.id) ? 'bg-primary' : 'bg-gray-400'}`} />
                    </div>
                </div>
            ))}
        </div>
    );
};

export default React.memo(TimeLineItemAnimation);
