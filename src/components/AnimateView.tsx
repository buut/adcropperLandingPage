import React from 'react';
import LayerPreview from './LayerPreview';
import Timeline from './Timeline';
import SliderZoom from './SliderZoom';
import LazyLoad from './LazyLoad';
import { Stage, Layer, TimelineMarker, FontData } from '../App';

interface AnimateViewProps {
    stages: Stage[];
    selectedLayerIds: string[];
    onLayersSelect: (ids: string[] | ((prev: string[]) => string[])) => void;
    onUpdateLayerAnimation: (layerId: string, updates: any) => void;
    onDurationChange: (stageId: string, duration: number) => void;
    onUpdateStageMarkers: (stageId: string, markers: TimelineMarker[]) => void;
    onLayerClick: (layerId: string, stageId: string, isDoubleClick: boolean, isShift: boolean) => void;
    onAddStage: () => void;
    zoom: number;
    onZoomChange: (zoom: number | ((prev: number) => number)) => void;
    playbackStates: Record<string, { isPlaying: boolean, currentTime: number, loopsDone: number }>;
    onPlayToggle: (stageId: string) => void;
    onSeek: (stageId: string, time: number) => void;
    onCopyAnimation?: (layerId: string) => void;
    onPasteAnimation?: (layerId: string) => void;
    isPreviewMode?: boolean;
    actionStates?: Record<string, boolean>;
    onTriggerAction?: (actionId: string, isActive: boolean) => void;
    editingLayerIds?: Record<string, string | null>;
    fonts?: FontData[];
    isInteractive?: boolean;
}

const StagePreviewWrapper: React.FC<{ 
    stage: Stage; 
    zoom: number; 
    onZoomChange: (zoom: number | ((prev: number) => number)) => void;
    selectedLayerIds: string[];
    onLayerClick: (layerId: string, stageId: string, isDoubleClick: boolean, isShift: boolean) => void; 
    currentTime?: number;
    showPlayPause?: boolean;
    isPlaying?: boolean;
    onPlayToggle?: () => void;
    loopsDone?: number;
    isPreviewMode?: boolean;
    actionStates?: Record<string, boolean>;
    onTriggerAction?: (actionId: string, isActive: boolean) => void;
    editingLayerIds?: Record<string, string | null>;
    fonts?: FontData[];
    isInteractive?: boolean;
}> = ({ 
    stage, 
    zoom, 
    onZoomChange, 
    selectedLayerIds, 
    onLayerClick, 
    currentTime = 0, 
    showPlayPause, 
    isPlaying, 
    onPlayToggle, 
    loopsDone = 0, 
    isPreviewMode = false,
    actionStates = {},
    onTriggerAction,
    editingLayerIds = {},
    fonts = [],
    isInteractive = false
}) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onWheel = (e: WheelEvent) => {
            if (isPreviewMode && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (isPreviewMode) return;

            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                const delta = -e.deltaY;
                const factor = Math.min(Math.max(Math.exp(delta * 0.0008), 0.8), 1.25);
                onZoomChange((prev: number) => Math.min(Math.max(prev * factor, 0.01), 10));
            }
        };

        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [isPreviewMode, onZoomChange]);

    const getFitZoom = () => {
        const availableH = isPreviewMode ? 400 : 380; 
        const availableW = isPreviewMode ? 400 : 800;
        const zh = availableH / stage.height;
        const zw = availableW / stage.width;
        return Math.min(zh, zw, 1) * 0.9;
    };

    return (
        <div 
            ref={containerRef} 
            className={`flex-1 w-full relative custom-scrollbar ${isPreviewMode ? 'bg-white overflow-hidden' : 'bg-gray-100/30 overflow-auto'}`}
            style={{ 
            }}
        >
            {/* The outer container uses grid to center the stage without the 'shifting' issues of flex + m-auto */}
            <div 
                className={`grid min-w-full min-h-full ${isPreviewMode ? 'p-2' : 'p-10 lg:p-24'}`}
                style={{ placeItems: 'center', width: 'max-content', height: 'max-content', margin: '0 auto' }}
            >
                <div 
                    key={stage.id}
                    id={`stage-root-${stage.id}`}
                    className="relative bg-white shadow-2xl flex-shrink-0 transition-transform duration-300 ease-in-out"
                    style={(() => {
                        return {
                            width: stage.width * zoom,
                            height: stage.height * zoom,
                            background: stage.bgType === 'none' || stage.backgroundColor === 'transparent'
                                ? 'transparent'
                                : stage.bgType === 'radial'
                                ? `radial-gradient(circle, ${stage.backgroundColor}, ${stage.backgroundColor2})`
                                : stage.bgType === 'linear'
                                ? `linear-gradient(180deg, ${stage.backgroundColor}, ${stage.backgroundColor2})`
                                : stage.backgroundColor || '#ffffff',
                            overflow: stage.overflow || 'hidden',
                            transformStyle: 'preserve-3d',
                            perspective: '2000px',
                            perspectiveOrigin: '50% 50%',
                            pointerEvents: isInteractive ? 'auto' : undefined
                        };
                    })()}
                    onClick={(e) => {
                        if (!isInteractive) return;
                        console.log(`[StagePreviewWrapper] Stage clicked for stage ${stage.id}`);
                        stage.actions?.forEach(a => {
                            if (a.triggerSourceId === 'stage' && (a.triggerEvent === 'click' || !a.triggerEvent)) {
                                console.log(`[StagePreviewWrapper] Triggering stage action ${a.id} (type: ${a.actionType}, phase: ${a.config?.animationPhase})`);
                                onTriggerAction?.(a.id, !actionStates[a.id]);
                            }
                        });
                    }}
                    onMouseEnter={() => {
                        if (!isInteractive) return;
                        console.log(`[StagePreviewWrapper] mouseEnter for stage ${stage.id}`);
                        stage.actions?.forEach(a => {
                            if (a.triggerSourceId === 'stage') {
                                if (a.triggerEvent === 'hover') {
                                    console.log(`[StagePreviewWrapper] Triggering HOVER ON stage action ${a.id}`);
                                    onTriggerAction?.(a.id, true);
                                } else if (a.triggerEvent === 'hoverEnd') {
                                    console.log(`[StagePreviewWrapper] Triggering HOVER OFF (hoverEnd action) stage action ${a.id}`);
                                    onTriggerAction?.(a.id, false);
                                }
                            }
                        });
                    }}
                    onMouseLeave={() => {
                        if (!isInteractive) return;
                        console.log(`[StagePreviewWrapper] mouseLeave for stage ${stage.id}`);
                        stage.actions?.forEach(a => {
                            if (a.triggerSourceId === 'stage') {
                                if (a.triggerEvent === 'hover') {
                                    console.log(`[StagePreviewWrapper] Triggering HOVER OFF stage action ${a.id}`);
                                    onTriggerAction?.(a.id, false);
                                } else if (a.triggerEvent === 'hoverEnd') {
                                    console.log(`[StagePreviewWrapper] Triggering HOVER ON (hoverEnd action) stage action ${a.id}`);
                                    onTriggerAction?.(a.id, true);
                                }
                            }
                        });
                    }}
                >
                    {/* Inner content is scaled but its parent (above) has the PRECISE pixel dimensions (width*zoom) */}
                    <div 
                        className="absolute top-0 left-0 origin-top-left pointer-events-none"
                        style={{
                            width: stage.width,
                            height: stage.height,
                            transform: `scale(${zoom})`,
                        }}
                    >
                        <div className="w-full h-full pointer-events-none relative class3d">
                            <div id={`stage-overlay-${stage.id}`} className="absolute inset-0 pointer-events-none overflow-visible" />
                            {stage.layers.map(layer => (
                                <LayerPreview 
                                    key={layer.id} 
                                    layer={layer} 
                                    stageId={stage.id} 
                                    selectedLayerIds={selectedLayerIds}
                                    onLayerClick={onLayerClick}
                                    currentTime={currentTime}
                                    loopsDone={loopsDone}
                                    stageLoopCount={stage.loopCount}
                                    stageStopAtSecond={stage.stopAtSecond}
                                    stageDuration={stage.duration}
                                    stageFeedLoopCount={stage.feedLoopCount}
                                    isPreviewMode={isPreviewMode}
                                    isInteractive={true}
                                    stageActions={stage.actions}
                                    actionStates={actionStates}
                                    onTriggerAction={onTriggerAction}
                                    editingLayerIds={editingLayerIds}
                                    stageWidth={stage.width}
                                    stageHeight={stage.height}
                                    fonts={fonts}
                                    isPlaying={isPlaying}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const AnimateView: React.FC<Omit<AnimateViewProps, 'onZoomChange'>> = (props) => {
    const { 
        stages, 
        selectedLayerIds, 
        onLayersSelect, 
        onUpdateLayerAnimation,
        onUpdateStageMarkers,
        onDurationChange,
        onLayerClick,
        onAddStage,
        zoom: globalZoom,
        playbackStates,
        onPlayToggle,
        onSeek,
        onCopyAnimation,
        onPasteAnimation,
        isPreviewMode = false,
        actionStates = {},
        onTriggerAction,
        editingLayerIds = {},
        fonts = [],
        isInteractive = false
    } = props;

    // Ref to the main container for non-passive zoom prevention
    const mainContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const el = mainContainerRef.current;
        if (!el) return;

        const onGlobalWheel = (e: WheelEvent) => {
            if (isPreviewMode && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
            }
        };

        el.addEventListener('wheel', onGlobalWheel, { passive: false });
        return () => el.removeEventListener('wheel', onGlobalWheel);
    }, [isPreviewMode]);

    // Debug log for props
    console.log('[AnimateView] Render. Props keys:', Object.keys(props));
    console.log('[AnimateView] Render. Has onUpdateStageMarkers:', !!props.onUpdateStageMarkers);

    // Track collapsed state for each stage
    const [collapsedStageIds, setCollapsedStageIds] = React.useState<string[]>([]);
    // Track independent zoom for each stage in Animate Mode
    const [localStageZooms, setLocalStageZooms] = React.useState<Record<string, number>>({});

    // Track previous isPreviewMode to detect transition
    const prevIsPreviewMode = React.useRef(isPreviewMode);

    // Automatically set zoom to FIT when entering Preview mode or on stages change
    React.useEffect(() => {
        // Trigger auto-zoom if we just entered PreviewMode OR if stages length changed
        const shouldTrigger = (isPreviewMode && !prevIsPreviewMode.current) || (stages.length !== Object.keys(localStageZooms).length);
        
        if (shouldTrigger) {
            const initialZooms: Record<string, number> = {};
            stages.forEach(s => {
                // In Preview mode, we want a comfortable initial fit
                const availableH = isPreviewMode ? 400 : 380; 
                const availableW = isPreviewMode ? 400 : 800;
                
                const zh = availableH / s.height;
                const zw = availableW / s.width;
                const fit = Math.min(zh, zw, 1) * 0.9;
                initialZooms[s.id] = fit;
            });
            
            setLocalStageZooms(prev => ({ ...prev, ...initialZooms }));
        }
        prevIsPreviewMode.current = isPreviewMode;
    }, [stages.length, isPreviewMode]);

    // --- Animation Playback Logic removed - handled by parent App.tsx ---

    const toggleStageCollapse = (stageId: string) => {
        setCollapsedStageIds(prev => 
            prev.includes(stageId) 
                ? prev.filter(id => id !== stageId) 
                : [...prev, stageId]
        );
    };

    const handleLocalZoomChange = (stageId: string, value: number | ((prev: number) => number)) => {
        setLocalStageZooms(prev => {
            const currentZoom = prev[stageId] ?? globalZoom;
            const updatedValue = typeof value === 'function' ? value(currentZoom) : value;
            return {
                ...prev,
                [stageId]: updatedValue
            };
        });
    };

    // Handle empty state
    if (!stages || stages.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f0f2f5] text-gray-400 gap-4">
                <div className="size-16 bg-white rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-black/5">
                    <span className="material-symbols-outlined text-[32px]">layers_clear</span>
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-700">No Stages Found</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Create your first stage to start animating.</p>
                </div>
                <button 
                    onClick={onAddStage}
                    className="h-10 px-6 bg-primary hover:bg-[#0f5757] text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 mt-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add_circle</span>
                    Create New Stage
                </button>
            </div>
        );
    }

    return (
        <div 
            ref={mainContainerRef}
            className="flex-1 flex flex-col bg-[#f0f2f5] overflow-y-auto custom-scrollbar"
        >
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 20px;
                    border: 2px solid #f0f2f5;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #008080;
                }
            `}</style>
            <div className={`flex gap-8 p-8 pb-32 mx-auto w-full ${isPreviewMode ? 'flex-row flex-wrap items-start justify-center' : 'flex-col max-w-[1400px]'}`}>
                {stages.map((stage) => {
                    if (stage.visible === false) return null;
                    const isCollapsed = collapsedStageIds.includes(stage.id);
                    const stageZoom = localStageZooms[stage.id] ?? globalZoom;

                    return (
                        <div 
                            key={stage.id} 
                            className={`flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden ring-1 ring-black/5 ${isCollapsed ? 'w-[300px]' : (isPreviewMode ? 'w-fit min-w-[300px] max-w-full' : 'w-full')}`}
                            style={{
                                willChange: 'width, height'
                            }}
                        >
                            {/* Stage Header */}
                            <div 
                                className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleStageCollapse(stage.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="size-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-gray-600 shadow-sm transition-transform group-active:scale-95">
                                        <span className={`material-symbols-outlined transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>expand_more</span>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-gray-900 truncate max-w-[150px]">{stage.name}</h3>
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                            <span className="font-medium bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{stage.width}x{stage.height}</span>
                                            {!isCollapsed && (
                                                <>
                                                    <span>•</span>
                                                    <span className="font-medium text-primary">{stage.duration}s</span>
                                                </>
                                            )}
                                            {isPreviewMode && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onPlayToggle(stage.id);
                                                    }}
                                                    className={`ml-2 size-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                                                        playbackStates[stage.id]?.isPlaying 
                                                        ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' 
                                                        : 'bg-primary text-white shadow-md shadow-primary/20'
                                                    }`}
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        {playbackStates[stage.id]?.isPlaying ? 'pause' : 'play_arrow'}
                                                    </span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {!isCollapsed && (
                                    <div className="flex items-center gap-6" onClick={(e) => e.stopPropagation()}>
                                        {isPreviewMode ? (
                                            <button 
                                                onClick={() => {
                                                    const availableH = 400; 
                                                    const availableW = 400;
                                                    const zh = availableH / stage.height;
                                                    const zw = availableW / stage.width;
                                                    const fitZoom = Math.min(zh, zw, 1) * 0.9;
                                                    
                                                    const target = Math.abs(stageZoom - 1) < 0.01 ? fitZoom : 1;
                                                    handleLocalZoomChange(stage.id, target);
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-gray-600 hover:text-primary hover:border-primary/30 hover:shadow-sm transition-all active:scale-95 group"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {Math.abs(stageZoom - 1) < 0.01 ? 'zoom_out_map' : 'fullscreen'}
                                                </span>
                                                {Math.abs(stageZoom - 1) < 0.01 ? 'Fit' : '100%'}
                                            </button>
                                        ) : (
                                            <SliderZoom 
                                                min={10}
                                                max={500}
                                                value={Math.round(stageZoom * 100)}
                                                onChange={(v) => handleLocalZoomChange(stage.id, v / 100)}
                                                className="scale-90 origin-right"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Split View: Preview (Left) + Timeline (Right) or Stacked? */}
                            {!isCollapsed && (
                                <LazyLoad height={isPreviewMode ? 'auto' as any : 550} offset={500} once={true}>
                                    <div className="flex flex-col">
                                        {/* Visual Preview Area - Grows with zoom in Preview Mode */}
                                        <div className={`${isPreviewMode ? 'h-auto min-h-[300px]' : 'h-[500px]'} w-full flex border-b border-gray-200 overflow-hidden relative`}>
                                            <StagePreviewWrapper 
                                                stage={stage} 
                                                zoom={stageZoom} 
                                                onZoomChange={(val) => handleLocalZoomChange(stage.id, val)}
                                                selectedLayerIds={selectedLayerIds} 
                                                onLayerClick={onLayerClick} 
                                                currentTime={playbackStates[stage.id]?.currentTime || 0}
                                                showPlayPause={isPreviewMode}
                                                isPlaying={playbackStates[stage.id]?.isPlaying || false}
                                                onPlayToggle={() => onPlayToggle(stage.id)}
                                                loopsDone={playbackStates[stage.id]?.loopsDone || 0}
                                                isPreviewMode={isPreviewMode}
                                                isInteractive={true}
                                                actionStates={actionStates}
                                                onTriggerAction={onTriggerAction}
                                                editingLayerIds={editingLayerIds}
                                                fonts={fonts}
                                            />
                                        </div>
                                        
                                        {/* Timeline Area - This lists layers independently */}
                                        {!isPreviewMode && (
                                            <div className="h-auto min-h-[200px] border-t border-gray-100 bg-white">
                                                <Timeline 
                                                    stages={[stage]}
                                                    selectedStageId={stage.id}
                                                    selectedLayerIds={selectedLayerIds}
                                                    onLayersSelect={onLayersSelect}
                                                    duration={stage.duration}
                                                    onDurationChange={(val) => onDurationChange(stage.id, val)}
                                                    onUpdateLayerAnimation={onUpdateLayerAnimation}
                                                    onUpdateStageMarkers={onUpdateStageMarkers}
                                                    currentTime={playbackStates[stage.id]?.currentTime || 0}
                                                    isPlaying={playbackStates[stage.id]?.isPlaying || false}
                                                    onPlayToggle={() => onPlayToggle(stage.id)}
                                                    onSeek={(time) => onSeek(stage.id, time)}
                                                    onCopyAnimation={onCopyAnimation}
                                                    onPasteAnimation={onPasteAnimation}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </LazyLoad>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default AnimateView;
