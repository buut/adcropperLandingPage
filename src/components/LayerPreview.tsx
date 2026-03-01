import React from 'react';
import { createPortal } from 'react-dom';
import { applyRichTextFormat } from '../utils/richText';
import { getAnimationStyles, getInterpolatedLayerStyles } from '../utils/animations';
import { Layer, FontData, AnimationTriggerAction, LandingPageAction } from '../App';
import FontSelector from './FontSelector';
import WeightSelector from './WeightSelector';
import ColorPicker from './ColorPicker';

interface LayerPreviewProps {
    layer: Layer;
    stageId: string;
    selectedLayerIds?: string[];
    onLayerClick?: (layerId: string, stageId: string, isDoubleClick: boolean, isShift: boolean) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    currentTime?: number;
    loopsDone?: number;
    stageLoopCount?: number;
    stageStopAtSecond?: number;
    stageDuration?: number;
    stageFeedLoopCount?: number;
    isPreviewMode?: boolean;
    editingLayerIds?: Record<string, string | null>;
    onStopEditing?: (stageId?: string) => void;
    onUpdateLayers?: (layerIds: string[], updates: any) => void;
    zoom?: number;
    isChildOfAutoLayout?: boolean;
    parentFlexDirection?: 'row' | 'column';
    parentWidth?: number;
    parentHeight?: number;
    previewState?: 'default' | 'hover' | 'active';
    stageActions?: LandingPageAction[];
    actionStates?: Record<string, boolean>;
    onTriggerAction?: (actionId: string, isActive: boolean) => void;
    onLandingPageAction?: (action: LandingPageAction) => void;
    parentOverriddenTime?: number;
    stageWidth?: number;
    stageHeight?: number;
    fonts?: FontData[];
    isHovered?: boolean;
    documentColors?: string[];
    isTransforming?: boolean;
    isInteractive?: boolean;
    onHover?: (id: string | null) => void;
    isTextToolActive?: boolean;
    onMouseDown?: (e: React.MouseEvent, layerId: string) => void;
    cursor?: string;
    isPlaying?: boolean;
}

const measurementCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
const measurementDiv = typeof document !== 'undefined' ? (() => {
    const div = document.createElement('div');
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.pointerEvents = 'none';
    div.style.left = '-9999px';
    div.style.top = '-9999px';
    div.style.zIndex = '-1000';
    document.body.appendChild(div);
    return div;
})() : null;

const LayerPreview: React.FC<LayerPreviewProps> = React.memo(({
    layer,
    stageId,
    selectedLayerIds = [],
    onLayerClick,
    onContextMenu,
    currentTime = 0,
    loopsDone = 0,
    stageLoopCount = -1,
    stageStopAtSecond,
    stageDuration = 10,
    stageFeedLoopCount = -1,
    isPreviewMode = false,
    editingLayerIds = {},
    onStopEditing,
    onUpdateLayers,
    zoom = 1,
    isChildOfAutoLayout = false,
    parentFlexDirection,
    parentWidth,
    parentHeight,
    previewState = 'default',
    stageActions = [],
    actionStates = {},
    onTriggerAction,
    parentOverriddenTime,
    cursor,
    stageWidth,
    stageHeight,
    fonts = [],
    isHovered = false,
    documentColors = [],
    isTransforming = false,
    isInteractive = false,
    onHover,
    isTextToolActive = false,
    onMouseDown,
    isPlaying = false,
    onLandingPageAction,
}) => {
    const isEditing = editingLayerIds[stageId] === layer.id;
    const isTextLayer = layer.type === 'text';

    const parseColorAlpha = (color: string): number => {
        if (!color) return 1;
        if (color.startsWith('rgba')) {
            const m = color.match(/[\d.]+/g);
            return m && m.length >= 4 ? parseFloat(m[3]) : 1;
        }
        if (color.startsWith('rgb') || !color.startsWith('#')) return 1;
        return color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
    };

    const toRgba = (color: string, fillOpacity: number): string => {
        if (!color) return `rgba(0,0,0,${fillOpacity})`;
        let r = 0, g = 0, b = 0;
        if (color.startsWith('rgb')) {
            const m = color.match(/[\d.]+/g);
            if (m && m.length >= 3) {
                r = parseInt(m[0], 10); g = parseInt(m[1], 10); b = parseInt(m[2], 10);
            }
        } else if (color.startsWith('#')) {
            r = parseInt(color.slice(1, 3), 16);
            g = parseInt(color.slice(3, 5), 16);
            b = parseInt(color.slice(5, 7), 16);
        }
        const colorAlpha = parseColorAlpha(color);
        const a = colorAlpha * fillOpacity;
        return `rgba(${r},${g},${b},${a})`;
    };

    const getGradientBackground = (f: any, fillOpacity: number, layer: any) => {
        const angle = f.gradientAngle ?? 180;
        const len = f.gradientLength ?? 100;
        const cx = f.gradientCenterX ?? 50;
        const cy = f.gradientCenterY ?? 50;
        const radLen = f.gradientRadius ?? 100;
        const w = (layer.width ?? 100), h = (layer.height ?? 100);

        if (f.type === 'solid') {
            const c = toRgba(f.color || '#3B82F6', fillOpacity);
            return `linear-gradient(${c}, ${c})`;
        }
        
        if (f.type === 'linear') {
            const r = angle * Math.PI / 180;
            const L = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)) || 1;
            const p1 = 50 + (((cx/100-0.5)*w*Math.sin(r) - (cy/100-0.5)*h*Math.cos(r)) / L) * 100;
            const p2 = p1 + ((len/100*w)/L)*100;

            const rawStops = Array.isArray(f.stops) && f.stops.length > 0 
                ? [...f.stops].sort((a, b) => a.offset - b.offset)
                : [
                    { offset: 0, color: f.color || '#3B82F6' },
                    { offset: 1, color: f.color2 || '#1D4ED8' }
                ];

            const stopsString = rawStops.map(s => {
                const cssP = p1 + s.offset * (p2 - p1);
                return `${toRgba(s.color, fillOpacity)} ${cssP}%`;
            }).join(', ');

            return `linear-gradient(${angle}deg, ${stopsString})`;
        }

        if (f.type === 'radial') {
            const rawStops = Array.isArray(f.stops) && f.stops.length > 0 
                ? [...f.stops].sort((a, b) => a.offset - b.offset)
                : [
                    { offset: 0, color: f.color || '#3B82F6' },
                    { offset: 1, color: f.color2 || '#1D4ED8' }
                ];
            const stopsString = rawStops.map(s => `${toRgba(s.color, fillOpacity)} ${s.offset * 100}%`).join(', ');
            const rPx = (radLen / 100) * w;
            return `radial-gradient(circle ${rPx}px at ${cx}% ${cy}%, ${stopsString})`;
        }

        if (f.type === 'image' && f.imageUrl) {
            return `url("${f.imageUrl}")`;
        }

        return 'linear-gradient(transparent, transparent)';
    };
    if (layer.hidden && !isEditing) return null;

    const isSelected = selectedLayerIds.includes(layer.id);
    const [toolbarXOffset, setToolbarXOffset] = React.useState(0);
    const toolbarRef = React.useRef<HTMLDivElement>(null);
    // isEditing already declared above
    const hasFocused = React.useRef(false);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const videoRef = React.useRef<HTMLVideoElement>(null);
    const [interactionAnim, setInteractionAnim] = React.useState<{ active: boolean; phase: string | null; reversed?: boolean; restartKey: number } | null>(null);
    const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const [localAnimTime, setLocalAnimTime] = React.useState(0);
    const localRafRef = React.useRef<number | null>(null);
    const localAnimTimeRef = React.useRef(0);
    const localLastRef = React.useRef<number | null>(null);
    const localTimerRef = React.useRef<any>(null);
    // RAF loop: advances localAnimTime while an interaction is active.
    // requestAnimationFrame is called OUTSIDE the state updater to avoid side-effect issues.
    React.useEffect(() => {
        if (interactionAnim?.active) {
            console.log(`[LayerPreview] Starting local interaction animation for layer ${layer.id}, phase: ${interactionAnim?.phase}`);
            
            // Calculate starting time based on requested phase
            let startTime = 0;
            let maxT = stageDuration || 10;
            const phase = interactionAnim.phase;
            
            // Normalize phase names for calculation
            const isEntry = phase === 'entry' || phase === 'in';
            const isMain = phase === 'main' || phase === 'middle' || phase === 'mid';
            const isExit = phase === 'exit' || phase === 'out';
            const isAll = phase === 'all' || phase === 'full';
            
            if (isEntry && layer.animation?.entry) {
                startTime = (layer.animation.entry.start || 0) / 100;
                maxT = ((layer.animation.entry.start || 0) + (layer.animation.entry.duration || 0)) / 100;
            } else if (isMain && layer.animation?.main) {
                startTime = (layer.animation.main.start || 0) / 100;
                maxT = ((layer.animation.main.start || 0) + (layer.animation.main.duration || 0)) / 100;
            } else if (isExit && layer.animation?.exit) {
                startTime = (layer.animation.exit.start || 0) / 100;
                maxT = ((layer.animation.exit.start || 0) + (layer.animation.exit.duration || 0)) / 100;
            } else if (isAll) {
                const entryVal = layer.animation?.entry;
                const mainVal = layer.animation?.main;
                const exitVal = layer.animation?.exit;
                
                const eStart = (entryVal?.start || 0);
                const eEnd = eStart + (entryVal?.duration || 0);
                
                const mStart = (mainVal?.start ?? eEnd);
                const mEnd = mStart + (mainVal?.duration || 0);
                
                const xStart = (exitVal?.start ?? mEnd);
                const xEnd = xStart + (exitVal?.duration || 0);
                
                startTime = eStart / 100;
                maxT = xEnd / 100;
                
                console.log(`[LayerPreview] Full phase calculation: Entry(${eStart}-${eEnd}), Main(${mStart}-${mEnd}), Exit(${xStart}-${xEnd}). Total MaxT: ${maxT}`);
                
                // If everything is zero or invalid, default to stage duration
                if (maxT <= startTime) maxT = stageDuration || 10;
            }
            
            console.log(`[LayerPreview] Local animation: ${phase} from ${startTime}s to ${maxT}s for layer ${layer.id}`);
            localAnimTimeRef.current = startTime;
            localLastRef.current = null;
            setLocalAnimTime(startTime);

            const tick = (timestamp: number) => {
                if (localLastRef.current === null) localLastRef.current = timestamp;
                const delta = Math.min((timestamp - localLastRef.current) / 1000, 0.05);
                localLastRef.current = timestamp;
                
                localAnimTimeRef.current = Math.min(localAnimTimeRef.current + delta, maxT);
                setLocalAnimTime(localAnimTimeRef.current);
                
                if (localAnimTimeRef.current < maxT) {
                    localRafRef.current = requestAnimationFrame(tick);
                } else {
                    console.log(`[LayerPreview] Finished local interaction animation for layer ${layer.id}`);
                    // Clear after a pause so the user sees the final state
                    if (localTimerRef.current) clearTimeout(localTimerRef.current);
                    localTimerRef.current = setTimeout(() => {
                        setInteractionAnim(null);
                        localTimerRef.current = null;
                    }, 800); 
                }
            };
            localRafRef.current = requestAnimationFrame(tick);
        } else {
            if (localTimerRef.current) {
                clearTimeout(localTimerRef.current);
                localTimerRef.current = null;
            }
            if (localRafRef.current !== null) {
                console.log(`[LayerPreview] Stopping local interaction animation for layer ${layer.id}`);
                cancelAnimationFrame(localRafRef.current);
                localRafRef.current = null;
            }
        }
        return () => {
            if (localTimerRef.current) clearTimeout(localTimerRef.current);
            if (localRafRef.current !== null) {
                cancelAnimationFrame(localRafRef.current);
                localRafRef.current = null;
            }
        };
    }, [interactionAnim?.active, interactionAnim?.phase, stageDuration, layer.id, layer.animation?.entry?.start, layer.animation?.main?.start, layer.animation?.exit?.start]);

    // Custom select dropdown state
    const [selectOpen, setSelectOpen] = React.useState(false);
    const [selectValue, setSelectValue] = React.useState('');
    const selectRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        if (!selectOpen) return;
        const handleClose = (e: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
                setSelectOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClose);
        return () => document.removeEventListener('mousedown', handleClose);
    }, [selectOpen]);

    // Form element interactive state (for preview mode + submission)
    const [formTextValue, setFormTextValue] = React.useState('');
    const [formCheckboxChecked, setFormCheckboxChecked] = React.useState(false);
    const [formRadioValue, setFormRadioValue] = React.useState('');
    React.useEffect(() => {
        if (layer.type !== 'form-input') return;
        try {
            const m = JSON.parse(layer.variant || '{}');
            setFormTextValue(m.defaultValue || '');
            setFormCheckboxChecked(!!m.defaultChecked);
            setFormRadioValue(m.defaultValue || '');
            setSelectOpen(false);
            setSelectValue(m.defaultValue || '');
        } catch {}
    }, [layer.id]);

    const [videoPlayState, setVideoPlayState] = React.useState(false);
    const [videoMuted, setVideoMuted] = React.useState(true);
    const [videoVolume, setVideoVolume] = React.useState(1);
    const [videoCurrentTime, setVideoProgress] = React.useState(0);
    const [videoDuration, setVideoDuration] = React.useState(0);



    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) v.play();
        else v.pause();
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        const val = parseFloat(e.target.value);
        v.volume = val;
        v.muted = val === 0;
    };

    const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        const val = parseFloat(e.target.value);
        v.currentTime = val;
    };
    const selectionRangeRef = React.useRef<Range | null>(null);
    const isApplyingFormatRef = React.useRef(false);

    // UI state for the text toolbar to reflect current selection
    const [selectionState, setSelectionState] = React.useState({
        bold: false,
        italic: false,
        underline: false,
        overline: false,
        strikethrough: false,
        fontFamily: '',
        fontSize: '',
        lineHeight: '',
        fontWeight: '',
        color: '',
        letterSpacing: '',
        textTransform: ''
    });

    // Track selection while editing to ensure toolbar actions apply to the correct text
    React.useEffect(() => {
        if (editingLayerIds[stageId] !== layer.id) {
            selectionRangeRef.current = null;
            return;
        }

        const handleSelectionChange = () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                const editor = document.getElementById(`editor-${layer.id}`);
                // Only save if the selection is inside THIS editor
                if (editor && editor.contains(range.commonAncestorContainer)) {
                    selectionRangeRef.current = range.cloneRange();

                    // Update UI state for toolbar using computed styles for more accuracy
                    const container = range.commonAncestorContainer.nodeType === 3
                        ? range.commonAncestorContainer.parentElement
                        : range.commonAncestorContainer as HTMLElement;

                    if (container) {
                        const styles = window.getComputedStyle(container);
                        const decoration = styles.textDecoration;
                        setSelectionState({
                            bold: document.queryCommandState('bold'),
                            italic: document.queryCommandState('italic'),
                            underline: decoration.includes('underline'),
                            overline: decoration.includes('overline'),
                            strikethrough: decoration.includes('line-through'),
                            fontFamily: styles.fontFamily.replace(/['"]/g, '').split(',')[0],
                            fontSize: styles.fontSize,
                            lineHeight: styles.lineHeight,
                            fontWeight: styles.fontWeight === 'bold' ? '700' : styles.fontWeight === 'normal' ? '400' : styles.fontWeight,
                            color: styles.color,
                            letterSpacing: styles.letterSpacing,
                            textTransform: styles.textTransform
                        });
                    }
                }
            }
        };

        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [editingLayerIds[stageId], layer.id, stageId]);

    React.useEffect(() => {
        if (editingLayerIds[stageId] !== layer.id) {
            hasFocused.current = false;
        }
    }, [editingLayerIds[stageId], layer.id, stageId]);

    const meta = React.useMemo(() => {
        if (!layer.variant) return {};
        try {
            return JSON.parse(layer.variant);
        } catch (e) {
            return {};
        }
    }, [layer.variant]);

    const getVal = React.useCallback((key: string, prefix: string = '') => {
        const stateKey = prefix ? prefix + key.charAt(0).toUpperCase() + key.slice(1) : key;
        return meta[stateKey] !== undefined && meta[stateKey] !== '' ? meta[stateKey] : meta[key];
    }, [meta]);

    const dynamicContent = React.useMemo(() => {
        if (layer.isDynamic && Array.isArray(meta.dynamicData) && meta.dynamicData.length > 0) {
            let index = loopsDone;
            // Respect either stage loop or feed loop for "infinite" behavior
            const isInfinite = stageLoopCount === -1 || stageFeedLoopCount === -1;

            if (isInfinite) {
                index = loopsDone % meta.dynamicData.length;
            } else {
                index = Math.min(loopsDone, meta.dynamicData.length - 1);
            }
            return meta.dynamicData[index];
        }
        return null;
    }, [layer.isDynamic, meta.dynamicData, loopsDone, stageLoopCount, stageFeedLoopCount]);

    // Sync state with video element
    React.useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const updateState = () => {
            setVideoPlayState(!v.paused);
            setVideoMuted(v.muted);
            setVideoVolume(v.volume);
            setVideoProgress(v.currentTime);
            setVideoDuration(v.duration || 0);
        };

        v.addEventListener('play', updateState);
        v.addEventListener('pause', updateState);
        v.addEventListener('volumechange', updateState);
        v.addEventListener('timeupdate', updateState);
        v.addEventListener('loadedmetadata', updateState);

        return () => {
            v.removeEventListener('play', updateState);
            v.removeEventListener('pause', updateState);
            v.removeEventListener('volumechange', updateState);
            v.removeEventListener('timeupdate', updateState);
            v.removeEventListener('loadedmetadata', updateState);
        };
    }, [layer.url, dynamicContent]);

    // Sync video playback with timeline in design mode
    React.useEffect(() => {
        if (layer.type === 'video' && videoRef.current && !isPreviewMode) {
            const v = videoRef.current;
            try {
                const isLooping = meta.loop !== false;
                const targetTime = (isLooping && v.duration) 
                    ? (currentTime % v.duration) 
                    : (v.duration ? Math.min(currentTime, v.duration) : currentTime);

                if (isPlaying) {
                    // During playback, try to keep the video running to avoid constant seeking
                    if (v.paused) v.play().catch(() => {});
                    
                    // Only seek if drift is > 0.3s to avoid jitter
                    const drift = Math.abs(v.currentTime - targetTime);
                    if (drift > 0.3) {
                        v.currentTime = targetTime;
                    }
                } else {
                    // Not playing (scrubbing or stopped): jump to exact frame
                    if (!v.paused) v.pause();
                    v.currentTime = targetTime;
                }
            } catch (e) {
                // Ignore errors if video is not ready or seeking is not possible
            }
        }
    }, [currentTime, isPlaying, isPreviewMode, layer.type, meta.loop]);

    const layoutType = meta.layoutType || 'none';
    const isFillW = meta.layoutSizingInGroupWidth === 'fill';
    const isFillH = meta.layoutSizingInGroupHeight === 'fill';

    // Auto layout grubu içindeyse, eğer her iki eksen de 'fill' ise boyut sabittir.
    // Aksi takdirde text nesnesinin kendi layout tipini (auto/autoHeight) kullanmasına izin veriyoruz.
    const sizingLayoutType = (isChildOfAutoLayout && isFillW && isFillH) ? 'fixed' : layoutType;

    // Sync layer dimensions with content size (for non-fixed layouts). Adjust x,y so top-left stays fixed (layer x,y are center in rendering).
    React.useLayoutEffect(() => {
        if (layer.type !== 'text' || !contentRef.current || isPreviewMode) return;
        
        // Ölçüm gerekliliğini kontrol et:
        // 1. autoHeight: Sadece yükseklik ölçülür. Eğer isFillH true ise parent yönetir, ölçme.
        // 2. auto: Her iki eksen ölçülür. Eğer her iki eksen de fill ise parent yönetir, ölçme.
        if (isChildOfAutoLayout) {
            if (layoutType === 'autoHeight' && isFillH) return;
            if (layoutType === 'auto' && isFillW && isFillH) return;
            // Eksenlerden biri fill ise onun ölçümünü pas geçmemiz lazım
        }
        if (layoutType === 'none' || layoutType === 'fixed' || layoutType === 'fit') return;

        const layerId = layer.id;
        const oldW = Number(layer.width) || 0;
        const oldH = Number(layer.height) || 0;
        const doMeasure = () => {
            if (!contentRef.current) return;
            const elem = contentRef.current;
            let actualWidth: number;
            let actualHeight: number;
            if (layoutType === 'auto') {
                // Measure in an off-screen clone so block-level children (e.g. <div> in content)
                // don't create circular width dependency; each gets width: max-content.
                const clone = elem.cloneNode(true) as HTMLElement;
                clone.style.position = 'fixed';
                clone.style.left = '-9999px';
                clone.style.top = '0';
                clone.style.width = 'max-content';
                clone.style.whiteSpace = 'pre';
                clone.style.wordBreak = 'normal';
                clone.style.boxSizing = 'border-box';
                clone.style.zoom = '1';
                clone.style.transform = 'none';
                const blockTags = ['div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'];
                blockTags.forEach((tag) => {
                    clone.querySelectorAll(tag).forEach((el) => {
                        (el as HTMLElement).style.display = 'block';
                        (el as HTMLElement).style.width = 'max-content';
                    });
                });
                document.body.appendChild(clone);
                actualWidth = Math.round(clone.getBoundingClientRect().width);
                actualHeight = Math.round(clone.getBoundingClientRect().height);
                clone.remove();
            } else {
                actualWidth = Math.round(elem.scrollWidth);
                actualHeight = Math.round(elem.scrollHeight);
            }
            if (layoutType === 'auto') {
                const padX = 8;
                const w = Math.max(2, actualWidth + padX);
                const h = Math.max(1, actualHeight);
                const updates: any = {};
                
                const align = meta.textAlign || 'left';
                const vAlign = meta.verticalAlign || 'top';

                if (Math.abs(w - oldW) > 2) {
                    updates.width = w;
                    // Adjust X based on alignment
                    if (align === 'left') {
                        updates.x = (layer.x ?? 0) + (w - oldW) / 2;
                    } else if (align === 'right') {
                        updates.x = (layer.x ?? 0) - (w - oldW) / 2;
                    }
                    // if center, x stays same (expands both ways)
                }
                
                if (!isFillH && Math.abs(h - oldH) > 2) {
                    updates.height = h;
                    // Adjust Y based on vertical alignment
                    if (vAlign === 'top') {
                        updates.y = (layer.y ?? 0) + (h - oldH) / 2;
                    } else if (vAlign === 'bottom') {
                        updates.y = (layer.y ?? 0) - (h - oldH) / 2;
                    }
                    // if middle, y stays same (expands both ways)
                }

                if (Object.keys(updates).length > 0) {
                    onUpdateLayers?.([layerId], updates);
                }
            } else if (layoutType === 'autoHeight' && !isFillH) {
                if (Math.abs(actualHeight - oldH) > 2) {
                    const vAlign = meta.verticalAlign || 'top';
                    let centerY = (layer.y ?? 0);
                    
                    if (vAlign === 'top') {
                        centerY += (actualHeight - oldH) / 2;
                    } else if (vAlign === 'bottom') {
                        centerY -= (actualHeight - oldH) / 2;
                    }
                     // if middle, y stays same

                    // If vAlign is top (default), existing logic was correct. 
                    // But for consistency we apply alignment logic here too.
                    // NOTE: Previous code forced top-align behavior implicitly. 
                    
                    const updates: any = { height: actualHeight };
                    if (Math.abs(centerY - (layer.y ?? 0)) > 0.01) {
                         updates.y = centerY;
                    }
                    onUpdateLayers?.([layerId], updates);
                }
            }
        };

        if (layoutType === 'auto') {
            requestAnimationFrame(() => {
                requestAnimationFrame(doMeasure);
            });
        } else {
            doMeasure();
        }
    }, [meta.label, meta.fontSize, meta.fontFamily, meta.fontWeight, meta.letterSpacing, meta.lineHeight, layoutType, layer.id, isPreviewMode, isEditing, isChildOfAutoLayout]);

    // Sync group dimensions for "hug" sizing: grup içi her elemanın w/h değerini kullanarak hesapla
    React.useLayoutEffect(() => {
        if (layer.type !== 'group' || isPreviewMode) return;
        const isAuto = meta.layoutMode === 'auto';
        if (!isAuto) return;

        const children = (layer.children || []).filter((c: any) => !c.isMask);
        const n = children.length;
        const gap = meta.gap === 'auto' ? 0 : (Number(meta.gap) || 0);
        const pl = Number(meta.paddingLeft ?? meta.paddingHorizontal ?? meta.padding ?? 0);
        const pr = Number(meta.paddingRight ?? meta.paddingHorizontal ?? meta.padding ?? 0);
        const pt = Number(meta.paddingTop ?? meta.paddingVertical ?? meta.padding ?? 0);
        const pb = Number(meta.paddingBottom ?? meta.paddingVertical ?? meta.padding ?? 0);
        const isRow = (meta.flexDirection || 'row') === 'row';
        const currentW = Number(layer.width) || 0;
        const currentH = Number(layer.height) || 0;

        // Grup içi elemanın genişlik/yükseklik: layer.width, layer.height (variant’ta varsa oradan da)
        const getChildSize = (c: any): { w: number; h: number } => {
            let w = Number(c?.width);
            let h = Number(c?.height);
            if (!Number.isFinite(w)) w = 0;
            if (!Number.isFinite(h)) h = 0;
            if (w <= 0 || h <= 0) {
                try {
                    const v = typeof c?.variant === 'string' ? JSON.parse(c.variant || '{}') : (c?.variant || {});
                    if (Number.isFinite(v.width)) w = w <= 0 ? Number(v.width) : w;
                    if (Number.isFinite(v.height)) h = h <= 0 ? Number(v.height) : h;
                } catch (_) { }
            }
            // İç içe grup: boyut hâlâ 0 ise kendi çocuklarından bounding box hesapla (recursive)
            if ((c?.type === 'group') && (w <= 0 || h <= 0)) {
                const subKids = (c.children || []).filter((cc: any) => !cc.isMask);
                if (subKids.length > 0) {
                    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                    for (const cc of subKids) {
                        const { w: cw, h: ch } = getChildSize(cc);
                        if (cw <= 0 || ch <= 0) continue;
                        const cx = Number(cc?.x) || 0;
                        const cy = Number(cc?.y) || 0;
                        const left = cx - cw / 2, right = cx + cw / 2, top = cy - ch / 2, bottom = cy + ch / 2;
                        minX = Math.min(minX, left); maxX = Math.max(maxX, right);
                        minY = Math.min(minY, top); maxY = Math.max(maxY, bottom);
                    }
                    if (minX !== Infinity && maxX > minX && maxY > minY) {
                        if (w <= 0) w = maxX - minX;
                        if (h <= 0) h = maxY - minY;
                    }
                }
            }
            return { w: Math.max(0, w), h: Math.max(0, h) };
        };

        // İçerik boyutu: sadece çocukların w/h değerlerinden (row: toplam genişlik + gap, column: max genişlik; yükseklik her zaman max)
        const getContentSizeFromChildren = (): { contentWidth: number; contentHeight: number } => {
            if (n === 0) return { contentWidth: 0, contentHeight: 0 };
            const sizes = children.map((c: any) => getChildSize(c));
            const widths = sizes.map(s => s.w);
            const heights = sizes.map(s => s.h);
            const maxW = widths.length ? Math.max(...widths) : 0;
            const maxH = heights.length ? Math.max(...heights) : 0;
            if (isRow) {
                const sumW = sizes.reduce((acc, s) => acc + s.w, 0) + (n - 1) * gap;
                return { contentWidth: sumW, contentHeight: maxH };
            }
            const sumH = sizes.reduce((acc, s) => acc + s.h, 0) + (n - 1) * gap;
            return { contentWidth: maxW, contentHeight: sumH };
        };

        const { contentWidth: contentWidthFromChildren, contentHeight: contentHeightFromChildren } = getContentSizeFromChildren();

        // Konsola: grup içindeki nesneler ve boyutları
        if (n > 0) {
            const items = children.map((c: any) => {
                const { w, h } = getChildSize(c);
                return {
                    id: c?.id,
                    name: c?.name,
                    type: c?.type,
                    x: Number(c?.x),
                    y: Number(c?.y),
                    width: Number(c?.width),
                    height: Number(c?.height),
                    computedWidth: w,
                    computedHeight: h,
                };
            });
            console.log(`[Group ${layer.id}] içindeki nesneler (${n} adet):`, items);
            console.log(`[Group ${layer.id}] toplam content: ${contentWidthFromChildren} x ${contentHeightFromChildren}`);
        }

        const applyHug = (hugWidth: number, hugHeight: number) => {
            const HUG_UPDATE_THRESHOLD = 0.5;
            const updates: any = {};
            const currentW = Number(layer.width) || 0;
            const currentH = Number(layer.height) || 0;

            if (meta.layoutSizingHorizontal === 'hug') {
                let w = Math.round(Math.max(1, hugWidth > 0 ? hugWidth : currentW));
                if (n > 0 && w <= 0) {
                    const { contentWidth: cw } = getContentSizeFromChildren();
                    w = Math.max(1, cw + pl + pr, currentW);
                }
                if (w > 0 && Math.abs(w - currentW) > HUG_UPDATE_THRESHOLD) {
                    updates.width = w;
                    // Keep top-left stationary (center coordinate update)
                    updates.x = (layer.x - currentW / 2) + w / 2;
                }
            }
            if (meta.layoutSizingVertical === 'hug') {
                let h = Math.round(Math.max(1, hugHeight > 0 ? hugHeight : currentH));
                if (n > 0 && h <= 0) {
                    const { contentHeight: ch } = getContentSizeFromChildren();
                    h = Math.max(1, ch + pt + pb, currentH);
                }
                if (h > 0 && Math.abs(h - currentH) > HUG_UPDATE_THRESHOLD) {
                    updates.height = h;
                    // Keep top-left stationary (center coordinate update)
                    updates.y = (layer.y - currentH / 2) + h / 2;
                }
            }
            if (Object.keys(updates).length > 0) onUpdateLayers?.([layer.id], updates);
        };

        // 1) Modelden hesapla: grup içi her elemanın w/h değeri kullanılır; tam sayıya yuvarla (jitter önleme)
        let contentWidth = contentWidthFromChildren;
        let contentHeight = contentHeightFromChildren;
        let hugWidth = Math.round(contentWidth + pl + pr);
        let hugHeight = Math.round(contentHeight + pt + pb);
        if (!Number.isFinite(hugWidth) || hugWidth <= 0) hugWidth = Math.max(1, currentW);
        if (!Number.isFinite(hugHeight) || hugHeight <= 0) hugHeight = Math.max(1, currentH);

        // 2) Bir frame sonra DOM’dan sadece gerçek flex öğelerini (boyutlu node’lar) ölç
        if (n > 0) {
            let raf2: number;
            const rafId = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => {
                    const el = contentRef.current;
                    if (!el || !el.children) {
                        applyHug(Math.max(1, hugWidth, currentW), Math.max(1, hugHeight, currentH));
                        return;
                    }
                    const gapNum = gap;
                    const isRowLayout = isRow;
                    const rects: { w: number; h: number }[] = [];
                    for (let i = 0; i < el.children.length; i++) {
                        const child = el.children[i] as HTMLElement;
                        if (child.nodeType !== 1) continue;
                        const rect = child.getBoundingClientRect();
                        
                        let w = rect.width / (zoom || 1);
                        let h = rect.height / (zoom || 1);

                        // LOOP & GROWTH FIX:
                        // Resizing moduna göre 'source of truth' seçmeliyiz:
                        // 1. Fixed veya Fill: Model boyutu esastır (DOM stretch/scale olabilir).
                        // 2. Hug (Auto): DOM boyutu esastır (çünkü içeriğe göre genişleyen budur).
                        const childId = child.getAttribute('id');
                        const childModel = children.find(c => c.id === childId);
                        if (childModel) {
                            let cMeta: any = {};
                            try { cMeta = JSON.parse(childModel.variant || '{}'); } catch {}
                            
                            const isText = childModel.type === 'text';
                            const isGroup = childModel.type === 'group';
                            
                            // Horizontal Sizing Check
                            const cSizingW = isGroup ? (cMeta.layoutSizingHorizontal || 'fixed') : 
                                            (isText ? (cMeta.layoutType === 'auto' ? 'hug' : 'fixed') : 'fixed');
                            const cFillW = cMeta.layoutSizingInGroupWidth === 'fill';

                            if (cFillW || cSizingW === 'fixed') {
                                w = Number(childModel.width) || 0;
                            }

                            // Vertical Sizing Check
                            const cSizingH = isGroup ? (cMeta.layoutSizingVertical || 'fixed') : 
                                            (isText ? (cMeta.layoutType === 'auto' || cMeta.layoutType === 'autoHeight' ? 'hug' : 'fixed') : 'fixed');
                            const cFillH = cMeta.layoutSizingInGroupHeight === 'fill';

                            if (cFillH || cSizingH === 'fixed') {
                                h = Number(childModel.height) || 0;
                            }
                        }

                        if (w < 0.5 && h < 0.5) continue;
                        rects.push({ w, h });
                    }
                    if (rects.length === 0) {
                        applyHug(Math.max(1, hugWidth, currentW), Math.max(1, hugHeight, currentH));
                        return;
                    }
                    let measuredW: number;
                    let measuredH: number;
                    const maxH = rects.length ? Math.max(...rects.map(r => r.h)) : 0;
                    if (isRowLayout) {
                        const sumW = rects.reduce((s, r) => s + r.w, 0);
                        measuredW = sumW + (rects.length - 1) * gapNum + pl + pr;
                        measuredH = maxH + pt + pb;
                    } else {
                        const maxW = Math.max(...rects.map(r => r.w));
                        measuredW = maxW + pl + pr;
                        measuredH = maxH + pt + pb;
                    }
                    // Tam sayıya yuvarla – taşımada subpixel jitter horizontal/vertical hizayı bozmasın
                    measuredW = Math.round(measuredW);
                    measuredH = Math.round(measuredH);
                    const safeW = (measuredW > 0 && measuredH > 0) ? Math.max(hugWidth, measuredW) : (hugWidth > 0 ? hugWidth : currentW);
                    const safeH = (measuredW > 0 && measuredH > 0) ? Math.max(hugHeight, measuredH) : (hugHeight > 0 ? hugHeight : currentH);
                    applyHug(Math.max(1, Math.round(safeW)), Math.max(1, Math.round(safeH)));
                });
            });
            return () => {
                cancelAnimationFrame(rafId);
                if (typeof raf2 === 'number') cancelAnimationFrame(raf2);
            };
        }

        applyHug(hugWidth, hugHeight);
    }, [
        layer.children,
        layer.width,
        layer.height,
        meta.layoutMode,
        meta.layoutSizingHorizontal,
        meta.layoutSizingVertical,
        meta.gap,
        meta.padding,
        meta.paddingLeft,
        meta.paddingRight,
        meta.paddingTop,
        meta.paddingBottom,
        meta.flexDirection,
        layer.id,
        isPreviewMode,
        onUpdateLayers,
        layer.children?.map((c: any) => `${c.id}:${c.width}:${c.height}`).join('|'),
    ]);

    // Fill width/height: grup içindeki elemanın w/h değerini grubun genişlik/yüksekliğine eşitle
    React.useLayoutEffect(() => {
        if (!isChildOfAutoLayout || !onUpdateLayers || isPreviewMode) return;
        const fillW = meta.layoutSizingInGroupWidth === 'fill';
        const fillH = meta.layoutSizingInGroupHeight === 'fill';
        if (!fillW && !fillH) return;
        const updates: any = {};
        if (fillW && parentWidth != null && Number(parentWidth) > 0) {
            const pw = Math.round(Number(parentWidth));
            if (Math.abs((Number(layer.width) || 0) - pw) > 0.5) updates.width = pw;
        }
        if (fillH && parentHeight != null && Number(parentHeight) > 0) {
            const ph = Math.round(Number(parentHeight));
            if (Math.abs((Number(layer.height) || 0) - ph) > 0.5) updates.height = ph;
        }
        if (Object.keys(updates).length > 0) onUpdateLayers([layer.id], updates);
    }, [isChildOfAutoLayout, isPreviewMode, onUpdateLayers, layer.id, layer.width, layer.height, meta.layoutSizingInGroupWidth, meta.layoutSizingInGroupHeight, parentWidth, parentHeight]);

    const applyFormat = React.useCallback((command: string, value: any) => {
        const editorId = `editor-${layer.id}`;
        const editor = document.getElementById(editorId);
        if (!editor) return;

        // Ensure we operate on the correct selection
        if (selectionRangeRef.current) {
            const sel = window.getSelection();
            if (sel) {
                sel.removeAllRanges();
                sel.addRange(selectionRangeRef.current);
            }
        } else {
            editor.focus();
        }

        // Use Unified Surgical Styling Logic
        applyRichTextFormat(editorId, command, value);

        // Persist changes
        const newMeta = { ...meta, label: editor.innerHTML };
        onUpdateLayers?.([layer.id], { variant: JSON.stringify(newMeta) });

        // Update selection ref to the live range
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            selectionRangeRef.current = sel.getRangeAt(0).cloneRange();
        }
    }, [layer.id, meta, onUpdateLayers]);


    const typography = React.useMemo(() => {
        const calculateStyles = (prefix: string = '') => {
            const isFontSizeAuto = (layoutType === 'fit') || (!getVal('fontSize', prefix) && layoutType === 'fixed');
            const fontFamily = getVal('fontFamily', prefix) || 'Outfit';
            const fontWeight = getVal('fontWeight', prefix) || (layer.type === 'button' ? '800' : '400');
            const letterSpacing = parseFloat(getVal('letterSpacing', prefix)) || 0;
            const textTransform = getVal('textTransform', prefix) || (layer.type === 'button' ? 'uppercase' : 'none');
            const rawLabel = (dynamicContent || meta.label || layer.url || '').toString();
            const isHTML = /<[a-z][\s\S]*>/i.test(rawLabel);
            const textForCanvas = rawLabel.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');

            let fontSize = parseFloat(getVal('fontSize')) || (layer.type === 'text' ? 24 : 16);
            let letterSpacingValue = parseFloat(getVal('letterSpacing')) || 0; // Local variable for the calculated result
            const baseLetterSpacing = letterSpacingValue;
            let scale = 1;
            const maxLines = parseInt(meta.maxLines) || 0;
            const lineHeightStr = getVal('lineHeight') || '1.2';
            const lineHeightValue = parseFloat(lineHeightStr);
            let computedLineHeight = lineHeightStr; // Initialize with default


            const overflowBehavior = getVal('overflowBehavior') || 'truncate';
            const isShrinkToFit = overflowBehavior === 'shrink';

            const isScalingMode = (layoutType === 'fit') || isShrinkToFit ||
                (!getVal('fontSize') && (layoutType === 'none' || layoutType === 'fixed'));

            if (isScalingMode && measurementDiv) {
                // Determine precise available space by subtracting fixed padding AND dynamic borders
                const bLeft = parseFloat(getVal('borderLeftWidth') ?? getVal('borderWidth') ?? '0');
                const bRight = parseFloat(getVal('borderRightWidth') ?? getVal('borderWidth') ?? '0');
                const bTop = parseFloat(getVal('borderTopWidth') ?? getVal('borderWidth') ?? '0');
                const bBottom = parseFloat(getVal('borderBottomWidth') ?? getVal('borderWidth') ?? '0');

                // Calculate precise padding from meta
                const pLeft = parseFloat(getVal('paddingLeft') ?? getVal('paddingHorizontal') ?? getVal('padding') ?? (layer.type === 'button' ? 20 : 4));
                const pRight = parseFloat(getVal('paddingRight') ?? getVal('paddingHorizontal') ?? getVal('padding') ?? (layer.type === 'button' ? 20 : 4));
                const pTop = parseFloat(getVal('paddingTop') ?? getVal('paddingVertical') ?? getVal('padding') ?? 0);
                const pBottom = parseFloat(getVal('paddingBottom') ?? getVal('paddingVertical') ?? getVal('padding') ?? 0);

                const paddingX = pLeft + pRight;
                const paddingY = pTop + pBottom;
                
                // We use a small safety height buffer to prevent bottom clipping
                const safetyHeight = layer.type === 'button' ? 4 : 0;

                // Safety Buffers
                // 1. Horizontal: Prevent sub-pixel wrapping issues.
                const SAFETY_BUFFER = 2;
                const availableWidth = Math.max(1, layer.width - paddingX - bLeft - bRight - SAFETY_BUFFER);
                const availableHeight = Math.max(1, layer.height - paddingY - safetyHeight - bTop - bBottom - 1);

                const baseFs = parseFloat(getVal('fontSize')) || 24;
                const lineHeightStr = getVal('lineHeight') || '1.2';
                // We keep line height string for assignment to style

                // Fit: try multiple line heights so text fits in the box (use first that fits)
                const lhTries = layoutType === 'fit' ? ['0.8', '0.9', '1.0', '1.1', '1.2'] : [lineHeightStr];

                // Constrain available height by maxLines if provided, especially for Shrink to Fit or Fit Text
                const effectiveAvailableHeight = (maxLines > 0)
                    ? (layoutType === 'autoHeight' 
                        ? (maxLines * (parseFloat(lineHeightStr) || 1.2) * baseFs)
                        : Math.min(availableHeight, maxLines * (parseFloat(lineHeightStr) || 1.2) * baseFs))
                    : availableHeight;

                let fitLineHeightUsed = lineHeightStr;

                for (const lhTry of lhTries) {
                    if (layoutType === 'fit') {
                        measurementDiv.style.lineHeight = lhTry;
                        fitLineHeightUsed = lhTry;
                    }

                    // Configure Measurement Div (Twin of the real text)
                    measurementDiv.style.fontSize = baseFs + 'px';
                    measurementDiv.style.fontFamily = `${fontFamily}, sans-serif`;
                    measurementDiv.style.fontWeight = fontWeight;
                    measurementDiv.style.letterSpacing = baseLetterSpacing + 'px';
                    measurementDiv.style.textTransform = textTransform;

                    measurementDiv.style.lineHeight = layoutType === 'fit' ? lhTry : lineHeightStr;

                    measurementDiv.style.whiteSpace = ((layoutType === 'none' || layoutType === 'fixed') && !getVal('fontSize') && maxLines === 0) ? 'nowrap' : 'pre-wrap';
                    measurementDiv.style.wordBreak = 'break-word';
                    measurementDiv.style.padding = '0px';
                    measurementDiv.style.boxSizing = 'border-box';
                    measurementDiv.style.display = 'inline-block';
                    measurementDiv.style.zoom = '1';
                    measurementDiv.innerHTML = rawLabel;

                    // --- STAGE 1: Calculate Reference Dimensions ---
                    measurementDiv.style.maxWidth = 'none';
                    measurementDiv.style.width = 'auto';
                    measurementDiv.style.whiteSpace = 'nowrap';
                    const naturalSingleLineWidth = (measurementDiv.getBoundingClientRect().width || 1);

                    // Measure the actual rendered single-line height (e.g. 24px * 1.2 = 28.8px)
                    const computedStyle = window.getComputedStyle(measurementDiv);
                    const lhVal = parseFloat(layoutType === 'fit' ? lhTry : lineHeightStr);
                    const singleLineHeightPx = parseFloat(computedStyle.lineHeight) || (baseFs * lhVal);

                    // Restore wrapping mode
                    // If maxLines is 1 or Shrink to Fit is forcing a single line, use nowrap
                    const shouldWrap = !(((layoutType === 'none' || layoutType === 'fixed') && !getVal('fontSize') && maxLines === 0) || (maxLines === 1));
                    measurementDiv.style.whiteSpace = shouldWrap ? 'pre-wrap' : 'nowrap';

                    // --- STAGE 2: V6 "Brute Force Aspect Match" ---
                    // Goal: Find the wrapping width that results in a text block shape that matches the container's shape,
                    // thereby allowing the Maximum Scale factor.

                    // 1. Definition of Space
                    // const aspectTarget = availableWidth / availableHeight; // Unused

                    // 2. Scan Range
                    // We must unwrap to find the natural max width
                    measurementDiv.style.maxWidth = 'none';
                    measurementDiv.style.whiteSpace = 'nowrap';
                    const fullLineWidth = measurementDiv.getBoundingClientRect().width;

                    // Find min width (approximate logic: longest word)
                    const minSweepWidth = baseFs * 2;

                    let bestWidth = fullLineWidth;
                    let maxPossibleScale = 0;

                    // Scan 12 steps (reduced from 20 for perf, verification catches errors)
                    const scanSteps = 12;

                    for (let i = 0; i <= scanSteps; i++) {
                        const ratio = i / scanSteps;
                        const testW = minSweepWidth + (fullLineWidth - minSweepWidth) * ratio;

                        // Apply Test
                        measurementDiv.style.maxWidth = testW + 'px';
                        measurementDiv.style.whiteSpace = maxLines === 1 ? 'nowrap' : 'pre-wrap';

                        const rect = measurementDiv.getBoundingClientRect();
                        const mW = Math.max(rect.width, 1);
                        const mH = Math.max(rect.height, 1);

                        // Calculate Line Count
                        const approximateLines = Math.round(mH / singleLineHeightPx);

                        // Strictly skip if we exceed maxLines when doing Shrink to Fit
                        // BUT if maxLines is 1, we are using nowrap, so lines will always be 1
                        if (maxLines > 1 && approximateLines > maxLines) {
                            continue;
                        }

                        // Calculate Scale for this configuration
                        const scaleW = availableWidth / (mW + 1);
                        const scaleH = effectiveAvailableHeight / (mH + 1);
                        const fitScale = Math.min(scaleW, scaleH);

                        if (fitScale > maxPossibleScale) {
                            maxPossibleScale = fitScale;
                            bestWidth = testW;
                        }
                    }

                    // Fallback: If no wrapped configuration met the line limit, use the full width (1-line) scale
                    if (maxPossibleScale === 0 || maxLines === 1) {
                        const scaleW = availableWidth / (fullLineWidth + 1);
                        const scaleH = effectiveAvailableHeight / (singleLineHeightPx + 1);
                        // If maxLines is 1, always use the fallback scale to ensure it fits on one line
                        maxPossibleScale = Math.min(scaleW, scaleH);
                        bestWidth = fullLineWidth;
                    }

                    // Initial Winner
                    scale = layoutType === 'fit' ? maxPossibleScale * 0.96 : Math.min(1, maxPossibleScale * 0.96); // 4% safety buffer

                    // --- STAGE 2.5: Verification & Correction Loop ---
                    // The logical "Best Fit" might fail in reality due to sub-pixel rendering or CSS 'calc' rounding.
                    // We MUST simulate the EXACT condition of the Ghost Div:
                    // Ghost Width = availableWidth / Scale. (Since visual width = AvailW)
                    // If this specific width causes a wrap that overflows height, we must reduce scale.
                    // Reducing scale -> Increases CSS Width -> Unwraps text -> Fits.

                    let fitSucceeded = false;
                    if (layoutType === 'fit' || isShrinkToFit) {
                        for (let retry = 0; retry < 5; retry++) {
                            const cssWidth = availableWidth / scale;
                            measurementDiv.style.maxWidth = 'none';
                            measurementDiv.style.width = cssWidth + 'px';
                            measurementDiv.style.whiteSpace = maxLines === 1 ? 'nowrap' : 'pre-wrap';

                            const rect = measurementDiv.getBoundingClientRect();
                            const visualH = rect.height * scale;
                            const currentLines = Math.round(rect.height / singleLineHeightPx);

                            // Check Vertical Fit AND Line Count Fit
                            const hFits = visualH <= availableHeight + 1;
                            const lineFits = maxLines > 0 ? (currentLines <= maxLines) : true;

                            if (hFits && lineFits) {
                                fitSucceeded = true;
                                break; 
                            }
                            scale *= 0.95;
                        }
                        if (fitSucceeded) break; 
                    } else {
                        break;
                    }
                }

                // Auto Height + Max Lines: verify wrapped height fits in maxLines, reduce scale if needed
                if (layoutType === 'autoHeight' && maxLines > 0) {
                    for (let retry = 0; retry < 8; retry++) {
                        const cssWidth = availableWidth / scale;
                        measurementDiv.style.maxWidth = 'none';
                        measurementDiv.style.width = cssWidth + 'px';
                        measurementDiv.style.whiteSpace = 'pre-wrap';
                        measurementDiv.style.display = 'block';
                        measurementDiv.style.webkitLineClamp = 'unset';
                        const rect = measurementDiv.getBoundingClientRect();
                        const visualH = rect.height * scale;
                        if (visualH <= effectiveAvailableHeight + 2) break;
                        scale *= 0.92;
                    }
                }

                // --- STAGE 3: Horizontal Fill (Letter Spacing) ---
                // If we are strictly height-limited, we might have width gaps.

                if (layoutType === 'fit') {
                    // Refine Width with Letter Spacing?
                    // We must use the VERIFIED scale.
                    const r = measurementDiv.getBoundingClientRect(); // Current state is synced from verification loop
                    const currentVisW = r.width * scale;

                    // Gap
                    const unusedW = availableWidth - currentVisW;
                    const charCount = rawLabel.length;

                    if (unusedW > (availableWidth * 0.05) && charCount > 1) { // 5% gap to care
                        const neededSpacingPerChar = (unusedW / scale) / (charCount - 1);
                        const maxAdd = Math.min(neededSpacingPerChar, 20); // Cap at 20px

                        let bestLS = baseLetterSpacing;

                        // Simple check: Try adding the spacing and see if it wraps?
                        // Binary search is safer.
                        let low = 0;
                        let high = maxAdd;
                        const baselineH = r.height;

                        // We must maintain the Width Constraint: availableWidth / scale
                        // (This constraint assumes scale doesn't change by adding spacing... which is true)
                        const constrainedWidth = availableWidth / scale;
                        measurementDiv.style.width = constrainedWidth + 'px';

                        for (let k = 0; k < 5; k++) {
                            const mid = (low + high) / 2;
                            measurementDiv.style.letterSpacing = (baseLetterSpacing + mid) + 'px';
                            const testR = measurementDiv.getBoundingClientRect();

                            if (testR.height <= baselineH + 2 && (testR.width * scale) <= availableWidth + 2) {
                                bestLS = baseLetterSpacing + mid;
                                low = mid;
                            } else {
                                high = mid;
                            }
                        }
                        letterSpacingValue = bestLS;
                    }
                }


                if (layoutType === 'fit') {
                    const visualFs = fontSize * scale;
                    const flooredFs = Math.floor(visualFs);
                    scale = flooredFs / fontSize;
                }

                fontSize = baseFs;

                // Fit: use the line height that made the text fit
                if (layoutType === 'fit') {
                    computedLineHeight = fitLineHeightUsed;
                }

                // --- DEBUG LOGGING ---
                if (isSelected || isEditing) {
                    console.log(`[TextFit-V6.1] Layer "${meta.label || layer.name}"`, {
                        visualFontSize: (baseFs * scale).toFixed(1) + 'px',
                        scale: scale.toFixed(4),
                        container: `${Math.round(availableWidth)}x${Math.round(availableHeight)}`
                    });
                }

                // Clamp for non-fit modes or if user wants limits
                if (layoutType !== 'fit' && getVal('fontSize')) {
                    scale = Math.min(1.0, scale);
                } else if (layoutType === 'fit') {
                    scale = Math.min(5.0, scale);
                }
            }

            const bgType = getVal('bgType') || (layer.type === 'text' ? 'none' : 'solid');
            const color1 = getVal('colorCode') || (layer.type === 'text' ? 'transparent' : '#008080');
            const color2 = getVal('colorCode2') || '#004040';

            const backgroundValue = bgType === 'none' || color1 === 'transparent'
                ? 'transparent'
                : getGradientBackground({
                    type: bgType,
                    color: color1,
                    color2: color2,
                    stops: getVal('stops'),
                    gradientAngle: getVal('gradientAngle'),
                    gradientLength: getVal('gradientLength'),
                    gradientCenterX: getVal('gradientCenterX'),
                    gradientCenterY: getVal('gradientCenterY'),
                    gradientRadius: getVal('gradientRadius'),
                }, 1, layer);

            // Auto Height: font size never changes when user scales the box; always use scale 1
            const finalScale = layoutType === 'autoHeight' ? 1 : scale;
            const effectiveLineHeight = (layoutType === 'fit' ? computedLineHeight : null) || getVal('lineHeight') || '1.2';
            const fitEffectiveFontSize = layoutType === 'fit' ? fontSize * scale : undefined;
            const fitEffectiveLineHeight = layoutType === 'fit' ? effectiveLineHeight : undefined;
            return {
                fontSize: `${fontSize}px`,
                letterSpacing: `${letterSpacingValue}px`,
                fontFamily,
                fontWeight,
                fontStyle: getVal('fontStyle') || 'normal',
                lineHeight: effectiveLineHeight,
                fitEffectiveFontSize,
                fitEffectiveLineHeight,
                textTransform,
                textDecoration: getVal('textDecoration') || 'none',
                textAlign: getVal('textAlign') || (layer.type === 'button' ? 'center' : 'left'),
                verticalAlign: getVal('verticalAlign') || (layer.type === 'button' ? 'middle' : 'top'),
                textColor: getVal('textColor') || (layer.type === 'button' ? '#ffffff' : '#121717'),
                textBgType: getVal('textBgType') || 'solid',
                textColor2: getVal('textColor2') || '#000000',
                textGradientAngle: getVal('textGradientAngle') ?? 180,
                textGradientLength: getVal('textGradientLength') ?? 100,
                textGradientCenterX: getVal('textGradientCenterX') ?? 50,
                textGradientCenterY: getVal('textGradientCenterY') ?? 50,
                textGradientRadius: getVal('textGradientRadius') ?? 100,
                textBackground: (() => {
                    const tVal = getVal('textBgType') || 'solid';
                    if (tVal === 'none') return 'transparent';
                    return getGradientBackground({
                        type: tVal,
                        color: getVal('textColor') || (layer.type === 'button' ? '#ffffff' : '#121717'),
                        color2: getVal('textColor2') || '#000000',
                        stops: getVal('textStops'),
                        gradientAngle: getVal('textGradientAngle'),
                        gradientLength: getVal('textGradientLength'),
                        gradientCenterX: getVal('textGradientCenterX'),
                        gradientCenterY: getVal('textGradientCenterY'),
                        gradientRadius: getVal('textGradientRadius'),
                    }, 1, layer);
                })(),
                textStroke: `${getVal('textStrokeWidth') || 0}px ${getVal('textStrokeColor') || 'transparent'}`,
                overflowBehavior,
                isShrinkToFit,
                background: backgroundValue,
                scale: finalScale,
                padding: (() => {
                    const hFallback = layer.type === 'button' ? 20 : 4;
                    const vFallback = 0;
                    const pt = getVal('paddingTop') ?? getVal('paddingVertical') ?? getVal('padding') ?? vFallback;
                    const pr = getVal('paddingRight') ?? getVal('paddingHorizontal') ?? getVal('padding') ?? hFallback;
                    const pb = getVal('paddingBottom') ?? getVal('paddingVertical') ?? getVal('padding') ?? vFallback;
                    const pl = getVal('paddingLeft') ?? getVal('paddingHorizontal') ?? getVal('padding') ?? hFallback;
                    return `${pt}px ${pr}px ${pb}px ${pl}px`;
                })(),
                borderRadius: (() => {
                    const tl = getVal('borderRadiusTopLeft') ?? getVal('borderRadius') ?? 0;
                    const tr = getVal('borderRadiusTopRight') ?? getVal('borderRadius') ?? 0;
                    const br = getVal('borderRadiusBottomRight') ?? getVal('borderRadius') ?? 0;
                    const bl = getVal('borderRadiusBottomLeft') ?? getVal('borderRadius') ?? 0;
                    return (tl || tr || br || bl) ? `${tl}px ${tr}px ${br}px ${bl}px` : undefined;
                })(),
                borderWidth: (() => {
                    const t = getVal('borderTopWidth') ?? getVal('borderWidth') ?? 0;
                    const r = getVal('borderRightWidth') ?? getVal('borderWidth') ?? 0;
                    const b = getVal('borderBottomWidth') ?? getVal('borderWidth') ?? 0;
                    const l = getVal('borderLeftWidth') ?? getVal('borderWidth') ?? 0;
                    return `${t}px ${r}px ${b}px ${l}px`;
                })(),
                borderStyle: getVal('borderStyle') || 'solid',
                borderColor: getVal('borderColor') || '#000000',
                filter: (() => {
                    const effects = getVal('effects');
                    if (!Array.isArray(effects)) return undefined;
                    return effects
                        .filter(fx => fx.active !== false && !['innerShadow', 'textShadow'].includes(fx.type))
                        .map(fx => {
                            const v = fx.value;
                            if (fx.type === 'dropShadow') {
                                const { x = 0, y = 0, blur = 0, color = '#000000', opacity = 0.5 } = fx;
                                const rgba = (color.startsWith('#') && color.length === 9) ?
                                    `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${parseInt(color.slice(7, 9), 16) / 255})` :
                                    (color.startsWith('#') ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacity})` : color);
                                return `drop-shadow(${x}px ${y}px ${blur}px ${rgba})`;
                            }
                            switch (fx.type) {
                                case 'blur': return `blur(${v}px)`;
                                case 'brightness': return `brightness(${v}%)`;
                                case 'contrast': return `contrast(${v}%)`;
                                case 'grayscale': return `grayscale(${v}%)`;
                                case 'hueRotate': return `hue-rotate(${v}deg)`;
                                case 'invert': return `invert(${v}%)`;
                                case 'saturate': return `saturate(${v}%)`;
                                case 'sepia': return `sepia(${v}%)`;
                                default: return '';
                            }
                        }).join(' ');
                })(),
                boxShadow: (() => {
                    const effects = getVal('effects');
                    if (!Array.isArray(effects)) return undefined;
                    return effects
                        .filter(fx => fx.active !== false && fx.type === 'innerShadow')
                        .map(fx => {
                            const { x = 0, y = 0, blur = 0, spread = 0, color = '#000000', opacity = 0.5 } = fx;
                            const rgba = (color.startsWith('#') && color.length === 9) ?
                                `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${parseInt(color.slice(7, 9), 16) / 255})` :
                                (color.startsWith('#') ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacity})` : color);
                            return `inset ${x}px ${y}px ${blur}px ${spread}px ${rgba}`;
                        }).join(', ');
                })(),
                textShadow: (() => {
                    const effects = getVal('effects');
                    if (!Array.isArray(effects)) return undefined;
                    return effects
                        .filter(fx => fx.active !== false && fx.type === 'textShadow')
                        .map(fx => {
                            const { x = 0, y = 0, blur = 0, color = '#000000', opacity = 0.5 } = fx;
                            const rgba = (color.startsWith('#') && color.length === 9) ?
                                `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${parseInt(color.slice(7, 9), 16) / 255})` :
                                (color.startsWith('#') ? `rgba(${parseInt(color.slice(1, 3), 16)}, ${parseInt(color.slice(3, 5), 16)}, ${parseInt(color.slice(5, 7), 16)}, ${opacity})` : color);
                            return `${x}px ${y}px ${blur}px ${rgba}`;
                        }).join(', ');
                })(),
            };
        };

        const defaultStyles = calculateStyles();
        if (layer.type === 'button') {
            return {
                default: defaultStyles,
                hover: calculateStyles('hover'),
                active: calculateStyles('active'),
            };
        }
        return { default: defaultStyles };
    }, [meta, layer.width, layer.height, layer.url, layer.type, layoutType, dynamicContent]);

    // Persist Fit Text effective fontSize and lineHeight to variant so text stays fitted and panel shows correct values
    React.useEffect(() => {
        if (layer.type !== 'text' || !onUpdateLayers || isEditing) return;
        const layoutTypeFromMeta = meta.layoutType || 'none';
        if (layoutTypeFromMeta !== 'fit') return;
        const d = (typography as any)?.default;
        const effectiveFs = d?.fitEffectiveFontSize;
        const effectiveLh = d?.fitEffectiveLineHeight;
        if (effectiveFs == null) return;
        const currentFs = parseFloat(meta.fontSize);
        const currentLh = meta.lineHeight || '1.2';
        const fsDiff = Math.abs((currentFs || 24) - effectiveFs);
        const lhChanged = effectiveLh != null && String(effectiveLh) !== String(currentLh);

        // We use Math.floor as requested (e.g. 10.84 -> 10, 55.40 -> 55)
        // and we check if the difference is more than 0.01 to avoid unnecessary updates from tiny float deviations,
        // but large enough to catch any float that needs flooring.
        if (fsDiff > 0.01 || lhChanged) {
            const newMeta = { ...meta, fontSize: String(Math.floor(effectiveFs)) };
            if (effectiveLh != null) newMeta.lineHeight = String(effectiveLh);
            onUpdateLayers([layer.id], { variant: JSON.stringify(newMeta) });
        }
    }, [typography, meta.layoutType, meta.fontSize, meta.lineHeight, meta, layer.id, layer.type, onUpdateLayers, isEditing]);

    // In preview: use localAnimTime while interaction is active; freeze at 0 unless animationAutoPlay.
    // In edit mode: use currentTime for timeline scrubbing.
    const effectiveTime = React.useMemo(() => {
        if (isPreviewMode) {
            if (interactionAnim?.active) {
                return localAnimTime;
            }
            if (layer.animationAutoPlay !== false) {
                return currentTime;
            }
            return 0; // Frozen at 0 if no auto-play and no active interaction
        }
        return currentTime;
    }, [isPreviewMode, interactionAnim?.active, localAnimTime, layer.animationAutoPlay, currentTime]);

    const effectiveStyles = React.useMemo(() => {
        return getInterpolatedLayerStyles(
            layer,
            effectiveTime,
            stageDuration,
            loopsDone,
            stageLoopCount,
            stageStopAtSecond,
            stageFeedLoopCount,
            isPreviewMode,
            isChildOfAutoLayout,
            stageWidth,
            stageHeight
        );
    }, [layer, effectiveTime, loopsDone, stageLoopCount, stageStopAtSecond, stageDuration, stageFeedLoopCount, isPreviewMode, isChildOfAutoLayout, stageWidth, stageHeight]);

    const textEffectiveStyles = React.useMemo(() => {
        if (!layer.textAnimation || layer.type !== 'text') return null;

        // Sanitize the layer object for text animation calculation
        // We only want the animation offsets relative to the parent container
        // The parent container already handles the base position (x, y), rotation, and scale
        const sanitizedLayer = {
            ...layer,
            animation: layer.textAnimation,
            // Zero out base spatial properties to prevent double-application
            x: 0,
            y: 0,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            scaleZ: 1,
            skewX: 0,
            skewY: 0,
            transformX: 0,
            transformY: 0,
            transformZ: 0,
            rotateX: 0,
            rotateY: 0,
            rotateZ: 0
        };

        return getInterpolatedLayerStyles(
            sanitizedLayer as any,
            effectiveTime,
            stageDuration,
            loopsDone,
            stageLoopCount,
            stageStopAtSecond,
            stageFeedLoopCount,
            isPreviewMode,
            true, // isChildOfAutoLayout
            stageWidth,
            stageHeight
        );
    }, [layer.textAnimation, layer, effectiveTime, loopsDone, stageLoopCount, stageStopAtSecond, stageDuration, stageFeedLoopCount, isPreviewMode, stageWidth, stageHeight]);

    // Handle floating toolbar horizontal clamping and boundary awareness
    React.useLayoutEffect(() => {
        if (!isEditing || !toolbarRef.current || stageWidth === undefined) return;

        const rect = toolbarRef.current.getBoundingClientRect();
        const toolbarW = rect.width / zoom;

        // Toolbar is centered on visualX initially
        const x_left = (effectiveStyles as any).visualX - toolbarW / 2;
        const x_right = (effectiveStyles as any).visualX + toolbarW / 2;

        let offset = 0;
        if (x_left < 8) { // 8px margin
            offset = 8 - x_left;
        } else if (x_right > stageWidth - 8) {
            offset = (stageWidth - 8) - x_right;
        }

        setToolbarXOffset(offset);
    }, [isEditing, (effectiveStyles as any).visualX, stageWidth, zoom]);

    const actionStyles: any = null;

    // Auto-Height Reporting: Update layer height in the model when content changes
    React.useLayoutEffect(() => {
        if (layer.type === 'text' && sizingLayoutType === 'autoHeight' && contentRef.current && !isEditing) {
            const rect = contentRef.current.getBoundingClientRect();
            // Convert visual height back to normalized height using zoom
            const newHeight = Math.ceil(rect.height / zoom);
            if (layer.height !== newHeight && newHeight > 0) {
                // Optimization: small threshold to avoid jitter
                if (Math.abs(layer.height - newHeight) > 1) {
                    onUpdateLayers?.([layer.id], { height: newHeight });
                }
            }
        }
    }, [meta.label, sizingLayoutType, zoom, layer.width, layer.height, onUpdateLayers]);

    const handleInteractionAction = (action: AnimationTriggerAction, includeChildren: boolean = false) => {
        console.log(`[LayerPreview] handleInteractionAction for layer: ${layer.id}, action: ${action}, includeChildren: ${includeChildren}`);
        const lowAction = String(action || '').toLowerCase();
        
        if (lowAction.includes('entry') || lowAction.includes('inbound')) {
            setInteractionAnim(prev => ({ active: true, phase: 'entry', restartKey: (prev?.restartKey ?? 0) + 1 }));
        } else if (lowAction.includes('main') || lowAction.includes('middle') || lowAction.includes('mid') || lowAction.includes('loop')) {
            setInteractionAnim(prev => ({ active: true, phase: 'main', restartKey: (prev?.restartKey ?? 0) + 1 }));
        } else if (lowAction.includes('exit') || lowAction.includes('outbound')) {
            setInteractionAnim(prev => ({ active: true, phase: 'exit', restartKey: (prev?.restartKey ?? 0) + 1 }));
        } else if (lowAction.includes('all') || lowAction.includes('full') || lowAction.includes('sequence')) {
            setInteractionAnim(prev => ({ active: true, phase: 'all', restartKey: (prev?.restartKey ?? 0) + 1 }));
        } else if (lowAction.includes('toggle')) {
            setInteractionAnim(prev => {
                if (prev?.active) return { active: false, phase: null, restartKey: prev.restartKey };
                let phaseToPlay: any = 'all';
                if (lowAction.includes('entry')) phaseToPlay = 'entry';
                else if (lowAction.includes('main') || lowAction.includes('loop')) phaseToPlay = 'main';
                else if (lowAction.includes('exit')) phaseToPlay = 'exit';
                return { active: true, phase: phaseToPlay, restartKey: (prev?.restartKey ?? 0) + 1 };
            });
        } else if (action === 'reverse') {
            setInteractionAnim(prev => ({ active: true, phase: prev?.phase || 'all', reversed: true, restartKey: (prev?.restartKey ?? 0) + 1 }));
        } else if (action === 'stop' || action === 'reset' || lowAction.includes('stop')) {
            setInteractionAnim(prev => ({ active: false, phase: null, restartKey: prev?.restartKey ?? 0 }));
        } else if (action === 'pause') {
            setInteractionAnim(prev => prev ? { ...prev, active: false } : null);
        } else if (action === 'resume') {
            setInteractionAnim(prev => prev ? { ...prev, active: true } : null);
        }

        // Propagate to children if it's a group and flag is set
        if (includeChildren && layer.type === 'group' && layer.children) {
            console.log(`[LayerPreview] Propagating interaction "${action}" to ${layer.children.length} children of group ${layer.id}`);
            layer.children.forEach(child => {
                document.dispatchEvent(new CustomEvent('layer:interaction', {
                    detail: { targetLayerId: child.id, action, includeChildren: true }
                }));
            });
        }
    };

    // Routes interaction to target layer (cross-layer) or self
    const fireInteraction = (ia: { targetLayerId?: string; action: AnimationTriggerAction; includeChildren?: boolean }) => {
        if (ia.targetLayerId && ia.targetLayerId !== layer.id) {
            document.dispatchEvent(new CustomEvent('layer:interaction', {
                detail: { targetLayerId: ia.targetLayerId, action: ia.action, includeChildren: ia.includeChildren }
            }));
        } else {
            handleInteractionAction(ia.action, ia.includeChildren);
        }
    };

    // Listen for cross-layer interaction events targeting this layer
    React.useEffect(() => {
        const handler = (e: CustomEvent) => {
            if (e.detail.targetLayerId === layer.id) {
                console.log(`[LayerPreview] Received cross-layer interaction: ${e.detail.action} for layer ${layer.id}, children: ${e.detail.includeChildren}`);
                handleInteractionAction(e.detail.action as AnimationTriggerAction, e.detail.includeChildren);
            }
        };
        document.addEventListener('layer:interaction', handler as EventListener);
        return () => document.removeEventListener('layer:interaction', handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layer.id]);

    // React to global actionStates changes for stage-level landing page actions targeting this layer
    const prevActionStatesRef = React.useRef<Record<string, boolean>>({});
    React.useEffect(() => {
        if (!stageActions || !actionStates) return;
        
        stageActions.forEach(a => {
            if (a.targetId === layer.id) {
                const isActive = actionStates[a.id];
                const wasActive = prevActionStatesRef.current[a.id];
                
                if (isActive !== wasActive) {
                    if (isActive) {
                        // Action just triggered (became true)
                        if (a.actionType === 'play-animation' || a.actionType === 'toggle-animation') {
                            const phase = a.config?.animationPhase || 'entry';
                            const includeChildren = a.config?.includeChildren || false;
                            console.log(`[LayerPreview] Action ${a.id} activated! Playing phase: ${phase} on layer ${layer.id}, children: ${includeChildren}`);
                            handleInteractionAction(`play-${phase}` as AnimationTriggerAction, includeChildren);
                        } else if (a.actionType === 'stop-animation') {
                            const includeChildren = a.config?.includeChildren || false;
                            console.log(`[LayerPreview] Action ${a.id} activated! Stopping animation on layer ${layer.id}, children: ${includeChildren}`);
                            handleInteractionAction('stop', includeChildren);
                        }
                    } else {
                        // Action became false
                        if (a.actionType === 'toggle-animation' || a.actionType === 'play-animation') {
                            const includeChildren = a.config?.includeChildren || false;
                            console.log(`[LayerPreview] Action ${a.id} deactivated. Stopping animation on layer ${layer.id}, children: ${includeChildren}`);
                            handleInteractionAction('stop', includeChildren);
                        }
                    }
                }
            }
        });
        prevActionStatesRef.current = { ...actionStates };
    }, [actionStates, stageActions, layer.id]);

    const handleActionTrigger = (type: 'click' | 'mouseenter' | 'mouseleave' | 'dblclick' | 'focus' | 'blur') => {
        console.log(`[LayerPreview] handleActionTrigger (type: ${type}) for layer ${layer.id} (${layer.name})`);
        // Fire layer interactionActions (per-layer animation triggers)
        layer.interactionActions?.forEach(ia => {
            const matches =
                (type === 'click'      && ia.event === 'click') ||
                (type === 'dblclick'   && ia.event === 'dblclick') ||
                (type === 'mouseenter' && ia.event === 'hover') ||
                (type === 'mouseleave' && ia.event === 'hoverEnd') ||
                (type === 'focus'      && ia.event === 'focus') ||
                (type === 'blur'       && ia.event === 'blur');
            if (matches && (isPreviewMode || isInteractive)) {
                console.log(`[LayerPreview] Found matching interaction action: ${ia.action} targeting ${ia.targetLayerId || 'self'}, includeChildren: ${!!ia.includeChildren}`);
                fireInteraction({
                    targetLayerId: ia.targetLayerId,
                    action: ia.action as AnimationTriggerAction,
                    includeChildren: !!ia.includeChildren
                });
            }
        });

        if (!isInteractive) return;
        // Fire stage-level LandingPageActions
        console.log(`[LayerPreview] Checking ${stageActions.length} stage actions for layer triggers...`);
        stageActions.forEach(a => {
            if (a.triggerSourceId === layer.id) {
                const eventType = a.triggerEvent || 'click';
                console.log(`[LayerPreview] Found action matched for layer trigger source. Action: ${a.id}, type: ${type}, triggerEvent: ${eventType}`);
                if (type === 'click' && eventType === 'click') {
                    console.log(`[LayerPreview] Triggering CLICK for stage action ${a.id}`);
                    onTriggerAction?.(a.id, !actionStates[a.id]);
                    onLandingPageAction?.(a);
                } else if (type === 'mouseenter' && eventType === 'hover') {
                    console.log(`[LayerPreview] Triggering HOVER ON for stage action ${a.id}`);
                    onTriggerAction?.(a.id, true);
                    onLandingPageAction?.(a);
                } else if (type === 'mouseleave' && eventType === 'hover') {
                    console.log(`[LayerPreview] Triggering HOVER OFF for stage action ${a.id}`);
                    onTriggerAction?.(a.id, false);
                } else if (type === 'mouseleave' && eventType === 'hoverEnd') {
                    console.log(`[LayerPreview] Triggering HOVER END (activate) for stage action ${a.id}`);
                    onTriggerAction?.(a.id, true);
                    onLandingPageAction?.(a);
                } else if (type === 'mouseenter' && eventType === 'scroll-into-view') {
                    console.log(`[LayerPreview] Triggering SCROLL INTO VIEW for stage action ${a.id}`);
                    onTriggerAction?.(a.id, true);
                    onLandingPageAction?.(a);
                }
            }
        });
    };

    // IntersectionObserver for scroll-into-view and scroll-out-view triggers
    React.useEffect(() => {
        const scrollInTrigger  = layer.interactionActions?.find(a => a.event === 'scroll-into-view');
        const scrollOutTrigger = layer.interactionActions?.find(a => a.event === 'scroll-out-view');
        if (!scrollInTrigger && !scrollOutTrigger) return;
        if (!isPreviewMode && !isInteractive) return;
        const el = document.getElementById(layer.id);
        if (!el) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && scrollInTrigger) {
                fireInteraction({ targetLayerId: scrollInTrigger.targetLayerId, action: scrollInTrigger.action as AnimationTriggerAction, includeChildren: scrollInTrigger.includeChildren });
            }
            if (!entry.isIntersecting && scrollOutTrigger) {
                fireInteraction({ targetLayerId: scrollOutTrigger.targetLayerId, action: scrollOutTrigger.action as AnimationTriggerAction, includeChildren: scrollOutTrigger.includeChildren });
            }
        }, { threshold: 0.15 });
        observer.observe(el);
        return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layer.interactionActions, layer.id, isPreviewMode, isInteractive]);

    // Keydown document listener
    React.useEffect(() => {
        const keyTriggers = layer.interactionActions?.filter(a => a.event === 'keydown') ?? [];
        if (!keyTriggers.length || (!isPreviewMode && !isInteractive)) return;
        const handler = (e: KeyboardEvent) => {
            keyTriggers.forEach(t => {
                if (!t.keyCode || e.code === t.keyCode) {
                    fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction, includeChildren: t.includeChildren });
                }
            });
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layer.interactionActions, isPreviewMode, isInteractive]);

    // Idle activity tracker
    React.useEffect(() => {
        const idleTrigger = layer.interactionActions?.find(a => a.event === 'idle');
        if (!idleTrigger || (!isPreviewMode && !isInteractive)) return;
        const seconds = idleTrigger.idleSeconds ?? 3;
        let idleTimer: ReturnType<typeof setTimeout>;
        const resetTimer = () => {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                fireInteraction({ targetLayerId: idleTrigger.targetLayerId, action: idleTrigger.action as AnimationTriggerAction, includeChildren: idleTrigger.includeChildren });
            }, seconds * 1000);
        };
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
        activityEvents.forEach(ev => document.addEventListener(ev, resetTimer));
        resetTimer();
        return () => {
            clearTimeout(idleTimer);
            activityEvents.forEach(ev => document.removeEventListener(ev, resetTimer));
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layer.interactionActions, isPreviewMode, isInteractive]);

    const startLongPress = () => {
        const t = layer.interactionActions?.find(a => a.event === 'long-press');
        if (!t || (!isPreviewMode && !isInteractive)) return;
        longPressTimer.current = setTimeout(() => {
            fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction, includeChildren: t.includeChildren });
        }, 500);
    };
    const cancelLongPress = () => {
        if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    };

    const handleClick = (e: React.MouseEvent) => {
        if (e.button !== 0) return;

        // Allow propagation only in preview/interactive mode so parents (groups) can also trigger their actions
        if (!isPreviewMode && !isInteractive) {
            e.stopPropagation();
        }

        console.log(`[LayerPreview] handleClick for layer ${layer.id} (${layer.name}) - stopPropagation: ${!isPreviewMode && !isInteractive}`);
        handleActionTrigger('click');

        if (meta.linkUrl && (isPreviewMode || e.metaKey || e.ctrlKey)) {
            let url = meta.linkUrl;
            if (!/^https?:\/\//i.test(url) && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
                url = 'https://' + url;
            }
            window.open(url, '_blank');
            if (isPreviewMode) return;
        }

        if (!onLayerClick) return;
        onLayerClick(layer.id, stageId, false, e.shiftKey);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        handleActionTrigger('dblclick');
        if (!onLayerClick) return;
        e.stopPropagation();
        onLayerClick(layer.id, stageId, true, false);
    };

    const rawAnim = (effectiveStyles as any)?.rawKeyframes;
    const { animName, progress } = (effectiveStyles as any) || {};

    let activeTransform = (effectiveStyles as any)?.transform;
    let cssLeft = isChildOfAutoLayout ? undefined : (effectiveStyles as any)?.x ?? layer.x;
    let cssTop = isChildOfAutoLayout ? undefined : (effectiveStyles as any)?.y ?? layer.y;

    const w = (effectiveStyles as any)?.width ?? layer.width;
    const h = (effectiveStyles as any)?.height ?? layer.height;

    // Alignment for Raw CSS Animations (Animista style)
    // CSS Animations with percentage-based origins (e.g. 50% 0% for scale-out-top)
    // require the element to have width/height and be positioned at the correct visual start point.
    if (rawAnim && !isChildOfAutoLayout) {
        // Use STATIC base position and transform for the wrapper and container,
        // because the CSS animation (rawAnim) applied to the wrapper will handle the movement and scaling.
        // This prevents "double transformation" where both JS and CSS apply the same animation.
        cssLeft = layer.x - layer.width / 2;
        cssTop = layer.y - layer.height / 2;

        // Construct STATIC transform (base rotation, scale, etc.)
        const tr = layer.rotation ?? 0;
        const sx = layer.scaleX ?? (layer as any).scale ?? 1;
        const sy = layer.scaleY ?? (layer as any).scale ?? 1;
        const sz = layer.scaleZ ?? 1;

        // Include static transform offsets but NOT the animated _translateX/Y parts
        const tx = (layer.transformX ?? 0);
        const ty = (layer.transformY ?? 0);
        const tz = (layer.transformZ ?? 0);

        activeTransform = [
            `translate3d(${tx}%, ${ty}%, ${tz}px)`,
            `rotate(${tr}deg)`,
            `rotateX(${layer.rotateX ?? 0}deg)`,
            `rotateY(${layer.rotateY ?? 0}deg)`,
            `rotateZ(${layer.rotateZ ?? 0}deg)`,
            `scale3d(${sx}, ${sy}, ${sz})`,
            `skew(${layer.skewX ?? 0}deg, ${layer.skewY ?? 0}deg)`
        ].filter(Boolean).join(' ');
    }

    const containerStyle: React.CSSProperties = {
        left: cssLeft,
        top: cssTop,
        width: `${w}px`,
        height: `${h}px`,
        zIndex: layer.zIndex,
        opacity: ((effectiveStyles as any)?.opacity ?? layer.opacity ?? 1),
        transform: actionStyles?.transform 
            ? `${activeTransform || ''} ${actionStyles.transform}`.trim() 
            : activeTransform,
        transformOrigin: (effectiveStyles as any)?.transformOrigin,
        filter: [actionStyles?.filter, (typography as any).default.filter, (effectiveStyles as any).filter].filter(Boolean).join(' '),
        boxShadow: actionStyles?.boxShadow || (typography as any).default.boxShadow,
        textShadow: actionStyles?.textShadow || (typography as any).default.textShadow,
        flexShrink: 0,
        transition: 'none !important',
        transformStyle: 'preserve-3d',
        pointerEvents: (layer.locked || (isTextToolActive && !isEditing)) ? 'none' : 'auto',
    };

    // Grup içi elemanlar: sabit boyut veya Fill width / Fill height (variant: layoutSizingInGroupWidth/Height)
    if (isChildOfAutoLayout) {
        const fillW = meta.layoutSizingInGroupWidth === 'fill';
        const fillH = meta.layoutSizingInGroupHeight === 'fill';
        const isRow = parentFlexDirection !== 'column';
        const fw = Math.max(0, Number(w) || 0);
        const fh = Math.max(0, Number(h) || 0);

        if (isRow) {
            if (fillW) {
                const groupW = parentWidth != null && Number(parentWidth) > 0 ? Number(parentWidth) : 0;
                if (groupW > 0) {
                    containerStyle.width = `${groupW}px`;
                    containerStyle.minWidth = `${groupW}px`;
                    containerStyle.flexShrink = 0;
                    containerStyle.flexGrow = 0;
                    containerStyle.flexBasis = 'auto';
                } else {
                    containerStyle.flex = '1 1 0%';
                    containerStyle.minWidth = 0;
                    containerStyle.width = 'auto';
                }
            } else {
                containerStyle.width = `${fw}px`;
                containerStyle.minWidth = `${fw}px`;
                containerStyle.flexShrink = 0;
                containerStyle.flexGrow = 0;
                containerStyle.flexBasis = 'auto';
            }
            if (fillH) {
                containerStyle.alignSelf = 'stretch';
                containerStyle.height = '100%';
                containerStyle.minHeight = 0;
            } else {
                containerStyle.height = `${fh}px`;
                containerStyle.minHeight = `${fh}px`;
            }
        } else {
            if (fillH) {
                containerStyle.flex = '1 1 0%';
                const groupW = parentWidth != null && Number(parentWidth) > 0 ? Number(parentWidth) : 0;
                const effectiveMinH = Math.max(fh, groupW);
                containerStyle.minHeight = effectiveMinH > 0 ? `${effectiveMinH}px` : 'min-content';
                containerStyle.height = effectiveMinH > 0 ? `${effectiveMinH}px` : 'auto';
            } else {
                containerStyle.height = `${fh}px`;
                containerStyle.minHeight = `${fh}px`;
                containerStyle.flexShrink = 0;
                containerStyle.flexGrow = 0;
                containerStyle.flexBasis = 'auto';
            }
            if (fillW) {
                const groupW = parentWidth != null && Number(parentWidth) > 0 ? Number(parentWidth) : 0;
                if (groupW > 0) {
                    containerStyle.width = `${groupW}px`;
                    containerStyle.minWidth = `${groupW}px`;
                } else {
                    containerStyle.alignSelf = 'stretch';
                    containerStyle.width = '100%';
                    containerStyle.minWidth = 'min-content';
                }
            } else {
                containerStyle.width = `${fw}px`;
                containerStyle.minWidth = `${fw}px`;
            }
        }
        if (!fillW && !fillH) {
            containerStyle.flexShrink = 0;
            containerStyle.flexGrow = 0;
            containerStyle.flexBasis = 'auto';
        }
    }

    const textRawAnim = (textEffectiveStyles as any)?.rawKeyframes;
    const { animName: textAnimName, progress: textProgress } = (textEffectiveStyles as any) || {};


    const wrapperStyle: React.CSSProperties = {
        position: isChildOfAutoLayout ? 'relative' : 'absolute',
        left: containerStyle.left,
        top: containerStyle.top,
        width: rawAnim ? containerStyle.width : (isChildOfAutoLayout ? containerStyle.width : undefined),
        height: rawAnim ? containerStyle.height : (isChildOfAutoLayout ? containerStyle.height : undefined),
        minWidth: isChildOfAutoLayout ? containerStyle.minWidth : undefined,
        minHeight: isChildOfAutoLayout ? containerStyle.minHeight : undefined,
        flex: isChildOfAutoLayout && (containerStyle as any).flex ? (containerStyle as any).flex : undefined,
        flexShrink: isChildOfAutoLayout && !(containerStyle as any).flex ? 0 : undefined,
        flexGrow: isChildOfAutoLayout && !(containerStyle as any).flex ? 0 : undefined,
        alignSelf: isChildOfAutoLayout ? ((containerStyle as any).alignSelf ?? 'auto') : undefined,
        zIndex: containerStyle.zIndex,
        transition: 'none !important',
        animationName: rawAnim ? `kf-${animName}-${interactionAnim?.restartKey ?? 0}` : 'none',
        animationDuration: '1s',
        animationTimingFunction: 'linear',
        animationFillMode: 'forwards',
        animationDelay: interactionAnim?.reversed ? '0s' : ((rawAnim || interactionAnim?.active) ? `-${progress}s` : '0s'),
        animationIterationCount: interactionAnim?.active
            ? (layer.animationLoopCount === 0 ? 'infinite' : (layer.animationLoopCount ?? 1))
            : 1,
        animationPlayState: interactionAnim?.active ? 'running' : 'paused',
        animationDirection: interactionAnim?.reversed ? 'reverse' : 'normal',
        // Critical: Ensure the wrapper (which might have a CSS animation) uses the correct origin
        transformOrigin: (effectiveStyles as any)?.transformOrigin,
        transformStyle: 'preserve-3d',
        pointerEvents: 'none',
    };

    // Inner style should be relative to wrapper
    containerStyle.left = 0;
    containerStyle.top = 0;
    containerStyle.zIndex = undefined;
    containerStyle.position = 'relative';

    const renderRawStyle = () => {
        if (!rawAnim || !animName) return null;
        const sfx = `-${interactionAnim?.restartKey ?? 0}`;
        return <style>{rawAnim.replace(new RegExp(`@keyframes ${animName}`, 'g'), `@keyframes kf-${animName}${sfx}`).replace(new RegExp(`@-webkit-keyframes ${animName}`, 'g'), `@-webkit-keyframes kf-${animName}${sfx}`)}</style>;
    };

    const renderRawTextStyle = () => {
        if (!textRawAnim || !textAnimName) return null;
        const sfx = `-${interactionAnim?.restartKey ?? 0}`;
        return <style>{textRawAnim.replace(new RegExp(`@keyframes ${textAnimName}`, 'g'), `@keyframes tkf-${textAnimName}${sfx}`).replace(new RegExp(`@-webkit-keyframes ${textAnimName}`, 'g'), `@-webkit-keyframes tkf-${textAnimName}${sfx}`)}</style>;
    };

    const getExtraTextProps = () => {
        if (!textRawAnim) return {};
        const sfx = `-${interactionAnim?.restartKey ?? 0}`;
        return {
            style: {
                animationName: `tkf-${textAnimName}${sfx}`,
                animationDuration: '1s',
                animationTimingFunction: 'linear',
                animationFillMode: 'forwards',
                animationDelay: interactionAnim?.reversed ? '0s' : ((textRawAnim || interactionAnim?.active) ? `-${textProgress}s` : '0s'),
                animationIterationCount: interactionAnim?.active
                    ? (layer.animationLoopCount === 0 ? 'infinite' : (layer.animationLoopCount ?? 1))
                    : 1,
                animationPlayState: interactionAnim?.active ? 'running' : 'paused',
                animationDirection: interactionAnim?.reversed ? 'reverse' : 'normal',
                transformOrigin: (textEffectiveStyles as any)?.transformOrigin,
            }
        };
    };

    if (layer.type === 'button') {
        const { default: dOrig, hover: hOrig, active: aOrig } = typography as any;

        // Force the display state based on properties bar selection
        let d = dOrig;
        // We still want the interaction to feel right, so if we force 'hover', 
        // the base look is 'hover'. If we hover over it, it should probably stay 'hover'.

        if (previewState === 'hover') {
            d = hOrig;
        } else if (previewState === 'active') {
            d = aOrig;
        }

        const h = hOrig;
        const a = aOrig;

        const getFlexProps = (align: string, vertical: string) => ({
            justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
            alignItems: vertical === 'top' ? 'flex-start' : vertical === 'bottom' ? 'flex-end' : 'center',
        });

        const dFlex = getFlexProps(d.textAlign, d.verticalAlign);
        const hFlex = getFlexProps(h.textAlign, h.verticalAlign);
        const aFlex = getFlexProps(a.textAlign, a.verticalAlign);

        return (
            <div style={wrapperStyle}>
                <div
                    id={layer.id}
                    className={`${isChildOfAutoLayout ? 'relative' : 'absolute'} ${isEditing ? 'select-text z-[400]' : 'select-none'} ${isSelected ? 'z-[300]' : ''}`}
                    style={{ ...containerStyle, cursor: cursor || (isEditing ? 'text' : (isTextToolActive ? 'text' : 'pointer')) }}
                    tabIndex={layer.interactionActions?.some(a => a.event === 'focus' || a.event === 'blur') ? 0 : undefined}
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    onMouseEnter={() => {
                        handleActionTrigger('mouseenter');
                        onHover?.(layer.id);
                    }}
                    onMouseLeave={() => {
                        handleActionTrigger('mouseleave');
                        cancelLongPress();
                        onHover?.(null);
                    }}
                    onFocus={() => handleActionTrigger('focus')}
                    onBlur={() => handleActionTrigger('blur')}
                    onTouchStart={(e) => {
                        startLongPress();
                        const t = layer.interactionActions?.find(a => a.event === 'touchStart');
                        if (t && (isPreviewMode || isInteractive)) { e.preventDefault(); fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction }); }
                    }}
                    onTouchEnd={() => {
                        cancelLongPress();
                        const t = layer.interactionActions?.find(a => a.event === 'touchEnd');
                        if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
                    }}
                    onMouseDown={(e) => {
                        startLongPress();
                        if (isEditing) {
                            e.stopPropagation();
                            return;
                        }
                        if (!isTextToolActive) e.stopPropagation();
                        onMouseDown?.(e, layer.id);
                    }}
                    onMouseUp={() => cancelLongPress()}
                    onContextMenu={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e);
                    }}
                >
                    {renderRawStyle()}
                    <div 
                        className="outer-button-container group/btn"
                        style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            ...dFlex,
                            backgroundColor: d.bgType === 'solid' ? d.backgroundColor : 'transparent',
                            backgroundImage: d.bgType !== 'solid' ? d.background : 'none',
                            borderRadius: d.borderRadius,
                            borderWidth: d.borderWidth,
                            borderColor: d.borderColor,
                            borderStyle: d.borderStyle,
                            boxSizing: 'border-box',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: d.boxShadow,
                            padding: `${getVal('paddingTop') ?? getVal('paddingVertical') ?? getVal('padding') ?? 0}px ${getVal('paddingRight') ?? getVal('paddingHorizontal') ?? getVal('padding') ?? 20}px ${getVal('paddingBottom') ?? getVal('paddingVertical') ?? getVal('padding') ?? 0}px ${getVal('paddingLeft') ?? getVal('paddingHorizontal') ?? getVal('padding') ?? 20}px`,
                            position: 'relative',
                            overflow: 'hidden',
                            '--h-bg': h.bgType === 'solid' ? h.backgroundColor : h.background,
                            '--a-bg': a.bgType === 'solid' ? a.backgroundColor : a.background,
                            // Hover variables
                            '--h-fs': h.fontSize,
                            '--h-ls': h.letterSpacing,
                            '--h-fw': h.fontWeight,
                            '--h-ff': `${h.fontFamily}, sans-serif`,
                            '--h-c': h.textBgType === 'solid' ? h.textColor : 'transparent',
                            '--h-tbg': h.textBgType !== 'solid' ? h.textBackground : 'none',
                            '--h-lh': h.lineHeight,
                            '--h-tt': h.textTransform,
                            '--h-td': h.textDecoration,
                            '--h-jc': hFlex.justifyContent,
                            '--h-ai': hFlex.alignItems,
                            // Active variables
                            '--a-fs': a.fontSize,
                            '--a-ls': a.letterSpacing,
                            '--a-fw': a.fontWeight,
                            '--a-ff': `${a.fontFamily}, sans-serif`,
                            '--a-c': a.textBgType === 'solid' ? a.textColor : 'transparent',
                            '--a-tbg': a.textBgType !== 'solid' ? a.textBackground : 'none',
                            '--a-lh': a.lineHeight,
                            '--a-tt': a.textTransform,
                            '--a-td': a.textDecoration,
                            '--a-jc': aFlex.justifyContent,
                            '--a-ai': aFlex.alignItems,
                        } as any}
                    >
                        <div 
                            id={isEditing ? `editor-${layer.id}` : undefined}
                            className="rich-media-text-v"
                            contentEditable={isEditing}
                            suppressContentEditableWarning={true}
                            onInput={(e) => {
                                if (isEditing) {
                                    const newMeta = { ...meta, label: e.currentTarget.innerHTML };
                                    onUpdateLayers?.([layer.id], { variant: JSON.stringify(newMeta) });
                                }
                            }}
                            onBlur={() => onStopEditing?.()}
                            style={{
                                fontSize: d.fontSize,
                                letterSpacing: d.letterSpacing,
                                fontWeight: d.fontWeight,
                                fontFamily: `${d.fontFamily}, sans-serif`,
                                color: d.textBgType === 'solid' ? d.textColor : 'rgba(0,0,0,0.01)',
                                WebkitTextFillColor: d.textBgType !== 'solid' ? 'transparent' : 'unset',
                                backgroundImage: d.textBgType !== 'solid' ? d.textBackground : 'none',
                                WebkitBackgroundClip: d.textBgType !== 'solid' ? 'text' : 'unset',
                                backgroundClip: d.textBgType !== 'solid' ? 'text' : 'unset',
                                lineHeight: d.lineHeight,
                                textTransform: d.textTransform,
                                textDecoration: d.textDecoration,
                                display: 'flex',
                                width: '100%',
                                height: '100%',
                                ...dFlex,
                                transition: 'all 0.2s ease',
                                outline: 'none',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                textAlign: d.textAlign as any,
                            }}
                            dangerouslySetInnerHTML={{ __html: dynamicContent || meta.label || layer.url || 'Button' }}
                        />
                    </div>
                    <style>{`
                    #${layer.id} .outer-button-container:hover { background-color: var(--h-bg) !important; }
                    #${layer.id} .outer-button-container:active { background-color: var(--a-bg) !important; }
                    #${layer.id}:hover .rich-media-text-v {
                        font-size: var(--h-fs) !important;
                        letter-spacing: var(--h-ls) !important;
                        font-weight: var(--h-fw) !important;
                        font-family: var(--h-ff) !important;
                        color: var(--h-c) !important;
                        background-image: var(--h-tbg) !important;
                        -webkit-background-clip: text !important;
                        background-clip: text !important;
                        line-height: var(--h-lh) !important;
                        text-transform: var(--h-tt) !important;
                        text-decoration: var(--h-td) !important;
                        justify-content: var(--h-jc) !important;
                        align-items: var(--h-ai) !important;
                    }
                    #${layer.id}:active .rich-media-text-v {
                        font-size: var(--a-fs) !important;
                        letter-spacing: var(--a-ls) !important;
                        font-weight: var(--a-fw) !important;
                        font-family: var(--a-ff) !important;
                        color: var(--a-c) !important;
                        background-image: var(--a-tbg) !important;
                        -webkit-background-clip: text !important;
                        background-clip: text !important;
                        line-height: var(--a-lh) !important;
                        text-transform: var(--a-tt) !important;
                        text-decoration: var(--a-td) !important;
                        justify-content: var(--a-jc) !important;
                        align-items: var(--a-ai) !important;
                    }
                `}</style>
                </div>
            </div>
        );
    }

    if (layer.type === 'form-input') {
        const fm = meta as any;
        const ft: string = fm.formType || 'text-input';
        const borderRadius = `${fm.borderRadius ?? 8}px`;
        const borderColor = fm.errorMessage ? '#ef4444' : (fm.borderColor || '#e5e7eb');
        const bg = fm.backgroundColor || '#ffffff';
        const textCol = fm.textColor || '#111827';
        const labelCol = fm.labelColor || '#374151';
        const fs = `${fm.fontSize ?? 14}px`;
        const baseFont = 'system-ui, sans-serif';

        const sharedInputStyle: React.CSSProperties = {
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            color: textCol, fontSize: fs, fontFamily: baseFont,
            padding: '0 10px', minWidth: 0,
            cursor: isPreviewMode ? 'text' : 'default',
        };

        const wrapHandlers = {
            onClick: handleClick,
            onDoubleClick: handleDoubleClick,
            onMouseEnter: () => { handleActionTrigger('mouseenter'); onHover?.(layer.id); },
            onMouseLeave: () => { handleActionTrigger('mouseleave'); cancelLongPress(); onHover?.(null); },
            onFocus: () => handleActionTrigger('focus'),
            onBlur: () => handleActionTrigger('blur'),
            onTouchStart: (e: React.TouchEvent) => {
                startLongPress();
                const t = layer.interactionActions?.find(a => a.event === 'touchStart');
                if (t && (isPreviewMode || isInteractive)) { e.preventDefault(); fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction }); }
            },
            onTouchEnd: () => {
                cancelLongPress();
                const t = layer.interactionActions?.find(a => a.event === 'touchEnd');
                if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
            },
            onMouseDown: (e: React.MouseEvent) => { if (!isPreviewMode && !isInteractive) { e.stopPropagation(); onMouseDown?.(e, layer.id); } },
        };

        // Shared label renderer
        const renderLabel = () => fm.showLabel !== false && fm.labelPosition !== 'none' && (
            <label style={{ fontSize: '11px', fontWeight: 600, color: labelCol, fontFamily: baseFont, pointerEvents: 'none', userSelect: 'none', lineHeight: 1.4 }}>
                {fm.label || 'Label'}
                {fm.required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
            </label>
        );

        // Shared helper/error renderer
        const renderHelper = () => (fm.errorMessage || fm.helperText) && (
            <span style={{ fontSize: '10px', color: fm.errorMessage ? '#ef4444' : '#9ca3af', fontFamily: baseFont, pointerEvents: 'none', lineHeight: 1.3 }}>
                {fm.errorMessage || fm.helperText}
            </span>
        );

        // Shared input box wrapper
        const inputBoxStyle: React.CSSProperties = {
            display: 'flex', alignItems: 'center',
            border: `1.5px solid ${borderColor}`, borderRadius,
            backgroundColor: bg, overflow: 'hidden',
            flex: 1, minHeight: '34px', transition: 'border-color 0.15s',
        };

        // Prefix / Suffix shared
        const prefixEl = fm.prefix && (
            <span style={{ padding: '0 8px', fontSize: fs, color: '#9ca3af', fontFamily: baseFont, whiteSpace: 'nowrap', borderRight: `1px solid ${borderColor}`, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                {fm.prefix}
            </span>
        );
        const suffixEl = fm.suffix && (
            <span style={{ padding: '0 8px', fontSize: fs, color: '#9ca3af', fontFamily: baseFont, whiteSpace: 'nowrap', borderLeft: `1px solid ${borderColor}`, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}>
                {fm.suffix}
            </span>
        );

        const renderInputContent = () => {
            // ── Checkbox ───────────────────────────────────────────
            if (ft === 'checkbox') {
                const checkColor = fm.checkboxColor || '#136c6c';
                const cbChecked = isPreviewMode ? formCheckboxChecked : !!fm.defaultChecked;
                return (
                    <div
                        data-form-field="" data-form-stage={stageId}
                        data-form-name={fm.name || ''} data-form-value={String(cbChecked)}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%', cursor: isPreviewMode && !fm.disabled ? 'pointer' : 'default' }}
                        onClick={isPreviewMode && !fm.disabled ? (e) => {
                            e.stopPropagation();
                            setFormCheckboxChecked(v => !v);
                        } : undefined}
                    >
                        <div style={{
                            width: '16px', height: '16px', flexShrink: 0, marginTop: '2px',
                            border: `2px solid ${cbChecked ? checkColor : borderColor}`,
                            borderRadius: '4px', backgroundColor: cbChecked ? checkColor : bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background-color 0.15s, border-color 0.15s',
                        }}>
                            {cbChecked && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: fs, color: textCol, fontFamily: baseFont, lineHeight: '1.4', userSelect: 'none' }}>
                            {fm.label || 'Checkbox label'}
                            {fm.required && <span style={{ color: '#ef4444', marginLeft: '3px' }}>*</span>}
                            {fm.linkText && (
                                <span style={{ color: checkColor, marginLeft: '4px', textDecoration: 'underline', cursor: 'pointer' }}>{fm.linkText}</span>
                            )}
                        </span>
                    </div>
                );
            }

            // ── Select / Dropdown (custom, fully styleable) ────────
            if (ft === 'select') {
                const opts: { label: string; value: string }[] = fm.options || [];
                const optBg        = fm.optionBg        || '#ffffff';
                const optText      = fm.optionText      || textCol;
                const optHoverBg   = fm.optionHoverBg   || '#f0fdf4';
                const optHoverText = fm.optionHoverText || '#136c6c';
                const optSelBg     = fm.optionSelectedBg || '#e6f4f1';
                const dropRadius   = `${fm.dropdownRadius ?? fm.borderRadius ?? 8}px`;
                const dropShadow   = fm.dropdownShadow !== false;

                const effectiveValue = selectValue || fm.defaultValue || '';
                const selOpt = opts.find(o => o.value === effectiveValue);
                const displayText = selOpt ? selOpt.label : (fm.placeholder || 'Choose...');
                const hasValue = !!selOpt;

                const selSubmitVal = isPreviewMode ? (selectValue || fm.defaultValue || '') : (fm.defaultValue || '');
                return (
                    <div ref={selectRef}
                        data-form-field="" data-form-stage={stageId}
                        data-form-name={fm.name || ''} data-form-value={selSubmitVal}
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', position: 'relative' }}
                    >
                        {renderLabel()}
                        {/* Trigger */}
                        <div
                            style={{
                                ...inputBoxStyle,
                                justifyContent: 'space-between',
                                paddingRight: '10px',
                                cursor: isPreviewMode && !fm.disabled ? 'pointer' : 'default',
                                userSelect: 'none',
                                opacity: fm.disabled ? 0.5 : 1,
                            }}
                            onMouseDown={(e) => {
                                if (!isPreviewMode || fm.disabled) return;
                                e.stopPropagation();
                                setSelectOpen(o => !o);
                            }}
                        >
                            <span style={{ ...sharedInputStyle, color: hasValue ? textCol : '#9ca3af' }}>
                                {displayText}
                            </span>
                            <span style={{
                                fontSize: '14px', color: '#9ca3af', lineHeight: 1, flexShrink: 0,
                                transform: selectOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.15s',
                                pointerEvents: 'none',
                            }}>▾</span>
                        </div>
                        {/* Dropdown panel */}
                        {selectOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                                zIndex: 9999, backgroundColor: optBg,
                                border: `1.5px solid ${borderColor}`, borderRadius: dropRadius,
                                boxShadow: dropShadow ? '0 8px 24px rgba(0,0,0,0.12)' : 'none',
                                overflow: 'hidden',
                            }}>
                                {opts.map(opt => {
                                    const isSel = opt.value === effectiveValue;
                                    return (
                                        <div
                                            key={opt.value}
                                            style={{
                                                padding: '8px 12px', fontSize: fs, fontFamily: baseFont,
                                                color: isSel ? optHoverText : optText,
                                                backgroundColor: isSel ? optSelBg : optBg,
                                                cursor: 'pointer',
                                            }}
                                            onMouseEnter={e => {
                                                (e.currentTarget as HTMLDivElement).style.backgroundColor = optHoverBg;
                                                (e.currentTarget as HTMLDivElement).style.color = optHoverText;
                                            }}
                                            onMouseLeave={e => {
                                                (e.currentTarget as HTMLDivElement).style.backgroundColor = isSel ? optSelBg : optBg;
                                                (e.currentTarget as HTMLDivElement).style.color = isSel ? optHoverText : optText;
                                            }}
                                            onMouseDown={(e) => {
                                                e.stopPropagation();
                                                setSelectValue(opt.value);
                                                setSelectOpen(false);
                                            }}
                                        >
                                            {opt.label}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {renderHelper()}
                    </div>
                );
            }

            // ── Radio Button Group ─────────────────────────────────
            if (ft === 'radio') {
                const opts: { label: string; value: string }[] = fm.options || [];
                const radioColor = fm.radioColor || '#136c6c';
                const isRow = fm.direction === 'horizontal';
                const activeRadio = isPreviewMode ? formRadioValue : (fm.defaultValue || '');
                return (
                    <div
                        data-form-field="" data-form-stage={stageId}
                        data-form-name={fm.name || ''} data-form-value={activeRadio}
                        style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}
                    >
                        {renderLabel()}
                        <div style={{ display: 'flex', flexDirection: isRow ? 'row' : 'column', gap: '8px', flexWrap: 'wrap' }}>
                            {opts.map(opt => {
                                const checked = activeRadio === opt.value;
                                return (
                                    <label
                                        key={opt.value}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isPreviewMode && !fm.disabled ? 'pointer' : 'default', userSelect: 'none' }}
                                        onClick={isPreviewMode && !fm.disabled ? (e) => { e.stopPropagation(); setFormRadioValue(opt.value); } : undefined}
                                    >
                                        <div style={{
                                            width: '16px', height: '16px', flexShrink: 0, borderRadius: '50%',
                                            border: `2px solid ${checked ? radioColor : borderColor}`,
                                            backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'border-color 0.15s',
                                        }}>
                                            {checked && <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: radioColor, transition: 'transform 0.1s' }} />}
                                        </div>
                                        <span style={{ fontSize: fs, color: textCol, fontFamily: baseFont, lineHeight: '1.4' }}>{opt.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                        {renderHelper()}
                    </div>
                );
            }

            // ── Submit Button ──────────────────────────────────────
            if (ft === 'form-button') {
                const btnColor = fm.buttonColor || '#136c6c';
                const btnTextColor = fm.textColor || '#ffffff';

                const handleFormSubmit = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    if (!fm.endpoint) return;
                    const fields = document.querySelectorAll(
                        `[data-form-stage="${stageId}"][data-form-field]`
                    ) as NodeListOf<HTMLElement>;
                    const data: Record<string, string> = {};
                    const submitFields: string[] | 'all' = fm.submitFields || 'all';
                    fields.forEach(el => {
                        const name = (el as HTMLElement).dataset.formName || '';
                        if (!name) return;
                        const value = (el as HTMLElement).dataset.formValue || '';
                        if (submitFields === 'all' || (Array.isArray(submitFields) && submitFields.includes(name))) {
                            data[name] = value;
                        }
                    });
                    const method = (fm.method || 'POST').toUpperCase();
                    const headers: Record<string, string> = {};
                    
                    // Parse custom headers if any
                    if (fm.headers) {
                        try {
                            const customHeaders = JSON.parse(fm.headers);
                            if (typeof customHeaders === 'object' && customHeaders !== null) {
                                Object.assign(headers, customHeaders);
                            }
                        } catch (e) {
                            console.warn("[FormSubmit] Header JSON parse error:", e);
                        }
                    }

                    let body: string | undefined;
                    if (fm.submitFormat === 'xml') {
                        const esc = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
                        const xmlBody = Object.entries(data).map(([k, v]) => `  <${k}>${esc(v)}</${k}>`).join('\n');
                        body = `<?xml version="1.0" encoding="UTF-8"?>\n<form>\n${xmlBody}\n</form>`;
                        headers['Content-Type'] = 'application/xml';
                    } else {
                        body = JSON.stringify(data);
                        headers['Content-Type'] = 'application/json';
                    }
                    fetch(fm.endpoint, { method, headers, ...(method !== 'GET' ? { body } : {}) })
                        .then(res => { if (res.ok && fm.successMessage) alert(fm.successMessage); else if (!res.ok && fm.errorMessage) alert(fm.errorMessage); })
                        .catch(() => { if (fm.errorMessage) alert(fm.errorMessage); });
                };

                return (
                    <button
                        disabled={fm.disabled || !isPreviewMode}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: fm.fullWidth !== false ? '100%' : 'auto',
                            minHeight: '40px', padding: '0 24px',
                            backgroundColor: btnColor, color: btnTextColor,
                            border: 'none', borderRadius, cursor: isPreviewMode ? 'pointer' : 'default',
                            fontSize: fs, fontFamily: baseFont, fontWeight: fm.fontWeight || '600',
                            letterSpacing: '0.5px', outline: 'none', transition: 'opacity 0.15s',
                        }}
                        onClick={isPreviewMode ? handleFormSubmit : undefined}
                    >
                        {fm.label || 'Submit'}
                    </button>
                );
            }

            // ── Textarea ───────────────────────────────────────────
            if (ft === 'textarea') {
                return (
                    <div
                        data-form-field="" data-form-stage={stageId}
                        data-form-name={fm.name || ''} data-form-value={isPreviewMode ? formTextValue : (fm.defaultValue || '')}
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', height: '100%' }}
                    >
                        {renderLabel()}
                        <textarea
                            placeholder={fm.placeholder || 'Write your message...'}
                            value={isPreviewMode ? formTextValue : (fm.defaultValue || '')}
                            disabled={fm.disabled || !isPreviewMode}
                            readOnly={!isPreviewMode}
                            style={{
                                flex: 1, border: `1.5px solid ${borderColor}`, borderRadius, backgroundColor: bg,
                                color: textCol, fontSize: fs, fontFamily: baseFont,
                                padding: '8px 10px', resize: isPreviewMode ? (fm.resize || 'vertical') : 'none',
                                outline: 'none', lineHeight: '1.5', transition: 'border-color 0.15s',
                            }}
                            onChange={isPreviewMode ? (e => setFormTextValue(e.target.value)) : undefined}
                            onClick={(e) => { if (isPreviewMode) e.stopPropagation(); }}
                        />
                        {renderHelper()}
                    </div>
                );
            }

            // ── Number Input ───────────────────────────────────────
            if (ft === 'number-input') {
                return (
                    <div
                        data-form-field="" data-form-stage={stageId}
                        data-form-name={fm.name || ''} data-form-value={isPreviewMode ? formTextValue : (fm.defaultValue || '')}
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}
                    >
                        {renderLabel()}
                        <div style={inputBoxStyle}>
                            {prefixEl}
                            <input
                                type="number"
                                placeholder={fm.placeholder ?? '0'}
                                value={isPreviewMode ? formTextValue : (fm.defaultValue || '')}
                                min={fm.min !== '' ? fm.min : undefined}
                                max={fm.max !== '' ? fm.max : undefined}
                                step={fm.step || '1'}
                                disabled={fm.disabled || !isPreviewMode}
                                readOnly={!isPreviewMode}
                                style={{ ...sharedInputStyle, MozAppearance: 'textfield' } as React.CSSProperties}
                                onChange={isPreviewMode ? (e => setFormTextValue(e.target.value)) : undefined}
                                onClick={(e) => { if (isPreviewMode) e.stopPropagation(); }}
                            />
                            {suffixEl}
                            {fm.showSteppers !== false && (
                                <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${borderColor}`, alignSelf: 'stretch' }}>
                                    <button style={{ flex: 1, padding: '0 7px', fontSize: '9px', color: '#6b7280', background: 'none', border: 'none', cursor: isPreviewMode ? 'pointer' : 'default', borderBottom: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }} tabIndex={-1}>▲</button>
                                    <button style={{ flex: 1, padding: '0 7px', fontSize: '9px', color: '#6b7280', background: 'none', border: 'none', cursor: isPreviewMode ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' }} tabIndex={-1}>▼</button>
                                </div>
                            )}
                        </div>
                        {renderHelper()}
                    </div>
                );
            }

            // ── Text Input / Email Input (default) ─────────────────
            const inputType = ft === 'email-input' ? 'email' : 'text';
            const showEmailIcon = ft === 'email-input' && fm.showIcon !== false;
            return (
                <div
                    data-form-field="" data-form-stage={stageId}
                    data-form-name={fm.name || ''} data-form-value={isPreviewMode ? formTextValue : (fm.defaultValue || '')}
                    style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}
                >
                    {renderLabel()}
                    <div style={inputBoxStyle}>
                        {showEmailIcon && !fm.prefix && (
                            <span style={{ padding: '0 0 0 10px', color: '#9ca3af', fontSize: '14px', display: 'flex', alignItems: 'center', fontFamily: 'Material Symbols Outlined', userSelect: 'none' }}>
                                @
                            </span>
                        )}
                        {prefixEl}
                        <input
                            type={inputType}
                            placeholder={fm.placeholder || ''}
                            value={isPreviewMode ? formTextValue : (fm.defaultValue || '')}
                            maxLength={fm.maxLength ? parseInt(fm.maxLength) : undefined}
                            disabled={fm.disabled || !isPreviewMode}
                            readOnly={!isPreviewMode}
                            style={sharedInputStyle}
                            onChange={isPreviewMode ? (e => setFormTextValue(e.target.value)) : undefined}
                            onClick={(e) => { if (isPreviewMode) e.stopPropagation(); }}
                        />
                        {suffixEl}
                    </div>
                    {renderHelper()}
                </div>
            );
        };

        // Checkbox doesn't need the outer label/column wrapper (it's self-contained)
        const isCheckbox = ft === 'checkbox';

        return (
            <div style={wrapperStyle}>
                {renderRawStyle()}
                <div
                    id={layer.id}
                    className={`${isChildOfAutoLayout ? 'relative' : 'absolute'} select-none ${isSelected ? 'z-[300]' : ''}`}
                    style={{ ...containerStyle, display: 'flex', flexDirection: 'column', justifyContent: isCheckbox ? 'center' : 'flex-start', gap: isCheckbox ? 0 : '4px', cursor: cursor || 'pointer' }}
                    tabIndex={layer.interactionActions?.some(a => a.event === 'focus' || a.event === 'blur') ? 0 : undefined}
                    {...wrapHandlers}
                >
                    {renderInputContent()}
                </div>
            </div>
        );
    }

    if (layer.type === 'text') {
        const { default: d } = typography as any;
        const { isShrinkToFit, overflowBehavior } = d || {};

        const baseFs = parseFloat(d.fontSize) || 24;
        const lhStr = d.lineHeight?.toString() || '1.2';
        const lhIsPx = lhStr.includes('px');
        const lhVal = parseFloat(lhStr) || (lhIsPx ? baseFs * 1.2 : 1.2);
        const singleLineH = lhIsPx ? lhVal : baseFs * lhVal;
        const pTop = parseFloat(d.paddingTop ?? d.paddingVertical ?? d.padding ?? '0');
        const pBot = parseFloat(d.paddingBottom ?? d.paddingVertical ?? d.padding ?? '0');
        const availableH = layer.height - pTop - pBot;
        // Reduce the available height by a tiny fraction to prevent edge cases rounding up
        const autoMaxLines = Math.max(1, Math.floor((availableH + 2) / singleLineH));

        const maxLinesVal = parseInt(meta.maxLines) || 0;
        const effectiveMaxLines = maxLinesVal > 0 ? maxLinesVal : (overflowBehavior === 'truncate' ? autoMaxLines : 0);

        return (
            <div style={wrapperStyle}>
                <div
                    id={layer.id}
                    {...({ name: layer.name } as any)}
                    className={`${isChildOfAutoLayout ? 'relative' : 'absolute'} flex ${isSelected ? 'z-[100]' : ''
                        } ${isEditing ? 'z-[400]' : ''} ${isEditing ? 'select-text' : 'select-none'}`}
                    style={{
                        ...containerStyle,
                        cursor: cursor || (isEditing ? 'text' : 'pointer'),
                        background: d.background === 'transparent' ? undefined : d.background,
                        borderRadius: d.borderRadius,
                        borderWidth: d.borderWidth,
                        borderStyle: d.borderStyle,
                        borderColor: d.borderColor,
                        textAlign: d.textAlign as any,
                        justifyContent: d.textAlign === 'left' ? 'flex-start' : d.textAlign === 'right' ? 'flex-end' : 'center',
                        alignItems: d.verticalAlign === 'top' ? 'flex-start' : d.verticalAlign === 'bottom' ? 'flex-end' : 'center',
                        overflow: (isEditing || (sizingLayoutType !== 'fixed' && sizingLayoutType !== 'fit' && sizingLayoutType !== 'none')) ? 'visible' : 'hidden',
                        minWidth: '2ch',
                        padding: d.padding,
                        boxSizing: 'border-box'
                    }}
                    onClick={isEditing ? (e) => e.stopPropagation() : handleClick}
                    onDoubleClick={handleDoubleClick}
                    onMouseEnter={() => {
                        handleActionTrigger('mouseenter');
                        onHover?.(layer.id);
                    }}
                    onMouseLeave={() => {
                        handleActionTrigger('mouseleave');
                        onHover?.(null);
                    }}
                    onTouchStart={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchStart');
                        if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
                    }}
                    onTouchEnd={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchEnd');
                        if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
                    }}
                onMouseDown={(e) => {
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation();
                    onMouseDown?.(e, layer.id);
                }}
                    onContextMenu={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e);
                    }}
                >
                    {/* Invisible overlay for robust hit-testing on gradient/transparent texts */}
                    {!isEditing && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 10, cursor: 'inherit', pointerEvents: 'auto' }} />
                    )}
                    {renderRawStyle()}
                    {renderRawTextStyle()}
                    {/* Visual Content / Ghost for measurement */}
                    <div
                        ref={contentRef}
                        style={{
                            fontSize: d.fontSize,
                            zoom: d.scale,
                            letterSpacing: d.letterSpacing,
                            fontFamily: `${d.fontFamily}, sans-serif`,
                            fontWeight: d.fontWeight,
                            fontStyle: d.fontStyle,
                            color: d.textBgType === 'solid' ? d.textColor : 'rgba(0,0,0,0.01)',
                            WebkitTextFillColor: d.textBgType !== 'solid' ? 'transparent' : 'unset',
                            backgroundImage: d.textBgType !== 'solid' ? d.textBackground : 'none',
                            WebkitBackgroundClip: d.textBgType !== 'solid' ? 'text' : 'unset',
                            backgroundClip: d.textBgType !== 'solid' ? 'text' : 'unset',
                            WebkitTextStroke: d.textStroke,
                            lineHeight: d.lineHeight,
                            textTransform: d.textTransform,
                            textDecoration: d.textDecoration,
                            textShadow: actionStyles?.textShadow || d.textShadow,
                            width: (sizingLayoutType === 'auto') ? 'max-content' : (d.scale === 1 ? '100%' : `calc(100% / ${d.scale})`),
                            wordBreak: 'break-word',
                            padding: '0px',
                            boxSizing: 'border-box',
                            visibility: isEditing ? 'hidden' : 'visible',
                            userSelect: isEditing ? 'none' : 'auto',
                            position: isEditing ? 'absolute' : 'relative',
                            ...(isEditing ? { left: 0, top: 0 } : {}),
                            minHeight: '1em',
                            display: (sizingLayoutType === 'auto' || isEditing || effectiveMaxLines <= 0) ? 'block' : '-webkit-box',
                            WebkitLineClamp: (isEditing || effectiveMaxLines <= 0) ? 'unset' : effectiveMaxLines,
                            WebkitBoxOrient: 'vertical',
                            textAlign: d.textAlign as any,
                            overflow: (isEditing || isShrinkToFit || (sizingLayoutType !== 'none' && sizingLayoutType !== 'fixed' && sizingLayoutType !== 'fit' && !effectiveMaxLines)) ? 'visible' : 'hidden',
                            textOverflow: overflowBehavior === 'truncate' ? 'ellipsis' : 'clip',
                            whiteSpace: (maxLinesVal === 1 && isShrinkToFit) ? 'nowrap' : 'pre-wrap',
                            transition: 'none !important',
                            ...getExtraTextProps().style,
                            animationName: textRawAnim ? `tkf-${textAnimName}` : 'none',
                            animationDuration: '1s',
                            animationTimingFunction: 'linear',
                            animationFillMode: 'forwards',
                            animationDelay: `-${textProgress}s`,
                            animationPlayState: interactionAnim?.active ? 'running' : 'paused',
                            transform: textRawAnim ? undefined : (textEffectiveStyles as any)?.transform,
                            transformOrigin: (textEffectiveStyles as any)?.transformOrigin,
                            opacity: textEffectiveStyles ? (textEffectiveStyles as any).opacity : undefined,
                            pointerEvents: textEffectiveStyles ? (textEffectiveStyles as any).pointerEvents : undefined,
                        }}
                        dangerouslySetInnerHTML={{ __html: dynamicContent || meta.label || layer.url || '' }}
                    />

                    {isEditing && (
                        <div
                            id={`editor-${layer.id}`}
                            contentEditable
                            suppressContentEditableWarning
                            ref={(el) => {
                                if (el && !hasFocused.current) {
                                    // Initialize content exactly once from meta
                                    el.innerHTML = meta.label ?? layer.url ?? '';
                                    el.focus();
                                    // Select all content
                                    const range = document.createRange();
                                    range.selectNodeContents(el);
                                    const selection = window.getSelection();
                                    selection?.removeAllRanges();
                                    selection?.addRange(range);
                                    hasFocused.current = true;
                                }
                            }}
                            style={{
                                fontSize: d.fontSize,
                                zoom: d.scale,
                                letterSpacing: d.letterSpacing,
                                fontFamily: `${d.fontFamily}, sans-serif`,
                                fontWeight: d.fontWeight,
                                fontStyle: d.fontStyle,
                                lineHeight: d.lineHeight,
                                textTransform: d.textTransform,
                                position: 'relative',
                                width: (sizingLayoutType === 'auto') ? 'max-content' : (d.scale === 1 ? '100%' : `calc(100% / ${d.scale})`),
                                height: 'auto',
                                boxSizing: 'border-box',
                                margin: 0,
                                background: 'transparent',
                                border: 'none',
                                padding: '0px',
                                outline: 'none',
                                zIndex: 10,
                                pointerEvents: 'auto',
                                overflow: 'visible',
                                whiteSpace: sizingLayoutType === 'auto' ? 'pre' : 'pre-wrap', // 'pre' prevents wrapping while typing until Enter
                                wordBreak: 'normal',
                                display: 'block',
                                // Add a subtle border or ring to clearly show the editor boundaries if it's very large
                                boxShadow: '0 0 0 1px rgba(0, 128, 128, 0.1)',
                                borderRadius: '2px',
                                color: d.textBgType === 'solid' ? d.textColor : 'rgba(0,0,0,0.01)',
                                WebkitTextFillColor: d.textBgType !== 'solid' ? 'transparent' : 'unset',
                                backgroundImage: d.textBgType !== 'solid' ? d.textBackground : 'none',
                                WebkitBackgroundClip: d.textBgType !== 'solid' ? 'text' : 'unset',
                                backgroundClip: d.textBgType !== 'solid' ? 'text' : 'unset',
                                WebkitTextStroke: d.textStroke,
                                textAlign: d.textAlign as any,
                                textShadow: d.textShadow,
                                cursor: 'text',
                                minHeight: '1em',
                                minWidth: sizingLayoutType === 'auto' ? '50px' : 'unset', // Prevent collapse while empty
                                userSelect: 'text'
                            }}
                            onPaste={(e) => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text/plain');
                                document.execCommand('insertText', false, text);
                            }}
                            onInput={(e) => {
                                const newMeta = { ...meta, label: e.currentTarget.innerHTML };
                                onUpdateLayers?.([layer.id], { variant: JSON.stringify(newMeta) });
                            }}
                            onBlur={(e) => {
                                // Only stop editing if we're not moving focus to the properties bar (the sidebar) OR the mini toolbar
                                const relatedTarget = e.relatedTarget as HTMLElement;
                                const isToolbar = relatedTarget?.closest('.properties-bar-container') ||
                                    relatedTarget?.closest('[data-property-control]') ||
                                    relatedTarget?.closest('[data-text-toolbar="true"]') ||
                                    relatedTarget?.closest('.color-picker-popover-content');

                                if (!isToolbar) {
                                    onStopEditing?.(stageId);
                                }
                            }}
                        onMouseDown={(e) => { 
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation(); 
                    onMouseDown?.(e, layer.id);
                }}
                            onMouseUp={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && sizingLayoutType === 'auto') {
                                    e.preventDefault();
                                    onStopEditing?.(stageId);
                                } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onStopEditing?.(stageId);
                                }
                            }}
                        >
                        </div>
                    )}

                    {/* Portal-based floating toolbar removed for unified Properties Bar editing */}
                </div>
            </div>
        );
    }
    if (layer.type === 'shape') {
        const { default: d } = typography as any;
        const useHtml = meta.useHtml === true || meta.shapeType === 'square' || meta.shapeType === 'circle' || meta.shapeType === 'line';
        const clipPath = useHtml ? 'none' : (meta.clipPath || 'inset(0%)');
        const borderRadius = (meta.shapeType === 'circle') ? '50%' : (meta.borderRadius ?? d.borderRadius);

        type FillLayer = { backgroundImage: string; backgroundSize: string; backgroundRepeat: string; backgroundPosition: string; opacity: number };
        let fillLayers: FillLayer[] = [];
        let backgroundColor = 'transparent';


        if (meta.fills && Array.isArray(meta.fills)) {
            const visibleFills = meta.fills.filter((f: any) => f.visible !== false);

            fillLayers = visibleFills.map((f: any) => {
                const fillOpacity = f.opacity !== undefined ? f.opacity : 1;
                const backgroundImage = getGradientBackground(f, fillOpacity, layer);

                const backgroundSize = f.type === 'image'
                    ? (f.imageMode === 'tile' ? 'auto' : f.imageMode === 'contain' ? 'contain' : f.imageMode === 'stretch' ? '100% 100%' : 'cover')
                    : 'auto';
                const backgroundRepeat = f.type === 'image' && f.imageMode === 'tile' ? 'repeat' : 'no-repeat';
                const backgroundPosition = f.type === 'image' && f.imageMode === 'tile' ? 'top left' : `${f.imagePosX ?? 50}% ${f.imagePosY ?? 50}%`;

                return {
                    backgroundImage,
                    backgroundSize,
                    backgroundRepeat,
                    backgroundPosition,
                    opacity: f.type === 'image' ? (f.opacity !== undefined ? f.opacity : 1) : 1,
                };
            });
        }
 else {
            // Fallback for single color/bgType (no per-fill opacity layers)
            const fillOpacity = layer.opacity ?? 1;
            const fallbackFill = {
                type: meta.bgType,
                color: meta.backgroundColor || meta.colorCode || '#3B82F6',
                color2: meta.backgroundColor2 || meta.colorCode2 || '#1D4ED8',
                stops: meta.stops,
                gradientAngle: meta.gradientAngle,
                gradientLength: meta.gradientLength,
                gradientCenterX: meta.gradientCenterX,
                gradientCenterY: meta.gradientCenterY,
                gradientRadius: meta.gradientRadius,
            };
            const backgroundImage = getGradientBackground(fallbackFill, fillOpacity, layer);
            if (meta.bgType === 'linear' || meta.bgType === 'radial') {
                fillLayers = [{
                    backgroundImage,
                    backgroundSize: 'cover',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center',
                    opacity: 1
                }];
            } else if (meta.bgType !== 'none') {
                backgroundColor = fallbackFill.color;
            }
        }

        const hasFillLayers = fillLayers.length > 0;

        return (
            <div style={wrapperStyle}>
                <div
                    id={layer.id}
                    {...({ name: layer.name } as any)}
                    className={`${isChildOfAutoLayout ? 'relative' : 'absolute'} select-none ${isSelected ? 'z-[100]' : ''
                        }`}
                    style={{
                        ...containerStyle,
                        cursor: cursor || 'pointer',
                        ...(hasFillLayers ? {} : { backgroundImage: '', backgroundColor }),
                        backgroundColor: hasFillLayers ? 'transparent' : backgroundColor,
                        clipPath,
                        WebkitClipPath: clipPath,
                        borderRadius,
                        borderWidth: d.borderWidth,
                        borderStyle: d.borderStyle,
                        borderColor: d.borderColor,
                        overflow: 'hidden',
                    }}
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    onMouseEnter={() => {
                        handleActionTrigger('mouseenter');
                        onHover?.(layer.id);
                    }}
                    onMouseLeave={() => {
                        handleActionTrigger('mouseleave');
                        onHover?.(null);
                    }}
                    onTouchStart={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchStart');
                        if (t && (isPreviewMode || isInteractive)) {
                            fireInteraction({ 
                                targetLayerId: t.targetLayerId, 
                                action: t.action as AnimationTriggerAction,
                                includeChildren: !!t.includeChildren
                            });
                        }
                    }}
                    onTouchEnd={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchEnd');
                        if (t && (isPreviewMode || isInteractive)) {
                            fireInteraction({ 
                                targetLayerId: t.targetLayerId, 
                                action: t.action as AnimationTriggerAction,
                                includeChildren: !!t.includeChildren
                            });
                        }
                    }}
                onMouseDown={(e) => {
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation();
                    onMouseDown?.(e, layer.id);
                }}
                    onContextMenu={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e);
                    }}
                >
                    {hasFillLayers && fillLayers.map((layerStyle, i) => (
                        <div
                            key={i}
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage: layerStyle.backgroundImage,
                                backgroundSize: layerStyle.backgroundSize,
                                backgroundRepeat: layerStyle.backgroundRepeat,
                                backgroundPosition: layerStyle.backgroundPosition,
                                opacity: layerStyle.opacity,
                                borderRadius: (meta.shapeType === 'circle') ? '50%' : (meta.borderRadius ?? d.borderRadius),
                            }}
                        />
                    ))}
                    {renderRawStyle()}
                </div>
            </div>
        );
    }



    if (layer.type === 'widget') {
        const getColorClasses = (color: string) => {
            switch (color) {
                case 'orange': return 'bg-orange-50 text-orange-500';
                case 'pink': return 'bg-pink-50 text-pink-500';
                case 'purple': return 'bg-purple-50 text-purple-500';
                case 'red': return 'bg-red-50 text-red-500';
                default: return 'bg-gray-50 text-gray-400';
            }
        };

        const renderContent = () => {
            if (meta.hasCustomCode) {
                const combinedDoc = `
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <style>${meta.widgetCss || ''}</style>
                        </head>
                        <body style="margin:0; padding:0; background:transparent;">
                            ${meta.widgetHtml || ''}
                            <script>
                                window.widgetProperties = ${JSON.stringify(meta.properties || [])};
                                window.widgetValues = window.widgetProperties.reduce((acc, prop) => {
                                    acc[prop.name] = prop.value;
                                    return acc;
                                }, {});
                                ${meta.widgetJs || ''}
                            </script>
                        </body>
                    </html>
                `;
                return (
                    <iframe
                        srcDoc={combinedDoc}
                        className={`w-full h-full border-0 rounded-xl ${isPreviewMode ? '' : 'pointer-events-none'}`}
                        title={meta.label || 'Widget'}
                        style={{ overflow: 'hidden' }}
                    />
                );
            }
            if (meta.url) {
                return (
                    <iframe
                        src={meta.url}
                        className={`w-full h-full border-0 rounded-xl ${isPreviewMode ? '' : 'pointer-events-none'}`}
                        title={meta.label || 'Widget'}
                        style={{ overflow: 'hidden' }}
                    />
                );
            }
            return (
                <div className="flex flex-col items-center gap-2 pointer-events-none">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${getColorClasses(meta.color)}`}>
                        <span className="material-symbols-outlined text-[32px]">{meta.icon || 'widgets'}</span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-tight px-2 text-center">{meta.label || layer.url || 'Widget'}</span>
                </div>
            );
        };

        return (
            <div style={wrapperStyle}>
                <div
                    id={layer.id}
                    {...({ name: layer.name } as any)}
                    className={`${isChildOfAutoLayout ? 'relative' : 'absolute'} flex items-center justify-center rounded-xl shadow-md border border-gray-100 select-none bg-white hover:shadow-lg overflow-hidden`}
                    style={{ ...containerStyle, cursor: cursor || 'pointer' }}
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    onMouseEnter={() => {
                        handleActionTrigger('mouseenter');
                        onHover?.(layer.id);
                    }}
                    onMouseLeave={() => {
                        handleActionTrigger('mouseleave');
                        onHover?.(null);
                    }}
                    onTouchStart={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchStart');
                        if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
                    }}
                    onTouchEnd={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchEnd');
                        if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
                    }}
                onMouseDown={(e) => {
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation();
                    onMouseDown?.(e, layer.id);
                }}
                    onContextMenu={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e);
                    }}
                >
                    {renderRawStyle()}
                    {renderContent()}
                </div>
            </div>
        );
    }

    if (layer.type === 'video') {
        return (
            <div style={wrapperStyle}>
                <div
                    id={layer.id}
                    {...({ name: layer.name } as any)}
                    className={`group ${isChildOfAutoLayout ? 'relative' : 'absolute'} cursor-pointer ${isSelected ? 'z-[100]' : ''
                        }`}
                    style={{
                        ...containerStyle,
                        backgroundColor: '#000',
                        borderRadius: (typography as any).default.borderRadius,
                        borderWidth: (typography as any).default.borderWidth,
                        borderStyle: (typography as any).default.borderStyle,
                        borderColor: (typography as any).default.borderColor,
                        overflow: 'hidden'
                    }}
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    onMouseEnter={() => {
                        handleActionTrigger('mouseenter');
                        onHover?.(layer.id);
                    }}
                    onMouseLeave={() => {
                        handleActionTrigger('mouseleave');
                        onHover?.(null);
                    }}
                    onTouchStart={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchStart');
                        if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
                    }}
                    onTouchEnd={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchEnd');
                        if (t && (isPreviewMode || isInteractive)) fireInteraction({ targetLayerId: t.targetLayerId, action: t.action as AnimationTriggerAction });
                    }}
                onMouseDown={(e) => {
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation();
                    onMouseDown?.(e, layer.id);
                }}
                    onContextMenu={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e);
                    }}
                >
                    <video
                        ref={videoRef}
                        src={dynamicContent || layer.url}
                        poster={meta.posterUrl}
                        className="w-full h-full object-cover pointer-events-none"
                        autoPlay={isPreviewMode}
                        muted={videoMuted}
                        loop={isPreviewMode && meta.loop !== false}
                        playsInline
                    />
                    
                    {/* Custom Video Controls Overlay */}
                    {meta.controls === true && (
                        <div 
                            className="absolute inset-x-0 bottom-0 p-2 flex flex-col gap-1.5 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => { 
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation(); 
                    onMouseDown?.(e, layer.id);
                }}
                        >
                            {meta.controlTimeline === true && (
                                <input 
                                    type="range"
                                    min="0"
                                    max={videoDuration || 100}
                                    step="0.1"
                                    value={videoCurrentTime}
                                    onChange={handleTimelineChange}
                                    style={{ 
                                        accentColor: meta.controlColorTimelineThumb || '#3B82F6',
                                        background: meta.controlColorTimelineTrack || 'rgba(255,255,255,0.3)'
                                    }}
                                    className="w-full h-1 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all"
                                />
                            )}
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    {meta.controlPlay === true && (
                                        <button 
                                            onClick={togglePlay}
                                            style={{ color: meta.controlColorPlay || '#ffffff' }}
                                            className="size-6 rounded-lg bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center transition-all active:scale-90"
                                        >
                                            {videoPlayState ? (
                                                meta.controlIconPause ? <img src={meta.controlIconPause} className="size-4 object-contain" alt="pause" /> : <span className="material-symbols-outlined text-[18px]">pause</span>
                                            ) : (
                                                meta.controlIconPlay ? <img src={meta.controlIconPlay} className="size-4 object-contain" alt="play" /> : <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                                            )}
                                        </button>
                                    )}
                                    {meta.controlMute === true && (
                                        <button 
                                            onClick={toggleMute}
                                            style={{ color: meta.controlColorMute || '#ffffff' }}
                                            className="size-6 rounded-lg bg-white/20 hover:bg-white/40 backdrop-blur-md flex items-center justify-center transition-all active:scale-90"
                                        >
                                            {videoMuted || videoVolume === 0 ? (
                                                meta.controlIconMute ? <img src={meta.controlIconMute} className="size-4 object-contain" alt="mute" /> : <span className="material-symbols-outlined text-[18px]">volume_off</span>
                                            ) : (
                                                meta.controlIconUnmute ? <img src={meta.controlIconUnmute} className="size-4 object-contain" alt="unmute" /> : <span className="material-symbols-outlined text-[18px]">volume_up</span>
                                            )}
                                        </button>
                                    )}
                                    {meta.controlVolume === true && (
                                        <input 
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={videoVolume}
                                            onChange={handleVolumeChange}
                                            style={{ 
                                                accentColor: meta.controlColorVolumeThumb || '#3B82F6',
                                                background: meta.controlColorVolumeTrack || 'rgba(255,255,255,0.3)'
                                            }}
                                            className="w-16 h-1 rounded-full appearance-none cursor-pointer"
                                        />
                                    )}
                                </div>
                                
                                {meta.controlTimeline === true && (
                                    <div className="text-[9px] font-bold text-white/80 tabular-nums">
                                        {Math.floor(videoCurrentTime / 60)}:{(videoCurrentTime % 60).toFixed(0).padStart(2, '0')} / {Math.floor(videoDuration / 60)}:{(videoDuration % 60).toFixed(0).padStart(2, '0')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {renderRawStyle()}
                </div>
            </div>
        );
    }

    if (layer.type === 'group') {
        const isAuto = meta.layoutMode === 'auto';

        // --- Masking Logic ---
        const maskLayer = layer.children?.find(c => c.isMask);

        let maskStyle: React.CSSProperties = {};

        if (maskLayer) {
            const mp = getInterpolatedLayerStyles(
                maskLayer,
                currentTime,
                stageDuration,
                loopsDone,
                stageLoopCount,
                stageStopAtSecond,
                stageFeedLoopCount,
                isPreviewMode,
                false // Mask source is relative to group coordinate system
            );

            const groupW = (effectiveStyles as any)?.width ?? layer.width;
            const groupH = (effectiveStyles as any)?.height ?? layer.height;

            // Base dimensions (unscaled)
            const baseW = mp.width;
            const baseH = mp.height;

            // Calculate Scaled Visual Dimensions vs Base Dimensions to get Scale Factor
            // Or use explicit scale props if available, falling back to visual/base ratio
            const scaleX = mp.scaleX ?? 1;
            const scaleY = mp.scaleY ?? 1;

            // Skew
            const skewX = mp.skewX ?? 0;
            const skewY = mp.skewY ?? 0;

            // Group specific: layer coordinates are usually relative to group Top-Left
            // We treat mp.visualX as the absolute Center X relative to the Group's Top-Left
            const maskCenterX = mp.visualX;
            const maskCenterY = mp.visualY;

            // Reconstruct variant to check for borderRadius
            let maskMeta: any = {};
            try { maskMeta = JSON.parse(maskLayer.variant || '{}'); } catch { }

            // Resolve Transform Origin for Rotation Pivot
            // Default to center (50% 50%) -> which is (maskCenterX, maskCenterY)


            // If we use rotate(angle, px, py) in SVG, it rotates around that generic point.
            // But we also have scale/skew.
            // Standard CSS transform-origin affects ALL of them.
            // The robust SVG equivalent is: 
            // translate(pivotX, pivotY) -> rotate -> skew -> scale -> translate(-pivotX + maskCenterX, -pivotY + maskCenterY)?
            // No, simpler: translate(maskCenterX, maskCenterY) -> translate(localOriginOffset) -> rotate/skew/scale -> translate(-localOriginOffset)

            const tOrigin = (mp as any).transformOrigin || maskMeta.transformOrigin || 'center center';

            // let localPivX = ... // Removed unused

            // Let's stick to the robust parsing I wrote above, but clean it up
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

            // Local offset from Center (0,0) to the Pivot Point
            const pivotOffsetX = -baseW / 2 + oxVal;
            const pivotOffsetY = -baseH / 2 + oyVal;

            const sr = parseFloat((mp.rotateZ || mp.rotation || mp.rotate || mp.rotationZ || 0) as any) || 0;

            const so = mp.opacity;

            // ... (formatting code) ...

            // Construct Transform String with strict Transform Origin support
            // 1. Center the coordinate system at the layer's visual center (maskCenterX, maskCenterY)
            // 2. Shift so (0,0) becomes the pivot point (pivotOffsetX, pivotOffsetY)
            // 3. Apply Transformations (Rotate, Skew, Scale)
            // 4. Shift back so the shape is drawn relative to its original top-left (which was centered)

            // Actually, simpler standard matrix sequence for "Transform around Pivot":
            // Translate(PivotGlobal) * TransformMatrix * Translate(-PivotGlobal) * Translate(GlobalPos)?
            // Correct sequence for SVG "transform" attribute (applied right-to-left):
            // translate(maskCenterX, maskCenterY) 
            // translate(pivotOffsetX, pivotOffsetY) -- move origin to pivot? No.

            // Let's do:
            // translate(maskCenterX, maskCenterY) -> the group is now at global center.
            // We want to rotate around (pivotOffsetX, pivotOffsetY) local to this center.
            // transform="translate(px, py) rotate(r) translate(-px, -py)" pattern.

            // Improved Transform Construction using single-parameter rotate(angle)
            // We apply the pivot translation manually to keep the rotate call simple.
            // Sequence: Translate to Global Center -> Translate to Pivot (Local) -> Rotate -> Translate back from Pivot -> Skew -> Scale

            const transform = `translate(${maskCenterX} ${maskCenterY}) translate(${pivotOffsetX} ${pivotOffsetY}) rotate(${sr}) translate(${-pivotOffsetX} ${-pivotOffsetY}) skewX(${skewX}) skewY(${skewY}) scale(${scaleX} ${scaleY})`;


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

            // Shape is drawn centered at 0,0 locally
            const localX = -baseW / 2;
            const localY = -baseH / 2;

            let maskShape = '';
            if (isPolygon) {
                // Parse and recenter polygon points
                // Polygon points are usually % formatted '0% 0%, 100% 0%...' or '0 0, 100 0...' relative to bounding box
                const pointsStr = clipPath.match(/polygon\((.*)\)/)?.[1] || '';

                // We need to map these % points to pixels relative to the local centered coordinate system (-w/2 to w/2)
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

            // (Previously redundant logic removed)

            const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${groupW}" height="${groupH}" style="overflow: visible;">
  <g transform="${transform}">
    ${maskShape}
  </g>
</svg>`.trim();

            const b64 = btoa(svg);
            const maskUrl = `url(data:image/svg+xml;base64,${b64})`;

            maskStyle = {
                WebkitMaskImage: maskUrl,
                maskImage: maskUrl,
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskSize: '100% 100%',
                maskSize: '100% 100%',
            };
        }

        type FillLayer = { backgroundImage: string; backgroundSize: string; backgroundRepeat: string; backgroundPosition: string; opacity: number };
        let fillLayers: FillLayer[] = [];
        let backgroundColor = 'transparent';

        if (meta.fills && Array.isArray(meta.fills)) {
            const visibleFills = meta.fills.filter((f: any) => f.visible !== false);

            const parseColorAlpha = (color: string): number => {
                if (!color) return 1;
                if (color.startsWith('rgba')) {
                    const m = color.match(/[\d.]+/g);
                    return m && m.length >= 4 ? parseFloat(m[3]) : 1;
                }
                if (color.startsWith('rgb') || !color.startsWith('#')) return 1;
                return color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
            };

            const toRgba = (color: string, fillOpacity: number): string => {
                if (!color) return `rgba(0,0,0,${fillOpacity})`;
                let r = 0, g = 0, b = 0;
                if (color.startsWith('rgb')) {
                    const m = color.match(/[\d.]+/g);
                    if (m && m.length >= 3) {
                        r = parseInt(m[0], 10); g = parseInt(m[1], 10); b = parseInt(m[2], 10);
                    }
                } else if (color.startsWith('#')) {
                    r = parseInt(color.slice(1, 3), 16);
                    g = parseInt(color.slice(3, 5), 16);
                    b = parseInt(color.slice(5, 7), 16);
                }
                const colorAlpha = parseColorAlpha(color);
                const a = colorAlpha * fillOpacity;
                return `rgba(${r},${g},${b},${a})`;
            };

            fillLayers = visibleFills.map((f: any) => {
                const c1 = f.color || '#3B82F6';
                const c2 = f.color2 || '#1D4ED8';
                const fillOpacity = f.opacity !== undefined ? f.opacity : 1;

                const opaC1 = toRgba(c1, fillOpacity);
                const opaC2 = toRgba(c2, fillOpacity);

                let backgroundImage: string;
                const angle = f.gradientAngle ?? 180;
                const len = f.gradientLength ?? 100;
                const cx = f.gradientCenterX ?? 50;
                const cy = f.gradientCenterY ?? 50;
                const radLen = f.gradientRadius ?? 100;
                if (f.type === 'solid') backgroundImage = `linear-gradient(${opaC1}, ${opaC1})`;
                else if (f.type === 'linear') {
                    const w = layer.width, h = layer.height;
                    const r = angle * Math.PI / 180;
                    const L = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)) || 1;
                    const p1 = 50 + (((cx/100-0.5)*w*Math.sin(r) - (cy/100-0.5)*h*Math.cos(r)) / L) * 100;
                    const p2 = p1 + ((len/100*w)/L)*100;
                    backgroundImage = `linear-gradient(${angle}deg, ${opaC1} ${p1}%, ${opaC2} ${p2}%)`;
                }
                else if (f.type === 'radial') {
                    const w = layer.width, h = layer.height;
                    const rPx = (radLen / 100) * w;
                    backgroundImage = `radial-gradient(circle ${rPx}px at ${cx}% ${cy}%, ${opaC1} 0%, ${opaC2} 100%)`;
                }
                else if (f.type === 'image' && f.imageUrl) {
                    backgroundImage = `url("${f.imageUrl}")`;
                } else {
                    backgroundImage = 'linear-gradient(transparent, transparent)';
                }

                const backgroundSize = f.type === 'image'
                    ? (f.imageMode === 'tile' ? 'auto' : f.imageMode === 'contain' ? 'contain' : f.imageMode === 'stretch' ? '100% 100%' : 'cover')
                    : 'auto';
                const backgroundRepeat = f.type === 'image' && f.imageMode === 'tile' ? 'repeat' : 'no-repeat';
                const backgroundPosition = f.type === 'image' && f.imageMode === 'tile' ? 'top left' : `${f.imagePosX ?? 50}% ${f.imagePosY ?? 50}%`;

                return {
                    backgroundImage,
                    backgroundSize,
                    backgroundRepeat,
                    backgroundPosition,
                    opacity: f.type === 'image' ? (f.opacity !== undefined ? f.opacity : 1) : 1,
                };
            });
        } else {
            const c1 = meta.colorCode || '#3B82F6';
            const c2 = meta.colorCode2 || '#1D4ED8';
            if (meta.bgType === 'linear') {
                const w = layer.width, h = layer.height;
                const cx = meta.gradientCenterX ?? 50;
                const cy = meta.gradientCenterY ?? 50;
                const angle = meta.gradientAngle ?? 180;
                const len = meta.gradientLength ?? 100;
                const r = angle * Math.PI / 180;
                const L = Math.abs(w * Math.sin(r)) + Math.abs(h * Math.cos(r)) || 1;
                const p1 = 50 + (((cx/100-0.5)*w*Math.sin(r) - (cy/100-0.5)*h*Math.cos(r)) / L) * 100;
                const p2 = p1 + ((len/100*w)/L)*100;
                fillLayers = [{ backgroundImage: `linear-gradient(${angle}deg, ${c1} ${p1}%, ${c2} ${p2}%)`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', opacity: 1 }];
            } else if (meta.bgType === 'radial') {
                const w = layer.width, h = layer.height;
                const rPx = ((meta.gradientRadius ?? 100) / 100) * w;
                const cx = meta.gradientCenterX ?? 50;
                const cy = meta.gradientCenterY ?? 50;
                fillLayers = [{ backgroundImage: `radial-gradient(circle ${rPx}px at ${cx}% ${cy}%, ${c1} 0%, ${c2} 100%)`, backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center', opacity: 1 }];
            } else if (meta.bgType !== 'none') {
                backgroundColor = c1;
            }
        }

        const hasFillLayers = fillLayers.length > 0;

        const groupBoxWidth = isAuto ? (meta.layoutSizingHorizontal === 'hug' ? 'fit-content' : `${(effectiveStyles as any)?.width ?? layer.width}px`) : `${(effectiveStyles as any)?.width ?? layer.width}px`;
        const groupBoxHeight = isAuto ? (meta.layoutSizingVertical === 'hug' ? 'fit-content' : `${(effectiveStyles as any)?.height ?? layer.height}px`) : `${(effectiveStyles as any)?.height ?? layer.height}px`;
        const groupFlexStyle: React.CSSProperties = isAuto
            ? {
                position: 'relative',
                left: 0,
                top: 0,
                width: groupBoxWidth,
                height: groupBoxHeight,
                minWidth: meta.layoutSizingHorizontal !== 'hug' ? `${Math.max(0, Number((effectiveStyles as any)?.width ?? layer.width) || 0)}px` : undefined,
                minHeight: meta.layoutSizingVertical !== 'hug' ? `${Math.max(0, Number((effectiveStyles as any)?.height ?? layer.height) || 0)}px` : undefined,
                display: 'flex',
                flexDirection: (meta.flexDirection || 'row') as React.CSSProperties['flexDirection'],
                flexWrap: (meta.flexWrap || 'nowrap') as React.CSSProperties['flexWrap'],
                gap: `${meta.gap === 'auto' ? 0 : (meta.gap || 0)}px`,
                padding: `${meta.paddingTop ?? meta.paddingVertical ?? meta.padding ?? 0}px ${meta.paddingRight ?? meta.paddingHorizontal ?? meta.padding ?? 0}px ${meta.paddingBottom ?? meta.paddingVertical ?? meta.padding ?? 0}px ${meta.paddingLeft ?? meta.paddingHorizontal ?? meta.padding ?? 0}px`,
                justifyContent: (meta.gap === 'auto' ? 'space-between' : (meta.justifyContent ?? 'flex-start')) as React.CSSProperties['justifyContent'],
                alignItems: (meta.alignItems ?? 'flex-start') as React.CSSProperties['alignItems'],
                alignContent: (meta.alignContent ?? meta.alignItems ?? 'flex-start') as React.CSSProperties['alignContent'],
                opacity: containerStyle.opacity,
                transform: containerStyle.transform,
                transformOrigin: containerStyle.transformOrigin,
                filter: containerStyle.filter,
                boxShadow: containerStyle.boxShadow,
                textShadow: containerStyle.textShadow,
                backgroundColor: hasFillLayers ? 'transparent' : backgroundColor,
                borderRadius: (typography as any).default.borderRadius,
                borderWidth: (typography as any).default.borderWidth,
                borderStyle: (typography as any).default.borderStyle,
                borderColor: (typography as any).default.borderColor,
                overflow: (maskLayer || meta.clipContent) ? 'hidden' : 'visible',
                pointerEvents: (layer.locked || (isTextToolActive && !isEditing)) ? 'none' : 'auto',
            }
            : {
                ...containerStyle,
                width: groupBoxWidth,
                height: groupBoxHeight,
                backgroundColor: hasFillLayers ? 'transparent' : backgroundColor,
                borderRadius: (typography as any).default.borderRadius,
                borderWidth: (typography as any).default.borderWidth,
                borderStyle: (typography as any).default.borderStyle,
                borderColor: (typography as any).default.borderColor,
                overflow: (maskLayer || meta.clipContent) ? 'hidden' : 'visible',
            };

        return (
            <div style={wrapperStyle}>
                <div
                    id={layer.id}
                    ref={contentRef}
                    {...({ name: layer.name } as any)}
                    className={`${isChildOfAutoLayout ? 'relative' : 'absolute'} ${isAuto ? 'border border-dashed border-purple-200/50' : ''}`}
                    style={{
                        ...groupFlexStyle,
                        ...maskStyle,
                    }}
                    onClick={handleClick}
                    onDoubleClick={handleDoubleClick}
                    onMouseEnter={() => {
                        handleActionTrigger('mouseenter');
                        onHover?.(layer.id);
                    }}
                    onMouseLeave={() => {
                        handleActionTrigger('mouseleave');
                        onHover?.(null);
                    }}
                    onTouchStart={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchStart');
                        if (t && (isPreviewMode || isInteractive)) {
                            fireInteraction({ 
                                targetLayerId: t.targetLayerId, 
                                action: t.action as AnimationTriggerAction,
                                includeChildren: !!t.includeChildren
                            });
                        }
                    }}
                    onTouchEnd={() => {
                        const t = layer.interactionActions?.find(a => a.event === 'touchEnd');
                        if (t && (isPreviewMode || isInteractive)) {
                            fireInteraction({ 
                                targetLayerId: t.targetLayerId, 
                                action: t.action as AnimationTriggerAction,
                                includeChildren: !!t.includeChildren
                            });
                        }
                    }}
                onMouseDown={(e) => {
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation();
                    onMouseDown?.(e, layer.id);
                }}
                    onContextMenu={(e) => {
                        e.stopPropagation();
                        onContextMenu?.(e);
                    }}
                >
                    {hasFillLayers && fillLayers.map((layerStyle, i) => (
                        <div
                            key={i}
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                ...layerStyle,
                                borderRadius: (typography as any).default.borderRadius,
                            }}
                        />
                    ))}
                    {renderRawStyle()}
                    {layer.children?.map((child) => (
                        child.isMask ? null : (
                            <LayerPreview
                                key={child.id}
                                layer={child}
                                stageId={stageId}
                                selectedLayerIds={selectedLayerIds}
                                onLayerClick={onLayerClick}
                                currentTime={currentTime}
                                loopsDone={loopsDone}
                                stageLoopCount={stageLoopCount}
                                stageStopAtSecond={stageStopAtSecond}
                                stageDuration={stageDuration}
                                stageFeedLoopCount={stageFeedLoopCount}
                                isPreviewMode={isPreviewMode}
                                zoom={zoom}
                                onUpdateLayers={onUpdateLayers}
                                onStopEditing={onStopEditing}
                                editingLayerIds={editingLayerIds}
                                isChildOfAutoLayout={isAuto}
                                parentFlexDirection={isAuto ? (meta.flexDirection || 'row') : undefined}
                                parentWidth={isAuto ? (Number((effectiveStyles as any)?.width ?? layer.width) || 0) : undefined}
                                parentHeight={isAuto ? (Number((effectiveStyles as any)?.height ?? layer.height) || 0) : undefined}
                                stageActions={stageActions}
                                actionStates={actionStates}
                                onTriggerAction={onTriggerAction}
                                parentOverriddenTime={parentOverriddenTime}
                                onHover={onHover}
                                stageWidth={stageWidth}
                                stageHeight={stageHeight}
                                isTextToolActive={isTextToolActive}
                                cursor={cursor}
                                isPlaying={isPlaying}
                            />
                        )
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={wrapperStyle}>
            <div
                id={layer.id}
                data-image-fit={meta.imageFit}
                {...({ name: layer.name } as any)}
                className={`group ${isChildOfAutoLayout ? 'relative' : 'absolute'}`}
                style={{
                    ...containerStyle,
                    cursor: cursor || 'pointer',
                    backgroundImage: (dynamicContent || layer.url) ? `url(${dynamicContent || layer.url})` : undefined,
                    backgroundSize: meta.imageFit === 'tile' ? 'auto' : (meta.imageFit || 'contain'),
                    backgroundPosition: `${meta.imagePosX ?? 50}% ${meta.imagePosY ?? 50}%`,
                    backgroundRepeat: meta.imageFit === 'tile' ? 'repeat' : 'no-repeat',
                    borderRadius: (typography as any).default.borderRadius,
                    borderWidth: (typography as any).default.borderWidth,
                    borderStyle: (typography as any).default.borderStyle,
                    borderColor: (typography as any).default.borderColor,
                    textShadow: actionStyles?.textShadow || (typography as any).default.textShadow,
                }}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                onMouseEnter={() => {
                    handleActionTrigger('mouseenter');
                    onHover?.(layer.id);
                }}
                onMouseLeave={() => {
                    handleActionTrigger('mouseleave');
                    onHover?.(null);
                }}
                onMouseDown={(e) => { 
                    if (isEditing) {
                        e.stopPropagation();
                        return;
                    }
                    if (!isTextToolActive) e.stopPropagation(); 
                    onMouseDown?.(e, layer.id);
                }}
                onContextMenu={(e) => {
                    e.stopPropagation();
                    onContextMenu?.(e);
                }}
            >
                {renderRawStyle()}
            </div>
        </div>
    );
});

export default LayerPreview;
