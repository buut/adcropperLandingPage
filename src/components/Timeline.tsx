import React, { useState, useMemo, useRef, useEffect } from 'react';
import TimeLineToolBar from './TimeLineToolBar';
import TimeLineItemName from './TimeLineItemName';
import TimeLineItemAnimation from './TimeLineItemAnimation';
import AnimationPopup from './AnimationPopup';
import TextAnimationPopup from './TextAnimationPopup';
import { getInterpolatedKeyframeProps, snapTime } from '../utils/animations';

interface TimelineMarker {
    id: string;
    time: number;
    type: 'image';
    label?: string;
}

interface TimelineProps {
    stages: Array<{ 
        id: string; 
        name: string;
        layers: any[];
        markers?: TimelineMarker[];
    }>;
    selectedStageId: string | null;
    onRename?: (layerId: string, newName: string) => void;
    onReorder?: (stageId: string, newOrder: string[], parentId?: string) => void;
    selectedLayerIds: string[];
    onLayersSelect: (ids: string[] | ((prev: string[]) => string[])) => void;
    duration: number;
    onDurationChange: (duration: number) => void;
    onUpdateLayerAnimation?: (layerId: string, updates: any) => void;
    onUpdateTextAnimation?: (layerId: string, updates: any) => void;
    onUpdateLayer?: (layerId: string, updates: any) => void;
    onUpdateStageMarkers?: (stageId: string, markers: TimelineMarker[]) => void;
    height?: number;
    onHeightChange?: (height: number) => void;
    isResizable?: boolean;
    currentTime?: number;
    isPlaying?: boolean;
    onSeek?: (time: number) => void;
    onCopyAnimation?: (layerId: string) => void;
    onPasteAnimation?: (layerId: string) => void;
    onMoveLayer?: (layerId: string, targetParentId: string | null) => void;
    onHoverLayer?: (layerId: string | null) => void;
    onPlayToggle?: () => void;
    onTextPopupOpenChange?: (isOpen: boolean) => void;
    activeGroupId?: string | null;
    onActiveGroupChange?: (id: string | null) => void;
    onEditKeyframe?: (config: any) => void;
}

const Timeline: React.FC<TimelineProps> = ({ 
    stages, 
    selectedStageId, 
    onRename, 
    onReorder,
    onMoveLayer,
    onHoverLayer,
    onCopyAnimation,
    onPasteAnimation,
    selectedLayerIds,
    onLayersSelect,
    duration,
    onDurationChange,
    onUpdateLayerAnimation,
    onUpdateTextAnimation,
    onUpdateLayer,
    onUpdateStageMarkers,
    height,
    onHeightChange,
    isResizable = false,
    currentTime: externalCurrentTime,
    isPlaying = false,
    onPlayToggle,
    onSeek,
    onTextPopupOpenChange,
    activeGroupId,
    onActiveGroupChange,
    onEditKeyframe,
}) => {
    const selectedStage = stages.find(s => s.id === selectedStageId);
    const [draggedLayerId, setDraggedLayerId] = React.useState<string | null>(null);
    const [expandedLayerIds, setExpandedLayerIds] = React.useState<string[]>([]);
    const [expandedTextAnimationLayerIds, setExpandedTextAnimationLayerIds] = React.useState<string[]>([]);
    
    // Internal state if NOT provided externally
    const [internalTime, setInternalTime] = React.useState(0);
    const currentTime = externalCurrentTime !== undefined ? externalCurrentTime : internalTime;
    const setCurrentTime = onSeek || setInternalTime;
    const timelineScrollRef = React.useRef<HTMLDivElement>(null);
    const sidebarRef = React.useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = React.useState(false);
    const [popupConfig, setPopupConfig] = React.useState<{ x: number, y: number, type: 'entry' | 'main' | 'exit', layerId: string } | null>(null);

    // Precise last-scroll values to break synchronization loops
    const lastSidebarScrollTop = React.useRef(0);
    const lastTimelineScrollTop = React.useRef(0);

    // Marker state
    const [markerContextMenu, setMarkerContextMenu] = React.useState<{ x: number, y: number, time: number } | null>(null);
    const [trackContextMenu, setTrackContextMenu] = React.useState<{ x: number, y: number, layerId: string, time: number, segmentType?: 'entry' | 'main' | 'exit' } | null>(null);
    const [keyframeContextMenu, setKeyframeContextMenu] = React.useState<{ x: number, y: number, layerId: string, keyframeId: string } | null>(null);
    const [selectedKeyframeIds, setSelectedKeyframeIds] = React.useState<string[]>([]);
    const [selectionBox, setSelectionBox] = React.useState<{ x1: number, y1: number, x2: number, y2: number, anchorY: number } | null>(null);
    const [isSelecting, setIsSelecting] = React.useState(false);
    const [isScaling, setIsScaling] = React.useState<{ side: 'left' | 'right', startX: number, startTimes: { id: string, time: number }[] } | null>(null);
    const [isMovingGroup, setIsMovingGroup] = React.useState<{ startX: number, startTimes: { id: string, time: number }[] } | null>(null);



    const [textAnimationPopupConfig, setTextAnimationPopupConfig] = React.useState<{
        x: number;
        y: number;
        layerId: string;
        type: 'entry' | 'main' | 'exit';
    } | null>(null);

    useEffect(() => {
        onTextPopupOpenChange?.(!!textAnimationPopupConfig);
    }, [textAnimationPopupConfig, onTextPopupOpenChange]);

    const [draggedMarkerId, setDraggedMarkerId] = React.useState<string | null>(null);
    const [copiedKeyframeProps, setCopiedKeyframeProps] = React.useState<any | null>(null);

    // Debug log to check if markers prop is updating
    //console.log(`[Timeline] Rendering stage: ${selectedStageId}, Markers found:`, selectedStage?.markers?.length || 0, selectedStage?.markers);

    // Zoom state
    const [zoom, setZoom] = React.useState(1);
    const minZoom = 0.2; // 1 unit = 5s (20px per sec)
    const maxZoom = 10;  // 1 unit = 0.1s (1000px per sec)

    // Scrubber state
    // const [currentTime, setCurrentTime] = React.useState(0); // Controlled by props or internal local state
    const [isDraggingScrubber, setIsDraggingScrubber] = React.useState(false);
    const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
    const lastReorderTime = React.useRef<number>(0);
    const lastTargetId = React.useRef<string | null>(null);
    const prevActiveGroupId = React.useRef<string | null>(null);

    useEffect(() => {
        const getPath = (id: string | null): string[] => {
            if (!id || !selectedStage) return [];
            const p: string[] = [];
            const find = (layers: any[], targetId: string, currentPath: string[] = []): boolean => {
                for (const l of layers) {
                    if (l.id === targetId) {
                        p.push(...currentPath, l.id);
                        return true;
                    }
                    if (l.children && find(l.children, targetId, [...currentPath, l.id])) {
                        return true;
                    }
                }
                return false;
            };
            find(selectedStage.layers, id);
            return p;
        };

        const currentPath = getPath(activeGroupId || null);
        
        if (currentPath.length > 0) {
            setExpandedLayerIds(prev => {
                const next = [...prev];
                currentPath.forEach(id => {
                    if (!next.includes(id)) next.push(id);
                });
                return next;
            });
        }

        // Handle closing path items that are no longer active
        if (prevActiveGroupId.current && prevActiveGroupId.current !== activeGroupId) {
            const oldPath = getPath(prevActiveGroupId.current);
            const toCollapse = oldPath.filter(id => !currentPath.includes(id));
            
            if (toCollapse.length > 0) {
                setExpandedLayerIds(prev => prev.filter(id => !toCollapse.includes(id)));
            }
        }

        prevActiveGroupId.current = activeGroupId || null;
    }, [activeGroupId, selectedStage]);

    // Grid calculation for snapping and visualization
    const gridSettings = React.useMemo(() => {
        const potentialIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
        const major = potentialIntervals.find(p => p * zoom >= 60) || 1000;
        const minor = potentialIntervals.find(p => p * zoom >= 10) || major;
        return { major, minor };
    }, [zoom]);

    const getFlattenedLayers = (layers: any[], depth = 0): any[] => {
        const sorted = [...layers].sort((a, b) => b.zIndex - a.zIndex);
        let result: any[] = [];
        
        sorted.forEach(layer => {
            const isExpanded = expandedLayerIds.includes(layer.id);
            const isTextAnimExpanded = layer.type === 'text' && expandedTextAnimationLayerIds.includes(layer.id);
            
            result.push({ ...layer, depth, isGroup: layer.type === 'group', isExpanded, isTextAnimExpanded });
            
            if (isTextAnimExpanded) {
                result.push({
                    id: `${layer.id}_text_anim`,
                    parentId: layer.id,
                    type: 'text_anim_track',
                    depth: depth,
                    name: 'Text Animation',
                    hidden: layer.hidden,
                    textAnimation: layer.textAnimation
                });
            }

            if (layer.type === 'group' && isExpanded && layer.children) {
                result = [...result, ...getFlattenedLayers(layer.children, depth + 1)];
            }
        });
        
        return result;
    };

    const visibleLayers = React.useMemo(() => {
        if (!selectedStage) return [];
        return getFlattenedLayers(selectedStage.layers);
    }, [selectedStage, expandedLayerIds, expandedTextAnimationLayerIds]);
    
    // Calculate global snap targets for the timeline (markers, playhead, other boundaries)
    const commonSnapTargets = React.useMemo(() => {
        const targets = new Set<number>();
        
        // Markers
        (selectedStage?.markers || []).forEach(m => targets.add(m.time * 100));
        
        // Playhead
        targets.add(currentTime * 100);
        
        // Other layers' boundaries
        visibleLayers.forEach(layer => {
            const anim = layer.animation;
            if (anim) {
                if (anim.entry && anim.entry.duration > 0) {
                    targets.add(Math.round(anim.entry.start));
                    targets.add(Math.round(anim.entry.start + anim.entry.duration));
                }
                if (anim.main && anim.main.duration > 0) {
                    targets.add(Math.round(anim.main.start));
                    targets.add(Math.round(anim.main.start + anim.main.duration));
                }
                if (anim.exit && anim.exit.duration > 0) {
                    targets.add(Math.round(anim.exit.start));
                    targets.add(Math.round(anim.exit.start + anim.exit.duration));
                }
                if (anim.keyframes && Array.isArray(anim.keyframes)) {
                    anim.keyframes.forEach((kf: any) => targets.add(Math.round(kf.time)));
                }
            }
        });

        return Array.from(targets);
    }, [selectedStage, visibleLayers, currentTime]);

    React.useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isResizing && onHeightChange) {
                const newHeight = window.innerHeight - e.clientY;
                onHeightChange(Math.max(150, Math.min(window.innerHeight - 200, newHeight)));
            }

            if (isDraggingScrubber && timelineScrollRef.current) {
                const rect = timelineScrollRef.current.getBoundingClientRect();
                const scrollLeft = timelineScrollRef.current.scrollLeft;
                const x = e.clientX - rect.left + scrollLeft;
                const rawTimeUnits = x / zoom;
                const snapTargets = Array.from(commonSnapTargets);
                const snappedUnits = snapTime(rawTimeUnits, zoom, duration, snapTargets, 8, false);
                setCurrentTime(snappedUnits / 100);
            }

            if (draggedMarkerId && selectedStage && timelineScrollRef.current) {
                const rect = timelineScrollRef.current.getBoundingClientRect();
                const scrollLeft = timelineScrollRef.current.scrollLeft;
                const x = e.clientX - rect.left + scrollLeft;
                const rawTimeUnits = x / zoom;
                const snapTargets = (selectedStage?.markers || [])
                    .filter(m => m.id !== draggedMarkerId)
                    .map(m => m.time * 100);
                // Also snap to playhead
                snapTargets.push(currentTime * 100);
                
                const snappedUnits = snapTime(rawTimeUnits, zoom, duration, snapTargets);
                const newTime = snappedUnits / 100;
                
                const updatedMarkers = (selectedStage.markers || []).map(m => 
                    m.id === draggedMarkerId ? { ...m, time: newTime } : m
                );
                onUpdateStageMarkers?.(selectedStage.id, updatedMarkers);
            }

            if (isSelecting && selectionBox) {
                const tracksArea = document.getElementById('tracks-area');
                if (!tracksArea || !timelineScrollRef.current) return;
                
                const rect = tracksArea.getBoundingClientRect();
                const x = e.clientX - rect.left + timelineScrollRef.current.scrollLeft;
                
                // Lock vertical position and height to the starting track
                setSelectionBox(prev => prev ? { 
                    ...prev, 
                    x2: x
                } : null);
            }

            if (isScaling && selectedKeyframeIds.length > 1) {
                const dx = (e.clientX - isScaling.startX) / zoom;
                const initialTimes = isScaling.startTimes;
                
                const minT = Math.min(...initialTimes.map(k => k.time));
                const maxT = Math.max(...initialTimes.map(k => k.time));
                const oldRange = maxT - minT;
                if (oldRange <= 0) return;

                const pivot = isScaling.side === 'left' ? maxT : minT;
                const handleStart = isScaling.side === 'left' ? minT : maxT;
                const handleCurrent = handleStart + dx;
                
                const newRange = isScaling.side === 'left' ? pivot - handleCurrent : handleCurrent - pivot;
                const scale = Math.max(0.01, newRange / oldRange);

                const updates = initialTimes.map(st => ({
                    id: st.id,
                    time: Math.max(0, Math.min(duration * 100, pivot + (st.time - pivot) * scale))
                }));

                // Map of layerId -> keyframes[]
                const layerUpdates: Record<string, any[]> = {};
                updates.forEach(u => {
                    const l = visibleLayers.find(lvl => lvl.animation?.keyframes?.some((k: any) => k.id === u.id));
                    if (l) {
                        if (!layerUpdates[l.id]) layerUpdates[l.id] = [...(l.animation?.keyframes || [])];
                        const idx = layerUpdates[l.id].findIndex(k => k.id === u.id);
                        if (idx !== -1) layerUpdates[l.id][idx] = { ...layerUpdates[l.id][idx], time: u.time };
                    }
                });
                Object.entries(layerUpdates).forEach(([lId, kfs]) => {
                    onUpdateLayerAnimation?.(lId, { keyframes: kfs.sort((a, b) => a.time - b.time) });
                });
            }

            if (isMovingGroup) {
                const dx = (e.clientX - isMovingGroup.startX) / zoom;
                const minStartTime = Math.min(...isMovingGroup.startTimes.map(st => st.time));
                const maxStartTime = Math.max(...isMovingGroup.startTimes.map(st => st.time));
                
                // Clamp dx to keep the entire group within boundaries [0, duration * 100]
                const clampedDx = Math.max(-minStartTime, Math.min(duration * 100 - maxStartTime, dx));
                
                // Calculate snap for the whole group based on the first keyframe
                const firstRawTime = isMovingGroup.startTimes[0].time + clampedDx;
                const firstSnappedTime = snapTime(firstRawTime, zoom, duration, commonSnapTargets);
                const snapDelta = firstSnappedTime - firstRawTime;

                const updates = isMovingGroup.startTimes.map(st => ({
                    id: st.id,
                    time: Math.max(0, Math.min(duration * 100, st.time + clampedDx + snapDelta))
                }));
                
                // Aggregate updates by layer
                const layerUpdates: Record<string, any[]> = {};
                updates.forEach(u => {
                    const l = visibleLayers.find(lvl => lvl.animation?.keyframes?.some((k: any) => k.id === u.id));
                    if (l) {
                        if (!layerUpdates[l.id]) layerUpdates[l.id] = [...(l.animation?.keyframes || [])];
                        const idx = layerUpdates[l.id].findIndex(k => k.id === u.id);
                        if (idx !== -1) layerUpdates[l.id][idx] = { ...layerUpdates[l.id][idx], time: u.time };
                    }
                });
                Object.entries(layerUpdates).forEach(([lId, kfs]) => {
                    onUpdateLayerAnimation?.(lId, { keyframes: kfs.sort((a, b) => a.time - b.time) });
                });
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (isSelecting && selectionBox) {
                // Calculate selection
                const xMin = Math.min(selectionBox.x1, selectionBox.x2);
                const xMax = Math.max(selectionBox.x1, selectionBox.x2);
                const yMin = Math.min(selectionBox.y1, selectionBox.y2);
                const yMax = Math.max(selectionBox.y1, selectionBox.y2);

                const newlySelected: string[] = [];
                const startIdx = Math.max(0, Math.floor(yMin / 32));
                const endIdx = Math.min(visibleLayers.length - 1, Math.floor((yMax - 1) / 32));

                for (let i = startIdx; i <= endIdx; i++) {
                    const layer = visibleLayers[i];
                    if (layer) {
                        (layer.animation?.keyframes || []).forEach((kf: { id: string, time: number }) => {
                            const kfX = kf.time * zoom;
                            if (kfX >= xMin && kfX <= xMax) {
                                newlySelected.push(kf.id);
                            }
                        });
                    }
                }

                if (e.shiftKey) {
                    setSelectedKeyframeIds(prev => {
                        const next = [...prev];
                        newlySelected.forEach(id => {
                            if (!next.includes(id)) next.push(id);
                        });
                        return next;
                    });
                } else {
                    setSelectedKeyframeIds(newlySelected);
                }
            }

            if (draggedLayerId && dropTargetId && selectedStage) {
                const findParent = (layers: any[], tid: string): any | null => {
                    for (const layer of layers) {
                        if (layer.children?.some((c: any) => c.id === tid)) return layer;
                        if (layer.children) {
                            const found = findParent(layer.children, tid);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const targetParent = findParent(selectedStage.layers, dropTargetId);
                onMoveLayer?.(draggedLayerId, targetParent?.id || null);
            }

            setIsResizing(false);
            setIsDraggingScrubber(false);
            setDraggedMarkerId(null);
            setIsSelecting(false);
            setIsScaling(null);
            setIsMovingGroup(null);
            setSelectionBox(null);
            setDraggedLayerId(null);
            setDropTargetId(null);
            document.body.style.cursor = 'default';
        };

        const isAnyDragging = isResizing || isDraggingScrubber || !!draggedMarkerId || isSelecting || !!isScaling || !!isMovingGroup || !!draggedLayerId;
        if (isAnyDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            if (isResizing) document.body.style.cursor = 'ns-resize';
            if (isDraggingScrubber || draggedMarkerId) document.body.style.cursor = 'ew-resize';
            if (draggedLayerId) document.body.style.cursor = 'grabbing';
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = '';
        };
    }, [isResizing, isDraggingScrubber, draggedMarkerId, selectedStage, onHeightChange, duration, zoom, onUpdateStageMarkers, isSelecting, isScaling, isMovingGroup, selectionBox, selectedKeyframeIds, visibleLayers, onUpdateLayerAnimation, commonSnapTargets, draggedLayerId, dropTargetId]);

    const handleScrubberMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return; // Only left click for scrubber
        if (!timelineScrollRef.current) return;
        const rect = timelineScrollRef.current.getBoundingClientRect();
        const scrollLeft = timelineScrollRef.current.scrollLeft;
        const x = e.clientX - rect.left + scrollLeft;
        const timeInUnitsRaw = x / zoom;
        const timeInUnits = snapTime(timeInUnitsRaw, zoom, duration, Array.from(commonSnapTargets));
        const time = timeInUnits / 100;
        
        setCurrentTime(time);
        setIsDraggingScrubber(true);
    };

    const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentTop = e.currentTarget.scrollTop;
        if (currentTop === lastTimelineScrollTop.current) return;
        
        lastSidebarScrollTop.current = currentTop;
        if (timelineScrollRef.current) {
            timelineScrollRef.current.scrollTop = currentTop;
        }
    };

    const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const currentTop = e.currentTarget.scrollTop;
        if (currentTop === lastSidebarScrollTop.current) return;
        
        lastTimelineScrollTop.current = currentTop;
        if (sidebarRef.current) {
            sidebarRef.current.scrollTop = currentTop;
        }
    };
    const toggleExpand = (id: string) => {
        setExpandedLayerIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const minWidth = duration * 100 * zoom;





    const handleSidebarMouseDown = (e: React.MouseEvent, id: string) => {
        if (e.button !== 0) return;
        setDraggedLayerId(id);
        setDropTargetId(null);
    };

    const handleSidebarMouseEnter = (targetId: string) => {
        onHoverLayer?.(targetId);
        if (!draggedLayerId || draggedLayerId === targetId || !selectedStageId) return;

        // Throttle to avoid flickering and expensive calculations
        const now = Date.now();
        if (now - lastReorderTime.current < 50 && lastTargetId.current === targetId) return;
        lastReorderTime.current = now;
        lastTargetId.current = targetId;

        const findParent = (layers: any[], targetId: string): any | null => {
            for (const layer of layers) {
                if (layer.children?.some((c: any) => c.id === targetId)) return layer;
                if (layer.children) {
                    const found = findParent(layer.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        const findLayer = (layers: any[], targetId: string): any | null => {
            for (const layer of layers) {
                if (layer.id === targetId) return layer;
                if (layer.children) {
                    const found = findLayer(layer.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        if (selectedStage) {
            const dragParent = findParent(selectedStage.layers, draggedLayerId);
            const targetParent = findParent(selectedStage.layers, targetId);

            // If target is in a different parent, we only MARK it for drop
            if (dragParent?.id !== targetParent?.id) {
                setDropTargetId(targetId);
                return;
            }

            // Normal reorder logic (siblings) - this is safe to do live
            setDropTargetId(null);
            const siblings = dragParent ? dragParent.children : selectedStage.layers;
            const currentOrder = [...siblings].sort((a, b) => b.zIndex - a.zIndex).map((l: any) => l.id);
            
            const oldIndex = currentOrder.indexOf(draggedLayerId);
            const newIndex = currentOrder.indexOf(targetId);
            
            if (oldIndex !== -1 && newIndex !== -1) {
                const newOrder = [...currentOrder];
                newOrder.splice(oldIndex, 1);
                newOrder.splice(newIndex, 0, draggedLayerId);
                onReorder?.(selectedStageId, newOrder, dragParent?.id);
            }
        }
    };
    
    const handleSidebarMouseLeave = () => {
        onHoverLayer?.(null);
    };

    const handleAnimationRightClick = (e: React.MouseEvent, type: 'entry' | 'main' | 'exit', layerId: string) => {
        // Calculate time at click to move playhead
        if (timelineScrollRef.current) {
            const rect = timelineScrollRef.current.getBoundingClientRect();
            const scrollLeft = timelineScrollRef.current.scrollLeft;
            const x = e.clientX - rect.left + scrollLeft;
            const time = Math.max(0, Math.min(duration, x / (100 * zoom)));
            onSeek?.(time);
        }

        setPopupConfig({
            x: e.clientX,
            y: e.clientY,
            type,
            layerId
        });
    };

    return (
        <div 
            className={`bg-white border-t border-[#e5e8eb] flex flex-col shrink-0 z-[100] relative min-w-0 ${!height ? 'h-auto' : ''}`}
            style={height ? { height: `${height}px` } : {}}
            onContextMenu={(e) => e.preventDefault()}
        >

            {isResizable && (
                <div 
                    className="absolute -top-1 left-0 right-0 h-2 cursor-ns-resize z-50 hover:bg-primary/20 transition-colors"
                    onMouseDown={() => setIsResizing(true)}
                />
            )}
            <TimeLineToolBar 
                selectedStageName={selectedStage?.name} 
                duration={duration}
                onDurationChange={onDurationChange}
                zoom={zoom}
                onZoomChange={setZoom}
                minZoom={minZoom}
                maxZoom={maxZoom}
                isPlaying={isPlaying}
                onPlayToggle={onPlayToggle}
                currentTime={currentTime}
            />
            <div className="flex flex-1 overflow-hidden min-h-0">
                <div className="w-[240px] border-r border-[#e5e8eb] flex flex-col shrink-0 bg-[#f9fafb]">
                    <div className="h-7 bg-[#f1f3f5] border-b border-[#e5e8eb] px-3 flex items-center">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tracks</span>
                    </div>
                    <div 
                        ref={sidebarRef}
                        onScroll={handleSidebarScroll}
                        className="flex-1 overflow-y-auto scrollbar-hide"
                    >
                        {visibleLayers.map((track) => {
                            if (track.type === 'text_anim_track') {
                                return (
                                    <div key={track.id} className="h-8 flex items-center px-2 bg-gray-50/30 border-b border-gray-100" style={{ paddingLeft: `${(track.depth || 0) * 16 + 32}px` }}>
                                        <div className="size-5 rounded flex items-center justify-center shrink-0 bg-indigo-50/50 text-[#4f46e5] mr-2">
                                            <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>title</span>
                                        </div>
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Text Animation</span>
                                    </div>
                                );
                            }
                            return (
                                <TimeLineItemName 
                                    key={track.id}
                                    id={track.id}
                                    name={track.name} 
                                    type={track.type}
                                    isSelected={selectedLayerIds.includes(track.id)}
                                    depth={track.depth}
                                    icon={track.icon}
                                    isGroup={track.isGroup}
                                    isExpanded={track.isExpanded}
                                    isMask={track.isMask}
                                    onToggleExpand={() => toggleExpand(track.id)}
                                    onRename={onRename}
                                    isVisible={!track.hidden}
                                    onToggleVisibility={() => onUpdateLayer?.(track.id, { hidden: !track.hidden })}
                                    isLocked={!!track.locked}
                                    onToggleLock={() => {
                                        const newLocked = !track.locked;
                                        onUpdateLayer?.(track.id, { locked: newLocked });
                                        if (newLocked) {
                                            onLayersSelect(prev => prev.filter(id => id !== track.id));
                                            if (activeGroupId === track.id) {
                                                onActiveGroupChange?.(null);
                                            }
                                        }
                                    }}
                                    onClick={(e) => {
                                        if (track.locked) return;
                                        if (e.shiftKey) {
                                            onLayersSelect(prev => prev.includes(track.id) ? prev.filter(id => id !== track.id) : [...prev, track.id]);
                                        } else {
                                            onLayersSelect([track.id]);
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        if (track.locked) return;
                                        handleSidebarMouseDown(e, track.id);
                                    }}
                                    onMouseEnter={() => {
                                        if (track.locked) return;
                                        handleSidebarMouseEnter(track.id);
                                    }}
                                    onMouseLeave={handleSidebarMouseLeave}
                                    isDragging={draggedLayerId === track.id}
                                    isDropTarget={dropTargetId === track.id}
                                    onCopy={() => onCopyAnimation?.(track.id)}
                                    onPaste={() => onPasteAnimation?.(track.id)}
                                    showTextAnimationTrack={track.isTextAnimExpanded}
                                    onToggleTextAnimation={() => {
                                        const isClosing = expandedTextAnimationLayerIds.includes(track.id);
                                        
                                        if (isClosing) {
                                            // Clear animation data when closing the track
                                            onUpdateTextAnimation?.(track.id, null);
                                        } else if (!track.textAnimation && onUpdateTextAnimation) {
                                            // Default track when opening if no data exists, segmented
                                            const totalUnits = duration * 100;
                                            const entryDur = 50; 
                                            const mainDur = 100;
                                            const exitDur = 50;
                                            
                                            onUpdateTextAnimation(track.id, {
                                                entry: { start: 0, duration: entryDur },
                                                main: { start: Math.max(entryDur, (totalUnits - mainDur) / 2), duration: mainDur },
                                                exit: { start: Math.max(totalUnits - exitDur, entryDur + mainDur), duration: exitDur }
                                            });
                                        }
                                        
                                        setExpandedTextAnimationLayerIds(prev => 
                                            prev.includes(track.id) ? prev.filter(id => id !== track.id) : [...prev, track.id]
                                        );
                                    }}
                                />
                            );
                        })}
                    </div>
                </div>
                <div 
                    id={`timeline-scroll-container-${selectedStageId || 'default'}`}
                    ref={timelineScrollRef}
                    onScroll={handleTimelineScroll}
                    onWheel={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            const delta = -e.deltaY * 0.001;
                            setZoom(prev => {
                                const newZoom = prev + delta;
                                return Math.min(maxZoom, Math.max(minZoom, newZoom));
                            });
                        }
                    }}
                    className="flex-1 relative overflow-x-auto overflow-y-auto bg-[#fbfcfd] timeline-scroll-container"
                >
                    {/* Time Ruler (Sticky) */}
                    <div 
                        className="h-8 border-b border-[#e5e8eb] bg-[#f9fafb]/95 backdrop-blur-sm sticky top-0 z-[60] cursor-pointer" 
                        style={{ width: `${minWidth}px` }}
                        onMouseDown={handleScrubberMouseDown}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            if (!timelineScrollRef.current) return;
                            const rect = timelineScrollRef.current.getBoundingClientRect();
                            const scrollLeft = timelineScrollRef.current.scrollLeft;
                            const x = e.clientX - rect.left + scrollLeft;
                            const time = Math.max(0, Math.min(duration, x / (100 * zoom)));
                            setMarkerContextMenu({ x: e.clientX, y: e.clientY, time });
                        }}
                    >
                        <div className="absolute inset-x-0 bottom-0 h-1.5 pointer-events-none opacity-40"
                             style={{ 
                                 backgroundImage: `linear-gradient(90deg, #d1d5db 1px, transparent 1px)`,
                                 backgroundSize: `${gridSettings.minor * zoom}px 100%`,
                             }}></div>
                        <div className="absolute inset-x-0 bottom-0 h-3 pointer-events-none opacity-60"
                             style={{ 
                                 backgroundImage: `linear-gradient(90deg, #9ca3af 1px, transparent 1px)`,
                                 backgroundSize: `${gridSettings.major * zoom}px 100%`,
                             }}></div>
                        
                        {/* Time labels layer */}
                        <div className="absolute inset-0 z-10 pointer-events-none">
                            {(() => {
                                const steps = [];
                                const stepUnit = gridSettings.major; // in centiseconds
                                const stepSize = stepUnit / 100; // in seconds

                                for (let s = 0; s <= duration + 0.001; s += stepSize) {
                                    const timeVal = Math.round(s * 100) / 100;
                                    steps.push(
                                        <span 
                                            key={timeVal} 
                                            className="absolute top-1 text-[9px] font-black text-gray-400 -translate-x-1/2 select-none" 
                                            style={{ left: `${timeVal * 100 * zoom}px` }}
                                        >
                                            {timeVal}
                                        </span>
                                    );
                                    if (stepSize <= 0) break;
                                }
                                return steps;
                            })()}
                        </div>

                        {/* Stage Markers */}
                        {(selectedStage?.markers || []).map(marker => (
                            <div 
                                key={marker.id}
                                className="absolute top-0 z-[100] cursor-grab active:cursor-grabbing hover:scale-110 transition-transform flex flex-col items-center -translate-x-1/2 group"
                                style={{ left: `${marker.time * 100 * zoom}px`, height: '28px' }}
                                onMouseDown={(e) => {
                                    if (e.button !== 0) return; // Only left click to drag
                                    e.stopPropagation();
                                    console.log(`[Timeline] Drag start: ${marker.id}`);
                                    setDraggedMarkerId(marker.id);
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (window.confirm('Delete this marker?')) {
                                        const updated = (selectedStage!.markers || []).filter(m => m.id !== marker.id);
                                        onUpdateStageMarkers?.(selectedStage!.id, updated);
                                    }
                                }}
                            >
                                <div className="size-6 bg-[#00cccc] rounded-md flex items-center justify-center shadow-xl ring-2 ring-white hover:bg-[#00aaaa] transition-colors mt-0.5">
                                    <span className="material-symbols-outlined text-[15px] text-white select-none pointer-events-none">image</span>
                                </div>
                            </div>
                        ))}

                        {/* Red Playhead / Scrubber */}
                        <div 
                            className="absolute top-0 bottom-0 z-50 flex flex-col items-center pointer-events-none -translate-x-1/2"
                            style={{ left: `${currentTime * 100 * zoom}px` }}
                        >
                            <div className="relative flex flex-col items-center">
                                <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] border-t-red-500 shadow-sm"></div>
                                <div className="absolute -top-4 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                                    {(Math.round(currentTime * 100) / 100).toFixed(2)}
                                </div>
                            </div>
                            <div className="w-[1px] h-[2000px] bg-red-500/50 shadow-sm relative">
                                <div className="absolute inset-0 bg-red-500 w-[1px] h-full opacity-100"></div>
                            </div>
                        </div>
                    </div>

                    <div 
                        id="tracks-area"
                        className="flex-1 relative" 
                        style={{ width: `${minWidth}px` }}
                        onMouseDown={(e) => {
                            // Only left click
                            if (e.button !== 0) return;
                            
                            const target = e.target as HTMLElement;
                            // Block marquee if clicking on interactive elements
                            const isControl = target.closest('.anim-segment, .keyframe-wrapper, .timeline-marker, button');
                            if (isControl) return;

                            // Allow marquee to start from the tracks container or any track background
                            const isTrackArea = target.closest('[data-timeline-track="true"]') || target === e.currentTarget;
                            if (!isTrackArea) return;

                            if (!timelineScrollRef.current) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = e.clientX - rect.left + timelineScrollRef.current.scrollLeft;
                            const y = e.clientY - rect.top;
                            
                            const startTrackIdx = Math.max(0, Math.min(visibleLayers.length - 1, Math.floor(y / 32)));
                            const snappedY1 = startTrackIdx * 32;

                            setIsSelecting(true);
                            setSelectionBox({ x1: x, y1: snappedY1, x2: x, y2: snappedY1 + 32, anchorY: snappedY1 });
                            if (!e.shiftKey) setSelectedKeyframeIds([]);
                        }}
                    >
                        {/* Dynamic Grid for tracks */}
                        <div className="absolute inset-0 pointer-events-none"
                             style={{ 
                                 backgroundImage: `linear-gradient(90deg, #f1f3f5 1px, transparent 1px)`,
                                 backgroundSize: `${gridSettings.minor * zoom}px 100%`,
                                 opacity: 0.5
                             }}></div>
                        <div className="absolute inset-0 pointer-events-none"
                             style={{ 
                                 backgroundImage: `linear-gradient(90deg, #eceef0 1px, transparent 1px)`,
                                 backgroundSize: `${gridSettings.major * zoom}px 100%`,
                                 opacity: 0.8
                             }}></div>
                        {/* Selection Box Overlay */}
                        {isSelecting && selectionBox && (
                            <div 
                                className="absolute z-[100] border border-primary bg-primary/10 pointer-events-none"
                                style={{
                                    left: Math.min(selectionBox.x1, selectionBox.x2),
                                    top: Math.min(selectionBox.y1, selectionBox.y2),
                                    width: Math.abs(selectionBox.x2 - selectionBox.x1),
                                    height: Math.abs(selectionBox.y2 - selectionBox.y1)
                                }}
                            />
                        )}

                        {/* Transform / Scaling Box */}
                        {(() => {
                            if (selectedKeyframeIds.length <= 1 || isSelecting) return null;
                            const allKfs: any[] = [];
                            const layerIndicesWithSelection = new Set<number>();
                            
                            visibleLayers.forEach((l, idx) => {
                                const layerKfs = (l.animation?.keyframes || []).filter((k: { id: string }) => selectedKeyframeIds.includes(k.id));
                                if (layerKfs.length > 0) {
                                    allKfs.push(...layerKfs.map((k: any) => ({ ...k, layerId: l.id })));
                                    layerIndicesWithSelection.add(idx);
                                }
                            });
                            
                            if (allKfs.length < 2) return null;

                            const times = allKfs.map(k => k.time);
                            const minT = Math.min(...times);
                            const maxT = Math.max(...times);
                            const left = minT * zoom;
                            const width = (maxT - minT) * zoom;
                            
                            // Calculate vertical bounds based on tracks
                            const sortedIndices = Array.from(layerIndicesWithSelection).sort((a, b) => a - b);
                            const minIdx = sortedIndices[0];
                            const maxIdx = sortedIndices[sortedIndices.length - 1];
                            const top = minIdx * 32;
                            const height = (maxIdx - minIdx + 1) * 32;

                            return (
                                <div 
                                    className="absolute z-[150] border-2 border-primary/60 bg-primary/10 rounded-sm cursor-grab active:cursor-grabbing pointer-events-auto shadow-lg"
                                    style={{
                                        left: `${left - 6}px`,
                                        width: `${width + 12}px`,
                                        top: `${top}px`,
                                        height: `${height}px`
                                    }}
                                    onMouseDown={(e) => {
                                        if (e.button !== 0) return; // Only left click moves group
                                        e.stopPropagation();
                                        const startTimes = allKfs.map(k => ({ id: k.id, time: k.time }));
                                        setIsMovingGroup({ startX: e.clientX, startTimes });
                                    }}
                                >
                                    {/* Left Scale Handle */}
                                    <div 
                                        className="absolute left-0 top-0 bottom-0 w-[24px] cursor-ew-resize bg-primary/5 pointer-events-auto hover:bg-primary/20 group/sh -translate-x-1/2 flex items-center justify-center transition-all z-[160]"
                                        onMouseDown={(e) => { 
                                            if (e.button !== 0) return;
                                            e.stopPropagation(); 
                                            const startTimes = allKfs.map((k: any) => ({ id: k.id, time: k.time }));
                                            setIsScaling({ side: 'left', startX: e.clientX, startTimes }); 
                                        }}
                                    >
                                        <div className="w-1.5 h-8 bg-primary rounded-full group-hover/sh:bg-white transition-colors" />
                                    </div>

                                    {/* Right Scale Handle */}
                                    <div 
                                        className="absolute right-0 top-0 bottom-0 w-[24px] cursor-ew-resize bg-primary/5 pointer-events-auto hover:bg-primary/20 group/sh translate-x-1/2 flex items-center justify-center transition-all z-[160]"
                                        onMouseDown={(e) => { 
                                            if (e.button !== 0) return;
                                            e.stopPropagation(); 
                                            const startTimes = allKfs.map((k: any) => ({ id: k.id, time: k.time }));
                                            setIsScaling({ side: 'right', startX: e.clientX, startTimes }); 
                                        }}
                                    >
                                        <div className="w-1.5 h-8 bg-primary rounded-full group-hover/sh:bg-white transition-colors" />
                                    </div>

                                </div>
                            );
                        })()}

                        {/* Red Playhead extended through tracks */}
                        <div 
                            className="absolute top-0 bottom-0 w-[1px] bg-red-500/20 z-40 pointer-events-none -translate-x-1/2"
                            style={{ left: `${currentTime * 100 * zoom}px` }}
                        ></div>
                        {visibleLayers.map((track) => {
                            if (track.type === 'text_anim_track') {
                                return (
                                    <TimeLineItemAnimation 
                                        key={track.id}
                                        entry={track.textAnimation?.entry ?? { start: 0, duration: 0 }}
                                        main={track.textAnimation?.main ?? { start: 0, duration: 100 }}
                                        exit={track.textAnimation?.exit ?? { start: duration * 100, duration: 0 }}
                                        entryName={track.textAnimation?.entry?.name}
                                        mainName={track.textAnimation?.main?.name}
                                        exitName={track.textAnimation?.exit?.name}
                                        label={!(track.textAnimation?.entry?.name || track.textAnimation?.main?.name || track.textAnimation?.exit?.name) ? "TEXT ANIMATION" : undefined}
                                        labelColor="text-primary/20"
                                        onUpdate={(updates) => onUpdateTextAnimation?.(track.parentId, updates)}
                                        onClick={(e, type) => {
                                            // Move playhead
                                            if (timelineScrollRef.current) {
                                                const rect = timelineScrollRef.current.getBoundingClientRect();
                                                const scrollLeft = timelineScrollRef.current.scrollLeft;
                                                const x = e.clientX - rect.left + scrollLeft;
                                                const time = Math.max(0, Math.min(duration, x / (100 * zoom)));
                                                onSeek?.(time);
                                            }

                                            setTextAnimationPopupConfig({
                                                x: e.clientX,
                                                y: e.clientY,
                                                layerId: track.parentId,
                                                type: type
                                            });
                                        }}
                                        duration={duration}
                                        isSelected={selectedLayerIds.includes(track.parentId)}
                                        zoom={zoom}
                                        snapTargets={commonSnapTargets}
                                        keyframes={[]}
                                    />
                                );
                            }
                            return (
                                <TimeLineItemAnimation 
                                    key={track.id} 
                                    entry={track.animation?.entry ?? { start: 0, duration: 0 }}
                                    main={track.animation?.main ?? { start: 0, duration: 0 }}
                                    exit={track.animation?.exit ?? { start: 0, duration: 0 }}
                                    entryName={track.animation?.entry?.name}
                                    mainName={track.animation?.main?.name}
                                    exitName={track.animation?.exit?.name}
                                    onUpdate={(updates) => onUpdateLayerAnimation?.(track.id, updates)}
                                    duration={duration}
                                    isSelected={selectedLayerIds.includes(track.id)}
                                    className={draggedLayerId === track.id ? 'opacity-30 bg-gray-50' : ''}
                                    zoom={zoom}
                                    keyframes={track.animation?.keyframes}
                                    selectedKeyframeIds={selectedKeyframeIds}
                                    onKeyframeClick={(e, kfId) => {
                                        e.stopPropagation();
                                        if (e.shiftKey) {
                                            setSelectedKeyframeIds(prev => prev.includes(kfId) ? prev.filter(id => id !== kfId) : [...prev, kfId]);
                                        } else {
                                            setSelectedKeyframeIds([kfId]);
                                            
                                            // Synchronize playhead to keyframe time
                                            const layer = visibleLayers.find(l => l.id === track.id);
                                            const kf = layer?.animation?.keyframes?.find((k: any) => k.id === kfId);
                                            if (kf) {
                                                onSeek?.(kf.time / 100);
                                                
                                                // Automatically show keyframe properties on single click
                                                const originalKfs: Record<string, any[]> = {};
                                                visibleLayers.forEach(l => {
                                                    if (l.animation?.keyframes) originalKfs[l.id] = [...l.animation.keyframes];
                                                });
                                                onEditKeyframe?.({
                                                    layerId: track.id,
                                                    keyframeIds: [kfId],
                                                    initialProps: kf.props || {},
                                                    originalKeyframes: originalKfs
                                                });
                                            }
                                        }
                                    }}
                                    onUpdateKeyframes={(kfs) => onUpdateLayerAnimation?.(track.id, { keyframes: kfs })}
                                    onUpdateMultipleKeyframes={(updates) => {
                                        // Map of layerId -> keyframes[]
                                        const layerUpdates: Record<string, any[]> = {};
                                        updates.forEach(u => {
                                            const l = visibleLayers.find(lvl => lvl.animation?.keyframes?.some((k: any) => k.id === u.id));
                                            if (l) {
                                                if (!layerUpdates[l.id]) layerUpdates[l.id] = [...(l.animation?.keyframes || [])];
                                                const idx = layerUpdates[l.id].findIndex(k => k.id === u.id);
                                                if (idx !== -1) layerUpdates[l.id][idx] = { ...layerUpdates[l.id][idx], time: u.time };
                                            }
                                        });
                                        Object.entries(layerUpdates).forEach(([lId, kfs]) => {
                                            onUpdateLayerAnimation?.(lId, { keyframes: kfs.sort((a, b) => a.time - b.time) });
                                        });
                                    }}
                                    onKeyframeRightClick={(e, kfId) => {
                                        if (!selectedKeyframeIds.includes(kfId)) {
                                            setSelectedKeyframeIds([kfId]);
                                        }
                                        setKeyframeContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            layerId: track.id,
                                            keyframeId: kfId
                                        });
                                    }}
                                    onRightClick={(e, type) => handleAnimationRightClick(e, type, track.id)}
                                    onClick={(e, type) => handleAnimationRightClick(e, type, track.id)}
                                    onEmptyRightClick={(e) => {
                                        // Calculate time at click
                                        if (!timelineScrollRef.current) return;
                                        const rect = timelineScrollRef.current.getBoundingClientRect();
                                        const scrollLeft = timelineScrollRef.current.scrollLeft;
                                        const x = e.clientX - rect.left + scrollLeft;
                                        const time = Math.max(0, Math.min(duration, x / (100 * zoom)));
                                        
                                        setTrackContextMenu({
                                            x: e.clientX,
                                            y: e.clientY,
                                            layerId: track.id,
                                            time,
                                            segmentType: undefined
                                        } as any);
                                    }}
                                    onEmptyClick={(e) => {
                                        if (!timelineScrollRef.current) return;
                                        const rect = timelineScrollRef.current.getBoundingClientRect();
                                        const scrollLeft = timelineScrollRef.current.scrollLeft;
                                        const x = e.clientX - rect.left + scrollLeft;
                                        const timeInUnitsRaw = x / zoom;
                                        const timeInUnits = snapTime(timeInUnitsRaw, zoom, duration, Array.from(commonSnapTargets));
                                        
                                        // Move playhead
                                        onSeek?.(timeInUnits / 100);

                                        const isCustomMode = track.animation?.name === 'custom' || (track.animation?.keyframes && track.animation.keyframes.length > 0);
                                        if (isCustomMode && onEditKeyframe) {
                                            const layer = visibleLayers.find(l => l.id === track.id);
                                            const props = layer ? getInterpolatedKeyframeProps(layer.animation?.keyframes || [], timeInUnits, layer) : undefined;
                                            
                                            const originalKfs: Record<string, any[]> = {};
                                            visibleLayers.forEach(l => {
                                                if (l.animation?.keyframes) originalKfs[l.id] = [...l.animation.keyframes];
                                            });

                                            onEditKeyframe({
                                                layerId: track.id,
                                                keyframeIds: [],
                                                initialProps: { ...(props || {}) },
                                                time: timeInUnits,
                                                originalKeyframes: originalKfs
                                            });
                                        }
                                    }}
                                    snapTargets={commonSnapTargets}
                                    isTransforming={!!isScaling || !!isMovingGroup}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
            {popupConfig && (
                <AnimationPopup 
                    type={popupConfig.type}
                    onClose={() => setPopupConfig(null)}
                    layerId={popupConfig.layerId}
                    repeatCount={(() => {
                        const layer = visibleLayers.find(l => l.id === popupConfig.layerId);
                        return layer?.animation?.[popupConfig.type]?.repeat ?? 1;
                    })()}
                    onRepeatChange={(id, count) => {
                        onUpdateLayerAnimation?.(id, {
                            [popupConfig.type]: {
                                ...(visibleLayers.find(l => l.id === id)?.animation?.[popupConfig.type] || {}),
                                repeat: count
                            }
                        });
                    }}
                    currentEasing={(() => {
                        const layer = visibleLayers.find(l => l.id === popupConfig.layerId);
                        return layer?.animation?.[popupConfig.type]?.easing || (popupConfig.type === 'main' ? 'smoothstep' : 'ease-in-out');
                    })()}
                    onEasingChange={(id, easing) => {
                        onUpdateLayerAnimation?.(id, {
                            [popupConfig.type]: {
                                ...(visibleLayers.find(l => l.id === id)?.animation?.[popupConfig.type] || {}),
                                easing: easing
                            }
                        });
                    }}
                    onSelect={(anim) => {
                        console.log(`Selected ${anim} for ${popupConfig.type} on layer ${popupConfig.layerId}`);
                        onUpdateLayerAnimation?.(popupConfig.layerId, {
                            [popupConfig.type]: {
                                ...(visibleLayers.find(l => l.id === popupConfig.layerId)?.animation?.[popupConfig.type] || {}),
                                name: anim
                            }
                        });
                        setPopupConfig(null);
                    }}
                    style={{
                        left: `${popupConfig.x}px`,
                        top: `${popupConfig.y}px`
                    }}
                />
            )}

            {markerContextMenu && (
                <div 
                    className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px] animate-in fade-in zoom-in duration-100"
                    style={{ left: markerContextMenu.x, top: markerContextMenu.y }}
                >
                    <button 
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={() => {
                            if (!selectedStage) {
                                console.error('[Timeline] Cannot add marker: selectedStage is null');
                                return;
                            }
                            if (!onUpdateStageMarkers) {
                                console.error('[Timeline] Cannot add marker: onUpdateStageMarkers prop is undefined!');
                                return;
                            }
                            const newMarker: TimelineMarker = {
                                id: `marker_${Math.random().toString(36).substr(2, 9)}`,
                                time: markerContextMenu.time,
                                type: 'image'
                            };
                            console.log('[Timeline] Adding marker:', newMarker, 'to stage:', selectedStage.id);
                            const updated = [...(selectedStage.markers || []), newMarker];
                            onUpdateStageMarkers(selectedStage.id, updated);
                            setMarkerContextMenu(null);
                        }}
                    >
                        <span className="material-symbols-outlined text-[18px]">image</span>
                        Add Image Marker
                    </button>
                </div>
            )}
            
            {markerContextMenu && (
                <div 
                    className="fixed inset-0 z-[99]" 
                    onClick={() => setMarkerContextMenu(null)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setMarkerContextMenu(null);
                    }}
                ></div>
            )}

            {trackContextMenu && (
                <div 
                    className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] animate-in fade-in zoom-in duration-100"
                    style={{ left: trackContextMenu.x, top: trackContextMenu.y }}
                >
                    {(() => {
                        const layer = visibleLayers.find(l => l.id === trackContextMenu.layerId);
                        const isCustomMode = layer?.animation && 
                                           layer.animation.entry.duration === 0 && 
                                           layer.animation.main.duration === 0 && 
                                           layer.animation.exit.duration === 0;
                        
                        return (
                            <>
                                {trackContextMenu.segmentType && (
                                    <button 
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                                        onClick={() => {
                                            setPopupConfig({
                                                x: trackContextMenu.x,
                                                y: trackContextMenu.y,
                                                type: trackContextMenu.segmentType!,
                                                layerId: trackContextMenu.layerId
                                            });
                                            setTrackContextMenu(null);
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                        Animation Presets...
                                    </button>
                                )}

                                <button 
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors ${trackContextMenu.segmentType ? 'border-t border-gray-100' : ''}`}
                                    onClick={() => {
                                        if (onUpdateLayerAnimation) {
                                            if (isCustomMode) {
                                                const totalUnits = duration * 100;
                                                onUpdateLayerAnimation(trackContextMenu.layerId, {
                                                    entry: { start: 0, duration: 50 },
                                                    main: { start: Math.max(0, (totalUnits / 2) - 25), duration: 50 },
                                                    exit: { start: Math.max(0, totalUnits - 50), duration: 50 },
                                                    keyframes: []
                                                });
                                            } else {
                                                const layer = visibleLayers.find(l => l.id === trackContextMenu.layerId);
                                                const initialKeyframe = {
                                                    id: `kf_default_${Math.random().toString(36).substr(2, 5)}`,
                                                    time: 0,
                                                    props: {
                                                        x: layer?.x ?? 0,
                                                        y: layer?.y ?? 0,
                                                        width: layer?.width ?? 100,
                                                        height: layer?.height ?? 100,
                                                        rotation: layer?.rotation ?? 0,
                                                        opacity: layer?.opacity ?? 1,
                                                        transformX: 0,
                                                        transformY: 0,
                                                        transformZ: 0,
                                                        rotateX: 0,
                                                        rotateY: 0,
                                                        rotateZ: 0,
                                                        scaleX: 1,
                                                        scaleY: 1,
                                                        scaleZ: 1,
                                                        skewX: 0,
                                                        skewY: 0,
                                                        transformOrigin: 'center center',
                                                        easing: 'linear',
                                                        blur: 0,
                                                        brightness: 1,
                                                        contrast: 1,
                                                        grayscale: 0,
                                                        sepia: 0,
                                                        saturate: 1,
                                                    }
                                                };

                                                onUpdateLayerAnimation(trackContextMenu.layerId, {
                                                    entry: { start: 0, duration: 0 },
                                                    main: { start: 0, duration: 0 },
                                                    exit: { start: 0, duration: 0 },
                                                    keyframes: [initialKeyframe]
                                                });

                                                const originalKfs: Record<string, any[]> = {};
                                                visibleLayers.forEach(l => {
                                                    if (l.animation?.keyframes) originalKfs[l.id] = [...l.animation.keyframes];
                                                });
                                                onEditKeyframe?.({
                                                    layerId: trackContextMenu.layerId,
                                                    keyframeIds: [initialKeyframe.id],
                                                    initialProps: initialKeyframe.props,
                                                    originalKeyframes: originalKfs
                                                });
                                            }
                                        }
                                        setTrackContextMenu(null);
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {isCustomMode ? 'delete' : 'animation'}
                                    </span>
                                    {isCustomMode ? 'Remove Custom Animation' : 'Add Custom Animation'}
                                </button>
                                
                                {isCustomMode ? (
                                    <>
                                        <button 
                                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors border-t border-gray-100"
                                            onClick={() => {
                                                const layer = visibleLayers.find(l => l.id === trackContextMenu.layerId);
                                                const timeInUnits = trackContextMenu.time * 100;
                                                const props = layer ? getInterpolatedKeyframeProps(layer.animation?.keyframes || [], timeInUnits, layer) : undefined;
                                                
                                                if (layer && onUpdateLayerAnimation) {
                                                    const newKeyframe = {
                                                        id: `kf_${Math.random().toString(36).substr(2, 9)}`,
                                                        time: timeInUnits,
                                                        props: { ...(props || {}) }
                                                    };
                                                    const currentKeyframes = layer.animation?.keyframes || [];
                                                    const updated = [...currentKeyframes, newKeyframe].sort((a: any, b: any) => a.time - b.time);
                                                    onUpdateLayerAnimation(layer.id, { keyframes: updated });

                                                    const originalKfs: Record<string, any[]> = {};
                                                    visibleLayers.forEach(l => {
                                                        if (l.animation?.keyframes) originalKfs[l.id] = [...l.animation.keyframes];
                                                    });

                                                    onEditKeyframe?.({
                                                        layerId: trackContextMenu.layerId,
                                                        keyframeIds: [newKeyframe.id],
                                                        initialProps: newKeyframe.props,
                                                        originalKeyframes: originalKfs
                                                    });
                                                }
                                                setTrackContextMenu(null);
                                            }}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">ads_click</span>
                                            Add Keyframe at Cursor
                                        </button>


                                        {copiedKeyframeProps && (
                                            <button 
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-green-600 hover:bg-green-50 transition-colors border-t border-gray-100"
                                                onClick={() => {
                                                    const layer = visibleLayers.find(l => l.id === trackContextMenu.layerId);
                                                    if (layer && onUpdateLayerAnimation) {
                                                        const newKeyframe = {
                                                            id: `kf_${Math.random().toString(36).substr(2, 9)}`,
                                                            time: trackContextMenu.time * 100,
                                                            props: { ...copiedKeyframeProps }
                                                        };
                                                        const currentKeyframes = layer.animation?.keyframes || [];
                                                        const updated = [...currentKeyframes, newKeyframe].sort((a: any, b: any) => a.time - b.time);
                                                        onUpdateLayerAnimation(layer.id, { keyframes: updated });
                                                    }
                                                    setTrackContextMenu(null);
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">content_paste</span>
                                                Paste Keyframe Here
                                            </button>
                                        )}
                                    </>
                                ) : null}
                            </>
                        );
                    })()}
                </div>
            )}

            {trackContextMenu && (
                <div 
                    className="fixed inset-0 z-[99]" 
                    onClick={() => setTrackContextMenu(null)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setTrackContextMenu(null);
                    }}
                ></div>
            )}

            {keyframeContextMenu && (
                <div 
                    className="fixed z-[100] bg-white rounded-lg shadow-xl border border-gray-200 py-1 min-w-[140px] animate-in fade-in zoom-in duration-100"
                    style={{ left: keyframeContextMenu.x, top: keyframeContextMenu.y }}
                >
                    {(() => {
                        const isMultiple = selectedKeyframeIds.length > 1;

                        return (
                            <>
                                <button 
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors"
                                    onClick={() => {
                                        const layer = visibleLayers.find(l => l.id === keyframeContextMenu.layerId);
                                        const kf = layer?.animation?.keyframes?.find((k: any) => k.id === keyframeContextMenu.keyframeId);
                                        if (kf || isMultiple) {
                                            const originalKfs: Record<string, any[]> = {};
                                            visibleLayers.forEach(l => {
                                                if (l.animation?.keyframes) originalKfs[l.id] = [...l.animation.keyframes];
                                            });

                                             onEditKeyframe?.({
                                                layerId: keyframeContextMenu.layerId,
                                                keyframeIds: isMultiple ? selectedKeyframeIds : [keyframeContextMenu.keyframeId],
                                                initialProps: kf?.props || {},
                                                originalKeyframes: originalKfs
                                             });
                                        }
                                        setKeyframeContextMenu(null);
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[16px]">
                                        {isMultiple ? 'layers' : 'edit'}
                                    </span>
                                    {isMultiple ? `Edit ${selectedKeyframeIds.length} Keyframes` : 'Edit Keyframe'}
                                </button>
                                {!isMultiple && (
                                    <button 
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-primary/10 hover:text-primary transition-colors border-t border-gray-100"
                                        onClick={() => {
                                            const layer = visibleLayers.find(l => l.id === keyframeContextMenu.layerId);
                                            const kf = layer?.animation?.keyframes?.find((k: any) => k.id === keyframeContextMenu.keyframeId);
                                            if (kf) {
                                                setCopiedKeyframeProps(kf.props);
                                                console.log('[Timeline] Keyframe props copied:', kf.props);
                                            }
                                            setKeyframeContextMenu(null);
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                        Copy Keyframe
                                    </button>
                                )}
                                <button 
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                                    onClick={() => {
                                        const idsToDelete = isMultiple ? selectedKeyframeIds : [keyframeContextMenu.keyframeId];
                                        
                                        const layersToUpdate = new Set<string>();
                                        visibleLayers.forEach(l => {
                                            if (l.animation?.keyframes?.some((k: any) => idsToDelete.includes(k.id))) {
                                                layersToUpdate.add(l.id);
                                            }
                                        });

                                        layersToUpdate.forEach(lId => {
                                            const l = visibleLayers.find(x => x.id === lId);
                                            const newKfs = (l.animation?.keyframes || []).filter((k: any) => !idsToDelete.includes(k.id));
                                            onUpdateLayerAnimation?.(lId, { keyframes: newKfs });
                                        });

                                        setSelectedKeyframeIds([]);
                                        setKeyframeContextMenu(null);
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                    {isMultiple ? `Delete ${selectedKeyframeIds.length} Keyframes` : 'Delete Keyframe'}
                                </button>
                            </>
                        );
                    })()}
                </div>
            )}

            {keyframeContextMenu && (
                <div 
                    className="fixed inset-0 z-[99]" 
                    onClick={() => setKeyframeContextMenu(null)}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        setKeyframeContextMenu(null);
                    }}
                ></div>
            )}



            {textAnimationPopupConfig && (
                <TextAnimationPopup 
                    onClose={() => setTextAnimationPopupConfig(null)}
                    type={textAnimationPopupConfig.type}
                    onSelect={(animation) => {
                        onUpdateTextAnimation?.(textAnimationPopupConfig.layerId, {
                            [textAnimationPopupConfig.type]: {
                                ...(visibleLayers.find(l => l.parentId === textAnimationPopupConfig.layerId)?.textAnimation?.[textAnimationPopupConfig.type] || { start: 0, duration: 100 }),
                                name: animation
                            }
                        });
                        setTextAnimationPopupConfig(null);
                    }}
                    layerId={textAnimationPopupConfig.layerId}
                    style={{
                        left: textAnimationPopupConfig.x,
                        top: textAnimationPopupConfig.y,
                        position: 'fixed'
                    }}
                />
            )}
        </div>
    );
};

export default Timeline;
