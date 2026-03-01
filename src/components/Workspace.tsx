import React, { useRef } from 'react';
import StageContainer from './StageContainer';
import TransformController from './TransformController';
import GradientHandlesOverlay from './GradientHandlesOverlay';
import ContextMenu from './ContextMenu';
import { Stage, FontData, GuideLine, ChatMessage } from '../App';
import LayerPreview from './LayerPreview';
import { getInterpolatedLayerStyles, project3d, parseOrigin } from '../utils/animations';
import { collectDescendantScaleUpdates, calculateLayerScaleUpdates } from '../utils/groupScaling';
import { createTransformSnapshot, applyTransformUpdate, type TransformSnapshot } from '../utils/transformSystem';
import Ruler from './Ruler';

interface WorkspaceProps {
    stages: Stage[];
    onUpdateStagePosition?: (stageId: string, x: number, y: number) => void;
    selectedStageId: string | null;
    onStageSelect: (id: string | null) => void;
    onAddLayer: (stageId: string, layer: { type: 'image' | 'widget' | 'group' | 'button' | 'text' | 'shape'; url?: string; x: number; y: number; width: number; height: number; rotation: number, name?: string, variant?: string }, prefix?: string) => string;
    onDropOnWorkspace: (source: string | File, assetType: string, meta?: any, x?: number, y?: number, targetStageId?: string) => void;
    selectedLayerIds: string[];
    onLayersSelect: (ids: string[] | ((prev: string[]) => string[])) => void;
    onUpdateLayers: (layerIds: string[], updates: any, isBatch?: boolean, targetLayerId?: string) => void;
    onBatchUpdateLayers: (updates: Array<{ id: string; changes: any }>) => void;
    onGroup: (stageId: string, layerIds: string[]) => void;
    onUngroup: (stageId: string, layerIds: string[], measuredPositions?: Record<string, { x: number, y: number }>) => void;
    activeGroupId: string | null;
    onActiveGroupChange: (id: string | null) => void;
    breadcrumbs: Array<{ id: string, name: string }>;
    isSnapEnabled: boolean;
    onLayerClick: (layerId: string, stageId: string, isDoubleClick: boolean, isShift: boolean) => void;
    zoom: number;
    onZoomChange: (zoom: number | ((prev: number) => number)) => void;
    onDelete?: () => void;
    onDuplicateStage?: (id: string) => void;
    currentTime?: number;
    playbackStates?: Record<string, { isPlaying: boolean, currentTime: number, loopsDone: number }>;
    isPreviewMode?: boolean;
    activeSidebarTab?: string | null;
    onToolCompleted?: () => void;
    editingLayerIds?: Record<string, string | null>;
    onStopEditing?: (stageId?: string) => void;
    previewState?: 'default' | 'hover' | 'active';
    actionStates?: Record<string, boolean>;
    onTriggerAction?: (actionId: string, isActive: boolean) => void;
    onCopyLayer?: (layerId: string) => void;
    onPasteLayer?: (stageId: string, x?: number, y?: number) => void;
    hasLayerClipboard?: boolean;
    hoveredLayerId?: string | null;
    // Collaboration
    collaboratorCursors?: Record<string, { x: number, y: number, color: string, name: string, activeMessage?: string }>;

    onContentMouseMove?: (x: number, y: number) => void;
    followedUserId?: string | null;
    fonts?: FontData[];
    // GuideLines (State is now per-stage, passed within 'stages')
    onAddGuideLine?: (stageId: string, guide: Omit<GuideLine, 'id'>) => void;
    onUpdateGuideLine?: (stageId: string, guideId: string, position: number) => void;
    onDeleteGuideLine?: (stageId: string, guideId: string) => void;
    pushToHistory?: () => void;
    onStartEditing?: (stageId: string, layerId: string) => void;
    onHoverLayer?: (id: string | null) => void;
    onDuplicateLayers?: (stageId: string, layerIds: string[], offset: { x: number, y: number }, updateSelection: boolean) => void;
    // Chat
    chatMessages?: ChatMessage[];
    chatInput?: { x: number, y: number } | null;
    onCloseChatInput?: () => void;
    onSendChatMessage?: (text: string) => void;
    onOpenChatInput?: (x: number, y: number) => void;
    onCreateButtonAsset?: (layerId: string) => void;
    onArrangeStages?: () => void;
    isLayerRatioLocked?: boolean;
    onUpdateStageName?: (stageId: string, name: string) => void;
    lastUsedTextStyles?: { 
        fontFamily: string, 
        fontSize: string, 
        fontWeight: string, 
        textColor: string,
        letterSpacing?: string,
        textTransform?: string,
        textAlign?: string,
        verticalAlign?: string,
        layoutType?: string,
        bgType?: string,
        lineHeight?: string
    };
}



export interface WorkspaceHandle {
    fitAllStages: () => void;
    fitStage: (stageId: string) => void;
}

const Workspace = React.forwardRef<WorkspaceHandle, WorkspaceProps>(({
    stages,
    selectedStageId,
    onStageSelect,
    onAddLayer,
    onDropOnWorkspace,
    selectedLayerIds,
    onLayersSelect,
    onUpdateLayers,
    onBatchUpdateLayers,
    onGroup,
    onUngroup,
    activeGroupId,
    onActiveGroupChange,
    breadcrumbs,
    isSnapEnabled,
    onLayerClick,
    zoom,
    onZoomChange,
    onDelete,
    onDuplicateStage,
    onUpdateStagePosition,
    currentTime: globalCurrentTime,
    playbackStates = {},
    isPreviewMode = false,
    activeSidebarTab = null,
    onToolCompleted,
    editingLayerIds = {},
    onStopEditing,
    onStartEditing,
    previewState = 'default',
    actionStates = {},
    onTriggerAction,
    onDuplicateLayers,
    onCopyLayer,
    onPasteLayer,
    hasLayerClipboard,
    hoveredLayerId,
    collaboratorCursors = {},
    onContentMouseMove,
    followedUserId,
    fonts = [],
    onAddGuideLine,
    onUpdateGuideLine,
    onDeleteGuideLine,
    pushToHistory,
    onHoverLayer,
    chatMessages = [],
    chatInput = null,
    onCloseChatInput,
    onSendChatMessage,
    onOpenChatInput,
    onCreateButtonAsset,
    onArrangeStages,
    onUpdateStageName,
    lastUsedTextStyles
}, ref) => {

    const [draggingGuide, setDraggingGuide] = React.useState<{ id: string | 'new', type: 'horizontal' | 'vertical', startPos: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<HTMLDivElement>(null);


    const [marquee, setMarquee] = React.useState<{ startX: number, startY: number, endX: number, endY: number, active: boolean } | null>(null);
    const [selectionRotation, setSelectionRotation] = React.useState(0);
    const [isTransforming, setIsTransforming] = React.useState(false);
    const chatInputPopupRef = React.useRef<HTMLDivElement>(null);
    const [snapGuides, setSnapGuides] = React.useState<{ x: number | null, y: number | null, labelX?: string, labelY?: string }>({ x: null, y: null });
    const isDraggingRef = React.useRef(false);
    const cachedSnapTargetsRef = React.useRef<Array<{ x?: number; y?: number; label?: string }>>([]);
    const [measuredOrigins, setMeasuredOrigins] = React.useState<{ x: number, y: number } | null>(null);
    const [scrollPos, setScrollPos] = React.useState({ x: 0, y: 0 });
    const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 });
    const [contextMenu, setContextMenu] = React.useState<{ x: number, y: number } | null>(null);
    /** Figma-style: tek snapshot pointer-down'da; tüm transform bu snapshot üzerinden. */
    const transformSnapshotRef = React.useRef<TransformSnapshot | null>(null);
    /** Mouse up'a kadar hangi işlemle başladıysak sadece onu uygula (move / scale / rotate). */
    const dragActionTypeRef = React.useRef<string | null>(null);
    /** Grup içi kaymayı önlemek: mousedown sonrası ilk onUpdate'te hiç güncelleme uygulama. */
    const skipFirstTransformUpdateRef = React.useRef(false);
    const hasDuplicatedDuringDragRef = React.useRef(false);
    const [isFittingAll, setIsFittingAll] = React.useState(false);
    const [needsArrangeBeforeFit, setNeedsArrangeBeforeFit] = React.useState(false);
    const [guideLineContextMenu, setGuideLineContextMenu] = React.useState<{ x: number, y: number, id: string } | null>(null);
    /** Auto layout grubu içindeki tek seçili nesne için DOM'dan ölçülen bounds (transform kutusunun nesnenin üstünde görünmesi) */
    const [measuredBoundsForAutoLayout, setMeasuredBoundsForAutoLayout] = React.useState<{
        stageId: string;
        layerId: string;
        bounds: { x: number; y: number; width: number; height: number; rotation: number; type?: string; variant?: string };
    } | null>(null);
    /** Hover (preview) karesi için auto layout child DOM ölçümü – preview karesi nesnenin üstünde görünsün */
    const [measuredBoundsForHoveredAutoLayout, setMeasuredBoundsForHoveredAutoLayout] = React.useState<{
        stageId: string;
        layerId: string;
        bounds: { x: number; y: number; width: number; height: number; rotation: number };
    } | null>(null);

    React.useEffect(() => {
        if (isDraggingRef.current) return;
        transformSnapshotRef.current = null;
        skipFirstTransformUpdateRef.current = false;
        dragActionTypeRef.current = null;
        setMeasuredBoundsForAutoLayout(null);
        setMeasuredBoundsForHoveredAutoLayout(null);
    }, [selectedLayerIds, selectedStageId]);

    const documentColors = React.useMemo(() => {

        const colors = new Set<string>();
        const processColor = (val: any) => {
            if (typeof val === 'string' && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(val)) {
                colors.add(val.toUpperCase());
            }
        };

        stages.forEach(s => {
            processColor(s.backgroundColor);
            processColor(s.backgroundColor2);

            const extract = (layers: any[]) => {
                layers.forEach(l => {
                    if (l.variant) {
                        try {
                            const meta = JSON.parse(l.variant);
                            Object.values(meta).forEach(val => {
                                processColor(val);
                                if (Array.isArray(val)) val.forEach(v => {
                                    if (v.color) processColor(v.color);
                                    if (v.color2) processColor(v.color2);
                                });
                            });
                        } catch { }
                    }
                    if (l.children) extract(l.children);
                });
            };
            extract(s.layers);
        });

        return Array.from(colors).sort();
    }, [stages]);

    const [isSpacePressed, setIsSpacePressed] = React.useState(false);
    const [isZPressed, setIsZPressed] = React.useState(false);
    const [isAltPressed, setIsAltPressed] = React.useState(false);
    const [isPanning, setIsPanning] = React.useState(false);
    const lastMousePos = React.useRef({ x: 0, y: 0 });
    const zoomPivotRef = React.useRef<{ contentX: number, contentY: number, mouseX: number, mouseY: number } | null>(null);
    const ignoreClickRef = useRef(false);
    const lastFocusedIdRef = useRef<string | null>(null);
    const lastFocusedStageIdRef = useRef<string | null>(null);
    const prevZoomRef = React.useRef(zoom);
    const stagesRef = React.useRef(stages);
    const manualDragStartMouseRef = React.useRef<{ x: number, y: number } | null>(null);
    const manualDragStageIdRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        stagesRef.current = stages;
    }, [stages]);

    // Synchronize scroll after zoom change to prevent jumping/jitter
    React.useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        if (zoomPivotRef.current) {
            const { contentX, contentY, mouseX, mouseY } = zoomPivotRef.current;
            container.scrollLeft = contentX * zoom - mouseX;
            container.scrollTop = contentY * zoom - mouseY;
            zoomPivotRef.current = null;
        } else if (prevZoomRef.current !== zoom) {
            // If zoom changed via UI (e.g. Navbar), zoom relative to viewport center
            const vCenterX = container.clientWidth / 2;
            const vCenterY = container.clientHeight / 2;
            const contentX = (container.scrollLeft + vCenterX) / prevZoomRef.current;
            const contentY = (container.scrollTop + vCenterY) / prevZoomRef.current;

            container.scrollLeft = contentX * zoom - vCenterX;
            container.scrollTop = contentY * zoom - vCenterY;
        }

        prevZoomRef.current = zoom;
    }, [zoom]);

    // Track keys for panning, zooming, and nudging
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)) {
                if (e.code === 'Space') {
                    if (!isSpacePressed) setIsSpacePressed(true);
                    // Always prevent default for Space in workspace to avoid page scrolling,
                    // as long as we're not in an input/editable.
                    e.preventDefault();
                }
                if (e.code === 'KeyZ') {
                    if (!isZPressed) setIsZPressed(true);
                }
                if (e.altKey || e.code === 'AltLeft' || e.code === 'AltRight') {
                    if (!isAltPressed) setIsAltPressed(true);
                }

                // Keyboard Nudges
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && selectedLayerIds.length > 0 && selectedStageId) {
                    // Check if any layer is being explicitly edited (text editing mode)
                    if (Object.values(editingLayerIds).some(id => id !== null)) return;

                    e.preventDefault();
                    const amount = e.shiftKey ? 10 : 1;
                    let dx = 0, dy = 0;
                    if (e.code === 'ArrowUp') dy = -amount;
                    if (e.code === 'ArrowDown') dy = amount;
                    if (e.code === 'ArrowLeft') dx = -amount;
                    if (e.code === 'ArrowRight') dx = amount;

                    const stage = stages.find(s => s.id === selectedStageId);
                    if (stage) {
                        const updates = selectedLayerIds.map(id => {
                            const l = findLayerInTree(stage.layers, id);
                            if (l) {
                                return {
                                    id,
                                    changes: {
                                        x: (l.x ?? 0) + dx,
                                        y: (l.y ?? 0) + dy
                                    }
                                };
                            }
                            return null;
                        }).filter(Boolean) as Array<{ id: string, changes: any }>;

                        if (updates.length > 0) {
                            pushToHistory?.();
                            onBatchUpdateLayers(updates);
                        }
                    }
                }
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsSpacePressed(false);
                setIsPanning(false);
            }
            if (e.code === 'KeyZ') {
                setIsZPressed(false);
            }
            if (e.code === 'AltLeft' || e.code === 'AltRight') {
                setIsAltPressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isSpacePressed, isZPressed, isAltPressed, selectedLayerIds, selectedStageId, stages, editingLayerIds, onBatchUpdateLayers, pushToHistory]);

    const centerStage = React.useCallback((stageId: string, smooth = true) => {
        const perform = () => {
            const container = containerRef.current;
            if (!container) return false;

            const el = document.getElementById(stageId);
            if (el) {
                const elRect = el.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();

                const scrollX = container.scrollLeft + (elRect.left + elRect.width / 2) - (containerRect.left + containerRect.width / 2);
                const scrollY = container.scrollTop + (elRect.top + elRect.height / 2) - (containerRect.top + containerRect.height / 2);

                container.scrollTo({
                    left: scrollX,
                    top: scrollY,
                    behavior: smooth ? 'smooth' : 'auto'
                });
                return true;
            }
            return false;
        };

        if (!perform()) {
            // Retry after a short delay if stage element not found yet
            setTimeout(perform, 150);
        }
    }, []);

    const fitStage = React.useCallback((stageId: string) => {
        const container = containerRef.current;
        if (!container) return;

        const stage = stages.find(s => s.id === stageId);
        if (!stage) return;

        // Calculate auto-fit zoom based on stage dimensions
        const padding = 120; // Margin around the stage
        const availableW = container.clientWidth - padding;
        const availableH = container.clientHeight - padding;

        const zoomX = availableW / stage.width;
        const zoomY = availableH / (stage.height + 40); // 40 for header

        // We cap at 1.0 (100%) so we don't over-zoom small stages, 
        // and floor at 0.1 (10%) to keep it sane.
        const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 1);

        onZoomChange(newZoom);

        // Wait for the scale transform to apply to DOM before centering
        setTimeout(() => {
            centerStage(stageId, false); // Instant center after zoom
        }, 100);
    }, [stages, onZoomChange, centerStage]);

    const fitAllStages = React.useCallback(() => {
        setNeedsArrangeBeforeFit(true);
    }, []);

    // Effect to handle the sequence: Delay -> Arrange -> Fit
    React.useEffect(() => {
        if (!needsArrangeBeforeFit) return;

        const timer = setTimeout(() => {
            if (onArrangeStages) {
                onArrangeStages();
            }
            setIsFittingAll(true);
            setNeedsArrangeBeforeFit(false);
        }, 100);

        return () => clearTimeout(timer);
    }, [needsArrangeBeforeFit, onArrangeStages]);

    // Same effect as before to perform the actual "Fit" calculation once stages update
    React.useEffect(() => {
        if (!isFittingAll) return;
        
        const container = containerRef.current;
        if (!container) {
            setIsFittingAll(false);
            return;
        }

        const visibleStages = stages.filter(s => s.visible !== false);
        if (visibleStages.length === 0) {
            setIsFittingAll(false);
            return;
        }

        // Calculate bounding box of all stages in unscaled content coordinates
        let minX = Infinity, minY = Infinity, maxY = -Infinity, maxX = -Infinity;
        visibleStages.forEach(s => {
            minX = Math.min(minX, s.x);
            minY = Math.min(minY, s.y);
            maxX = Math.max(maxX, s.x + s.width);
            maxY = Math.max(maxY, s.y + s.height + 40); // 40 for stage header
        });

        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const padding = 120;
        const availableW = container.clientWidth - padding;
        const availableH = container.clientHeight - padding;

        const zoomX = availableW / contentW;
        const zoomY = availableH / contentH;

        const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.1), 1);
        onZoomChange(newZoom);

        // Reset flag and finalize centering after zoom applies
        const timer = setTimeout(() => {
            const centerX = (minX + maxX) / 2 + 1000;
            const centerY = (minY + maxY) / 2 + 1000;

            const scrollX = centerX * newZoom - container.clientWidth / 2;
            const scrollY = centerY * newZoom - container.clientHeight / 2;

            container.scrollTo({
                left: scrollX,
                top: scrollY,
                behavior: 'smooth'
            });
            setIsFittingAll(false);
        }, 100);

        return () => clearTimeout(timer);
    }, [isFittingAll, stages, onZoomChange]);

    React.useImperativeHandle(ref, () => ({
        fitAllStages,
        fitStage
    }));

    const hasInitialScrolledRef = useRef(false);

    // Measure actual DOM position for accurate ruler origin
    React.useEffect(() => {
        if (!selectedStageId) {
            setMeasuredOrigins(null);
            return;
        }

        const measure = () => {
            const container = containerRef.current;
            const stageEl = document.getElementById(selectedStageId); // This is the inner content div

            if (container && stageEl) {
                const cRect = container.getBoundingClientRect();
                const sRect = stageEl.getBoundingClientRect();

                // Calculate where the top-left of the stage content is relative to the scrolled container content
                // sRect is visual (scaled). cRect is visual.
                // relative visual pos = sRect.x - cRect.x + container.scrollLeft
                // unzoomed pos = (relative visual pos) / zoom

                const visualX = sRect.left - cRect.left + container.scrollLeft;
                const visualY = sRect.top - cRect.top + container.scrollTop;

                // Adjust for the Ruler component's local coordinate system which starts at 24px (left-6/top-6)
                // The Ruler calculates value as (x + scrollPos)/zoom - origin.
                // But x is relative to the ruler canvas, which is offset by 24px from the container.
                // visualX is relative to the container.
                // So Ruler X = visualX - 24.
                // We want Value = 0 at the stage.
                // 0 = (visualX - 24)/zoom - origin => origin = (visualX - 24)/zoom.

                const originX = (visualX - 24) / zoom;
                const originY = (visualY - 24) / zoom;

                setMeasuredOrigins({ x: originX, y: originY });
            }
        };

        // Measure immediately and after a short delay to allow for layout shifts
        measure();
        const t = setTimeout(measure, 100);
        return () => clearTimeout(t);
    }, [selectedStageId, zoom, stages]);

    // Auto-scroll to center the selected stage
    React.useEffect(() => {
        // When entering Design mode (mount), zoom to fit and scroll all stages if any exist
        if (!hasInitialScrolledRef.current) {
            hasInitialScrolledRef.current = true;
            if (stages.length > 0) {
                fitAllStages();
            }
            return;
        }

        // Standard selection scroll logic (just centering, no zoom change)
        if (selectedStageId && selectedStageId !== lastFocusedStageIdRef.current) {
            lastFocusedStageIdRef.current = selectedStageId;

            // Allow a small delay for layout to settle if needed
            const timer = setTimeout(() => {
                centerStage(selectedStageId);
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [selectedStageId, centerStage, stages.length, fitAllStages]); // added stages.length to dependency

    // Watch for stages being added (e.g. initial load or first creation)
    const prevStagesLengthRef = useRef(stages.length);
    React.useEffect(() => {
        if (prevStagesLengthRef.current === 0 && stages.length > 0) {
            fitAllStages();
        }
        prevStagesLengthRef.current = stages.length;
    }, [stages.length, fitAllStages]);

    // Follow Mode: Auto-scroll to followed user's cursor
    React.useEffect(() => {
        if (followedUserId && collaboratorCursors[followedUserId] && containerRef.current) {
            const cursor = collaboratorCursors[followedUserId];
            const container = containerRef.current;

            // Calculate center position for the cursor
            // cursor.x/y are in content coordinates (unzoomed)
            // We want to center the viewport on (cursor.x * zoom, cursor.y * zoom)

            const targetScrollLeft = (cursor.x * zoom) - (container.clientWidth / 2);
            const targetScrollTop = (cursor.y * zoom) - (container.clientHeight / 2);

            // Smooth scroll or instant? Instant feels more responsive for "following"
            container.scrollTo({
                left: targetScrollLeft,
                top: targetScrollTop,
                behavior: 'auto'
            });
        }
    }, [followedUserId, collaboratorCursors, zoom]);

    // Sync scroll and viewport size
    React.useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            setScrollPos({ x: container.scrollLeft, y: container.scrollTop });
        };

        const handleResize = () => {
            setViewportSize({
                width: container.clientWidth,
                height: container.clientHeight
            });
        };

        container.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleResize);

        // Initial size
        handleResize();

        return () => {
            container.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const getInterpolatedProps = (layer: any, stageId: string, isAuto = false) => {
        const stage = stages.find(s => s.id === stageId);
        const pb = playbackStates[stageId] || { currentTime: globalCurrentTime ?? 0, loopsDone: 0 };

        return getInterpolatedLayerStyles(
            layer,
            pb.currentTime ?? globalCurrentTime ?? 0,
            (stage as any)?.duration || 10,
            pb.loopsDone || 0,
            (stage as any)?.loopCount,
            (stage as any)?.stopAtSecond,
            (stage as any)?.feedLoopCount,
            isPreviewMode,
            isAuto,
            (stage as any)?.width || 0,
            (stage as any)?.height || 0
        );
    };

    const getPadding = (layer: any) => {
        if (!layer.variant) return { left: 0, top: 0, right: 0, bottom: 0 };
        try {
            const meta = JSON.parse(layer.variant);
            const p = meta.padding ?? 0;
            const ph = meta.paddingHorizontal ?? p;
            const pv = meta.paddingVertical ?? p;
            return {
                left: meta.paddingLeft ?? ph,
                top: meta.paddingTop ?? pv,
                right: meta.paddingRight ?? ph,
                bottom: meta.paddingBottom ?? pv
            };
        } catch {
            return { left: 0, top: 0, right: 0, bottom: 0 };
        }
    };

    /** Snapshot (klon) ağacında id ile layer bulur – drag başlangıç x,y için kullanılır. */
    const findLayerInTree = (layers: any[], id: string): any | null => {
        for (const l of layers) {
            if (l.id === id) return l;
            if (l.children) {
                const found = findLayerInTree(l.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    /** Seçili grupların tüm alt öğe id'lerini toplar – resize'ta grup içi orantılı ölçekleme için. */
    const getSelectedIdsWithGroupDescendants = (stageLayers: any[], selectedIds: string[]): string[] => {
        const out = new Set<string>(selectedIds);
        const collectDescendantIds = (layers: any[], parentSelected: boolean) => {
            layers.forEach((l) => {
                const isSelected = selectedIds.includes(l.id);
                if (parentSelected || isSelected) out.add(l.id);
                if (l.children) collectDescendantIds(l.children, parentSelected || isSelected);
            });
        };
        collectDescendantIds(stageLayers, false);
        return Array.from(out);
    };

    /** Snapshot ağacından grubun (parent) world pozisyonunu hesaplar – grup içi transformta grubun halihazırdaki pozisyonu kullanılır. */
    const getParentWorldFromTree = (stageLayers: any[], parentId: string, stageId: string): { wx: number; wy: number; wr: number; width: number; height: number } | null => {
        let result: { wx: number; wy: number; wr: number; width: number; height: number } | null = null;
        
        const stageContentEl = document.getElementById(stageId);
        const stageRect = stageContentEl?.getBoundingClientRect();

        const traverse = (layers: any[], px = 0, py = 0, pz = 0, pr = 0, pw = 0, ph = 0, psx = 1, psy = 1, isParentAuto = false, parentPadding = { left: 0, top: 0 }) => {
            if (result) return;
            const effectivePadding = parentPadding;
            for (const l of layers) {
                const props = getInterpolatedProps(l, stageId, isParentAuto);
                const rad = pr * (Math.PI / 180);
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const pxOffset = isParentAuto ? (effectivePadding.left || 0) : 0;
                const pyOffset = isParentAuto ? (effectivePadding.top || 0) : 0;

                let relX = ((props.x3d ?? props.x ?? 0) + pxOffset - pw / 2) * psx;
                let relY = ((props.y3d ?? props.y ?? 0) + pyOffset - ph / 2) * psy;

                let wx = px + (relX * cos - relY * sin);
                let wy = py + (relX * sin + relY * cos);

                // Precision override for auto-layout children: use DOM center as source of truth
                if (isParentAuto && stageRect) {
                    const lEl = document.getElementById(stageId)?.querySelector(`[id="${l.id}"]`);
                    if (lEl) {
                        const lRect = lEl.getBoundingClientRect();
                        const screenCX = lRect.left + lRect.width / 2;
                        const screenCY = lRect.top + lRect.height / 2;
                        wx = (screenCX - stageRect.left) / zoom;
                        wy = (screenCY - stageRect.top) / zoom;
                    }
                }

                const relZ = props.z3d ?? props.z ?? 0;
                const wz = pz + relZ;
                const wr = pr + props.rotation;

                const currentSX = psx * (props.scaleX ?? props.scale ?? 1);
                const currentSY = psy * (props.scaleY ?? props.scale ?? 1);

                if (l.id === parentId) {
                    // Try to get visual dimensions from DOM for accuracy (handles scaling and auto-layout resizing)
                    const lEl = document.getElementById(stageId)?.querySelector(`[id="${l.id}"]`);
                    if (lEl) {
                        const lRect = lEl.getBoundingClientRect();
                        let dww, dwh;
                        if (Math.abs(wr) < 0.1) {
                            dww = lRect.width / zoom;
                            dwh = lRect.height / zoom;
                        } else {
                            const style = window.getComputedStyle(lEl);
                            // Use computed style width/height and multiply by world scale for rotated elements
                            dww = (parseFloat(style.width) || 0) * currentSX;
                            dwh = (parseFloat(style.height) || 0) * currentSY;
                        }
                        result = { 
                            wx, 
                            wy, 
                            wr, 
                            width: dww, 
                            height: dwh 
                        };
                    } else {
                        result = { 
                            wx, 
                            wy, 
                            wr, 
                            width: (props.width ?? 0) * currentSX, 
                            height: (props.height ?? 0) * currentSY 
                        };
                    }
                    return;
                }
                if (l.children) {
                    let isAuto = false;
                    try {
                        const meta = l.variant ? JSON.parse(l.variant) : {};
                        isAuto = l.type === 'group' && meta.layoutMode === 'auto';
                    } catch (e) { }
                    const currentPadding = getPadding(l);
                    traverse(l.children, wx, wy, wz, wr, props.width ?? 0, props.height ?? 0, currentSX, currentSY, isAuto, currentPadding);
                    if (result) return;
                }
            }
        };
        traverse(stageLayers);
        return result;
    };

    const getSelectedWorldLayers = (stageLayers: any[], selectedIds: string[], stageId: string, ignoreAnimations: boolean | string[] = false, includeAll = false) => {
        const found: Array<{
            layer: any,
            worldX: number,
            worldY: number,
            worldZ: number,
            worldRotation: number,
            worldScaleX: number,
            worldScaleY: number,
            parentWorldX: number,
            parentWorldY: number,
            parentWorldZ: number,
            parentWorldRotation: number,
            parentWidth: number,
            parentHeight: number,
            parentPadding: { left: number, top: number },
            isRootSelection: boolean,
            parentId: string | null,
            isParentAuto: boolean
        }> = [];

        const stageContentEl = document.getElementById(stageId);
        const stageRect = stageContentEl?.getBoundingClientRect();

        const traverse = (layers: any[], px = 0, py = 0, pz = 0, pr = 0, pw = 0, ph = 0, psx = 1, psy = 1, hasSelectedAncestor = false, isParentAuto = false, parentPadding = { left: 0, top: 0 }, parentId: string | null = null) => {
            const effectivePadding = parentPadding;

            layers.forEach((l: any) => {
                const shouldIgnore = (typeof ignoreAnimations === 'boolean' && ignoreAnimations) || (Array.isArray(ignoreAnimations) && ignoreAnimations.includes(l.id));
                const props = shouldIgnore ? l : getInterpolatedProps(l, stageId, isParentAuto);
                const rad = pr * (Math.PI / 180);
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);

                const pxOffset = isParentAuto ? (effectivePadding.left || 0) : 0;
                const pyOffset = isParentAuto ? (effectivePadding.top || 0) : 0;

                const relX = ((props.x3d ?? props.x ?? 0) + pxOffset - pw / 2) * psx;
                const relY = ((props.y3d ?? props.y ?? 0) + pyOffset - ph / 2) * psy;
                const relZ = props.z3d ?? props.z ?? 0;

                let wx = px + (relX * cos - relY * sin);
                let wy = py + (relX * sin + relY * cos);
                const wz = pz + relZ;
                const wr = pr + props.rotation;

                if (stageId && selectedIds.includes(l.id)) {
                    console.log(`[getWorld] ${l.type}(${l.id}) - animName: ${(props as any).animName || 'none'}`, {
                        propsX3d: props.x3d,
                        propsY3d: props.y3d,
                        relX, relY,
                        parentCenter: { px, py, pr },
                        parentSize: { pw, ph },
                        wx, wy, wr
                    });
                }

                // Precision override for auto-layout children: use DOM center as source of truth
                if (isParentAuto && stageRect) {
                    const lEl = document.getElementById(stageId)?.querySelector(`[id="${l.id}"]`);
                    if (lEl) {
                        const lRect = lEl.getBoundingClientRect();
                        const screenCX = lRect.left + lRect.width / 2;
                        const screenCY = lRect.top + lRect.height / 2;
                        wx = (screenCX - stageRect.left) / zoom;
                        wy = (screenCY - stageRect.top) / zoom;
                    }
                }
                const isSelected = selectedIds.includes(l.id);

                const currentSX = psx * (props.scaleX ?? l.scaleX ?? (l as any).scale ?? 1);
                const currentSY = psy * (props.scaleY ?? l.scaleY ?? (l as any).scale ?? 1);

                if (isSelected || hasSelectedAncestor || includeAll) {
                    found.push({
                        layer: l,
                        worldX: wx,
                        worldY: wy,
                        worldZ: wz,
                        worldRotation: wr,
                        worldScaleX: currentSX,
                        worldScaleY: currentSY,
                        parentWorldX: px,
                        parentWorldY: py,
                        parentWorldZ: pz,
                        parentWorldRotation: pr,
                        parentWidth: pw * psx,
                        parentHeight: ph * psy,
                        parentPadding: effectivePadding,
                        isRootSelection: !hasSelectedAncestor,
                        parentId: parentId,
                        isParentAuto: isParentAuto
                    });
                }

                if (l.children) {
                    let isAuto = false;
                    try {
                        const meta = l.variant ? JSON.parse(l.variant) : {};
                        isAuto = l.type === 'group' && meta.layoutMode === 'auto';
                    } catch (e) { }

                    const currentPadding = getPadding(l);
                    traverse(l.children, wx, wy, wz, wr, props.width ?? 0, props.height ?? 0, currentSX, currentSY, hasSelectedAncestor || isSelected, isAuto, currentPadding, l.id);
                }
            });
        };

        traverse(stageLayers);
        return found;
    };

    // Sync selectionRotation when selection changes - using useEffect to avoid render-phase update loops
    React.useEffect(() => {
        if (selectedLayerIds.length > 0) {
            let rotation = 0;
            let found = false;
            for (const s of stages) {
                const selected = getSelectedWorldLayers(s.layers, selectedLayerIds, s.id);
                if (selected.length > 0) {
                    const firstRot = selected[0].worldRotation;
                    const allSame = selected.every(l => Math.abs(l.worldRotation - firstRot) < 0.1);
                    rotation = allSame ? firstRot : 0;
                    found = true;
                    break;
                }
            }
            setSelectionRotation(found ? rotation : 0);
        } else {
            setSelectionRotation(0);
        }
    }, [selectedLayerIds, stages, selectedStageId]);

    // Tek seçili nesne için transform kutusunu DOM konumuna hizala (metin, auto height, auto layout vb. tüm durumlarda kutu modeli takip etsin).
    // Overlay'ın gerçekten içinde olduğu container'a göre ölçüm yapıyoruz; bir frame gecikmeyle layout oturduktan sonra ölçüyoruz.
    React.useLayoutEffect(() => {
        if (!selectedStageId || selectedLayerIds.length !== 1) {
            if (measuredBoundsForAutoLayout !== null) {
                setMeasuredBoundsForAutoLayout(null);
            }
            return;
        }
        const stage = stages.find(s => s.id === selectedStageId);
        if (!stage) {
            setMeasuredBoundsForAutoLayout(null);
            return;
        }
        const world = getSelectedWorldLayers(stage.layers, selectedLayerIds, stage.id);
        const roots = world.filter((w: any) => w.isRootSelection);
        if (roots.length !== 1) {
            setMeasuredBoundsForAutoLayout(null);
            return;
        }
        const layerId = selectedLayerIds[0];
        let cancelled = false;
        const measure = () => {
            const layerEl = document.getElementById(stage.id)?.querySelector(`[id="${layerId}"]`);
            // Overlay'ın render edildiği container = stage-overlay'ın parent'ı (transform kutusu bu koordinat sisteminde)
            const overlayContainer = document.getElementById(`stage-overlay-${stage.id}`)?.parentElement;
            const stageContentEl = document.getElementById(stage.id);
            const refEl = overlayContainer || stageContentEl;
            if (!layerEl || !refEl) {
                if (!cancelled && measuredBoundsForAutoLayout !== null) {
                    setMeasuredBoundsForAutoLayout(null);
                }
                return;
            }
            const layerRect = layerEl.getBoundingClientRect();
            const refRect = refEl.getBoundingClientRect();
            
            const scaleX = zoom;
            const scaleY = zoom;

            const screenCenterX = layerRect.left + layerRect.width / 2;
            const screenCenterY = layerRect.top + layerRect.height / 2;
            
            const logicalX = (screenCenterX - refRect.left) / scaleX;
            const logicalY = (screenCenterY - refRect.top) / scaleY;

            const rotation = roots[0].worldRotation ?? 0;
            let logicalWidth, logicalHeight;

            if (Math.abs(rotation) < 0.1) {
                logicalWidth = layerRect.width / scaleX;
                logicalHeight = layerRect.height / scaleY;
            } else {
                const style = window.getComputedStyle(layerEl);
                logicalWidth = (parseFloat(style.width) || 0) * (roots[0].worldScaleX || 1);
                logicalHeight = (parseFloat(style.height) || 0) * (roots[0].worldScaleY || 1);
            }

            if (!cancelled) {
                setMeasuredBoundsForAutoLayout(prev => {
                    const next = {
                        stageId: stage.id,
                        layerId,
                        bounds: {
                            x: logicalX,
                            y: logicalY,
                            width: logicalWidth,
                            height: logicalHeight,
                            rotation,
                            type: roots[0].layer.type,
                            variant: roots[0].layer.variant
                        },
                    };
                    if (!prev) return next;
                    const b = prev.bounds;
                    const n = next.bounds;
                    // Relax threshold from 0.01 to 0.5 to prevent sub-pixel layout jitter loops
                    const changed = Math.abs(b.x - n.x) > 0.5 || Math.abs(b.y - n.y) > 0.5 || 
                                    Math.abs(b.width - n.width) > 0.5 || Math.abs(b.height - n.height) > 0.5 ||
                                    Math.abs(b.rotation - n.rotation) > 0.01 ||
                                    prev.stageId !== next.stageId ||
                                    prev.layerId !== next.layerId ||
                                    prev.bounds.variant !== next.bounds.variant;
                    return changed ? next : prev;
                });
            }
        };

        let rafId: number;
        const loop = () => {
            if (cancelled) return;
            measure();
            rafId = requestAnimationFrame(loop);
        };
        // Run first iteration in the next frame to avoid synchronous "Maximum update depth exceeded" errors
        rafId = requestAnimationFrame(loop);
        rafId = requestAnimationFrame(loop);
        
        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
        };
    }, [selectedStageId, selectedLayerIds, stages, zoom]);

    // Hover (preview) karesi: hover edilen nesne için DOM'dan ölçüm – preview karesi nesnenin tam üstünde görünsün
    React.useLayoutEffect(() => {
        if (!hoveredLayerId) {
            if (measuredBoundsForHoveredAutoLayout !== null) {
                setMeasuredBoundsForHoveredAutoLayout(null);
            }
            return;
        }
        let foundStage: typeof stages[0] | null = null;
        let foundRoot: { worldRotation: number } | null = null;
        for (const stage of stages) {
            const world = getSelectedWorldLayers(stage.layers, [hoveredLayerId], stage.id);
            const roots = world.filter((w: any) => w.isRootSelection);
            if (roots.length === 1) {
                foundStage = stage;
                foundRoot = roots[0];
                break;
            }
        }
        if (!foundStage || !foundRoot) {
            setMeasuredBoundsForHoveredAutoLayout(null);
            return;
        }
        const stage = foundStage;
        const layerId = hoveredLayerId;
        let cancelled = false;
        const measure = () => {
            const layerEl = document.getElementById(stage.id)?.querySelector(`[id="${layerId}"]`);
            const overlayContainer = document.getElementById(`stage-overlay-${stage.id}`)?.parentElement;
            const stageContentEl = document.getElementById(stage.id);
            const refEl = overlayContainer || stageContentEl;
            if (!layerEl || !refEl) {
                if (!cancelled && measuredBoundsForHoveredAutoLayout !== null) {
                    setMeasuredBoundsForHoveredAutoLayout(null);
                }
                return;
            }
            const layerRect = layerEl.getBoundingClientRect();
            const refRect = refEl.getBoundingClientRect();
            const scaleX = refRect.width / stage.width;
            const scaleY = refRect.height / stage.height;
            
            const screenCenterX = layerRect.left + layerRect.width / 2;
            const screenCenterY = layerRect.top + layerRect.height / 2;
            
            const logicalWidth = layerRect.width / scaleX;
            const logicalHeight = layerRect.height / scaleY;
            const logicalX = (screenCenterX - refRect.left) / scaleX;
            const logicalY = (screenCenterY - refRect.top) / scaleY;
            
            if (!cancelled) {
                setMeasuredBoundsForHoveredAutoLayout(prev => {
                    const next = {
                        stageId: stage.id,
                        layerId,
                        bounds: {
                            x: logicalX,
                            y: logicalY,
                            width: logicalWidth,
                            height: logicalHeight,
                            rotation: foundRoot!.worldRotation ?? 0,
                        },
                    };
                    if (!prev) return next;
                    const b = prev.bounds;
                    const n = next.bounds;
                    // Use a reasonable threshold to prevent micro-fluctuations and infinite loops
                    const changed = Math.abs(b.x - n.x) > 0.01 || Math.abs(b.y - n.y) > 0.01 || 
                                    Math.abs(b.width - n.width) > 0.01 || Math.abs(b.height - n.height) > 0.01 ||
                                    Math.abs(b.rotation - n.rotation) > 0.01 ||
                                    prev.stageId !== next.stageId ||
                                    prev.layerId !== next.layerId;
                    return changed ? next : prev;
                });
            }
        };
        measure();
        let rafId: number;
        const loop = () => {
            if (cancelled) return;
            measure();
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        
        return () => {
            cancelled = true;
            cancelAnimationFrame(rafId);
        };
    }, [hoveredLayerId, stages, zoom]);

    /** Selection bounds for transform controller. Uses stage's current animation time (playback/scrub) so the box follows the layer during animation. */
    const getSelectionBounds = (stageLayers: any[], selectedIds: string[], stageId: string, targetRotation: number) => {
        const selected = getSelectedWorldLayers(stageLayers, selectedIds, stageId);
        const roots = selected.filter(s => s.isRootSelection);
        if (selected.length === 0) return null;

        // Optimization for single selection: Match visual interpolated bounds exactly
        if (roots.length === 1) {
            const s = roots[0];
            const interpolated = getInterpolatedProps(s.layer, stageId);

            // Get static world position for CSS animations (ignore only leaf animation, keep parent motion)
            const staticSelected = getSelectedWorldLayers(stageLayers, [s.layer.id], stageId, [s.layer.id]);
            const ss = staticSelected[0];
            const staticWorldX = ss?.worldX ?? s.worldX;
            const staticWorldY = ss?.worldY ?? s.worldY;
            const staticWorldRot = ss?.worldRotation ?? 0;

            const stage = stages.find(st => st.id === stageId);
            const sw = stage?.width || 0;
            const sh = stage?.height || 0;

            // Project interpolated visual center
            const projected = project3d(s.worldX, s.worldY, s.worldZ, sw, sh);

            // For CSS animations, we'll use base width/height and let CSS handle scaling.
            // For JS animations, we use the perspective-scaled visual width/height.
            const baseWidth = (interpolated.width ?? s.layer.width) * s.worldScaleX;
            const baseHeight = (interpolated.height ?? s.layer.height) * s.worldScaleY;
            const visualWidth = baseWidth * projected.factor;
            const visualHeight = baseHeight * projected.factor;

            console.log(`[getSelectionBounds] ID: ${s.layer.id}`, {
                interpolatedRot: interpolated.rotation,
                worldRot: s.worldRotation,
                worldX: s.worldX,
                worldY: s.worldY,
                projectedX: projected.x,
                projectedY: projected.y
            });

            return {
                x: projected.x,
                y: projected.y,
                width: visualWidth,
                height: visualHeight,
                rotation: s.worldRotation,
                rotateX: interpolated.rotateX ?? s.layer.rotateX ?? 0,
                rotateY: interpolated.rotateY ?? s.layer.rotateY ?? 0,
                baseWidth,
                baseHeight,
                staticX: staticWorldX,
                staticY: staticWorldY,
                staticRotation: staticWorldRot,
                animName: (interpolated as any).animName,
                progress: (interpolated as any).progress,
                rawKeyframes: (interpolated as any).rawKeyframes,
                transformOrigin: (interpolated as any).transformOrigin,
                type: s.layer.type,
                variant: s.layer.variant
            } as any;
        }

        // 1. Find group center (Stable geometric center of top-level selected items)
        let totalX = 0, totalY = 0, totalZ = 0;
        roots.forEach((s: any) => {
            totalX += s.worldX;
            totalY += s.worldY;
            totalZ += s.worldZ;
        });
        const cx = totalX / roots.length;
        const cy = totalY / roots.length;
        const cz = totalZ / roots.length;

        // 2. Project all corners into the rotated coordinate system to find tight bounds
        let lMinX = Infinity, lMaxX = -Infinity, lMinY = Infinity, lMaxY = -Infinity;
        const rad = -targetRotation * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const currentStage = stages.find(st => st.id === stageId);
        const sw = currentStage?.width || 0;
        const sh = currentStage?.height || 0;

        const projectedCX = project3d(cx, cy, cz, sw, sh);

        selected.forEach((s: any) => {
            const interpProps = getInterpolatedProps(s.layer, stageId);
            const hw = (interpProps.width * s.worldScaleX) / 2;
            const hh = (interpProps.height * s.worldScaleY) / 2;
            const lRad = s.worldRotation * (Math.PI / 180);
            const lCos = Math.cos(lRad);
            const lSin = Math.sin(lRad);

            const corners = [
                { x: -hw, y: -hh },
                { x: hw, y: -hh },
                { x: hw, y: hh },
                { x: -hw, y: hh }
            ];

            corners.forEach((c: any) => {
                // Absolute 3D world position of the corner
                const wx = s.worldX + (c.x * lCos - c.y * lSin);
                const wy = s.worldY + (c.x * lSin + c.y * lCos);
                const wz = s.worldZ;

                // Project 3D world position to 2D stage-space
                const projected = project3d(wx, wy, wz, sw, sh);

                const rx = projected.x - projectedCX.x;
                const ry = projected.y - projectedCX.y;

                // Correct rotation into axis-aligned selection frame (theta = rad)
                lMinX = Math.min(lMinX, rx * cos - ry * sin);
                lMaxX = Math.max(lMaxX, rx * cos - ry * sin);
                lMinY = Math.min(lMinY, rx * sin + ry * cos);
                lMaxY = Math.max(lMaxY, rx * sin + ry * cos);
            });
        });

        const groupLocalCX = (lMinX + lMaxX) / 2;
        const groupLocalCY = (lMinY + lMaxY) / 2;

        const invCos = Math.cos(-rad);
        const invSin = Math.sin(-rad);

        const worldCX = projectedCX.x + (groupLocalCX * invCos - groupLocalCY * invSin);
        const worldCY = projectedCX.y + (groupLocalCX * invSin + groupLocalCY * invCos);

        const unprojectedCX = currentStage ? (sw / 2 + (worldCX - sw / 2) / projectedCX.factor) : worldCX;
        const unprojectedCY = currentStage ? (sh / 2 + (worldCY - sh / 2) / projectedCX.factor) : worldCY;

        return {
            id: 'selection-group',
            x: worldCX,
            y: worldCY,
            x3d: unprojectedCX,
            y3d: unprojectedCY,
            perspectiveFactor: projectedCX.factor,
            width: lMaxX - lMinX,
            height: lMaxY - lMinY,
            rotation: targetRotation
        };
    };

    /** Memoized snap targets for the selected stage to avoid recomputing on every render during drag. */
    const snapTargetsForSelection = React.useMemo(() => {
        if (isDraggingRef.current) return cachedSnapTargetsRef.current;
        if (!isSnapEnabled || !selectedStageId) return [];
        const stage = stages.find(s => s.id === selectedStageId);
        if (!stage) return [];
        const targets: Array<{ x?: number; y?: number; label?: string }> = [];
        const pushSafe = (t: { x?: number; y?: number; label?: string }) => {
            if (t.x !== undefined && (t.x < -20 || t.x > stage.width + 20)) return;
            if (t.y !== undefined && (t.y < -20 || t.y > stage.height + 20)) return;
            targets.push(t);
        };
        pushSafe({ x: 0, label: 'Stage Left' });
        pushSafe({ x: stage.width, label: 'Stage Right' });
        pushSafe({ y: 0, label: 'Stage Top' });
        pushSafe({ y: stage.height, label: 'Stage Bottom' });
        pushSafe({ x: stage.width / 2, label: 'Stage V-Center' });
        pushSafe({ y: stage.height / 2, label: 'Stage H-Center' });
        pushSafe({ x: 0, y: 0, label: 'Stage' });
        pushSafe({ x: stage.width, y: 0, label: 'Stage' });
        pushSafe({ x: 0, y: stage.height, label: 'Stage' });
        pushSafe({ x: stage.width, y: stage.height, label: 'Stage' });
        if (stage.guideLines) {
            stage.guideLines.forEach((g: GuideLine) => {
                if (g.type === 'vertical') pushSafe({ x: g.position, label: 'Guideline' });
                else pushSafe({ y: g.position, label: 'Guideline' });
            });
        }
        const allLayers = getSelectedWorldLayers(stage.layers, [], stage.id, true, true);
        allLayers.forEach(swl => {
            if (selectedLayerIds.includes(swl.layer.id) || swl.layer.hidden) return;
            const padding = 100;
            if (swl.worldX < -padding || swl.worldX > stage.width + padding ||
                swl.worldY < -padding || swl.worldY > stage.height + padding) return;
            const ww = swl.layer.width ?? 0;
            const wh = swl.layer.height ?? 0;
            const rad = swl.worldRotation * (Math.PI / 180);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const pts: { dx: number; dy: number }[] = [
                { dx: -ww / 2, dy: -wh / 2 }, { dx: ww / 2, dy: -wh / 2 },
                { dx: -ww / 2, dy: wh / 2 }, { dx: ww / 2, dy: wh / 2 },
                { dx: 0, dy: -wh / 2 }, { dx: 0, dy: wh / 2 },
                { dx: -ww / 2, dy: 0 }, { dx: ww / 2, dy: 0 },
                { dx: 0, dy: 0 }
            ];
            pts.forEach(p => {
                const wx = swl.worldX + (p.dx * cos - p.dy * sin);
                const wy = swl.worldY + (p.dx * sin + p.dy * cos);
                pushSafe({ x: wx });
                pushSafe({ y: wy });
                pushSafe({ x: wx, y: wy, label: 'Layer' });
            });
        });
        cachedSnapTargetsRef.current = targets;
        return targets;
    }, [isSnapEnabled, selectedStageId, stages, selectedLayerIds]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'none'; // Default to none on background
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Dropping on background is disabled per user request
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };



    const handleMouseDownCapture = (e: React.MouseEvent) => {
        const isMiddleMouse = e.button === 1;
        const isLeftMouse = e.button === 0;

        if (isMiddleMouse || (isLeftMouse && isSpacePressed)) {
            setIsPanning(true);
            lastMousePos.current = { x: e.clientX, y: e.clientY };
            e.stopPropagation();
            return;
        }

        if (isZPressed && isLeftMouse) {
            e.preventDefault();
            e.stopPropagation();
            const factor = (e.altKey || isAltPressed) ? 1 / 1.5 : 1.5;
            const container = containerRef.current;
            if (container) {
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                zoomPivotRef.current = {
                    contentX: (container.scrollLeft + mouseX) / zoom,
                    contentY: (container.scrollTop + mouseY) / zoom,
                    mouseX,
                    mouseY
                };
                onZoomChange((prev: number) => Math.min(Math.max(prev * factor, 0.1), 5));
            }
            return;
        }
    };

    const handleLayerMouseDown = (e: React.MouseEvent, layerId: string, stageId: string) => {
        if (e.button !== 0) return;
        
        const isAlt = e.altKey || isAltPressed;
        const stage = stages.find(s => s.id === stageId);
        if (!stage) return;

        // If Shift is pressed, we don't want to instantiate an immediate drag that clears the current selection.
        // We let the onClick event (handleLayerClick in App.tsx) handle the multi-selection logic.
        if (e.shiftKey) return;

        // If it's a standard click on an already selected layer, we might let TransformController handle it
        // BUT if we want "immediate" drag even on first click, we handle it here.
        
        e.stopPropagation();
        
        // 1. Selection
        if (!selectedLayerIds.includes(layerId) || selectedStageId !== stageId) {
            onStageSelect(stageId);
            onLayersSelect([layerId]);
        }
        
        let targetId = layerId;

        if (isAlt) {
            e.preventDefault();
            // 2. Duplicate immediately
            const idMap = onDuplicateLayers?.(stageId, [layerId], { x: 0, y: 0 }, true);
            if (!idMap || !idMap[layerId]) return;
            targetId = idMap[layerId];
            hasDuplicatedDuringDragRef.current = true;
        } else {
            hasDuplicatedDuringDragRef.current = false;
        }
        
        // 3. Initialize manual drag
        pushToHistory?.();
        isDraggingRef.current = true;
        dragActionTypeRef.current = 'move';
        manualDragStartMouseRef.current = { x: e.clientX, y: e.clientY };
        manualDragStageIdRef.current = stageId;
        
        // 4. Create snapshot
        const selectedWorldLayers = getSelectedWorldLayers(stage.layers, [layerId], stageId);
        const selRotation = selectedWorldLayers.length === 1 ? selectedWorldLayers[0].worldRotation : 0;
        const selectionBounds = getSelectionBounds(stage.layers, [layerId], stageId, selRotation);
        
        if (selectionBounds && selectedWorldLayers.length > 0) {
            const initialLayers = JSON.parse(JSON.stringify(stage.layers));
            const frozenWorldLayers = selectedWorldLayers.map((s: any) => ({
                ...s,
                layerId: targetId,
                layer: JSON.parse(JSON.stringify(s.layer))
            }));
            frozenWorldLayers[0].layer.id = targetId;

            transformSnapshotRef.current = createTransformSnapshot(
                selectionBounds,
                frozenWorldLayers,
                initialLayers
            );

            // Setup global handlers for manual drag
            const onGlobalMove = (moveEvent: MouseEvent) => {
                if (transformSnapshotRef.current && manualDragStartMouseRef.current) {
                    const dx = (moveEvent.clientX - manualDragStartMouseRef.current.x) / zoom;
                    const dy = (moveEvent.clientY - manualDragStartMouseRef.current.y) / zoom;
                    
                    const snapshot = transformSnapshotRef.current;
                    const updates = {
                        x: snapshot.bounds.left + dx,
                        y: snapshot.bounds.top + dy
                    };
                    
                    const { changes, hasChange } = applyTransformUpdate(
                        snapshot,
                        updates,
                        calculateLayerScaleUpdates
                    );
                    
                    if (hasChange) {
                        onBatchUpdateLayers(Array.from(changes.entries()).map(([id, changes]) => ({ id, changes, absoluteLocal: true })));
                    }
                }
            };

            const onGlobalUp = () => {
                window.removeEventListener('mousemove', onGlobalMove);
                window.removeEventListener('mouseup', onGlobalUp);
                
                isDraggingRef.current = false;
                setIsTransforming(false);
                transformSnapshotRef.current = null;
                dragActionTypeRef.current = null;
                manualDragStartMouseRef.current = null;
                manualDragStageIdRef.current = null;
                
                // Use the updated targetId for final update if it was a duplicate
                const finalIds = isAlt ? [targetId] : [layerId];
                onBatchUpdateLayers(finalIds.map(id => ({ id, changes: {} })));
            };

            window.addEventListener('mousemove', onGlobalMove);
            window.addEventListener('mouseup', onGlobalUp);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click

        const target = e.target as HTMLElement;

        // 1. Identify if this is a click on UI elements that should NOT trigger background logic
        // We check for portal markers, text toolbars, and specific popover classes
        const isUIInteraction = !!target.closest('[id$="-portal"]') ||
            !!target.closest('.color-picker-popover-content') ||
            !!target.closest('[data-text-toolbar="true"]') ||
            !!target.closest('.ignore-workspace-mousedown');

        if (isUIInteraction) {
            // Stop propagation to prevent any parent components from reacting as well
            e.stopPropagation();
            return;
        }

        const containerRect = workspaceRef.current!.getBoundingClientRect();

        const startX = (e.clientX - containerRect.left) / zoom;
        const startY = (e.clientY - containerRect.top) / zoom;

        setMarquee({ startX, startY, endX: startX, endY: startY, active: true });

        // 2. Only clear selection if clicking the workspace background areas
        const isBackground = target === e.currentTarget ||
            target.classList.contains('workspace-background-wrapper') ||
            target === workspaceRef.current ||
            // In text tool mode, we treat everything inside the stage as background for marquee logic, EXCEPT existing text layers
            (activeSidebarTab === 'text' && !target.closest('[id^="text_"]')) ||
            // Clicks on the stage background (stage-root-* or stage_*) that aren't on specific layers
            ((!!target.closest('[id^="stage-root-"]') || !!target.closest('[id^="stage_"]')) &&
                !target.closest('[id^="media_"]') &&
                !target.closest('[id^="image_"]') &&
                !target.closest('[id^="text_"]') &&
                !target.closest('[id^="button_"]') &&
                !target.closest('[id^="svg_"]') &&
                !target.closest('[id^="widget_"]') &&
                !target.closest('[id^="shape_"]') &&
                !target.closest('[id^="group_"]'));

        if (isBackground) {
            const stageTarget = target.closest('[id^="stage-root-"]') || target.closest('[id^="stage_"]');
            if (stageTarget) {
                const stageId = stageTarget.id.startsWith('stage-root-') ? stageTarget.id.replace('stage-root-', '') : stageTarget.id;
                onStageSelect(stageId);
            } else {
                onStageSelect(null);
            }
            onLayersSelect([]);
            onActiveGroupChange(null);
            onStopEditing?.();
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const container = containerRef.current;
        if (container) {
            const rect = container.getBoundingClientRect();
            // Local visual pos for Rulers
            const localX = e.clientX - rect.left - 24;
            const localY = e.clientY - rect.top - 24;
            setMousePos({ x: localX, y: localY });

            const contentX = (e.clientX - rect.left - 24 + container.scrollLeft) / zoom;
            const contentY = (e.clientY - rect.top - 24 + container.scrollTop) / zoom;

            if (onContentMouseMove) {
                onContentMouseMove(contentX, contentY);
            }

            // If chat input is open, make it follow the mouse instantly via Ref to avoid React render lag
            if (chatInput && chatInputPopupRef.current) {
                const vx = contentX * zoom + 24;
                const vy = contentY * zoom + 24;
                chatInputPopupRef.current.style.transform = `translate(${vx}px, ${vy}px)`;
            }
        }
        
        if (draggingGuide) {
            if (container) {
                const rect = container.getBoundingClientRect();
                const selectedStage = stages.find(s => s.id === selectedStageId);
                const calcOriginX = (selectedStage?.x || 0) + 1000;
                const calcOriginY = (selectedStage?.y || 0) + 1030; // 30px for header + gap
                const originX = measuredOrigins ? measuredOrigins.x : calcOriginX;
                const originY = measuredOrigins ? measuredOrigins.y : calcOriginY;

                if (draggingGuide.type === 'vertical') {
                    let contentX = (e.clientX - rect.left + container.scrollLeft - 24) / zoom - originX;
                    if (isSnapEnabled) contentX = Math.round(contentX / 10) * 10;

                    if (draggingGuide.id !== 'new' && selectedStageId) {
                        onUpdateGuideLine?.(selectedStageId, draggingGuide.id, contentX);
                    }
                } else {
                    let contentY = (e.clientY - rect.top + container.scrollTop - 24) / zoom - originY;
                    if (isSnapEnabled) contentY = Math.round(contentY / 10) * 10;

                    if (draggingGuide.id !== 'new' && selectedStageId) {
                        onUpdateGuideLine?.(selectedStageId, draggingGuide.id, contentY);
                    }
                }
            }
            return;
        }

        if (isPanning) {
            const dx = e.clientX - lastMousePos.current.x;
            const dy = e.clientY - lastMousePos.current.y;

            if (containerRef.current) {
                containerRef.current.scrollLeft -= dx;
                containerRef.current.scrollTop -= dy;
            }

            lastMousePos.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (marquee?.active && workspaceRef.current) {
            const containerRect = workspaceRef.current!.getBoundingClientRect();
            setMarquee(prev => prev ? {
                ...prev,
                endX: (e.clientX - containerRect.left) / zoom,
                endY: (e.clientY - containerRect.top) / zoom
            } : null);
        }
    };

    const handleMouseUp = (e: React.MouseEvent) => {
        if (draggingGuide) {
            if (draggingGuide.id === 'new') {
                const container = containerRef.current;
                if (container) {
                    const rect = container.getBoundingClientRect();
                    const selectedStage = stages.find(s => s.id === selectedStageId);
                    const calcOriginX = (selectedStage?.x || 0) + 1000;
                    const calcOriginY = (selectedStage?.y || 0) + 1030; // Matches handleMouseMove
                    const originX = measuredOrigins ? measuredOrigins.x : calcOriginX;
                    const originY = measuredOrigins ? measuredOrigins.y : calcOriginY;

                    if (draggingGuide.type === 'vertical' && selectedStageId) {
                        let contentX = (e.clientX - rect.left + container.scrollLeft - 24) / zoom - originX;
                        if (isSnapEnabled) contentX = Math.round(contentX / 10) * 10;
                        onAddGuideLine?.(selectedStageId, { type: 'vertical', position: contentX });
                    } else if (selectedStageId) {
                        let contentY = (e.clientY - rect.top + container.scrollTop - 24) / zoom - originY;
                        if (isSnapEnabled) contentY = Math.round(contentY / 10) * 10;
                        onAddGuideLine?.(selectedStageId, { type: 'horizontal', position: contentY });
                    }
                }
            }
            setDraggingGuide(null);
            return;
        }

        if (isPanning) {
            setIsPanning(false);
            return;
        }

        if (!marquee?.active) return;
        // ... rest of selection logic
        // Selection Box (Marquee) Boundaries in Content coordinates
        if (activeSidebarTab === 'text') {
            ignoreClickRef.current = true;

            // Find which stage we are drawing on
            const mStartX = Math.min(marquee.startX, marquee.endX) - 1000;
            const mStartY = Math.min(marquee.startY, marquee.endY) - 1000;
            const mWidth = Math.abs(marquee.endX - marquee.startX);
            const mHeight = Math.abs(marquee.endY - marquee.startY);

            // Use at least default size for simple clicks - increased for better initial typing experience
            const finalWidth = mWidth < 10 ? 350 : mWidth;
            const defaultFontSize = parseFloat(lastUsedTextStyles?.fontSize || '14');
            const finalHeight = mHeight < 10 ? defaultFontSize : mHeight;
            const isSimpleClick = mWidth < 10;

            // Find first stage that contains the point
            let targetStage = null;
            let contentTop = 0;
            let contentLeft = 0;

            for (const s of stages) {
                const el = document.getElementById(s.id);
                if (el && workspaceRef.current) {
                    const rect = el.getBoundingClientRect();
                    const wRect = workspaceRef.current.getBoundingClientRect();

                    // Convert screen coordinates to zoomed workspace coordinates
                    const l = (rect.left - wRect.left) / zoom;
                    const t = (rect.top - wRect.top) / zoom;
                    const r = l + s.width;
                    const b = t + s.height;

                    if (marquee.startX >= l && marquee.startX <= r &&
                        marquee.startY >= t && marquee.startY <= b) {
                        targetStage = s;
                        contentLeft = l;
                        contentTop = t;
                        break;
                    }
                }
            }

            if (targetStage) {
                const variant = JSON.stringify({
                    label: '', // Empty by default
                    fontFamily: lastUsedTextStyles?.fontFamily || 'Inter',
                    fontWeight: lastUsedTextStyles?.fontWeight || '400',
                    fontSize: lastUsedTextStyles?.fontSize || '14',
                    lineHeight: lastUsedTextStyles?.lineHeight || '1.2',
                    letterSpacing: lastUsedTextStyles?.letterSpacing || '0',
                    textTransform: lastUsedTextStyles?.textTransform || 'none',
                    textAlign: lastUsedTextStyles?.textAlign || 'center',
                    verticalAlign: lastUsedTextStyles?.verticalAlign || 'middle', // Set default to middle for better visual alignment in fixed box
                    textColor: lastUsedTextStyles?.textColor || '#000000',
                    // Use 'none' (Fixed) as default per requirement
                    layoutType: isSimpleClick ? 'none' : (lastUsedTextStyles?.layoutType || 'none'),
                    bgType: lastUsedTextStyles?.bgType || 'none',
                    overflowBehavior: 'truncate' // Added default overflow behavior
                });

                // Use selected area size so the text box matches the drawn rectangle
                const centerX = (Math.min(marquee.startX, marquee.endX) + finalWidth / 2) - contentLeft;
                const centerY = (Math.min(marquee.startY, marquee.endY) + finalHeight / 2) - contentTop;

                const id = onAddLayer(targetStage.id, {
                    type: 'text',
                    url: '', 
                    x: centerX,
                    y: centerY,
                    width: finalWidth,
                    height: finalHeight,
                    rotation: 0,
                    variant: variant
                }, 'text');

                if (targetStage.id !== selectedStageId) {
                    onStageSelect(targetStage.id);
                }
                onLayersSelect([id]);
                onStartEditing?.(targetStage.id, id);
                onToolCompleted?.();
                ignoreClickRef.current = true; // Block subsequent click event
            }

            setMarquee(null);
            return;
        }

        const isSmallMarquee = Math.abs(marquee.endX - marquee.startX) < 5 && Math.abs(marquee.endY - marquee.startY) < 5;

        if (!isSmallMarquee) {
            ignoreClickRef.current = true; // Block subsequent click event

            const newSelectedIds: string[] = [];
            let newSelectedStageId: string | null = null;

            const checkVisibility = (layers: any[], stageId: string) => {
                layers.forEach(layer => {
                    if (layer.locked) return;
                    const layerElement = document.getElementById(stageId)?.querySelector(`[id="${layer.id}"]`);
                    if (!layerElement) return;

                    const layerRect = layerElement.getBoundingClientRect();
                    const marqueeRect = {
                        left: Math.min(marquee.startX, marquee.endX) * zoom + workspaceRef.current!.getBoundingClientRect().left,
                        top: Math.min(marquee.startY, marquee.endY) * zoom + workspaceRef.current!.getBoundingClientRect().top,
                        right: Math.max(marquee.startX, marquee.endX) * zoom + workspaceRef.current!.getBoundingClientRect().left,
                        bottom: Math.max(marquee.startY, marquee.endY) * zoom + workspaceRef.current!.getBoundingClientRect().top
                    };

                    const intersects = !(layerRect.left > marqueeRect.right ||
                        layerRect.right < marqueeRect.left ||
                        layerRect.top > marqueeRect.bottom ||
                        layerRect.bottom < marqueeRect.top);

                    if (intersects) {
                        newSelectedIds.push(layer.id);
                        newSelectedStageId = stageId;
                    }

                    if (layer.children) checkVisibility(layer.children, stageId);
                });
            };

            stages.forEach(stage => {
                checkVisibility(stage.layers, stage.id);
            });

            if (newSelectedIds.length > 0) {
                if (newSelectedStageId !== selectedStageId) {
                    onStageSelect(newSelectedStageId);
                }

                // If we have an active group, we should only select things that are children of it
                // and follow the same hierarchical rule as single click
                if (activeGroupId) {
                    const refinedSelectedIds: string[] = [];
                    newSelectedIds.forEach(id => {
                        // Find path to each selected item
                        const findPath = (layers: any[], targetId: string, currentPath: string[] = []): string[] | null => {
                            for (const l of layers) {
                                if (l.id === targetId) return [...currentPath, l.id];
                                if (l.children) {
                                    const p = findPath(l.children, targetId, [...currentPath, l.id]);
                                    if (p) return p;
                                }
                            }
                            return null;
                        };

                        const stage = stages.find(s => s.id === newSelectedStageId);
                        if (stage) {
                            const path = findPath(stage.layers, id);
                            if (path) {
                                const activeIdx = path.indexOf(activeGroupId);
                                if (activeIdx !== -1 && activeIdx < path.length - 1) {
                                    refinedSelectedIds.push(path[activeIdx + 1]);
                                }
                            }
                        }
                    });

                    // Deduplicate
                    const uniqueIds = Array.from(new Set(refinedSelectedIds));
                    onLayersSelect(uniqueIds.length > 0 ? uniqueIds : []);
                } else {
                    // No active group, select top-level ancestors that are in marquee
                    const refinedSelectedIds: string[] = [];
                    newSelectedIds.forEach(id => {
                        // Reuse hierarchical logic: find path, pick path[0]
                        stages.forEach(s => {
                            const findPath = (layers: any[], targetId: string, currentPath: string[] = []): string[] | null => {
                                for (const l of layers) {
                                    if (l.id === targetId) return [...currentPath, l.id];
                                    if (l.children) {
                                        const p = findPath(l.children, targetId, [...currentPath, l.id]);
                                        if (p) return p;
                                    }
                                }
                                return null;
                            };
                            const path = findPath(s.layers, id);
                            if (path) refinedSelectedIds.push(path[0]);
                        });
                    });
                    const uniqueIds = Array.from(new Set(refinedSelectedIds));
                    onLayersSelect(uniqueIds);
                }
            } else {
                onLayersSelect([]);
            }
        }

        setMarquee(null);
    };

    const handleWheel = (e: React.WheelEvent) => {
        const container = containerRef.current;
        if (!container) return;

        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();

            const delta = -e.deltaY;
            // More stable and linear-feeling zoom factor
            const factor = Math.min(Math.max(Math.exp(delta * 0.001), 0.7), 1.4);

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            zoomPivotRef.current = {
                contentX: (container.scrollLeft + mouseX) / zoom,
                contentY: (container.scrollTop + mouseY) / zoom,
                mouseX,
                mouseY
            };

            onZoomChange((prev: number) => Math.min(Math.max(prev * factor, 0.1), 5));
        } else if (e.shiftKey) {
            container.scrollLeft += e.deltaY;
        } else {
            // Vertical scroll is handled by overflow-auto automatically
        }
    };

    const getWorkspaceCursor = () => {
        if (isPanning) return 'grabbing';
        if (isSpacePressed) return 'grab';
        if (isZPressed) return isAltPressed ? 'zoom-out' : 'zoom-in';
        if (activeSidebarTab === 'text') return 'text';
        return 'default';
    };

    return (
        <div
            ref={containerRef}
            id="workspace-container"
            className="flex-1 overflow-auto bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:24px_24px] relative grid"
            style={{
                overscrollBehavior: 'none',
                cursor: getWorkspaceCursor(),
                scrollBehavior: 'auto',
                overflowAnchor: 'none',
                gridTemplateColumns: '24px 1fr',
                gridTemplateRows: '24px 1fr'
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMouseDownCapture={handleMouseDownCapture}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            onContextMenu={handleContextMenu}
            onClickCapture={(e) => {
                if (ignoreClickRef.current) {
                    e.stopPropagation();
                    ignoreClickRef.current = false;
                }
            }}
        >
            {/* Rulers Overlay - Fixed positions */}
            <div className="sticky top-0 left-0 z-10 w-6 h-6 bg-[#f3f4f6] border-r border-b border-gray-200 flex items-center justify-center text-[10px] text-gray-400 font-medium font-sans pointer-events-none row-start-1 col-start-1">
                px
            </div>
            {(() => {
                const selectedStage = stages.find(s => s.id === selectedStageId);
                const calcOriginX = (selectedStage?.x || 0) + 1000;
                const calcOriginY = (selectedStage?.y || 0) + 1030; // 22 header + 8 gap

                const originX = measuredOrigins ? measuredOrigins.x : calcOriginX;
                const originY = measuredOrigins ? measuredOrigins.y : calcOriginY;

                return (
                    <>
                        <div className="sticky top-0 left-[24px] z-10 h-6 bg-[#f3f4f6] row-start-1 col-start-2 overflow-hidden" style={{ width: viewportSize.width ? `${viewportSize.width - 24}px` : '100%' }}>
                            <Ruler
                                orientation="horizontal"
                                zoom={zoom}
                                scrollPos={scrollPos.x}
                                size={24}
                                length={viewportSize.width - 24}
                                mousePos={mousePos.x}
                                origin={originX}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const container = containerRef.current;
                                    if (!container || !selectedStageId) return;
                                    setDraggingGuide({ id: 'new', type: 'horizontal', startPos: 0 });
                                }}
                            />
                        </div>
                        <div className="sticky left-0 top-[24px] z-10 w-6 bg-[#f3f4f6] row-start-2 col-start-1 overflow-hidden" style={{ height: viewportSize.height ? `${viewportSize.height - 24}px` : '100%' }}>
                            <Ruler
                                orientation="vertical"
                                zoom={zoom}
                                scrollPos={scrollPos.y}
                                size={24}
                                length={viewportSize.height - 24}
                                mousePos={mousePos.y}
                                origin={originY}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    const container = containerRef.current;
                                    if (!container || !selectedStageId) return;
                                    setDraggingGuide({ id: 'new', type: 'vertical', startPos: 0 });
                                }}
                            />
                        </div>
                    </>
                );
            })()}

            {/* Standard Canvas Layout - Fixed to start to prevent coordinate shifts during scale */}
            <div
                className="min-h-full min-w-full flex items-start justify-start overflow-visible workspace-background-wrapper row-start-2 col-start-2"
                style={{ width: '10000px', height: '10000px', transformStyle: 'preserve-3d' }}
            >
                <div
                    ref={workspaceRef}
                    className="relative origin-top-left"
                    style={{
                        transform: `scale(${zoom})`,
                        transformStyle: 'preserve-3d',
                        // Stable padding that allows room for marquee selection even at the edges
                        padding: '1000px',
                        width: '100%',
                        height: '100%'
                    }}
                >
                    {/* Guidelines Rendering (Only for selected stage) */}
                    {(() => {
                        const selectedStage = stages.find(s => s.id === selectedStageId);
                        if (!selectedStage) return null;

                        const calcOriginX = (selectedStage.x || 0) + 1000;
                        const calcOriginY = (selectedStage.y || 0) + 1030; // Consistent fallback
                        const originX = measuredOrigins ? measuredOrigins.x : calcOriginX;
                        const originY = measuredOrigins ? measuredOrigins.y : calcOriginY;

                        return (selectedStage.guideLines || []).map(guide => {
                            const isVertical = guide.type === 'vertical';
                            const pos = isVertical ? guide.position + originX : guide.position + originY;

                            return (
                                <div
                                    key={guide.id}
                                    className={`absolute bg-cyan-400 opacity-60 hover:opacity-100 z-[9999] cursor-${isVertical ? 'col-resize' : 'row-resize'} transition-opacity group/guide`}
                                    style={{
                                        left: isVertical ? `${pos}px` : '-1000px',
                                        top: isVertical ? '-1000px' : `${pos}px`,
                                        width: isVertical ? '1px' : '10000px',
                                        height: isVertical ? '10000px' : '1px',
                                        padding: isVertical ? '0 4px' : '4px 0', // Slightly larger hit area
                                        marginLeft: isVertical ? '-4px' : '0',
                                        marginTop: isVertical ? '0' : '-4px',
                                        backgroundClip: 'content-box'
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation();
                                        if (e.button !== 0) return;
                                        setDraggingGuide({ id: guide.id, type: guide.type, startPos: guide.position });
                                    }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setGuideLineContextMenu({ x: e.clientX, y: e.clientY, id: guide.id });
                                    }}
                                >
                                    {/* Visual line inside hit area */}
                                    <div className={`absolute inset-0 bg-cyan-400 ${isVertical ? 'w-[1px] left-1/2' : 'h-[1px] top-1/2'} pointer-events-none shadow-[0_0_2px_rgba(0,0,0,0.2)]`} />
                                </div>
                            );
                        });
                    })()}

                    {draggingGuide && draggingGuide.id === 'new' && (() => {
                        const isVertical = draggingGuide.type === 'vertical';
                        const selectedStage = stages.find(s => s.id === selectedStageId);
                        if (!selectedStage) return null;

                        // Use mousePos directly from state which is correctly calculated in handleMouseMove
                        let paddedWorldPos = isVertical
                            ? (mousePos.x + scrollPos.x) / zoom
                            : (mousePos.y + scrollPos.y) / zoom;

                        const calcOriginX = (selectedStage.x || 0) + 1000;
                        const calcOriginY = (selectedStage.y || 0) + 1030;
                        const originX = measuredOrigins ? measuredOrigins.x : calcOriginX;
                        const originY = measuredOrigins ? measuredOrigins.y : calcOriginY;

                        if (isSnapEnabled) {
                            const origin = isVertical ? originX : originY;
                            const relativePos = paddedWorldPos - origin;
                            const snappedRelative = Math.round(relativePos / 10) * 10;
                            paddedWorldPos = snappedRelative + origin;
                        }

                        return (
                            <div
                                className={`absolute bg-cyan-400 opacity-40 z-[9999] pointer-events-none`}
                                style={{
                                    left: isVertical ? `${paddedWorldPos}px` : '-1000px',
                                    top: isVertical ? '-1000px' : `${paddedWorldPos}px`,
                                    width: isVertical ? '1px' : '10000px',
                                    height: isVertical ? '10000px' : '1px',
                                }}
                            >
                                {/* Dragging Label */}
                                <div className="absolute top-2 left-2 bg-cyan-500 text-white text-[9px] px-1 rounded shadow-sm">
                                    {Math.round(isVertical
                                        ? (paddedWorldPos - (measuredOrigins?.x ?? (selectedStage.x + 1000)))
                                        : (paddedWorldPos - (measuredOrigins?.y ?? (selectedStage.y + 1030)))
                                    )}px
                                </div>
                            </div>
                        );
                    })()}

                    {stages.map((stage) => {
                        if (stage.visible === false) return null;
                        
                        const selectionBounds = getSelectionBounds(stage.layers, selectedLayerIds, stage.id, selectionRotation);

                        const selectedWorldLayers = getSelectedWorldLayers(stage.layers, selectedLayerIds, stage.id);
                        const selectedIdsWithDescendants = getSelectedIdsWithGroupDescendants(stage.layers, selectedLayerIds);
                        const selectedWorldLayersForTransform = getSelectedWorldLayers(stage.layers, selectedIdsWithDescendants, stage.id);
                        const hoveredBounds = hoveredLayerId ? getSelectionBounds(stage.layers, [hoveredLayerId], stage.id, 0) : null;

                        // --- Stage Masking Logic ---
                        const maskLayer = stage.layers.find(l => l.isMask);
                        let stageMaskStyle: React.CSSProperties = {};
                        const isAnyEditing = !!editingLayerIds[stage.id];

                        if (maskLayer && !isAnyEditing) {
                            const mp = getInterpolatedLayerStyles(
                                maskLayer,
                                playbackStates[stage.id]?.currentTime ?? globalCurrentTime ?? 0,
                                (stage as any).duration || 10,
                                playbackStates[stage.id]?.loopsDone ?? 0,
                                (stage as any).loopCount,
                                (stage as any).stopAtSecond,
                                (stage as any).feedLoopCount,
                                isPreviewMode,
                                false
                            );

                            const baseW = mp.width;
                            const baseH = mp.height;

                            const scaleX = mp.scaleX ?? (baseW ? mp.visualWidth / baseW : 1);
                            const scaleY = mp.scaleY ?? (baseH ? mp.visualHeight / baseH : 1);

                            const skewX = mp.skewX ?? 0;
                            const skewY = mp.skewY ?? 0;

                            // Stage layers coordinates are relative to stage top-left 0,0
                            const maskCenterX = mp.visualX;
                            const maskCenterY = mp.visualY;

                            const sr = mp.rotation;
                            const so = mp.opacity;

                            let maskMeta: any = {};
                            try { maskMeta = JSON.parse(maskLayer.variant || '{}'); } catch { }

                            let br = mp.borderRadius ?? maskMeta.borderRadius ?? 0;
                            const shapeType = maskMeta.shapeType;
                            const clipPath = mp.clipPath || maskMeta.clipPath || '';
                            const isCircle = shapeType === 'circle';
                            const isPolygon = clipPath.includes('polygon');

                            if (isCircle) {
                                br = Math.min(baseW, baseH) / 2;
                            } else if (typeof br === 'string' && br.endsWith('%')) {
                                br = (parseFloat(br) / 100) * Math.min(baseW, baseH);
                            }

                            const localX = -baseW / 2;
                            const localY = -baseH / 2;

                            let maskShape = '';
                            if (isPolygon) {
                                const pointsStr = clipPath.match(/polygon\((.*)\)/)?.[1] || '';
                                const svgPoints = pointsStr.split(',').map((p: string) => {
                                    const [px, py] = p.trim().split(/\s+/);
                                    const vx = (parseFloat(px) / 100) * baseW + localX;
                                    const vy = (parseFloat(py) / 100) * baseH + localY;
                                    return `${vx},${vy}`;
                                }).join(' ');
                                maskShape = `<polygon points="${svgPoints}" fill="rgba(255,255,255,${so})" />`;
                            } else {
                                maskShape = `<rect x="${localX}" y="${localY}" width="${baseW}" height="${baseH}" rx="${br}" ry="${br}" fill="rgba(255,255,255,${so})" />`;
                            }

                            // Resolve Transform Origin for Stage Masks
                            const tOrigin = (mp as any)?.transformOrigin || 'center center';
                            const parseOriginVal = (val: string, size: number) => {
                                if (!val) return size / 2;
                                if (val.includes('%')) return (parseFloat(val) / 100) * size;
                                if (val === 'left' || val === 'top') return 0;
                                if (val === 'right' || val === 'bottom') return size;
                                if (val === 'center') return size / 2;
                                return parseFloat(val) || size / 2;
                            };
                            const [oxS, oyS] = tOrigin.split(' ');
                            const oxVal = parseOriginVal(oxS, baseW);
                            const oyVal = parseOriginVal(oyS || 'center', baseH);

                            const pivotOffsetX = -baseW / 2 + oxVal;
                            const pivotOffsetY = -baseH / 2 + oyVal;

                            const transform = `translate(${maskCenterX} ${maskCenterY}) translate(${pivotOffsetX} ${pivotOffsetY}) rotate(${sr}) skewX(${skewX}) skewY(${skewY}) scale(${scaleX} ${scaleY}) translate(${-pivotOffsetX} ${-pivotOffsetY})`;

                            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${stage.width}" height="${stage.height}">
  <g transform="${transform}">
    ${maskShape}
  </g>
</svg>`.trim();
                            const b64 = btoa(svg);
                            const maskUrl = `url(data:image/svg+xml;base64,${b64})`;
                            stageMaskStyle = {
                                WebkitMaskImage: maskUrl,
                                maskImage: maskUrl,
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat',
                                WebkitMaskSize: '100% 100%',
                                maskSize: '100% 100%',
                            };
                        }

                        return (
                            <div
                                key={stage.id}
                                id={`stage-root-${stage.id}`}
                                className="absolute transition-transform duration-300 ease-in-out"
                                style={(() => {
                                    const activeStageActions = (stage.actions || []).filter(a => a.triggerTargetId === 'stage' && actionStates[a.id]);
                                    let stx = 0, sty = 0;
                                    activeStageActions.forEach(a => {
                                        if (a.actionType === 'position') {
                                            stx += Number(a.config?.x) || 0;
                                            sty += Number(a.config?.y) || 0;
                                        }
                                    });
                                    const stageTransform = (stx !== 0 || sty !== 0) ? `translate(${stx}px, ${sty}px)` : '';

                                    return {
                                        left: stage.x + 1000, // Account for padding
                                        top: stage.y + 1000,
                                        width: `${stage.width}px`,
                                        height: `${stage.height}px`,
                                        zIndex: selectedStageId === stage.id ? 10 : 1,
                                        perspective: (isPreviewMode || activeSidebarTab === 'animate') ? '2000px' : undefined,
                                        perspectiveOrigin: '50% 50%',
                                        transformStyle: 'preserve-3d',
                                        pointerEvents: 'none', // Wrapper shouldn't block, children will handle events
                                        contain: 'layout size',
                                        transform: stageTransform || undefined
                                    };
                                })()}
                            >
                                <StageContainer
                                    id={stage.id}
                                    name={stage.name}
                                    width={stage.width}
                                    height={stage.height}
                                    maskStyle={stageMaskStyle}
                                    backgroundColor={stage.backgroundColor}
                                    backgroundColor2={stage.backgroundColor2}
                                    bgType={stage.bgType}
                                    isSelected={selectedStageId === stage.id}
                                    onSelect={() => {
                                        onStageSelect(stage.id);
                                    }}
                                    onHeaderMouseDown={(e) => {
                                        if (e.button !== 0) return; // Only left click for stage selection
                                        e.stopPropagation();
                                        onStageSelect(stage.id);
                                    }}
                                    breadcrumbs={breadcrumbs}
                                    onBreadcrumbClick={(id: string | null) => onActiveGroupChange(id)}
                                    zoom={zoom}
                                    viewportRef={containerRef}
                                    actions={stage.actions}
                                    actionStates={actionStates}
                                    onTriggerAction={onTriggerAction}
                                    isPreviewMode={isPreviewMode}
                                    isInteractive={isPreviewMode || activeSidebarTab === 'animate'}
                                    overflow={stage.overflow}
                                    onUpdateName={(newName) => onUpdateStageName?.(stage.id, newName)}
                                    onDrop={(source, x, y, assetType, meta) => {
                                        onDropOnWorkspace(source, assetType, meta, x, y, stage.id);
                                    }}
                                    isTextToolActive={activeSidebarTab === 'text'}
                                    cursor={getWorkspaceCursor()}
                                    overlay={<>
                                        {selectedStageId === stage.id && snapGuides.x !== null && (
                                            <div
                                                className="absolute top-[-2000px] bottom-[-2000px] border-l-2 border-dashed border-red-500 z-[500] pointer-events-none"
                                                style={{ left: snapGuides.x }}
                                            >
                                                <div className="absolute top-0 -left-1 px-1 bg-red-500 text-white text-[10px] rounded-sm whitespace-nowrap opacity-70">
                                                    {snapGuides.labelX || 'Snap'}
                                                </div>
                                            </div>
                                        )}
                                        {selectedStageId === stage.id && snapGuides.y !== null && (
                                            <div
                                                className="absolute left-[-2000px] right-[-2000px] border-t-2 border-dashed border-red-500 z-[500] pointer-events-none"
                                                style={{ top: snapGuides.y }}
                                            >
                                                <div className="absolute left-0 -top-1 px-1 bg-red-500 text-white text-[10px] rounded-sm whitespace-nowrap opacity-70 -translate-y-px">
                                                    {snapGuides.labelY || 'Snap'}
                                                </div>
                                            </div>
                                        )}
                                        {/* Nokta snap: hem x hem y set olduğunda kesişim noktasını belirgin işaretle (rotate'da da görünsün) */}
                                        {selectedStageId === stage.id && snapGuides.x !== null && snapGuides.y !== null && (
                                            <div
                                                className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 border-2 border-red-500 bg-red-500/30 rounded-full z-[501] pointer-events-none"
                                                style={{ left: snapGuides.x, top: snapGuides.y }}
                                            />
                                        )}

                                        {/* Aktif grup düzenleme çerçevesi – grup içinde edit yapılırken grubun sınırlarını ince çerçeve ile gösterir */}
                                        {selectedStageId === stage.id && activeGroupId && (() => {
                                            const groupWorld = getParentWorldFromTree(stage.layers, activeGroupId, stage.id);
                                            if (!groupWorld) return null;
                                            const { wx, wy, wr, width: ww, height: wh } = groupWorld;
                                            return (
                                                <div
                                                    className="absolute pointer-events-none z-[290] border rounded-sm"
                                                    style={{
                                                        left: wx - ww / 2,
                                                        top: wy - wh / 2,
                                                        width: ww,
                                                        height: wh,
                                                        transform: `rotate(${wr}deg)`,
                                                        boxSizing: 'border-box',
                                                        borderWidth: '1px',
                                                        borderColor: 'rgba(99, 102, 241, 0.5)'
                                                    }}
                                                />
                                            );
                                        })()}

                                        {/* Hover Highlight (preview karesi) – auto layout child'da DOM'dan ölçülen bounds kullanılır */}
                                        {hoveredBounds && (() => {
                                            const useHoverMeasured = measuredBoundsForHoveredAutoLayout && measuredBoundsForHoveredAutoLayout.stageId === stage.id && hoveredLayerId && measuredBoundsForHoveredAutoLayout.layerId === hoveredLayerId;
                                            const effectiveHoveredBounds = useHoverMeasured ? measuredBoundsForHoveredAutoLayout!.bounds : hoveredBounds;
                                            return (
                                                <div
                                                    className="absolute pointer-events-none z-[400]"
                                                    style={{
                                                        left: effectiveHoveredBounds.x - effectiveHoveredBounds.width / 2,
                                                        top: effectiveHoveredBounds.y - effectiveHoveredBounds.height / 2,
                                                        width: `${effectiveHoveredBounds.width}px`,
                                                        height: `${effectiveHoveredBounds.height}px`,
                                                        transform: `rotate(${effectiveHoveredBounds.rotation}deg)`,
                                                        boxShadow: '0 0 0 1px white, inset 0 0 0 1.5px #0C8CE9',
                                                        transition: 'none'
                                                    }}
                                                />
                                            );
                                        })()}

                                        {/* Group Transform Controller: bounds use current animation time so it follows selected layer during playback/scrub. Animasyon varken her zaman selectionBounds (interpolated) kullanılır ki kutu move/rotate/scale ile takip etsin. */}
                                        {selectionBounds && Object.values(editingLayerIds).every(id => !id) && (() => {
                                            const selectedLayer = selectedLayerIds.length === 1 ? findLayerInTree(stage.layers, selectedLayerIds[0]) : null;
                                            const layerHasAnimation = selectedLayer && (
                                                (selectedLayer.animation?.keyframes?.length > 0) ||
                                                !!(selectedLayer.animation?.entry || selectedLayer.animation?.main || selectedLayer.animation?.exit)
                                            );
                                            const useMeasured = !layerHasAnimation && measuredBoundsForAutoLayout && measuredBoundsForAutoLayout.stageId === stage.id && selectedLayerIds.length === 1 && measuredBoundsForAutoLayout.layerId === selectedLayerIds[0];
                                            
                                            if (selectedLayerIds.length === 1 && !useMeasured && selectionBounds.x === 0 && selectionBounds.y === 0 && !layerHasAnimation) return null;

                                            const effectiveBounds = useMeasured ? measuredBoundsForAutoLayout!.bounds : selectionBounds;
                                            let isLocked = true;
                                            if (selectedLayerIds.length === 1 && selectedLayer) {
                                                try {
                                                    const m = JSON.parse(selectedLayer.variant || '{}');
                                                    isLocked = m.lockAspectRatio !== false;
                                                } catch(_) { isLocked = true; }
                                            }

                                            return (
                                                <>
                                                    <div
                                                        className="absolute pointer-events-none z-[300]"
                                                        style={{
                                                            left: effectiveBounds.x - effectiveBounds.width / 2,
                                                            top: effectiveBounds.y - effectiveBounds.height / 2,
                                                            width: effectiveBounds.width,
                                                            height: effectiveBounds.height,
                                                            transform: `rotate(${effectiveBounds.rotation}deg) rotateX(${effectiveBounds.rotateX ?? 0}deg) rotateY(${effectiveBounds.rotateY ?? 0}deg)`,
                                                            transformOrigin: (selectionBounds as any).transformOrigin || 'center center',
                                                            transition: 'none',
                                                            transformStyle: 'preserve-3d',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                width: '100%',
                                                                height: '100%',
                                                                transition: 'none'
                                                            }}
                                                        >
                                                            <TransformController
                                                                layer={{ 
                                                                    ...effectiveBounds, 
                                                                    id: selectedLayerIds.join(','),
                                                                    x: effectiveBounds.x - effectiveBounds.width / 2, 
                                                                    y: effectiveBounds.y - effectiveBounds.height / 2 
                                                                } as any}
                                                                zoom={zoom}
                                                                onContextMenu={handleContextMenu}
                                                                isSnapEnabled={isSnapEnabled}
                                                                snapTargets={selectedStageId === stage.id ? snapTargetsForSelection : []}
                                                                onSnap={(snap) => {
                                                                    setSnapGuides({ x: snap.x, y: snap.y, labelX: snap.labelX, labelY: snap.labelY });
                                                                }}
                                                                onHover={onHoverLayer}
                                                                cursor={getWorkspaceCursor()}
                                                                lockAspectRatio={isLocked}
                                                                isSelectionActiveGroup={selectedLayerIds.length === 1 && activeGroupId === selectedLayerIds[0]}
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     // Drilling down into groups: if we click a selected group, try to find the actual layer under the cursor
                                                                     const overlay = e.currentTarget as HTMLElement;
                                                                     const oldPointerEvents = overlay.style.pointerEvents;
                                                                     overlay.style.pointerEvents = 'none';
                                                                     const hovered = document.elementFromPoint(e.clientX, e.clientY);
                                                                     overlay.style.pointerEvents = oldPointerEvents;

                                                                     const layerEl = hovered?.closest('[id]');
                                                                     if (layerEl && layerEl.id && !['workspace-container', 'stage-overlay'].some(ex => layerEl.id.includes(ex))) {
                                                                         onLayerClick(layerEl.id, stage.id, false, e.shiftKey);
                                                                     } else if (selectedLayerIds.length === 1) {
                                                                         // Fallback to current selection if nothing specific found
                                                                         onLayerClick(selectedLayerIds[0], stage.id, false, e.shiftKey);
                                                                     }
                                                                 }}
                                                                 onDoubleClick={(e) => {
                                                                     e.stopPropagation();
                                                                     // Same drilling logic for double clicks to enable text editing inside groups
                                                                     const overlay = e.currentTarget as HTMLElement;
                                                                     const oldPointerEvents = overlay.style.pointerEvents;
                                                                     overlay.style.pointerEvents = 'none';
                                                                     const hovered = document.elementFromPoint(e.clientX, e.clientY);
                                                                     overlay.style.pointerEvents = oldPointerEvents;

                                                                     const layerEl = hovered?.closest('[id]');
                                                                     const targetId = (layerEl && layerEl.id && !['workspace-container', 'stage-overlay'].some(ex => layerEl.id.includes(ex))) 
                                                                         ? layerEl.id 
                                                                         : selectedLayerIds[0];
                                                                     
                                                                     if (targetId) {
                                                                         onLayerClick(targetId, stage.id, true, false);
                                                                     }
                                                                 }}
                                                                 onDragStart={(payload) => {
                                                                    pushToHistory?.();
                                                                    isDraggingRef.current = true;
                                                                    setIsTransforming(true);
                                                                    dragActionTypeRef.current = payload.actionType ?? null;
                                                                    hasDuplicatedDuringDragRef.current = false;
                                                                    const initialLayers = JSON.parse(JSON.stringify(stage.layers));
                                                                    const frozenWorldLayers = selectedWorldLayersForTransform.map((s: any) => ({
                                                                        ...s,
                                                                        layer: findLayerInTree(initialLayers, s.layer.id) || s.layer
                                                                    }));
                                                                    transformSnapshotRef.current = createTransformSnapshot(
                                                                        useMeasured ? { ...selectionBounds, ...effectiveBounds } : selectionBounds,
                                                                        frozenWorldLayers,
                                                                        initialLayers
                                                                    );
                                                                    skipFirstTransformUpdateRef.current = true;
                                                                }}
                                                                disableResize={(() => {
                                                                    const selectedLayers = getSelectedWorldLayers(stage.layers, selectedLayerIds, stage.id).filter(s => s.isRootSelection);
                                                                    if (selectedLayers.length <= 1) return false;
                                                                    const firstRot = selectedLayers[0].worldRotation;
                                                                    return !selectedLayers.every(s => Math.abs(s.worldRotation - firstRot) < 0.1);
                                                                })()}
                                                                onUpdate={(updates, _isBatch, altKey) => {
                                                                    const lockedAction = dragActionTypeRef.current;

                                                                    // Alt-drag duplication
                                                                    if (altKey && lockedAction === 'move' && !hasDuplicatedDuringDragRef.current && selectedLayerIds.length > 0) {
                                                                        const idMap = onDuplicateLayers?.(stage.id, selectedLayerIds, { x: 0, y: 0 }, true);
                                                                        
                                                                        // Update snapshot to target new IDs so originals stay and clones move
                                                                        if (idMap && transformSnapshotRef.current) {
                                                                            transformSnapshotRef.current.layers.forEach((l: any) => {
                                                                                if (idMap[l.layerId]) {
                                                                                    l.layerId = idMap[l.layerId];
                                                                                    if (l.layer) l.layer.id = idMap[l.layerId];
                                                                                }
                                                                            });
                                                                        }
                                                                        
                                                                        hasDuplicatedDuringDragRef.current = true;
                                                                    }

                                                                    const isResizeType = lockedAction && ['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'].includes(lockedAction);
                                                                    if (lockedAction === 'move' && (updates.width !== undefined || updates.height !== undefined)) return;
                                                                    if (isResizeType && (updates.width === undefined || updates.height === undefined)) return;
                                                                    if (lockedAction === 'rotate' && updates.rotation === undefined) return;
 
                                                                    if (updates.rotation !== undefined) setSelectionRotation(updates.rotation);
                                                                    if (skipFirstTransformUpdateRef.current) {
                                                                        skipFirstTransformUpdateRef.current = false;
                                                                        const isResize = updates.width !== undefined || updates.height !== undefined;
                                                                        const isRotateOnly = updates.rotation !== undefined && !isResize;
                                                                        if (isRotateOnly) return;
                                                                    }
                                                                    if (!transformSnapshotRef.current) {
                                                                        const initialLayers = JSON.parse(JSON.stringify(stage.layers));
                                                                        const frozenWorldLayers = selectedWorldLayersForTransform.map((s: any) => ({
                                                                            ...s,
                                                                            layer: findLayerInTree(initialLayers, s.layer.id) || s.layer
                                                                        }));
                                                                        const boundsForSnapshot = (measuredBoundsForAutoLayout && measuredBoundsForAutoLayout.stageId === stage.id && selectedLayerIds.length === 1 && measuredBoundsForAutoLayout.layerId === selectedLayerIds[0])
                                                                            ? { ...selectionBounds, ...measuredBoundsForAutoLayout.bounds }
                                                                            : selectionBounds;
                                                                        transformSnapshotRef.current = createTransformSnapshot(
                                                                            boundsForSnapshot,
                                                                            frozenWorldLayers,
                                                                            initialLayers
                                                                        );
                                                                    }
                                                                    const snapshot = transformSnapshotRef.current;
                                                                    const isResize = updates.width !== undefined && updates.height !== undefined;
                                                                    const anchor = (isResize && !altKey) ? dragActionTypeRef.current : undefined;
                                                                    const { changes, hasChange } = applyTransformUpdate(
                                                                        snapshot,
                                                                        {
                                                                            x: updates.x,
                                                                            y: updates.y,
                                                                            width: updates.width,
                                                                            height: updates.height,
                                                                            rotation: updates.rotation,
                                                                            resizeAnchor: anchor ?? undefined
                                                                        },
                                                                        calculateLayerScaleUpdates
                                                                    );
                                                                    if (hasChange) {
                                                                        onBatchUpdateLayers(Array.from(changes.entries()).map(([id, changes]) => ({ id, changes, absoluteLocal: true })));
                                                                    }
                                                                }}
                                                                 onComplete={() => {
                                                                    isDraggingRef.current = false;
                                                                    setIsTransforming(false);
                                                                    transformSnapshotRef.current = null;
                                                                    dragActionTypeRef.current = null;
                                                                    
                                                                    // Trigger a final update (force re-calc of group bounds)
                                                                    // We send an empty update for the selected layers to trigger the App.tsx logic
                                                                    // which runs the full "Tight Fit" (non-batch) calculation.
                                                                    if (selectedLayerIds.length > 0) {
                                                                        onBatchUpdateLayers(selectedLayerIds.map(id => ({ id, changes: {} })));
                                                                    }
                                                                 }}
                                                            />
                                                            {selectedLayerIds.length === 1 && selectedStageId === stage.id && (() => {
                                                                const selLayer = findLayerInTree(stage.layers, selectedLayerIds[0]);
                                                                if (!selLayer) return null;
                                                                let meta: any = {};
                                                                try { meta = JSON.parse(selLayer.variant || '{}'); } catch { return null; }
                                                                
                                                                const fills = Array.isArray(meta.fills) ? meta.fills : [];
                                                                const gradientFillIndex = fills.findIndex((f: any) => (f.type === 'linear' || f.type === 'radial') && f.visible !== false);
                                                                
                                                                if (gradientFillIndex !== -1) {
                                                                    const gradientFill = fills[gradientFillIndex];
                                                                    return (
                                                                        <GradientHandlesOverlay
                                                                            width={effectiveBounds.width}
                                                                            height={effectiveBounds.height}
                                                                            fill={gradientFill}
                                                                            fillIndex={gradientFillIndex}
                                                                            zoom={zoom}
                                                                            rotation={effectiveBounds.rotation}
                                                                            onUpdate={(updates) => {
                                                                                const newFills = [...fills];
                                                                                newFills[gradientFillIndex] = { ...gradientFill, ...updates };
                                                                                onUpdateLayers([selLayer.id], { variant: JSON.stringify({ ...meta, fills: newFills }) });
                                                                            }}
                                                                        />
                                                                    );
                                                                } else if (meta.bgType === 'linear' || meta.bgType === 'radial') {
                                                                    // Control legacy bgType
                                                                    const gradientFill = {
                                                                        type: meta.bgType as 'linear' | 'radial',
                                                                        gradientAngle: meta.gradientAngle,
                                                                        gradientLength: meta.gradientLength,
                                                                        gradientCenterX: meta.gradientCenterX,
                                                                        gradientCenterY: meta.gradientCenterY,
                                                                        gradientRadius: meta.gradientRadius,
                                                                        color: meta.backgroundColor || stage.backgroundColor,
                                                                        color2: meta.backgroundColor2 || stage.backgroundColor2,
                                                                    };
                                                                    return (
                                                                        <GradientHandlesOverlay
                                                                            width={effectiveBounds.width}
                                                                            height={effectiveBounds.height}
                                                                            fill={gradientFill}
                                                                            fillIndex={-1} // Marks it as legacy
                                                                            zoom={zoom}
                                                                            rotation={effectiveBounds.rotation}
                                                                            onUpdate={(updates) => {
                                                                                const legacyUpdates: any = { ...updates };
                                                                                if (updates.color) {
                                                                                    legacyUpdates.backgroundColor = updates.color;
                                                                                    delete legacyUpdates.color;
                                                                                }
                                                                                if (updates.color2) {
                                                                                    legacyUpdates.backgroundColor2 = updates.color2;
                                                                                    delete legacyUpdates.color2;
                                                                                }
                                                                                onUpdateLayers([selLayer.id], { variant: JSON.stringify({ ...meta, ...legacyUpdates }) });
                                                                            }}
                                                                        />
                                                                    );
                                                                } else if (selLayer.type === 'text' && (meta.textBgType === 'linear' || meta.textBgType === 'radial')) {
                                                                    const gradientFill: any = {
                                                                        type: meta.textBgType,
                                                                        gradientAngle: meta.textGradientAngle,
                                                                        gradientLength: meta.textGradientLength,
                                                                        gradientCenterX: meta.textGradientCenterX,
                                                                        gradientCenterY: meta.textGradientCenterY,
                                                                        gradientRadius: meta.textGradientRadius,
                                                                        stops: meta.textStops,
                                                                        color: meta.textColor,
                                                                        color2: meta.textColor2
                                                                    };
                                                                    return (
                                                                        <GradientHandlesOverlay
                                                                            width={effectiveBounds.width}
                                                                            height={effectiveBounds.height}
                                                                            fill={gradientFill}
                                                                            fillIndex={-2} // Mark as text gradient
                                                                            zoom={zoom}
                                                                            rotation={effectiveBounds.rotation}
                                                                            onUpdate={(updates) => {
                                                                                const textUpdates: any = {};
                                                                                if (updates.gradientAngle !== undefined) textUpdates.textGradientAngle = updates.gradientAngle;
                                                                                if (updates.gradientLength !== undefined) textUpdates.textGradientLength = updates.gradientLength;
                                                                                if (updates.gradientCenterX !== undefined) textUpdates.textGradientCenterX = updates.gradientCenterX;
                                                                                if (updates.gradientCenterY !== undefined) textUpdates.textGradientCenterY = updates.gradientCenterY;
                                                                                if (updates.gradientRadius !== undefined) textUpdates.textGradientRadius = updates.gradientRadius;
                                                                                if (updates.stops) textUpdates.textStops = updates.stops;
                                                                                if (updates.color) textUpdates.textColor = updates.color;
                                                                                if (updates.color2) textUpdates.textColor2 = updates.color2;
                                                                                onUpdateLayers([selLayer.id], { variant: JSON.stringify({ ...meta, ...textUpdates }) });
                                                                            }}
                                                                        />
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}

                                    </>}
                                >
                                     <div
                                         className=""
                                        style={{ transformStyle: 'preserve-3d' }}
                                    >
                                        {stage.layers.filter(l => !l.isMask).map(layer => (
                                            <LayerPreview
                                                key={layer.id}
                                                layer={layer}
                                                stageId={stage.id}
                                                selectedLayerIds={selectedLayerIds}
                                                onLayerClick={onLayerClick}
                                                onContextMenu={handleContextMenu}
                                                onMouseDown={(e, lId) => handleLayerMouseDown(e, lId, stage.id)}
                                                currentTime={playbackStates[stage.id]?.currentTime ?? (stage.id === selectedStageId ? globalCurrentTime : 0) ?? 0}
                                                loopsDone={playbackStates[stage.id]?.loopsDone ?? 0}
                                                stageLoopCount={(stage as any).loopCount}
                                                stageStopAtSecond={(stage as any).stopAtSecond}
                                                stageDuration={(stage as any).duration}
                                                stageFeedLoopCount={(stage as any).feedLoopCount}
                                                isPreviewMode={isPreviewMode}
                                                isInteractive={isPreviewMode || activeSidebarTab === 'animate'}
                                                editingLayerIds={editingLayerIds}
                                                onStopEditing={(sId: string | undefined) => onStopEditing?.(sId || stage.id)}
                                                onUpdateLayers={onUpdateLayers}
                                                zoom={zoom}
                                                isHovered={hoveredLayerId === layer.id}
                                                previewState={selectedLayerIds.includes(layer.id) ? previewState : 'default'}
                                                stageActions={stage.actions}
                                                actionStates={actionStates}
                                                onTriggerAction={onTriggerAction}
                                                stageWidth={stage.width}
                                                stageHeight={stage.height}
                                                 fonts={fonts}
                                                 documentColors={documentColors}
                                                 isTransforming={isTransforming}
                                                onHover={onHoverLayer}
                                                 isTextToolActive={activeSidebarTab === 'text'}
                                                 cursor={getWorkspaceCursor()}
                                                 isPlaying={playbackStates[stage.id]?.isPlaying ?? false}
                                               />
                                        ))}
                                    </div>


                                </StageContainer>
                            </div>
                        );
                    })}
                </div>

            </div>

            {/* Selection Marquee / Text Draw Marquee */}
            {marquee && marquee.active && (
                <div
                    className={`absolute border pointer-events-none flex items-center justify-center ${activeSidebarTab === 'text' ? 'border-dashed border-gray-400 bg-gray-50/20' : 'border-[#0C8CE9] bg-[#0C8CE9]/10'}`}
                    style={{
                        left: Math.min(marquee.startX, marquee.endX) * zoom + (workspaceRef.current?.getBoundingClientRect().left ?? 0) - (containerRef.current?.getBoundingClientRect().left ?? 0) + (containerRef.current?.scrollLeft ?? 0),
                        top: Math.min(marquee.startY, marquee.endY) * zoom + (workspaceRef.current?.getBoundingClientRect().top ?? 0) - (containerRef.current?.getBoundingClientRect().top ?? 0) + (containerRef.current?.scrollTop ?? 0),
                        width: Math.abs(marquee.endX - marquee.startX) * zoom,
                        height: Math.abs(marquee.endY - marquee.startY) * zoom,
                        zIndex: 100
                    }}
                >
                    {activeSidebarTab === 'text' && (
                        <span className="material-symbols-outlined text-gray-400 text-sm opacity-50">title</span>
                    )}
                </div>
            )}

            {/* Floating Text Tool Icon */}
            {activeSidebarTab === 'text' && !marquee?.active && (
                <div
                    className="fixed pointer-events-none z-[200] flex items-center gap-2 bg-white/90 border border-gray-200 px-2 py-1 rounded-lg shadow-sm backdrop-blur-sm"
                    style={{
                        left: mousePos.x + (containerRef.current?.getBoundingClientRect().left ?? 0) + 40,
                        top: mousePos.y + (containerRef.current?.getBoundingClientRect().top ?? 0) + 10,
                    }}
                >
                    <span className="material-symbols-outlined text-[18px] text-gray-700">title</span>
                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">Draw Text Box</span>
                </div>
            )}

            {contextMenu && (() => {
                const selectedStage = stages.find(s => s.id === selectedStageId);
                const selectedWorldLayers = selectedStage
                    ? getSelectedWorldLayers(selectedStage.layers, selectedLayerIds, selectedStage.id)
                    : [];
                const hasGroupSelected = selectedWorldLayers.some(swl => swl.layer.type === 'group');

                return (
                    <ContextMenu
                        x={contextMenu.x}
                        y={contextMenu.y}
                        onClose={() => setContextMenu(null)}
                        actions={[
                            {
                                label: 'Copy Element',
                                icon: 'content_copy',
                                onClick: () => selectedLayerIds.length > 0 && onCopyLayer?.(selectedLayerIds[0]),
                                disabled: selectedLayerIds.length === 0
                            },
                            {
                                label: 'Paste Element',
                                icon: 'content_paste',
                                onClick: () => {
                                    if (selectedStageId && onPasteLayer && contextMenu) {
                                        const workspaceRect = workspaceRef.current?.getBoundingClientRect();
                                        const stage = stages.find(s => s.id === selectedStageId);
                                        if (workspaceRect && stage) {
                                            const worldX = (contextMenu.x - workspaceRect.left) / zoom - 1000;
                                            const worldY = (contextMenu.y - workspaceRect.top) / zoom - 1000;

                                            const stageX = worldX - stage.x;
                                            const stageY = worldY - stage.y;
                                            onPasteLayer(selectedStageId, stageX, stageY);
                                        } else {
                                            onPasteLayer(selectedStageId);
                                        }
                                    }
                                    setContextMenu(null);
                                },
                                disabled: !selectedStageId || !hasLayerClipboard
                            },
                            {
                                label: 'Duplicate Banner',
                                icon: 'content_copy',
                                onClick: () => selectedStageId && onDuplicateStage?.(selectedStageId),
                                disabled: !selectedStageId
                            },
                            {
                                label: 'Group',
                                icon: 'group',
                                onClick: () => selectedStageId && onGroup(selectedStageId, selectedLayerIds),
                                disabled: selectedLayerIds.length === 0
                            },
                            {
                                label: 'Ungroup',
                                icon: 'ungroup',
                                onClick: () => {
                                    if (selectedStageId && selectedLayerIds.length > 0) {
                                        // Collect measured world coordinates for the group and its children
                                        // to preserve layout for auto-layout groups
                                        const stage = stages.find(s => s.id === selectedStageId);
                                        const stageEl = document.getElementById(selectedStageId);
                                        const measuredPositions: Record<string, { x: number, y: number }> = {};

                                        if (stage && stageEl) {
                                            const stageRect = stageEl.getBoundingClientRect();
                                            const measure = (id: string) => {
                                                const el = document.getElementById(id);
                                                if (el) {
                                                    const rect = el.getBoundingClientRect();
                                                    measuredPositions[id] = {
                                                        x: (rect.left + rect.width / 2 - stageRect.left) / zoom,
                                                        y: (rect.top + rect.height / 2 - stageRect.top) / zoom
                                                    };
                                                }
                                            };
                                            selectedLayerIds.forEach(id => {
                                                const layer = stage.layers.find(l => l.id === id);
                                                if (layer?.children) layer.children.forEach(c => measure(c.id));
                                            });
                                        }
                                        onUngroup(selectedStageId, selectedLayerIds, measuredPositions);
                                    }
                                },
                                disabled: !hasGroupSelected
                            },
                            {
                                label: 'Create Asset',
                                icon: 'add_circle',
                                onClick: () => {
                                    if (selectedLayerIds.length > 0) {
                                        onCreateButtonAsset?.(selectedLayerIds[0]);
                                    }
                                    setContextMenu(null);
                                },
                                disabled: selectedLayerIds.length === 0 || !selectedWorldLayers.some(swl => swl.layer.type === 'button')
                            },
                            {
                                label: 'Delete',
                                icon: 'delete',
                                onClick: () => onDelete?.(),
                                disabled: selectedLayerIds.length === 0 && !selectedStageId,
                                variant: 'danger'
                            },
                            {
                                label: 'Send Message',
                                icon: 'chat',
                                onClick: () => {
                                    if (contextMenu && containerRef.current) {
                                        const rect = containerRef.current.getBoundingClientRect();
                                        const contentX = (contextMenu.x - rect.left - 24 + containerRef.current.scrollLeft) / zoom;
                                        const contentY = (contextMenu.y - rect.top - 24 + containerRef.current.scrollTop) / zoom;
                                        onOpenChatInput?.(contentX, contentY);
                                    }
                                    setContextMenu(null);
                                }
                            }
                        ]}
                    />
                );
            })()}

            {guideLineContextMenu && (
                <ContextMenu
                    x={guideLineContextMenu.x}
                    y={guideLineContextMenu.y}
                    onClose={() => setGuideLineContextMenu(null)}
                    actions={[
                        {
                            label: 'Delete Guide Line',
                            icon: 'delete',
                            onClick: () => {
                                if (selectedStageId) {
                                    onDeleteGuideLine?.(selectedStageId, guideLineContextMenu.id);
                                }
                                setGuideLineContextMenu(null);
                            },
                        }
                    ]}
                />
            )}
            {/* Collaborator Cursors Overlay */}
            {Object.entries(collaboratorCursors).map(([id, cursor]) => (
                <div
                    key={id}
                    className="absolute pointer-events-none transition-transform duration-100 z-50 flex flex-col items-start"
                    style={{
                        transform: `translate(${cursor.x * zoom + 24}px, ${cursor.y * zoom + 24}px)`,
                        left: 0,
                        top: 0
                    }}
                >
                    {/* PC Cursor Icon */}
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ color: cursor.color }}>
                        <path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L14.8395 12.3673H5.65376Z" fill="currentColor" stroke="white" strokeWidth="1" />
                    </svg>
                    <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white whitespace-nowrap shadow-sm ml-4 -mt-2 transition-all duration-300 ${cursor.activeMessage ? 'scale-110 !rounded-lg' : ''}`}
                        style={{ backgroundColor: cursor.color }}
                    >
                        {cursor.activeMessage || cursor.name}
                    </span>
                </div>
            ))}

            {/* Chat Input Popup */}
            {chatInput && (
                <div 
                    ref={chatInputPopupRef}
                    className="absolute z-[100] transition-transform duration-75"
                    style={{ 
                        left: 0, 
                        top: 0,
                        transform: `translate(${chatInput.x * zoom + 24}px, ${chatInput.y * zoom + 24}px)`
                    }}
                >
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-100 p-2 flex items-center gap-2 min-w-[200px]">
                        <textarea 
                            autoFocus
                            maxLength={30}
                            className="flex-1 bg-gray-50 border-none outline-none text-xs font-bold px-3 py-2 rounded-lg resize-none overflow-hidden h-12"
                            onChange={(e) => {
                                onSendChatMessage?.(e.target.value);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const textarea = e.target as HTMLTextAreaElement;
                                    const val = textarea.value;
                                    
                                    // Move to next line visually
                                    const newValue = val + '\n';
                                    textarea.value = newValue;
                                    textarea.scrollTop = textarea.scrollHeight;
                                    onSendChatMessage?.(newValue);

                                    // After 1 second, specifically remove the first line (the message)
                                    // while keeping whatever the user might have started typing on the new line
                                    setTimeout(() => {
                                        const lines = textarea.value.split('\n');
                                        let nextVal = '';
                                        if (lines.length > 1) {
                                            // Remove the first line and join the rest
                                            nextVal = lines.slice(1).join('\n');
                                        } else {
                                            nextVal = '';
                                        }
                                        textarea.value = nextVal;
                                        onSendChatMessage?.(nextVal);
                                    }, 1000);
                                } else if (e.key === 'Escape') {
                                    onCloseChatInput?.();
                                }
                            }}
                            onBlur={() => {
                                // Small timeout to allow input processing before closing
                                setTimeout(() => onCloseChatInput?.(), 200);
                            }}
                        />
                    </div>
                </div>
            )}

        </div>

    );
});

export default Workspace;
