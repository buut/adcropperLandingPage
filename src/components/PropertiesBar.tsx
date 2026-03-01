import React, { useEffect, useState, useRef, useMemo } from 'react';
import { cleanFileName } from '../utils/fileUtils';
import { AppMode } from './Header';
import InteractiveEffectPopup, { interactiveEffects, visualEffects } from './InteractiveEffectPopup';

import { Stage, Layer, StageAction, FontData, InteractionAction, AnimationTriggerEvent, AnimationTriggerAction, LandingPageAction, LandingPageTrigger, LandingPageActionType, BreakpointName } from '../App';
import WidgetCodeEditor from './WidgetCodeEditor';
import FontSelector from './FontSelector';
import WeightSelector from './WeightSelector';
import BorderStyleSelector from './BorderStyleSelector';
import ColorPicker from './ColorPicker';
import VideoControlSettings from './VideoControlSettings';
import { parseOrigin, getInterpolatedKeyframeProps } from '../utils/animations';
import { UPLOAD_URL } from '../App';
import { applyRichTextFormat } from '../utils/richText';

const getLayerIcon = (type: string) => {
    switch (type) {
        case 'text': return 'text_fields';
        case 'image': return 'image';
        case 'widget': return 'widgets';
        case 'button': return 'smart_button';
        case 'shape': return 'category';
        case 'group': return 'group';
        case 'video': return 'movie';
        default: return 'layers';
    }
};

interface KeyframeProperties {
    transformX: number;
    transformY: number;
    transformZ: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    rotation?: number;
    scaleX: number;
    scaleY: number;
    scaleZ: number;
    skewX: number;
    skewY: number;
    opacity: number;
    transformOrigin?: string;
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'elastic' | 'bounce' | 'back-in' | 'back-out' | 'back-in-out';
    blur: number;
    brightness: number;
    contrast: number;
    grayscale: number;
    sepia: number;
    saturate: number;
}

const defaultKeyframeProps: KeyframeProperties = {
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
    opacity: 1,
    transformOrigin: 'center center',
    easing: 'linear',
    blur: 0,
    brightness: 1,
    contrast: 1,
    grayscale: 0,
    sepia: 0,
    saturate: 1,
};

const easingOptions = [
    { label: 'Linear', value: 'linear' },
    { label: 'Ease-In', value: 'ease-in' },
    { label: 'Ease-Out', value: 'ease-out' },
    { label: 'Ease-In-Out', value: 'ease-in-out' },
    { label: 'Elastic', value: 'elastic' },
    { label: 'Bounce', value: 'bounce' },
    { label: 'Back-In', value: 'back-in' },
    { label: 'Back-Out', value: 'back-out' },
    { label: 'Back-In-Out', value: 'back-in-out' },
];

const originOptions = [
    { label: 'Center', value: 'center center' },
    { label: 'Top Left', value: 'left top' },
    { label: 'Top Center', value: 'center top' },
    { label: 'Top Right', value: 'right top' },
    { label: 'Left Center', value: 'left center' },
    { label: 'Right Center', value: 'right center' },
    { label: 'Bottom Left', value: 'left bottom' },
    { label: 'Bottom Center', value: 'center bottom' },
    { label: 'Bottom Right', value: 'right bottom' },
];

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: { label: string; value: string }[];
    icon: string;
    placeholder?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, icon, placeholder = 'Select' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.value === value)?.label || value;

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full h-9 pl-9 pr-3 bg-gray-50/50 border border-gray-100 rounded-lg text-[10px] font-black uppercase tracking-wider text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white relative"
            >
                <span className="truncate">{selectedLabel || placeholder}</span>
                <span className={`material-symbols-outlined text-[16px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] pointer-events-none z-10">{icon}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[500] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="overflow-y-auto max-h-[200px] p-1 custom-scrollbar">
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === option.value ? 'bg-primary/10 text-primary' : 'text-gray-700'}`}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <span className="material-symbols-outlined text-[14px]">check</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface PropertiesBarProps {
    selectedLayerIds: string[];
    stages: Stage[];
    onUpdateLayers: (layerIds: string[], updates: Partial<Omit<Layer, 'id' | 'type'>>, isBatch?: boolean, targetLayerId?: string) => void;
    onUpdateStage: (stageId: string, updates: Partial<Omit<Stage, 'id' | 'layers'>>) => void;
    onBatchUpdateStages?: (stageIds: string[], updates: Partial<Omit<Stage, 'id' | 'layers'>>) => void;
    onArrangeStages?: () => void;
    onStageSelect: (id: string | null) => void;
    selectedStageId: string | null;
    mode?: AppMode;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    selectedSize: string;
    onSizeChange: (val: string) => void;
    editingLayerIds?: Record<string, string | null>;
    previewState: 'default' | 'hover' | 'active';
    onPreviewStateChange: (state: 'default' | 'hover' | 'active') => void;
    onUpdateLayerAnimation?: (layerId: string, updates: any) => void;
    fonts?: FontData[];
    mediaAssets?: string[];
    onUpdateMediaAssets?: (assets: string[]) => void;
    editingKeyframeInfo?: {
        layerId: string;
        keyframeIds?: string[];
        time?: number;
        initialProps?: any;
        originalKeyframes?: Record<string, any[]>;
        tempKeyframeId?: string;
        isBatch?: boolean;
    } | null;
    onCloseKeyframeEditor?: () => void;
    onSendMessageClick?: () => void;
    currentTime?: number;
}


const PropertiesBar: React.FC<PropertiesBarProps> = ({ 
    selectedLayerIds, 
    stages, 
    onUpdateLayers,
    onUpdateStage,
    onBatchUpdateStages,
    onArrangeStages,
    onStageSelect,
    selectedStageId,
    mode = 'design',
    searchTerm,
    onSearchChange,
    selectedSize,
    onSizeChange,
    editingLayerIds = {},
    previewState: buttonState, // Map key to buttonState for minimal refactor of internal code
    onPreviewStateChange: setButtonState,
    onUpdateLayerAnimation,
    fonts = [],
    mediaAssets = [],
    onUpdateMediaAssets,
    editingKeyframeInfo,
    onCloseKeyframeEditor,
    onSendMessageClick,
    currentTime
}) => {

    const [isStageRatioLocked, setIsStageRatioLocked] = useState(false);
    const [kfProps, setKfProps] = useState<KeyframeProperties>(defaultKeyframeProps);
    const [internalTempKeyframeId, setInternalTempKeyframeId] = useState<string | undefined>(undefined);

    const activeKeyframeInfo = useMemo(() => {
        let selectedLayer: any = null;
        const targetLayerId = editingKeyframeInfo ? editingKeyframeInfo.layerId : (selectedLayerIds.length === 1 ? selectedLayerIds[0] : null);
        
        if (targetLayerId) {
            stages.forEach(s => {
                const find = (layers: any[]) => {
                    layers.forEach(l => {
                        if (l.id === targetLayerId) selectedLayer = l;
                        if (l.children) find(l.children);
                    });
                };
                find(s.layers);
            });
        }

        if (editingKeyframeInfo) {
            const timeInUnits = currentTime !== undefined ? Math.round(currentTime * 100) : (editingKeyframeInfo.time || 0);
            
            const isEditingMultiple = editingKeyframeInfo.keyframeIds && editingKeyframeInfo.keyframeIds.length > 1;
            
            if (isEditingMultiple || editingKeyframeInfo.time === timeInUnits) {
                return editingKeyframeInfo;
            }

            if (selectedLayer) {
                const props = getInterpolatedKeyframeProps(selectedLayer.animation?.keyframes || [], timeInUnits, selectedLayer);
                const existingKf = selectedLayer.animation?.keyframes?.find((k: any) => k.time === timeInUnits);
                
                return {
                    ...editingKeyframeInfo,
                    time: timeInUnits,
                    initialProps: props,
                    tempKeyframeId: existingKf ? existingKf.id : undefined,
                    keyframeIds: existingKf ? [existingKf.id] : []
                };
            }

            return editingKeyframeInfo;
        }

        const isCustomMode = selectedLayer && mode !== 'design' && (selectedLayer.animation?.name === 'custom' || (selectedLayer.animation?.keyframes && selectedLayer.animation.keyframes.length > 0));

        if (isCustomMode && selectedLayer) {
            const timeInUnits = currentTime !== undefined ? Math.round(currentTime * 100) : 0;
            const props = getInterpolatedKeyframeProps(selectedLayer.animation?.keyframes || [], timeInUnits, selectedLayer);
            
            // Determine if there already is an exact keyframe here
            const existingKf = selectedLayer.animation?.keyframes?.find((k: any) => k.time === timeInUnits);
            
            return {
                layerId: selectedLayer.id,
                time: timeInUnits,
                initialProps: props,
                tempKeyframeId: existingKf ? existingKf.id : undefined,
                keyframeIds: existingKf ? [existingKf.id] : []
            };
        }
        return null;
    }, [editingKeyframeInfo, selectedLayerIds, mode, stages, currentTime]);

    const prevActiveTimeRef = useRef<number | null>(null);
    const prevActiveLayerRef = useRef<string | null>(null);
    const prevEditingRef = useRef<any>(null);

    useEffect(() => {
        if (activeKeyframeInfo) {
            // Only overwrite kfProps if time, layer, or explicit editingKeyframeInfo changes
            const isEditingExplicitChanged = prevEditingRef.current !== editingKeyframeInfo;
            if (activeKeyframeInfo.time !== prevActiveTimeRef.current || activeKeyframeInfo.layerId !== prevActiveLayerRef.current || isEditingExplicitChanged) {
                const init = { ...activeKeyframeInfo.initialProps };
                if (init.rotateZ !== undefined && init.rotation === undefined) {
                    init.rotation = init.rotateZ;
                }
                if (typeof init.rotation === 'string') init.rotation = parseFloat(init.rotation) || 0;
                setKfProps({ ...defaultKeyframeProps, ...init });
                setInternalTempKeyframeId(activeKeyframeInfo.tempKeyframeId);
                
                prevActiveTimeRef.current = activeKeyframeInfo.time ?? null;
                prevActiveLayerRef.current = activeKeyframeInfo.layerId;
                prevEditingRef.current = editingKeyframeInfo;
            }
        } else {
            setInternalTempKeyframeId(undefined);
            prevActiveTimeRef.current = null;
            prevActiveLayerRef.current = null;
            prevEditingRef.current = null;
        }
    }, [activeKeyframeInfo, editingKeyframeInfo]);

    const handleKfChange = (updates: Partial<KeyframeProperties>) => {
        if (!activeKeyframeInfo || !onUpdateLayerAnimation) return;

        const newProps = { ...kfProps, ...updates };
        setKfProps(newProps);

        const ids = activeKeyframeInfo.keyframeIds || (internalTempKeyframeId ? [internalTempKeyframeId] : []);
        const realTime = currentTime !== undefined ? Math.round(currentTime * 100) : activeKeyframeInfo.time;

        if (ids.length > 0) {
            // Update Multiple or already created temp kf
            const layersToUpdate = new Set<string>();
            stages.forEach(s => {
                s.layers.forEach(l => {
                    const check = (layer: Layer) => {
                        if (layer.animation?.keyframes?.some((k: any) => ids.includes(k.id))) {
                            layersToUpdate.add(layer.id);
                        }
                        if (layer.children) layer.children.forEach(check);
                    };
                    check(l);
                });
            });

            layersToUpdate.forEach(lId => {
                let targetLayer: Layer | undefined;
                stages.forEach(s => {
                    const find = (layers: Layer[]) => {
                        layers.forEach(l => {
                            if (l.id === lId) targetLayer = l;
                            if (l.children) find(l.children);
                        });
                    };
                    find(s.layers);
                });

                if (targetLayer) {
                    const updated = (targetLayer.animation?.keyframes || []).map((k: any) => {
                        if (ids.includes(k.id)) {
                            return { ...k, props: { ...k.props, ...updates } };
                        }
                        return k;
                    });
                    onUpdateLayerAnimation(lId, { keyframes: updated });
                }
            });
        }
        // Case 2: Adding a new keyframe (Live Preview)
        else if (realTime !== undefined) {
            let kfId = internalTempKeyframeId;
            if (!kfId) {
                kfId = `kf_temp_${Math.random().toString(36).substr(2, 9)}`;
                setInternalTempKeyframeId(kfId);
                
                let targetLayer: Layer | undefined;
                stages.forEach(s => {
                    const find = (layers: Layer[]) => {
                        layers.forEach(l => {
                            if (l.id === activeKeyframeInfo.layerId) targetLayer = l;
                            if (l.children) find(l.children);
                        });
                    };
                    find(s.layers);
                });

                if (targetLayer) {
                    const currentKeyframes = targetLayer.animation?.keyframes || [];
                    const newKeyframe = {
                        id: kfId,
                        time: realTime,
                        props: newProps
                    };
                    const updated = [...currentKeyframes, newKeyframe].sort((a: any, b: any) => a.time - b.time);
                    onUpdateLayerAnimation(activeKeyframeInfo.layerId, { keyframes: updated });
                }
            } else {
                // Already created temp, just update it
                let targetLayer: Layer | undefined;
                stages.forEach(s => {
                    const find = (layers: Layer[]) => {
                        layers.forEach(l => {
                            if (l.id === activeKeyframeInfo.layerId) targetLayer = l;
                            if (l.children) find(l.children);
                        });
                    };
                    find(s.layers);
                });

                if (targetLayer) {
                    const updated = (targetLayer.animation?.keyframes || []).map((k: any) => 
                        k.id === kfId ? { ...k, props: { ...k.props, ...updates } } : k
                    );
                    onUpdateLayerAnimation(activeKeyframeInfo.layerId, { keyframes: updated });
                }
            }
        }
    };



    const renderKfInput = (label: string, key: keyof KeyframeProperties, icon: string, step = 1, min?: number, max?: number) => (
        <div className="flex flex-col gap-1.5 min-w-0">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                {icon.length > 1 ? (
                    <span className="material-symbols-outlined text-[14px]">{icon}</span>
                ) : (
                    <span className="text-[10px] font-bold w-[14px] text-center">{icon}</span>
                )}
                {label}
            </label>
            <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                <input
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={kfProps[key] ?? 0}
                    onChange={(e) => {
                        let val = parseFloat(e.target.value);
                        if (isNaN(val)) val = 0;
                        handleKfChange({ [key]: val });
                    }}
                    className="flex-1 w-full text-xs font-bold px-3 h-8 bg-transparent outline-none appearance-none"
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            let val = (parseFloat(kfProps[key] as any) || 0) + (e.shiftKey ? step * 10 : step);
                            if (max !== undefined) val = Math.min(max, val);
                            handleKfChange({ [key]: parseFloat(val.toFixed(3)) });
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            let val = (parseFloat(kfProps[key] as any) || 0) - (e.shiftKey ? step * 10 : step);
                            if (min !== undefined) val = Math.max(min, val);
                            handleKfChange({ [key]: parseFloat(val.toFixed(3)) });
                        }
                    }}
                />
                <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                    <button 
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                            let val = (parseFloat(kfProps[key] as any) || 0) + step;
                            if (max !== undefined) val = Math.min(max, val);
                            handleKfChange({ [key]: parseFloat(val.toFixed(3)) });
                        }}
                        className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-[12px] leading-none">expand_less</span>
                    </button>
                    <button 
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                            let val = (parseFloat(kfProps[key] as any) || 0) - step;
                            if (min !== undefined) val = Math.max(min, val);
                            handleKfChange({ [key]: parseFloat(val.toFixed(3)) });
                        }}
                        className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-[12px] leading-none">expand_more</span>
                    </button>
                </div>
            </div>
        </div>
    );

    const renderKeyframeEditor = () => {
        if (!activeKeyframeInfo) return null;

        const isMultiple = activeKeyframeInfo.keyframeIds && activeKeyframeInfo.keyframeIds.length > 1;
        const timeInSec = activeKeyframeInfo.time !== undefined ? (activeKeyframeInfo.time / 100).toFixed(2) : null;

        return (
            <div className="flex flex-col h-full bg-white animate-in slide-in-from-right-10 duration-300">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-20 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]">
                                {isMultiple ? 'layers' : 'edit_square'}
                            </span>
                        </div>
                        <div className="flex-1 flex flex-col">
                            <h3 className="text-[11px] font-black text-gray-800 uppercase tracking-tight">
                                {isMultiple ? `Edit ${activeKeyframeInfo.keyframeIds!.length} Keyframes` : 'Keyframe Properties'}
                            </h3>
                            {timeInSec !== null && (
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Time: {timeInSec}s</span>
                            )}
                        </div>
                        <button 
                            onClick={() => onCloseKeyframeEditor?.()}
                            className="text-[10px] font-black text-gray-400 hover:text-gray-800 flex items-center gap-1 transition-all uppercase tracking-widest"
                        >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                            Close
                        </button>
                    </div>
                </div>
                <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-3">
                    {timeInSec !== null && (
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">
                            <span>Keyframe Time: {timeInSec}s</span>
                            <span className="text-primary/60">Playhead: {(currentTime || 0).toFixed(2)}s</span>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                    <div className="grid grid-cols-1 gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10">
                        <div className="space-y-2">
                             <label className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">show_chart</span>
                                Easing
                             </label>
                             <CustomSelect
                                value={kfProps.easing}
                                onChange={(val) => handleKfChange({ easing: val as any })}
                                options={easingOptions}
                                icon="show_chart"
                             />
                        </div>
                        <div className="space-y-2">
                             <label className="text-[10px] text-primary font-black uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">filter_center_focus</span>
                                Origin
                             </label>
                             <CustomSelect
                                value={kfProps.transformOrigin || 'center center'}
                                onChange={(val) => handleKfChange({ transformOrigin: val })}
                                options={originOptions}
                                icon="filter_center_focus"
                             />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-primary">open_with</span>
                            Translate (%)
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {renderKfInput('X', 'transformX', 'X')}
                            {renderKfInput('Y', 'transformY', 'Y')}
                            {renderKfInput('Z', 'transformZ', 'Z')}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-primary">aspect_ratio</span>
                            Scale
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {renderKfInput('Scale X', 'scaleX', 'W', 0.1)}
                            {renderKfInput('Scale Y', 'scaleY', 'H', 0.1)}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-primary">palette</span>
                            Appearance
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {renderKfInput('Rotate', 'rotation', 'rotate_right')}
                            {renderKfInput('Opacity', 'opacity', 'opacity', 0.05, 0, 1)}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-primary">format_italic</span>
                            Skew
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {renderKfInput('Skew X', 'skewX', 'X')}
                            {renderKfInput('Skew Y', 'skewY', 'Y')}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
                            Filters
                        </label>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                            {renderKfInput('Blur', 'blur', 'blur_on', 1, 0)}
                            {renderKfInput('Brightness', 'brightness', 'brightness_6', 0.1, 0)}
                            {renderKfInput('Contrast', 'contrast', 'contrast', 0.1, 0)}
                            {renderKfInput('Grayscale', 'grayscale', 'gradient', 0.1, 0, 1)}
                            {renderKfInput('Sepia', 'sepia', 'settings_brightness', 0.1, 0, 1)}
                            {renderKfInput('Saturate', 'saturate', 'colorize', 0.1, 0)}
                        </div>
                    </div>
                </div>


            </div>
        );
    };
    const handleImageUpload = async (file: File, targetField: string = 'url') => {
        if (!file) return;

        setIsUploading(true);
        const companyId = '66db07778b5e35892545578c';
        const brandId = '671a1666d786fa251fca95d0';
        const templateId = '670fa914c2f0842143d5932';

        try {
            const formData = new FormData();
            const cleanedName = cleanFileName(file.name);
            const renamedFile = new File([file], cleanedName, { type: file.type });
            formData.append('file', renamedFile);
            formData.append('companyId', companyId);
            formData.append('brandId', brandId);
            formData.append('templateId', templateId);

            const response = await fetch(`${UPLOAD_URL}/upload-asset`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            
            if (data.url) {
                // Update layers
                if (targetField === 'url') {
                    onUpdateLayers(selectedLayerIds, { url: data.url });
                } else if (targetField.startsWith('fill-')) {
                    const fillIdx = parseInt(targetField.split('-')[1]);
                    if (Array.isArray(localValues['fills'])) {
                        const newFills = [...localValues['fills']];
                        if (newFills[fillIdx]) {
                            newFills[fillIdx] = { ...newFills[fillIdx], imageUrl: data.url };
                            handleUpdateFills(newFills);
                        }
                    }
                } else {
                    selectedLayers.forEach(l => {
                        try {
                            const meta = JSON.parse(l.variant || '{}');
                            meta[targetField] = data.url;
                            const updates: any = { variant: JSON.stringify(meta) };
                            if (targetField === 'videoUrl') updates.url = data.url;
                            onUpdateLayers([l.id], updates);
                        } catch {}
                    });
                }
                
                // Add to media assets
                if (onUpdateMediaAssets && !mediaAssets.includes(data.url)) {
                    onUpdateMediaAssets([...mediaAssets, data.url]);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const [localValues, setLocalValues] = useState<Record<string, any>>({});
    const [surgicalStyles, setSurgicalStyles] = useState<Record<string, any>>({});
    // Removed local buttonState
    const [isExporting, setIsExporting] = useState(false);
    const [effectPopupAnchor, setEffectPopupAnchor] = useState<DOMRect | null>(null);
    const [showIndependentPadding, setShowIndependentPadding] = useState(false);
    const [showIndependentCorners, setShowIndependentCorners] = useState(false);
    const [showIndependentBorders, setShowIndependentBorders] = useState(false);
    const [stageTab, setStageTab] = useState<'settings' | 'actions'>('settings');
    const [isWidgetEditorOpen, setIsWidgetEditorOpen] = useState(false);
    const [isMainLibraryOpen, setIsMainLibraryOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLayerTextsCollapsed, setIsLayerTextsCollapsed] = useState(false);
    const [libraryTarget, setLibraryTarget] = useState<string>('url');
    const [widgetCode, setWidgetCode] = useState<{ html: string; css: string; js: string; name: string; icon: string; properties: any[] }>({ 
        html: '', css: '', js: '', name: '', icon: 'widgets', properties: [] 
    });
    const [openDropdown, setOpenDropdown] = useState<{ actionId: string, type: 'source' | 'target' | 'effect' | 'ia-event' | 'ia-action' | 'ia-target' } | null>(null);
    const [dropdownSearchTerm, setDropdownSearchTerm] = useState('');
    const lastFocusedId = useRef<string | null>(null);
    const spatialDebounceTimers = useRef<Record<string, any>>({});
    const lastRangeRef = useRef<Range | null>(null);
    const textContentEditorRef = useRef<HTMLDivElement | null>(null);
    const stepDragRef = useRef<{
        key: string;
        handleStep: (k: string, d: number) => void;
        lastDirection: number;
        intervalId: ReturnType<typeof setInterval> | null;
    } | null>(null);

    const [arrowSlider, setArrowSlider] = useState<{ key: string; clientX: number; clientY: number } | null>(null);
    const arrowSliderCenterRef = useRef<number>(0);
    const arrowSliderMouseXRef = useRef<number>(0);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressKeyRef = useRef<string | null>(null);
    const longPressMouseRef = useRef<{ clientX: number; clientY: number }>({ clientX: 0, clientY: 0 });

    const currentEditingLayerId = selectedStageId ? editingLayerIds[selectedStageId] : null;
    const editingLayerId = currentEditingLayerId; // Alias for minimal refactor below

    // Track the last valid selection range within the editor
    useEffect(() => {
        const handleSelectionChange = () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                let node = range.commonAncestorContainer;
                if (node.nodeType === 3) node = node.parentNode!;
                
                const htmlNode = node as HTMLElement;
                const editor = htmlNode.closest && htmlNode.closest('[id^="editor-"]');
                
                // If the selection is inside any editor, remember it and update sidebar
                if (editor) {
                    lastRangeRef.current = range.cloneRange();
                    
                    const styles = window.getComputedStyle(htmlNode);
                    setSurgicalStyles({
                        fontSize: styles.fontSize.replace('px', '').split('.')[0], // Int format
                        fontWeight: styles.fontWeight,
                        fontFamily: styles.fontFamily.split(',')[0].replace(/['"]/g, ''), // Clean name
                        fontStyle: styles.fontStyle,
                        textColor: styles.color,
                        textDecoration: styles.textDecoration,
                        lineHeight: (() => {
                            let lh = styles.lineHeight;
                            if (lh === 'normal') return '1.2';
                            if (lh.includes('px')) {
                                const fs = parseFloat(styles.fontSize);
                                const lhp = parseFloat(lh);
                                if (fs > 0) return (lhp / fs).toFixed(1);
                            }
                            return lh;
                        })(),
                        letterSpacing: styles.letterSpacing === 'normal' ? '0' : styles.letterSpacing.replace('px', ''),
                        isSelected: !range.collapsed
                    });
                } else {
                    // Only clear if we were editing but now selection is outside
                    if (Object.keys(surgicalStyles).length > 0) {
                        setSurgicalStyles({});
                    }
                }
            }
        };
        document.addEventListener('selectionchange', handleSelectionChange);
        return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (!(e.target as HTMLElement).closest('.action-selector-container')) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!openDropdown) {
            setDropdownSearchTerm('');
        }
    }, [openDropdown]);

    // Auto-detect independent settings on selection
    useEffect(() => {
        if (selectedLayers.length > 0) {
            const hasIndCorners = selectedLayers.some(l => {
                try {
                    const m = JSON.parse(l.variant || '{}');
                    return m.borderRadiusTopLeft !== undefined || m.borderRadiusTopRight !== undefined || 
                           m.borderRadiusBottomRight !== undefined || m.borderRadiusBottomLeft !== undefined;
                } catch { return false; }
            });
            const hasIndBorders = selectedLayers.some(l => {
                try {
                    const m = JSON.parse(l.variant || '{}');
                    return m.borderTopWidth !== undefined || m.borderRightWidth !== undefined || 
                           m.borderBottomWidth !== undefined || m.borderLeftWidth !== undefined;
                } catch { return false; }
            });
            const hasIndPadding = selectedLayers.some(l => {
                try {
                    const m = JSON.parse(l.variant || '{}');
                    return m.paddingTop !== undefined || m.paddingRight !== undefined || 
                           m.paddingBottom !== undefined || m.paddingLeft !== undefined;
                } catch { return false; }
            });

            setShowIndependentCorners(hasIndCorners);
            setShowIndependentBorders(hasIndBorders);
            setShowIndependentPadding(hasIndPadding);
        } else {
            setShowIndependentCorners(false);
            setShowIndependentBorders(false);
            setShowIndependentPadding(false);
        }
    }, [selectedLayerIds]);

    const getAllLayers = (layers: Layer[]): Layer[] => {
        if (!layers) return [];
        let result: Layer[] = [];
        layers.forEach((l: Layer) => {
            result.push(l);
            if (l.children) result = [...result, ...getAllLayers(l.children)];
        });
        return result;
    };

    const findAllTextLayers = (layer: Layer): Layer[] => {
        let result: Layer[] = [];
        if (layer.id && layer.type === 'text') result.push(layer);
        if (layer.children) {
            layer.children.forEach((child: Layer) => {
                result = [...result, ...findAllTextLayers(child)];
            });
        }
        return result;
    };

    const selectedLayers = stages.flatMap(s => getAllLayers(s.layers)).filter(l => selectedLayerIds.includes(l.id));

    const selectedLayer = selectedLayers[0];
    let isLayerRatioLocked = true; // Default to true if nothing selected or parsing fails
    if (selectedLayer) {
        try {
            const m = JSON.parse(selectedLayer.variant || '{}');
            isLayerRatioLocked = m.lockAspectRatio !== false;
        } catch(_) { isLayerRatioLocked = true; }
    }

    const setLayerRatioLocked = (val: boolean) => {
        if (!selectedLayer) return;
        const updates: any[] = [];
        selectedLayers.forEach(l => {
            try {
                const m = JSON.parse(l.variant || '{}');
                updates.push({ id: l.id, changes: { variant: JSON.stringify({ ...m, lockAspectRatio: val }) } });
            } catch(_) {}
        });
        if (updates.length > 0) {
            onUpdateLayers(updates.map(u => u.id), updates[0].changes, true);
        }
    };
    const currentStage = stages.find(s => s.id === selectedStageId);

    const findParentLayer = (layers: Layer[], childId: string): Layer | null => {
        for (const l of layers) {
            if (l.children?.some((c: Layer) => c.id === childId)) return l;
            if (l.children) {
                const found = findParentLayer(l.children, childId);
                if (found) return found;
            }
        }
        return null;
    };

    const documentColors = useMemo(() => {
        const colors = new Set<string>();
        const processColor = (val: any) => {
            if (typeof val === 'string' && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(val)) {
                colors.add(val.toUpperCase());
            }
        };

        stages.forEach(s => {
            processColor(s.backgroundColor);
            processColor(s.backgroundColor2);
            
            const extract = (layers: Layer[]) => {
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
                        } catch {}
                    }
                    if (l.children) extract(l.children);
                });
            };
            extract(s.layers);
        });

        return Array.from(colors).sort();
    }, [stages]);

    useEffect(() => {
        if (selectedLayers.length > 0) {
            const getCommonValue = (key: keyof Layer) => {
                const values = selectedLayers.map(l => {
                    const val = l[key];
                    if (typeof val !== 'number') return val;

                    // Convert Center-based to Top-Left based for display if not in Auto Layout
                    if (key === 'x' || key === 'y') {
                        const size = key === 'x' ? l.width : l.height;
                        
                        const stage = stages.find(s => s.id === selectedStageId);
                        const isAutoChild = (() => {
                            if (!stage) return false;
                            const parent = findParentLayer(stage.layers, l.id);
                            if (!parent || parent.type !== 'group') return false;
                            try {
                                const pm = JSON.parse(parent.variant || '{}');
                                return pm.layoutMode === 'auto';
                            } catch { return false; }
                        })();

                        // If it's an auto-layout child, val is already top-left
                        if (isAutoChild) return Math.round(val);
                        // Otherwise, val is center, subtract size/2 to show top-left
                        return Math.round(val - size/2);
                    }
                    return Math.round(val);
                });

                const first = values[0];
                const isAllSame = values.every(v => v === first);
                if (!isAllSame) return 'Mixed';
                
                if (first === undefined) return '';
                return String(first);
            };

            const getCommonVariantValue = (key: string) => {
                const values = selectedLayers.map(l => {
                    try {
                        const v = JSON.parse(l.variant || '{}');
                        return v[key];
                    } catch { return undefined; }
                });
                const first = values[0];
                const isAllSame = values.every(v => v === first);
                
                // If it's undefined/null, return empty string
                if (first === undefined || first === null) return '';
                if (!isAllSame) return 'Mixed';
                return String(first);
            };

            const newSpatialValues = {
                x: getCommonValue('x'),
                y: getCommonValue('y'),
                width: getCommonValue('width'),
                height: getCommonValue('height'),
                rotation: getCommonValue('rotation'),
                url: getCommonValue('url'),
                opacity: (() => {
                    const values = selectedLayers.map(l => l.opacity === undefined ? 1 : l.opacity);
                    const first = values[0];
                    const isAllSame = values.every(v => v === first);
                    if (!isAllSame) return 'Mixed';
                    return String(Math.round(first * 100));
                })(),
                transformOrigin: (() => {
                    const values = selectedLayers.map(l => l.transformOrigin);
                    const first = values[0];
                    if (values.every(v => v === first)) return first || '';
                    return 'Mixed';
                })(),
            };

            const newVariantValues = {
                fontSize: getCommonVariantValue('fontSize'),
                fontFamily: getCommonVariantValue('fontFamily'),
                fontWeight: getCommonVariantValue('fontWeight'),
                textColor: getCommonVariantValue('textColor'),
                lineHeight: getCommonVariantValue('lineHeight'),
                letterSpacing: getCommonVariantValue('letterSpacing'),
                textAlign: getCommonVariantValue('textAlign'),
                textTransform: getCommonVariantValue('textTransform'),
                textDecoration: getCommonVariantValue('textDecoration'),
                layoutType: getCommonVariantValue('layoutType'),
                maxLines: getCommonVariantValue('maxLines'),
                bgType: getCommonVariantValue('bgType'),
                colorCode: getCommonVariantValue('colorCode'),
                colorCode2: getCommonVariantValue('colorCode2'),
                effect: getCommonVariantValue('effect'),
                label: getCommonVariantValue('label'), // Also track label
                borderRadius: getCommonVariantValue('borderRadius') || '0',
                borderRadiusTopLeft: getCommonVariantValue('borderRadiusTopLeft'),
                borderRadiusTopRight: getCommonVariantValue('borderRadiusTopRight'),
                borderRadiusBottomRight: getCommonVariantValue('borderRadiusBottomRight'),
                borderRadiusBottomLeft: getCommonVariantValue('borderRadiusBottomLeft'),
                borderWidth: getCommonVariantValue('borderWidth'),
                borderColor: getCommonVariantValue('borderColor'),
                borderStyle: getCommonVariantValue('borderStyle'),
                borderTopWidth: getCommonVariantValue('borderTopWidth'),
                borderRightWidth: getCommonVariantValue('borderRightWidth'),
                borderBottomWidth: getCommonVariantValue('borderBottomWidth'),
                borderLeftWidth: getCommonVariantValue('borderLeftWidth'),
                videoUrl: getCommonVariantValue('videoUrl'),
                posterUrl: getCommonVariantValue('posterUrl'),
                loop: getCommonVariantValue('loop') === 'false' ? 'false' : 'true',
                controls: getCommonVariantValue('controls') === 'true' ? 'true' : 'false',
                controlPlay: getCommonVariantValue('controlPlay') === 'true' ? 'true' : 'false',
                controlMute: getCommonVariantValue('controlMute') === 'true' ? 'true' : 'false',
                controlVolume: getCommonVariantValue('controlVolume') === 'true' ? 'true' : 'false',
                controlTimeline: getCommonVariantValue('controlTimeline') === 'true' ? 'true' : 'false',
                controlColorPlay: getCommonVariantValue('controlColorPlay') || '#ffffff',
                controlColorMute: getCommonVariantValue('controlColorMute') || '#ffffff',
                controlColorTimelineTrack: getCommonVariantValue('controlColorTimelineTrack') || 'rgba(255,255,255,0.3)',
                controlColorTimelineThumb: getCommonVariantValue('controlColorTimelineThumb') || '#3B82F6',
                controlColorVolumeTrack: getCommonVariantValue('controlColorVolumeTrack') || 'rgba(255,255,255,0.3)',
                controlColorVolumeThumb: getCommonVariantValue('controlColorVolumeThumb') || '#3B82F6',
                controlIconPlay: getCommonVariantValue('controlIconPlay'),
                controlIconPause: getCommonVariantValue('controlIconPause'),
                controlIconMute: getCommonVariantValue('controlIconMute'),
                controlIconUnmute: getCommonVariantValue('controlIconUnmute'),
                effects: (() => {
                    const values = selectedLayers.map(l => {
                        try { return JSON.parse(l.variant || '{}').effects || []; } catch { return []; }
                    });
                    const first = JSON.stringify(values[0]);
                    const isAllSame = values.every(v => JSON.stringify(v) === first);
                    return isAllSame ? values[0] : 'Mixed';
                })(),
                fills: (() => {
                    const values = selectedLayers.map(l => {
                        try { return JSON.parse(l.variant || '{}').fills || []; } catch { return []; }
                    });
                    const first = JSON.stringify(values[0]);
                    const isAllSame = values.every(v => JSON.stringify(v) === first);
                    return isAllSame ? values[0] : 'Mixed';
                })(),
            };

            const isSameEditingFocus = lastFocusedId.current === editingLayerId;
            lastFocusedId.current = editingLayerId;

            setLocalValues(prev => {
                // If we are currently editing this layer AND it's the same one as before, we want to PRESERVE the local variants
                // to avoid the UI flickering or reverting while the user types/interacts.
                // However, we ALWAYS accept new spatial values (x, y, etc) from the canvas interactions.
                if (editingLayerId && selectedLayers.some(l => l.id === editingLayerId) && isSameEditingFocus) {
                    return {
                        ...newSpatialValues,
                        // Keep previous variant values to respect user input state
                        ...prev, 
                        // But if prev doesn't have it (first load), fallback to newVariantValues? 
                        // Actually, spread prev is good, but we need to ensure we don't have stale data from *other* layers.
                        // Since editingLayerId check passes, we are on the same layer.
                        // We might want to fill in gaps if prev is missing something.
                        ...Object.fromEntries(Object.entries(newVariantValues).filter(([k]) => prev[k] === undefined))
                    };
                }

                return {
                    ...newSpatialValues,
                    ...newVariantValues
                };
            });

        } else if (currentStage) {
            setLocalValues({
                stageName: currentStage.name,
                stageWidth: String(currentStage.width),
                stageHeight: String(currentStage.height),
                stageDuration: String(currentStage.duration), // Added
                loopCount: String(currentStage.loopCount ?? -1),
                stopAtSecond: String(currentStage.stopAtSecond ?? 0),
                backgroundColor: currentStage.backgroundColor || '#ffffff',
                bgType: currentStage.bgType || 'solid',
                feedLoopCount: String(currentStage.feedLoopCount ?? -1)
            });
        } else {
            setLocalValues({});
        }
    }, [selectedLayerIds, stages, selectedStageId, editingLayerIds]);

    // Reset button state to default when selection changes
    useEffect(() => {
        setButtonState('default');
    }, [selectedLayerIds]);

    const handleInputChange = (key: string, value: string) => {
        let val = value;
        if (['loopCount', 'feedLoopCount'].includes(key) && value.toLowerCase().includes('inf')) {
            val = '-1';
        }
        setLocalValues(prev => {
            const next = { ...prev, [key]: val };
            if (isStageRatioLocked && (key === 'stageWidth' || key === 'stageHeight') && currentStage) {
                const numVal = parseFloat(val);
                if (!isNaN(numVal) && numVal > 0) {
                    if (key === 'stageWidth') {
                        const ratio = currentStage.height / currentStage.width;
                        next.stageHeight = String(Math.round(numVal * ratio));
                    } else if (key === 'stageHeight') {
                        const ratio = currentStage.width / currentStage.height;
                        next.stageWidth = String(Math.round(numVal * ratio));
                    }
                }
            } else if (isLayerRatioLocked && (key === 'width' || key === 'height') && selectedLayers.length > 0) {
                const numVal = parseFloat(val);
                if (!isNaN(numVal) && numVal > 0) {
                    // Use the first selected layer to determine the ratio
                    const l = selectedLayers[0];
                    if (l.width > 0 && l.height > 0) {
                        if (key === 'width') {
                            const ratio = l.height / l.width;
                            next.height = String(Math.round(numVal * ratio));
                        } else if (key === 'height') {
                            const ratio = l.width / l.height;
                            next.width = String(Math.round(numVal * ratio));
                        }
                    }
                }
            }
            return next;
        });
        
        // Debounce x and y updates: wait 300ms after last change, then refresh from state
        if (key === 'x' || key === 'y') {
            if (spatialDebounceTimers.current[key]) clearTimeout(spatialDebounceTimers.current[key]);
            spatialDebounceTimers.current[key] = setTimeout(() => {
                triggerUpdate(key, val);
                // Clear both x and y from localValues so they refresh from newly calculated stage state (Full Tight Fit result)
                setLocalValues(prev => {
                    const next = { ...prev };
                    delete next.x;
                    delete next.y;
                    return next;
                });
                delete spatialDebounceTimers.current[key];
            }, 300);
        }

        // Live updates for specific properties
        if (key === 'opacity' && val && val !== 'Mixed') {
            const num = Number(val);
            if (!isNaN(num)) {
                triggerUpdate(key, val);
            }
        }
    };

    const triggerUpdate = (key: string, value: string) => {
        if (!value || value === 'Mixed') return;
        
        let numVal = Number(value);
        if (isNaN(numVal) && !['borderColor', 'borderStyle', 'stageName', 'backgroundColor', 'videoUrl', 'posterUrl', 'loop', 'controls', 'controlPlay', 'controlMute', 'controlVolume', 'controlTimeline', 'controlColorPlay', 'controlColorMute', 'controlColorTimelineTrack', 'controlColorTimelineThumb', 'controlColorVolumeTrack', 'controlColorVolumeThumb', 'controlIconPlay', 'controlIconPause', 'controlIconMute', 'controlIconUnmute', 'transformOrigin', 'url'].includes(key)) return;

        // Apply constraints
        if (key === 'stopAtSecond') {
            numVal = Math.max(0, numVal);
        } else if (key === 'stageDuration') {
            numVal = Math.max(1, numVal);
        } else if (['loopCount', 'feedLoopCount'].includes(key)) {
            numVal = Math.max(-1, Math.round(numVal));
        } else if (key === 'opacity') {
            numVal = Math.max(0, Math.min(100, numVal)) / 100;
        } else if (key === 'borderRadius' || key.startsWith('borderRadius')) {
            numVal = Math.max(0, Math.round(numVal));
        }

        if (selectedLayers.length > 0) {
            if (key === 'borderRadius' || key.startsWith('borderRadius')) {
                selectedLayers.forEach(l => {
                    try {
                        const meta = JSON.parse(l.variant || '{}');
                        meta[key] = numVal;
                        onUpdateLayers([l.id], { variant: JSON.stringify(meta) });
                    } catch (e) {
                        console.error('Failed to update radius metadata', e);
                    }
                });
            } else if (key === 'borderWidth' || key.startsWith('border') && key.endsWith('Width') || key === 'borderColor' || key === 'borderStyle') {
                selectedLayers.forEach(l => {
                    try {
                        const meta = JSON.parse(l.variant || '{}');
                        meta[key] = (key.endsWith('Width')) ? numVal : value;
                        onUpdateLayers([l.id], { variant: JSON.stringify(meta) });
                    } catch (e) {
                        console.error(`Failed to update border ${key} metadata`, e);
                    }
                });
            } else if (['videoUrl', 'posterUrl', 'loop', 'controls', 'controlPlay', 'controlMute', 'controlVolume', 'controlTimeline', 'controlColorPlay', 'controlColorMute', 'controlColorTimelineTrack', 'controlColorTimelineThumb', 'controlColorVolumeTrack', 'controlColorVolumeThumb', 'controlIconPlay', 'controlIconPause', 'controlIconMute', 'controlIconUnmute'].includes(key)) {
                selectedLayers.forEach(l => {
                    try {
                        const meta = JSON.parse(l.variant || '{}');
                        if (['loop', 'controls', 'controlPlay', 'controlMute', 'controlVolume', 'controlTimeline'].includes(key)) {
                            meta[key] = value === 'true';
                        } else {
                            meta[key] = value;
                        }
                        const updates: any = { variant: JSON.stringify(meta) };
                        if (key === 'videoUrl') updates.url = value;
                        onUpdateLayers([l.id], updates, true);
                    } catch (e) {
                        console.error(`Failed to update video ${key} metadata`, e);
                    }
                });
            } else if (key === 'transformOrigin') {
                // Smart Transform Origin: Keep the object's visual position when changing the origin
                selectedLayers.forEach(l => {
                    const oldOriginStr = l.transformOrigin || 'center center';
                    const newOriginStr = value;
                    if (oldOriginStr === newOriginStr) return;

                    const baseRotation = l.rotation || 0;
                    const rad = baseRotation * (Math.PI / 180);
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);

                    const oOld = parseOrigin(oldOriginStr, l.width, l.height);
                    const oNew = parseOrigin(newOriginStr, l.width, l.height);

                    const dx = oNew.x - oOld.x;
                    const dy = oNew.y - oOld.y;

                    const shiftX = dx - (dx * cos - dy * sin);
                    const shiftY = dy - (dx * sin + dy * cos);

                    onUpdateLayers([l.id], { 
                        transformOrigin: value,
                        x: l.x + shiftX,
                        y: l.y + shiftY
                    });
                });
            } else if (key === 'url') {
                onUpdateLayers(selectedLayerIds, { url: value });
            } else if (key === 'x' || key === 'y') {
                selectedLayers.forEach(l => {
                    const size = key === 'x' ? l.width : l.height;
                    const stage = stages.find(s => s.id === selectedStageId);
                    const isAutoChild = (() => {
                        if (!stage) return false;
                        const parent = findParentLayer(stage.layers, l.id);
                        if (!parent || parent.type !== 'group') return false;
                        try {
                            const pm = JSON.parse(parent.variant || '{}');
                            return pm.layoutMode === 'auto';
                        } catch { return false; }
                    })();

                    // If it's an auto-layout child, store as top-left (numVal as entered)
                    // If it's NOT (top-level or regular group child), store as center
                    const storedVal = isAutoChild ? numVal : (numVal + size / 2);
                    onUpdateLayers([l.id], { [key]: storedVal });
                });
            } else if (key === 'width' || key === 'height') {
                selectedLayers.forEach(l => {
                    const updates: any = {};
                    
                    const updateDim = (k: 'width' | 'height', val: number) => {
                        const oldSize = l[k];
                        const newSize = val;
                        const posKey = k === 'width' ? 'x' : 'y';
                        const oldPos = l[posKey];

                        const stage = stages.find(s => s.id === selectedStageId);
                        const isAutoChild = (() => {
                            if (!stage) return false;
                            const parent = findParentLayer(stage.layers, l.id);
                            if (!parent || parent.type !== 'group') return false;
                            try {
                                const pm = JSON.parse(parent.variant || '{}');
                                return pm.layoutMode === 'auto';
                            } catch { return false; }
                        })();

                        updates[k] = newSize;
                        if (!isAutoChild) {
                            updates[posKey] = (oldPos - oldSize / 2) + newSize / 2;
                        }
                    };

                    updateDim(key, numVal);

                    if (isLayerRatioLocked && l.width > 0 && l.height > 0) {
                        if (key === 'width') {
                            const ratio = l.height / l.width;
                            updateDim('height', Math.round(numVal * ratio));
                        } else {
                            const ratio = l.width / l.height;
                            updateDim('width', Math.round(numVal * ratio));
                        }
                    }

                    onUpdateLayers([l.id], updates);
                });
            } else {
                onUpdateLayers(selectedLayerIds, { [key]: numVal });
            }
        } else if (currentStage) {
            // Stage updates
            if (key === 'stageName') {
                onUpdateStage(currentStage.id, { name: value });
            } else if (key === 'stageWidth' || key === 'stageHeight') {
                const updates: any = { [key === 'stageWidth' ? 'width' : 'height']: numVal || (key === 'stageWidth' ? currentStage.width : currentStage.height) };
                if (isStageRatioLocked && currentStage) {
                    if (key === 'stageWidth') {
                        const ratio = currentStage.height / currentStage.width;
                        updates.height = Math.round(numVal * ratio);
                    } else {
                        const ratio = currentStage.width / currentStage.height;
                        updates.width = Math.round(numVal * ratio);
                    }
                }
                onUpdateStage(currentStage.id, updates);
            } else if (key === 'stageDuration') {
                onUpdateStage(currentStage.id, { duration: numVal });
            } else if (key === 'loopCount') {
                onUpdateStage(currentStage.id, { loopCount: numVal });
            } else if (key === 'feedLoopCount') {
                onUpdateStage(currentStage.id, { feedLoopCount: numVal });
            } else if (key === 'stopAtSecond') {
                onUpdateStage(currentStage.id, { stopAtSecond: numVal });
            } else if (key === 'backgroundColor') {
                onUpdateStage(currentStage.id, { backgroundColor: value });
            }
        }
    };

    const handleOpenWidgetEditor = async () => {
        if (selectedLayers.length !== 1 || selectedLayers[0].type !== 'widget') {
            console.warn('[PropertiesBar] No widget selected or multiple layers selected');
            return;
        }
        
        const layer = selectedLayers[0];
        let meta: any = {};
        try { meta = JSON.parse(layer.variant || '{}'); } catch (e) {
            console.error('[PropertiesBar] Failed to parse variant JSON', e);
        }

        const widgetName = meta.label || layer.name || 'Custom Widget';
        const widgetUrl = meta.url;
        
        const widgetIcon = meta.icon || 'widgets';
        
        console.log('[PropertiesBar] Opening widget editor for:', widgetName, 'URL:', widgetUrl);

        // Use custom code if available, otherwise fetch from URL if it exists
        let html = meta.widgetHtml || '';
        let css = meta.widgetCss || '';
        let js = meta.widgetJs || '';

        if (!html && widgetUrl) {
            try {
                // Determine base path for other files
                const basePath = widgetUrl.substring(0, widgetUrl.lastIndexOf('/'));
                console.log('[PropertiesBar] Fetching widget assets from:', basePath);
                
                const fetchWithCheck = async (url: string) => {
                    try {
                        const r = await fetch(url);
                        if (!r.ok) {
                            console.error(`[PropertiesBar] Fetch failed for ${url}: ${r.status} ${r.statusText}`);
                            return '';
                        }
                        return await r.text();
                    } catch (e) {
                        console.error(`[PropertiesBar] Network error for ${url}:`, e);
                        return '';
                    }
                };

                const [hResp, cResp, jResp] = await Promise.all([
                    fetchWithCheck(widgetUrl),
                    fetchWithCheck(`${basePath}/style.css`),
                    fetchWithCheck(`${basePath}/script.js`)
                ]);
                
                html = hResp;
                css = cResp;
                js = jResp;
                
                console.log('[PropertiesBar] Assets loaded. HTML size:', html.length, 'CSS size:', css.length, 'JS size:', js.length);
            } catch (e) {
                console.error('[PropertiesBar] Unexpected error fetching widget code', e);
            }
        } else if (html) {
            console.log('[PropertiesBar] Using existing custom code from metadata');
        }

        const properties = meta.properties || [];
        setWidgetCode({ html, css, js, name: widgetName, icon: widgetIcon, properties });
        setIsWidgetEditorOpen(true);
    };

    const handleSaveWidgetCode = (name: string, html: string, css: string, js: string, icon: string, properties: any[]) => {
        if (selectedLayers.length !== 1) return;
        const layer = selectedLayers[0];
        let meta: any = {};
        try { meta = JSON.parse(layer.variant || '{}'); } catch (e) {}

        const updatedMeta = {
            ...meta,
            label: name,
            icon: icon,
            widgetHtml: html,
            widgetCss: css,
            widgetJs: js,
            properties: properties,
            hasCustomCode: true
        };

        onUpdateLayers([layer.id], { 
            name: name, // Synchronize layer name
            variant: JSON.stringify(updatedMeta) 
        });
    };

    const handleUpdateEffects = (effectsOrUpdater: any[] | ((prev: any[]) => any[])) => {
        setLocalValues(prev => {
            const nextEffects = typeof effectsOrUpdater === 'function' ? effectsOrUpdater(prev.effects || []) : effectsOrUpdater;
            
            selectedLayers.forEach(l => {
                try {
                    const meta = JSON.parse(l.variant || '{}');
                    meta.effects = nextEffects;
                    onUpdateLayers([l.id], { variant: JSON.stringify(meta) });
                } catch (e) {
                    console.error('Failed to update effects metadata', e);
                }
            });

            return { ...prev, effects: nextEffects };
        });
    };

    const handleAddEffect = (type: string) => {
        const currentEffects = Array.isArray(localValues['effects']) ? localValues['effects'] : [];
        const newEffect = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            active: true,
            value: type === 'hueRotate' ? 0 : (['brightness', 'contrast', 'saturate'].includes(type) ? 100 : 0),
            x: 0, y: 0, blur: 5, spread: 0, color: '#000000', opacity: 0.5
        };
        handleUpdateEffects([...currentEffects, newEffect]);
    };
    
    const handleUpdateFills = (fillsOrUpdater: any[] | ((prev: any[]) => any[])) => {
        setLocalValues(prev => {
            const nextFills = typeof fillsOrUpdater === 'function' ? fillsOrUpdater(prev.fills || []) : fillsOrUpdater;
            
            selectedLayers.forEach(l => {
                try {
                    const meta = JSON.parse(l.variant || '{}');
                    meta.fills = nextFills;
                    onUpdateLayers([l.id], { variant: JSON.stringify(meta) });
                } catch (e) {
                    console.error('Failed to update fills metadata', e);
                }
            });

            return { ...prev, fills: nextFills };
        });
    };

    const renderGradientStopsManager = (
        stops: any[],
        type: string,
        onUpdateStops: (newStops: any[]) => void,
        color1Fallback: string,
        color2Fallback: string
    ) => {
        const allStops = (Array.isArray(stops) && stops.length > 0) ? stops : [
            { id: '1', color: color1Fallback || '#3B82F6', offset: 0 },
            { id: '2', color: color2Fallback || '#1D4ED8', offset: 1 }
        ];

        return (
            <div className="space-y-3 mt-2">
                <div className="space-y-1.5">
                    {allStops.map((stop: any, sIdx: number) => (
                        <div key={stop.id || sIdx} className="flex items-center gap-2 group p-1.5 bg-gray-50/50 hover:bg-white rounded-xl transition-all border border-gray-100/50">
                            <div onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}>
                                <ColorPicker 
                                    variant="minimal"
                                    value={stop.color}
                                    onChange={(c) => {
                                        const next = allStops.map((s, i) => i === sIdx ? { ...s, color: c } : s);
                                        onUpdateStops(next);
                                    }}
                                    swatches={documentColors}
                                />
                            </div>
                            <div className="flex-1 flex gap-2 items-center">
                                <input 
                                    type="range" min="0" max="1" step="0.01" value={stop.offset}
                                    onChange={(e) => {
                                        const next = allStops.map((s, i) => i === sIdx ? { ...s, offset: parseFloat(e.target.value) } : s);
                                        onUpdateStops(next.sort((a,b) => a.offset - b.offset));
                                    }}
                                    className="flex-1 h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
                                />
                                <span className="text-[9px] font-bold text-gray-500 w-6 text-right">{Math.round(stop.offset * 100)}%</span>
                            </div>
                            <button 
                                onClick={() => {
                                    if (allStops.length <= 2) return;
                                    const next = allStops.filter((_, i) => i !== sIdx);
                                    onUpdateStops(next);
                                }}
                                className={`text-gray-300 hover:text-red-500 transition-colors ${allStops.length <= 2 ? 'opacity-20 cursor-not-allowed' : ''}`}
                            >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                        </div>
                    ))}
                </div>
                <button 
                    onClick={() => {
                        const lastStop = allStops[allStops.length - 1];
                        const newStop = {
                            id: Math.random().toString(36).substr(2, 9),
                            color: lastStop.color,
                            offset: Math.min(1, lastStop.offset + 0.05)
                        };
                        const next = [...allStops, newStop].sort((a,b) => a.offset - b.offset);
                        onUpdateStops(next);
                    }}
                    className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-[9px] font-black text-gray-400 uppercase hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-1.5"
                >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Add Color Stop
                </button>
            </div>
        );
    };

    const handleAddFill = () => {
        const currentFills = Array.isArray(localValues['fills']) ? localValues['fills'] : [];
        const newFill = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'solid',
            color: '#3B82F6',
            color2: '#1D4ED8',
            visible: true,
            opacity: 1
        };
        handleUpdateFills([newFill, ...currentFills]);
    };

    const handleInputBlur = (key: string) => {
        if (spatialDebounceTimers.current[key]) {
            clearTimeout(spatialDebounceTimers.current[key]);
            delete spatialDebounceTimers.current[key];
        }
        triggerUpdate(key, localValues[key]);
    };

    const handleStep = (key: string, delta: number) => {
        const step = key === 'stopAtSecond' ? 0.5 : 1;
        let current = Number(localValues[key]);

        // Smart fallback for corner radius inheritance
        if (isNaN(current) && key.startsWith('borderRadius') && key !== 'borderRadius') {
            current = Number(localValues['borderRadius']);
        }
        if (isNaN(current) && key.startsWith('border') && key.endsWith('Width') && key !== 'borderWidth') {
            current = Number(localValues['borderWidth']);
        }

        if (isNaN(current)) current = 0;

        let nextVal = current + (delta * step);

        // Min constraints
        if (key === 'stopAtSecond') {
            nextVal = Math.max(0, nextVal);
        } else if (['loopCount', 'feedLoopCount'].includes(key)) {
            nextVal = Math.max(-1, nextVal);
        }

        const next = String(nextVal);
        handleInputChange(key, next);
        triggerUpdate(key, next);
    };

    const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            handleStep(key, e.shiftKey ? 10 : 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            handleStep(key, e.shiftKey ? -10 : -1);
        }
    };

    const STEP_REPEAT_MS = 1000;
    const handleStepDragMove = React.useCallback((e: MouseEvent) => {
        const state = stepDragRef.current;
        if (!state) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const dirEl = el?.closest?.('[data-step-direction]');
        const dir = dirEl ? Number((dirEl as HTMLElement).getAttribute('data-step-direction')) : 0;
        state.lastDirection = (dir === 1 || dir === -1) ? dir : 0;
    }, []);
    const handleStepDragEnd = React.useCallback(() => {
        const state = stepDragRef.current;
        if (state?.intervalId) clearInterval(state.intervalId);
        document.removeEventListener('mousemove', handleStepDragMove);
        document.removeEventListener('mouseup', handleStepDragEnd);
        stepDragRef.current = null;
    }, [handleStepDragMove]);

    const startStepDrag = React.useCallback((key: string, initialTarget?: EventTarget | null) => {
        let lastDirection = 0;
        const dirEl = (initialTarget as HTMLElement)?.closest?.('[data-step-direction]');
        if (dirEl) lastDirection = Number((dirEl as HTMLElement).getAttribute('data-step-direction')) || 0;
        const intervalId = setInterval(() => {
            const state = stepDragRef.current;
            if (!state || state.lastDirection === 0) return;
            state.handleStep(state.key, state.lastDirection);
        }, STEP_REPEAT_MS);
        stepDragRef.current = {
            key,
            handleStep,
            lastDirection,
            intervalId,
        };
        document.addEventListener('mousemove', handleStepDragMove);
        document.addEventListener('mouseup', handleStepDragEnd);
    }, [handleStepDragMove, handleStepDragEnd, handleStep]);

    const ARROW_SLIDER_PIXELS_PER_STEP = 8;
    const ARROW_SLIDER_MAX_STEPS_PER_TICK = 5;
    const ARROW_SLIDER_TICK_MS = 150;
    const arrowSliderPopoverRef = useRef<HTMLDivElement | null>(null);
    const arrowSliderIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    React.useLayoutEffect(() => {
        if (!arrowSlider || !arrowSliderPopoverRef.current) return;
        const rect = arrowSliderPopoverRef.current.getBoundingClientRect();
        arrowSliderCenterRef.current = rect.left + rect.width / 2;
    }, [arrowSlider]);

    React.useEffect(() => {
        if (!arrowSlider) return;
        arrowSliderMouseXRef.current = arrowSliderCenterRef.current;
        const tick = () => {
            const centerX = arrowSliderCenterRef.current;
            const mouseX = arrowSliderMouseXRef.current;
            const deltaX = mouseX - centerX;
            const steps = Math.round(deltaX / ARROW_SLIDER_PIXELS_PER_STEP);
            const clamped = Math.max(-ARROW_SLIDER_MAX_STEPS_PER_TICK, Math.min(ARROW_SLIDER_MAX_STEPS_PER_TICK, steps));
            if (clamped !== 0 && arrowSlider) {
                handleStep(arrowSlider.key, clamped);
            }
        };
        arrowSliderIntervalRef.current = setInterval(tick, ARROW_SLIDER_TICK_MS);
        const onMove = (e: MouseEvent) => { arrowSliderMouseXRef.current = e.clientX; };
        const onUp = () => {
            if (arrowSliderIntervalRef.current) clearInterval(arrowSliderIntervalRef.current);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            setArrowSlider(null);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        return () => {
            if (arrowSliderIntervalRef.current) clearInterval(arrowSliderIntervalRef.current);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }, [arrowSlider, handleStep]);

    const handleInputLongPressStart = React.useCallback((key: string, e: React.MouseEvent<HTMLInputElement>) => {
        longPressKeyRef.current = key;
        longPressMouseRef.current = { clientX: e.clientX, clientY: e.clientY };
        const onMove = (ev: MouseEvent) => { longPressMouseRef.current = { clientX: ev.clientX, clientY: ev.clientY }; };
        longPressTimerRef.current = setTimeout(() => {
            longPressTimerRef.current = null;
            const { clientX, clientY } = longPressMouseRef.current;
            setArrowSlider({ key, clientX, clientY });
        }, 400);
        const onUp = () => {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            longPressKeyRef.current = null;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, []);

    const uniqueSizes = Array.from(new Set(stages.map(s => `${s.width}x${s.height}`)));
    const filteredStages = stages.filter(s => {
        const matchesName = s.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSize = selectedSize === 'all' || `${s.width}x${s.height}` === selectedSize;
        return matchesName && matchesSize;
    });

    const renderInput = (label: string, key: string, icon: string, type: string = 'text') => {
        const isNumber = !['stageName', 'backgroundColor', 'transformOrigin'].includes(key);
        let displayValue = localValues[key] || '';
        
        if (['loopCount', 'feedLoopCount'].includes(key) && displayValue === '-1') {
            displayValue = 'infinite';
        }

        return (
            <div className="flex flex-col gap-1.5 min-w-0">
                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                    <span className="material-symbols-outlined text-[14px]">{icon}</span>
                    {label}
                </label>
                <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                    <input
                        type={type}
                        {...(isNumber ? { 'data-number-wheel-drag': 'true' as const, 'data-step-key': key } : {})}
                        className={`flex-1 w-full text-xs font-medium px-3 h-9 bg-transparent outline-none ${type === 'color' ? 'p-1 cursor-pointer' : ''} ${displayValue === 'infinite' ? 'text-primary font-bold' : ''}`}
                        value={displayValue}
                        onChange={(e) => handleInputChange(key, e.target.value)}
                        onBlur={() => handleInputBlur(key)}
                        onKeyDown={(e) => handleKeyDown(e, key)}
                        {...(isNumber ? { onMouseDown: (e: React.MouseEvent<HTMLInputElement>) => { if (e.button === 0) handleInputLongPressStart(key, e); } } : {})}
                    />
                    {isNumber && (
                        <div
                            className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity select-none"
                            onMouseDown={(e) => {
                                if (e.button === 0) {
                                    e.preventDefault();
                                    startStepDrag(key, e.target);
                                }
                            }}
                        >
                            <button
                                type="button"
                                tabIndex={-1}
                                data-step-direction="1"
                                onClick={() => handleStep(key, 1)}
                                className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                            >
                                <span className="material-symbols-outlined text-[12px] leading-none">expand_less</span>
                            </button>
                            <button
                                type="button"
                                tabIndex={-1}
                                data-step-direction="-1"
                                onClick={() => handleStep(key, -1)}
                                className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                            >
                                <span className="material-symbols-outlined text-[12px] leading-none">expand_more</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (activeKeyframeInfo) {
        return (
            <div className="w-[280px] bg-white border-l border-[#e5e8eb] flex flex-col shrink-0 overflow-hidden shadow-2xl z-50">
                {renderKeyframeEditor()}
            </div>
        );
    }

    if (mode === 'preview') {
        return (
            <div className="w-[280px] bg-white border-l border-[#e5e8eb] flex flex-col shrink-0 overflow-hidden shadow-2xl z-50 animate-in slide-in-from-right duration-300">
                <div className="px-6 py-5 border-b border-[#e5e8eb] bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px]">filter_list</span>
                        </div>
                        <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight flex-1">Format Browser</h3>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => onBatchUpdateStages?.(stages.map(s => s.id), { visible: true })}
                                className="size-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:border-primary/50 hover:text-primary transition-all shadow-sm"
                                title="Show All"
                            >
                                <span className="material-symbols-outlined text-[18px]">visibility</span>
                            </button>
                            <button 
                                onClick={() => onBatchUpdateStages?.(stages.map(s => s.id), { visible: false })}
                                className="size-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:border-red-400 hover:text-red-500 transition-all shadow-sm"
                                title="Hide All"
                            >
                                <span className="material-symbols-outlined text-[18px]">visibility_off</span>
                            </button>
                            <button 
                                onClick={() => onArrangeStages?.()}
                                className="size-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:border-primary/50 hover:text-primary transition-all shadow-sm"
                                title="Arrange Visible"
                            >
                                <span className="material-symbols-outlined text-[18px]">grid_view</span>
                            </button>
                            {onSendMessageClick && (
                                <button 
                                    onClick={onSendMessageClick}
                                    className="size-8 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:border-primary/50 hover:text-primary transition-all shadow-sm"
                                    title="Send Message"
                                >
                                    <span className="material-symbols-outlined text-[18px]">chat</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white flex flex-col gap-6">
                    <div className="flex flex-col gap-4">
                        <div className="relative group">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px] group-focus-within:text-primary transition-colors">search</span>
                            <input 
                                type="text" 
                                placeholder="Search dimensions..."
                                className="w-full h-10 pl-10 pr-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5 outline-none placeholder:text-gray-300"
                                value={searchTerm}
                                onChange={(e) => onSearchChange(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Filter by Size</label>
                            <div className="flex flex-wrap gap-2">
                                <button 
                                    onClick={() => onSizeChange('all')}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedSize === 'all' ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
                                >
                                    ALL FORMATS
                                </button>
                                {uniqueSizes.map(size => (
                                    <button 
                                        key={size}
                                        onClick={() => onSizeChange(size)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${selectedSize === size ? 'bg-primary text-white border-primary shadow-md shadow-primary/20' : 'bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100'}`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        {filteredStages.map(stage => (
                            <div 
                                key={stage.id}
                                onClick={() => onStageSelect(stage.id)}
                                className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedStageId === stage.id ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-white border-gray-100 hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`size-10 rounded-xl flex items-center justify-center transition-colors ${selectedStageId === stage.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-gray-50 text-gray-400 group-hover:bg-primary/10 group-hover:text-primary'}`}>
                                        <span className="material-symbols-outlined text-[20px]">aspect_ratio</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <h4 className="text-[11px] font-black text-gray-700 leading-tight tracking-tight">{stage.name}</h4>
                                        <p className="text-[10px] font-bold text-gray-400 mt-0.5">{stage.width}x{stage.height}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUpdateStage(stage.id, { visible: stage.visible === false });
                                        }}
                                        className={`size-8 flex items-center justify-center rounded-lg transition-colors ${stage.visible === false ? 'text-gray-300 hover:text-gray-400' : 'text-primary/90 hover:text-primary hover:bg-primary/5'}`}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            {stage.visible === false ? 'visibility_off' : 'visibility'}
                                        </span>
                                    </button>
                                    <span className={`material-symbols-outlined text-[20px] transition-all ${selectedStageId === stage.id ? 'text-primary scale-110' : 'text-gray-200 group-hover:text-primary'}`}>
                                        {selectedStageId === stage.id ? 'check_circle' : 'arrow_forward'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="p-6 bg-gray-50/50 border-t border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-tight">
                        Displaying <span className="text-primary">{filteredStages.length}</span> of <span className="text-gray-600">{stages.length}</span> active campaign formats.
                    </p>
                </div>
            </div>
        );
    }

    if (selectedLayers.length === 0) {
        return (
            <div className="w-[280px] bg-white border-l border-[#e5e8eb] flex flex-col shrink-0 overflow-hidden z-50">
                <div className="px-6 py-4 border-b border-[#e5e8eb] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-800">
                        {currentStage ? 'Stage Settings' : 'Stages Overview'}
                    </h3>
                    {currentStage && (
                        <button 
                            onClick={() => onStageSelect(null)}
                            className="text-[10px] font-bold text-gray-400 hover:text-primary flex items-center gap-1 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                            RELEASE
                        </button>
                    )}
                    {!currentStage && onSendMessageClick && (
                        <button 
                            onClick={onSendMessageClick}
                            className="size-8 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-lg hover:border-primary/50 hover:text-primary transition-all shadow-sm"
                            title="Send Message"
                        >
                            <span className="material-symbols-outlined text-[18px]">chat</span>
                        </button>
                    )}
                </div>


                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {currentStage ? (
                        <div className="flex flex-col min-h-full">
                            <div className="flex border-b border-gray-100 bg-gray-50/30 sticky top-0 z-10 backdrop-blur-md">
                                <button 
                                    onClick={() => setStageTab('settings')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${stageTab === 'settings' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Settings
                                </button>
                                <button 
                                    onClick={() => setStageTab('actions')}
                                    className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${stageTab === 'actions' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-600'}`}
                                >
                                    Actions
                                </button>
                            </div>

                            {stageTab === 'settings' ? (
                                <div className="p-6 flex flex-col gap-6">
                                    {renderInput('Stage Name', 'stageName', 'edit')}
                                    
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1">
                                            {renderInput('Width', 'stageWidth', 'straighten')}
                                        </div>
                                        <button 
                                            onClick={() => setIsStageRatioLocked(!isStageRatioLocked)}
                                            className={`mb-1 size-9 flex items-center justify-center rounded-lg transition-all ${isStageRatioLocked ? 'text-primary bg-primary/10 border border-primary/20 shadow-sm' : 'text-gray-300 hover:text-gray-400 border border-transparent'}`}
                                            title={isStageRatioLocked ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">
                                                {isStageRatioLocked ? 'link' : 'link_off'}
                                            </span>
                                        </button>
                                        <div className="flex-1 relative">
                                            {renderInput('Height', 'stageHeight', 'straighten')}
                                            {currentStage.dynamicHeight && (
                                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg pointer-events-none border border-primary/20">
                                                    <span className="text-[10px] font-black text-primary tracking-widest">AUTO</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Dynamic Height toggle for Stage */}
                                    <div className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 bg-gray-50/50">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px] text-primary">height</span>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest leading-none">Fit to Content</span>
                                                <span className="text-[8px] text-gray-400 font-medium uppercase mt-1">Dynamic Height</span>
                                            </div>
                                        </div>
                                        <button
                                            className={`relative w-9 h-5 rounded-full transition-colors ${currentStage.dynamicHeight ? 'bg-primary' : 'bg-gray-200'}`}
                                            onClick={() => onUpdateStage(currentStage.id, { dynamicHeight: !currentStage.dynamicHeight })}
                                        >
                                            <div className={`absolute top-0.5 left-0.5 size-4 bg-white rounded-full shadow transition-transform ${currentStage.dynamicHeight ? 'translate-x-4' : ''}`} />
                                        </button>
                                    </div>

                                    {renderInput('Stage Duration', 'stageDuration', 'schedule')}
                                    
                                    {/* Auto-Play toggle for Stage */}
                                    <div className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 bg-gray-50/50">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px] text-primary">play_circle</span>
                                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest">Auto Play</span>
                                        </div>
                                        {(() => {
                                            const isStageAutoPlay = currentStage.autoPlay === undefined || currentStage.autoPlay === true;
                                            return (
                                                <button
                                                    className={`relative w-9 h-5 rounded-full transition-colors ${isStageAutoPlay ? 'bg-primary' : 'bg-gray-200'}`}
                                                    onClick={() => onUpdateStage(currentStage.id, { autoPlay: !isStageAutoPlay })}
                                                >
                                                    <div className={`absolute top-0.5 left-0.5 size-4 bg-white rounded-full shadow transition-transform ${isStageAutoPlay ? 'translate-x-4' : ''}`} />
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    <div className="h-px bg-gray-50 my-1"></div>

                                    <div className="grid grid-cols-2 gap-4">
                                        {renderInput('Loop Count', 'loopCount', 'loop')}
                                        {renderInput('Stop (sec)', 'stopAtSecond', 'timer_off')}
                                    </div>
                                    
                                    {renderInput('Feed Loop', 'feedLoopCount', 'sync')}

                                    <div className="h-px bg-gray-50 my-1"></div>

                                    {/* Stage Background Card */}
                                    <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/bg">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">palette</span>
                                            Background
                                        </label>
                                        
                                        <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-xl border border-gray-200/50">
                                            {(['none', 'solid', 'linear', 'radial'] as const).map((type) => (
                                                <button 
                                                    key={type}
                                                    onClick={() => {
                                                        const updates: any = { bgType: type };
                                                        if (type === 'linear' && currentStage.gradientAngle === undefined) {
                                                            updates.gradientAngle = 135;
                                                            updates.gradientLength = 141;
                                                            updates.gradientCenterX = 0;
                                                            updates.gradientCenterY = 0;
                                                        } else if (type === 'radial' && currentStage.gradientRadius === undefined) {
                                                            updates.gradientRadius = 100;
                                                            updates.gradientCenterX = 50;
                                                            updates.gradientCenterY = 50;
                                                        }
                                                        setLocalValues(prev => ({ ...prev, ...updates }));
                                                        onUpdateStage(currentStage.id, updates);
                                                    }}
                                                    className={`h-8 flex items-center justify-center rounded-lg transition-all text-[9.5px] font-black uppercase tracking-tight ${(localValues.bgType || currentStage.bgType) === type ? 'bg-white text-primary shadow-sm border border-gray-100/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    {type}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                        <ColorPicker 
                                            value={currentStage.backgroundColor === 'transparent' ? '#ffffff' : (currentStage.backgroundColor || '#ffffff')}
                                            onChange={(val) => {
                                                const updates: any = { backgroundColor: val };
                                                const currentBgType = localValues.bgType || currentStage.bgType;
                                                if (!currentBgType || currentBgType === 'none') {
                                                    updates.bgType = 'solid';
                                                    setLocalValues(prev => ({ ...prev, bgType: 'solid' }));
                                                }
                                                onUpdateStage(currentStage.id, updates);
                                            }}
                                            className="w-full"
                                            swatches={documentColors}
                                        />

                                            {((localValues.bgType || currentStage.bgType) === 'radial' || (localValues.bgType || currentStage.bgType) === 'linear') && (
                                                <ColorPicker 
                                                    label={(localValues.bgType || currentStage.bgType) === 'radial' ? 'Outer Color' : 'End Color'}
                                                    value={currentStage.backgroundColor2 || '#ffffff'}
                                                    onChange={(val) => onUpdateStage(currentStage.id, { backgroundColor2: val })}
                                                    swatches={documentColors}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/clipping">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">layers</span>
                                            Stage Clipping
                                        </label>
                                        
                                        <div className="flex bg-gray-100 p-0.5 rounded-xl border border-gray-200/50">
                                            {[
                                                { id: 'hidden', label: 'Hidden', icon: 'indeterminate_check_box' },
                                                { id: 'visible', label: 'Visible', icon: 'check_box_outline_blank' }
                                            ].map((opt) => (
                                                <button 
                                                    key={opt.id}
                                                    onClick={() => onUpdateStage(currentStage.id, { overflow: opt.id as any })}
                                                    className={`flex-1 h-8 flex items-center justify-center gap-2 rounded-lg transition-all text-[9.5px] font-black uppercase tracking-tight ${ (currentStage.overflow || 'hidden') === opt.id ? 'bg-white text-primary shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600' }`}
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                                        <p className="text-[10px] text-primary font-medium leading-relaxed">
                                            Stage properties are unique to each banner size. Changes here affect only <strong>{currentStage.name}</strong>.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 flex flex-col gap-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex flex-col">
                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-[16px] text-primary">dynamic_feed</span>
                                                Stage Actions
                                            </label>
                                            <p className="text-[9px] text-gray-400 font-medium pl-6">Automate interactivity & effects</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const allLayers = getAllLayers(currentStage!.layers);
                                                const newAction: LandingPageAction = {
                                                    id: Math.random().toString(36).slice(2, 9),
                                                    triggerSourceId: allLayers[0]?.id || 'stage',
                                                    triggerEvent: 'click',
                                                    actionType: 'scroll-to-section',
                                                    targetId: '',
                                                };
                                                const newActions = [...(currentStage!.actions || []), newAction];
                                                onUpdateStage(currentStage!.id, { actions: newActions });
                                            }}
                                            className="size-8 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-all shadow-md shadow-primary/20 group/add"
                                        >
                                            <span className="material-symbols-outlined text-[20px] group-hover/add:scale-110 transition-transform">add</span>
                                        </button>
                                    </div>

                                    {(!currentStage.actions || currentStage.actions.length === 0) ? (
                                        <div className="py-12 flex flex-col items-center justify-center text-center px-6 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100 mt-2">
                                            <div className="size-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-gray-300 mb-4">
                                                <span className="material-symbols-outlined text-[32px]">touch_app</span>
                                            </div>
                                            <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-loose">No actions defined for this stage yet.</h5>
                                            <p className="text-[9px] text-gray-400 font-medium px-4 mt-2">Click + to define landing page interactions like scroll, menus, or navigation.</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {currentStage.actions.map((action, idx) => {
                                                const allLayers = getAllLayers(currentStage!.layers);
                                                return (
                                                    <div key={action.id} className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-primary/20 transition-all flex flex-col gap-4 relative group/action">
                                                        <button 
                                                            onClick={() => {
                                                                const newActions = currentStage!.actions?.filter(a => a.id !== action.id);
                                                                onUpdateStage(currentStage!.id, { actions: newActions });
                                                            }}
                                                            className="absolute top-3 right-3 opacity-0 group-hover/action:opacity-100 size-6 rounded-lg bg-red-50 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                        </button>

                                                        {/* Trigger Source */}
                                                        <div className="flex flex-col gap-1.5 action-selector-container">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                    <span className="material-symbols-outlined text-[16px] text-primary">login</span>
                                                                    Trigger Source
                                                                </label>
                                                            </div>
                                                            <div className="relative group/src-select">
                                                                <div 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenDropdown(openDropdown?.actionId === action.id && openDropdown?.type === 'source' ? null : { actionId: action.id, type: 'source' });
                                                                        setDropdownSearchTerm('');
                                                                    }}
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                    className={`flex items-center justify-between p-2 bg-gray-50/50 border rounded-lg hover:border-primary/30 transition-all cursor-pointer ${openDropdown?.actionId === action.id && openDropdown?.type === 'source' ? 'border-primary ring-2 ring-primary/10' : 'border-gray-100'}`}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className={`size-6 rounded-md flex items-center justify-center shrink-0 ${action.triggerSourceId === 'stage' ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-100'}`}>
                                                                            <span className="material-symbols-outlined text-[14px]">
                                                                                {action.triggerSourceId === 'stage' ? 'aspect_ratio' : getLayerIcon(allLayers.find(l => l.id === action.triggerSourceId)?.type || '')}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[9px] font-black text-gray-900 tracking-tight truncate leading-tight">
                                                                                {action.triggerSourceId === 'stage' ? 'STAGE (GLOBAL)' : (allLayers.find(l => l.id === action.triggerSourceId)?.name || 'Unknown Layer')}
                                                                            </span>
                                                                            <span className="text-[8px] text-gray-400 font-bold truncate tracking-tight uppercase leading-tight">
                                                                                {action.triggerSourceId === 'stage' ? 'Entire Workspace' : `ID: ${action.triggerSourceId?.split('_')[1] || action.triggerSourceId}`}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`material-symbols-outlined text-gray-300 text-[14px] transition-all ${openDropdown?.actionId === action.id && openDropdown?.type === 'source' ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                                                                </div>
                                                                
                                                                {/* Dropdown Menu */}
                                                                {openDropdown?.actionId === action.id && openDropdown?.type === 'source' && (
                                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
                                                                        <div className="p-1 px-2 border-b border-gray-50 bg-gray-50/30">
                                                                            <div className="relative">
                                                                                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]">search</span>
                                                                                <input 
                                                                                    autoFocus
                                                                                    type="text"
                                                                                    placeholder="Search layers..."
                                                                                    value={dropdownSearchTerm}
                                                                                    onChange={(e) => setDropdownSearchTerm(e.target.value)}
                                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                                    className="w-full h-7 pl-7 pr-2 bg-white border border-gray-100 rounded-md text-[9px] font-bold outline-none focus:border-primary transition-all placeholder:text-gray-300"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                                                                            {('STAGE (GLOBAL)'.toLowerCase().includes(dropdownSearchTerm.toLowerCase())) && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const sc = stages.find(s => s.id === selectedStageId);
                                                                                        if (!sc) return;
                                                                                        const newActions = [...(sc.actions || [])];
                                                                                        newActions[idx] = { ...action, triggerSourceId: 'stage' };
                                                                                        onUpdateStage(sc.id, { actions: newActions });
                                                                                        setOpenDropdown(null);
                                                                                    }}
                                                                                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 transition-all hover:bg-primary/5 group/opt ${action.triggerSourceId === 'stage' ? 'bg-primary/[0.03]' : ''}`}
                                                                                >
                                                                                    <div className={`size-6 rounded-md flex items-center justify-center shrink-0 transition-all ${action.triggerSourceId === 'stage' ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400 group-hover/opt:bg-white group-hover/opt:text-primary'}`}>
                                                                                        <span className="material-symbols-outlined text-[14px]">aspect_ratio</span>
                                                                                    </div>
                                                                                    <div className="flex flex-col items-start min-w-0">
                                                                                        <span className={`text-[9px] font-black uppercase tracking-tight ${action.triggerSourceId === 'stage' ? 'text-primary' : 'text-gray-700'}`}>STAGE</span>
                                                                                        <span className="text-[7px] text-gray-400 font-bold tracking-tight">GLOBAL TRIGGER</span>
                                                                                    </div>
                                                                                </button>
                                                                            )}
                                                                            
                                                                            {allLayers
                                                                                .filter(l => l.name.toLowerCase().includes(dropdownSearchTerm.toLowerCase()) || l.type.toLowerCase().includes(dropdownSearchTerm.toLowerCase()))
                                                                                .map(l => (
                                                                                <button
                                                                                    key={l.id}
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const sc = stages.find(s => s.id === selectedStageId);
                                                                                        if (!sc) return;
                                                                                        const newActions = [...(sc.actions || [])];
                                                                                        newActions[idx] = { ...action, triggerSourceId: l.id };
                                                                                        onUpdateStage(sc.id, { actions: newActions });
                                                                                        setOpenDropdown(null);
                                                                                    }}
                                                                                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 transition-all hover:bg-primary/5 group/opt ${action.triggerSourceId === l.id ? 'bg-primary/[0.03]' : ''}`}
                                                                                >
                                                                                    <div className={`size-6 rounded-md flex items-center justify-center shrink-0 transition-all ${action.triggerSourceId === l.id ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400 group-hover/opt:bg-white group-hover/opt:text-primary'}`}>
                                                                                        <span className="material-symbols-outlined text-[14px]">{getLayerIcon(l.type)}</span>
                                                                                    </div>
                                                                                    <div className="flex flex-col items-start min-w-0">
                                                                                        <span className={`text-[9px] font-black tracking-tight truncate w-full text-left ${action.triggerSourceId === l.id ? 'text-primary' : 'text-gray-700'}`}>{l.name}</span>
                                                                                        <span className="text-[7px] text-gray-400 font-bold tracking-tight uppercase">{l.type} LAYER</span>
                                                                                    </div>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Interaction Event */}
                                                        <div className="flex flex-col gap-1.5 action-selector-container">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                    <span className="material-symbols-outlined text-[16px] text-primary">touch_app</span>
                                                                    Interaction Event
                                                                </label>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {([
                                                                    { id: 'click',            label: 'Click',   icon: 'touch_app' },
                                                                    { id: 'hover',            label: 'Over',    icon: 'ads_click' },
                                                                    { id: 'hoverEnd',         label: 'Out',     icon: 'eject' },
                                                                    { id: 'touchStart',       label: 'Touch',   icon: 'fingerprint' },
                                                                    { id: 'scroll-into-view', label: 'Scroll',  icon: 'swipe_down' },
                                                                ] as { id: LandingPageTrigger; label: string; icon: string }[]).map((opt) => (
                                                                    <button
                                                                        key={opt.id}
                                                                        onClick={() => {
                                                                            const sc = stages.find(s => s.id === selectedStageId);
                                                                            if (!sc) return;
                                                                            const newActions = [...(sc.actions || [])];
                                                                            newActions[idx] = { ...action, triggerEvent: opt.id };
                                                                            onUpdateStage(sc.id, { actions: newActions as LandingPageAction[] });
                                                                        }}
                                                                        className={`flex-1 min-w-[50px] h-8 flex items-center justify-center gap-1.5 rounded-lg transition-all text-[9px] font-black uppercase tracking-tight border ${ (action.triggerEvent || 'click') === opt.id ? 'bg-white text-primary shadow-sm border-gray-200/50' : 'text-gray-400 border-transparent hover:text-gray-600 hover:border-gray-100' }`}
                                                                    >
                                                                        <span className="material-symbols-outlined text-[13px]">{opt.icon}</span>
                                                                        {opt.label}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Trigger Target */}
                                                        <div className="flex flex-col gap-1.5 action-selector-container">
                                                            <div className="flex items-center justify-between">
                                                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                    <span className="material-symbols-outlined text-[16px] text-primary">output</span>
                                                                    Target Source
                                                                </label>
                                                            </div>
                                                            <div className="relative group/target-select">
                                                                <div 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenDropdown(openDropdown?.actionId === action.id && openDropdown?.type === 'target' ? null : { actionId: action.id, type: 'target' });
                                                                        setDropdownSearchTerm('');
                                                                    }}
                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                    className={`flex items-center justify-between p-2 bg-gray-50/50 border rounded-lg hover:border-primary/30 transition-all cursor-pointer ${openDropdown?.actionId === action.id && openDropdown?.type === 'target' ? 'border-primary ring-2 ring-primary/10' : 'border-gray-100'}`}
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className={`size-6 rounded-md flex items-center justify-center shrink-0 ${action.targetId ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-100'}`}>
                                                                            <span className="material-symbols-outlined text-[14px]">
                                                                                {getLayerIcon(allLayers.find(l => l.id === action.targetId)?.type || '')}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex flex-col min-w-0">
                                                                            <span className="text-[9px] font-black text-gray-900 tracking-tight truncate leading-tight">
                                                                                {(allLayers.find(l => l.id === action.targetId)?.name || stages.find(s => s.id === action.targetId)?.name || 'Select Target')}
                                                                            </span>
                                                                            <span className="text-[8px] text-gray-400 font-bold truncate tracking-tight uppercase leading-tight">
                                                                                {action.targetId ? `ID: ${action.targetId?.split('_')[1] || action.targetId}` : 'Target Layer / Section'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <span className={`material-symbols-outlined text-gray-300 text-[14px] transition-all ${openDropdown?.actionId === action.id && openDropdown?.type === 'target' ? 'rotate-180 text-primary' : ''}`}>expand_more</span>
                                                                </div>
                                                                
                                                                {/* Dropdown Menu */}
                                                                {openDropdown?.actionId === action.id && openDropdown?.type === 'target' && (
                                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
                                                                        <div className="p-1 px-2 border-b border-gray-50 bg-gray-50/30">
                                                                            <div className="relative">
                                                                                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]">search</span>
                                                                                <input 
                                                                                    autoFocus
                                                                                    type="text"
                                                                                    placeholder="Search layers..."
                                                                                    value={dropdownSearchTerm}
                                                                                    onChange={(e) => setDropdownSearchTerm(e.target.value)}
                                                                                    onMouseDown={(e) => e.stopPropagation()}
                                                                                    className="w-full h-7 pl-7 pr-2 bg-white border border-gray-100 rounded-md text-[9px] font-bold outline-none focus:border-primary transition-all placeholder:text-gray-300"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                         <div className="max-h-[180px] overflow-y-auto custom-scrollbar">
                                                                              {/* Stages as targets (for scroll-to-section) */}
                                                                              {stages.filter(s => s.id !== selectedStageId && (!dropdownSearchTerm || s.name.toLowerCase().includes(dropdownSearchTerm.toLowerCase()))).map(s => (
                                                                                  <button
                                                                                      key={s.id}
                                                                                      onClick={(e) => {
                                                                                          e.stopPropagation();
                                                                                          const sc = stages.find(st => st.id === selectedStageId);
                                                                                          if (!sc) return;
                                                                                          const newActions = [...(sc.actions || [])];
                                                                                          newActions[idx] = { ...action, targetId: s.id };
                                                                                          onUpdateStage(sc.id, { actions: newActions as LandingPageAction[] });
                                                                                          setOpenDropdown(null);
                                                                                      }}
                                                                                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 transition-all hover:bg-primary/5 group/opt ${action.targetId === s.id ? 'bg-primary/[0.03]' : ''}`}
                                                                                  >
                                                                                      <div className={`size-6 rounded-md flex items-center justify-center shrink-0 transition-all ${action.targetId === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400 group-hover/opt:bg-white group-hover/opt:text-primary'}`}>
                                                                                          <span className="material-symbols-outlined text-[14px]">web_asset</span>
                                                                                      </div>
                                                                                      <div className="flex flex-col items-start min-w-0">
                                                                                          <span className={`text-[9px] font-black tracking-tight truncate w-full text-left ${action.targetId === s.id ? 'text-primary' : 'text-gray-700'}`}>{s.name}</span>
                                                                                          <span className="text-[7px] text-gray-400 font-bold tracking-tight uppercase">Section</span>
                                                                                      </div>
                                                                                  </button>
                                                                              ))}

                                                                              {/* Layers as targets */}
                                                                              {allLayers
                                                                                 .filter(l => l.name.toLowerCase().includes(dropdownSearchTerm.toLowerCase()) || l.type.toLowerCase().includes(dropdownSearchTerm.toLowerCase()))
                                                                                 .map(l => (
                                                                                 <button
                                                                                     key={l.id}
                                                                                     onClick={(e) => {
                                                                                         e.stopPropagation();
                                                                                         const sc = stages.find(s => s.id === selectedStageId);
                                                                                         if (!sc) return;
                                                                                         const newActions = [...(sc.actions || [])];
                                                                                         newActions[idx] = { ...action, targetId: l.id };
                                                                                         onUpdateStage(sc.id, { actions: newActions as LandingPageAction[] });
                                                                                         setOpenDropdown(null);
                                                                                     }}
                                                                                     className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 transition-all hover:bg-primary/5 group/opt ${action.targetId === l.id ? 'bg-primary/[0.03]' : ''}`}
                                                                                 >
                                                                                     <div className={`size-6 rounded-md flex items-center justify-center shrink-0 transition-all ${action.targetId === l.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400 group-hover/opt:bg-white group-hover/opt:text-primary'}`}>
                                                                                         <span className="material-symbols-outlined text-[14px]">{getLayerIcon(l.type)}</span>
                                                                                     </div>
                                                                                     <div className="flex flex-col items-start min-w-0">
                                                                                         <span className={`text-[9px] font-black tracking-tight truncate w-full text-left ${action.targetId === l.id ? 'text-primary' : 'text-gray-700'}`}>{l.name}</span>
                                                                                         <span className="text-[7px] text-gray-400 font-bold tracking-tight uppercase">{l.type} Layer</span>
                                                                                     </div>
                                                                                 </button>
                                                                             ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-1.5 action-selector-container">
                                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                <span className="material-symbols-outlined text-[16px] text-primary">bolt</span>
                                                                Action Type
                                                            </label>
                                                            {(() => {
                                                                const LP_ACTION_OPTIONS: { id: LandingPageActionType; label: string; icon: string; desc: string }[] = [
                                                                    { id: 'scroll-to-section', label: 'Scroll to Section', icon: 'swipe_down', desc: 'Smooth scroll to another section' },
                                                                    { id: 'open-menu',         label: 'Open Menu',        icon: 'menu_open',  desc: 'Show a navigation menu layer' },
                                                                    { id: 'close-menu',        label: 'Close Menu',       icon: 'close',      desc: 'Hide a navigation menu layer' },
                                                                    { id: 'toggle-layer',      label: 'Toggle Layer',     icon: 'layers',     desc: 'Show or hide a layer' },
                                                                    { id: 'navigate-url',      label: 'Navigate to URL',  icon: 'open_in_new', desc: 'Open a link in browser' },
                                                                    { id: 'play-animation',    label: 'Play Animation',   icon: 'play_circle', desc: 'Trigger a layer animation' },
                                                                    { id: 'stop-animation',    label: 'Stop Animation',   icon: 'stop_circle', desc: 'Stop a layer animation' },
                                                                    { id: 'toggle-animation',  label: 'Toggle Animation', icon: 'motion_photos_on', desc: 'Play or stop animation' },
                                                                ];
                                                                const current = LP_ACTION_OPTIONS.find(o => o.id === action.actionType);
                                                                return (
                                                                    <div className="relative group/efx-select">
                                                                        <div
                                                                            onClick={() => setOpenDropdown(openDropdown?.actionId === action.id && openDropdown?.type === 'effect' ? null : { actionId: action.id, type: 'effect' })}
                                                                            onMouseDown={(e) => e.stopPropagation()}
                                                                            className={`flex items-center justify-between p-2 bg-primary/[0.03] border rounded-lg hover:border-primary/30 transition-all cursor-pointer ${openDropdown?.actionId === action.id && openDropdown?.type === 'effect' ? 'border-primary ring-2 ring-primary/10' : 'border-primary/10'}`}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <div className={`size-6 rounded-md flex items-center justify-center transition-colors ${current ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-100'}`}>
                                                                                    <span className="material-symbols-outlined text-[14px]">{current?.icon || 'bolt'}</span>
                                                                                </div>
                                                                                <div className="flex flex-col min-w-0">
                                                                                    <span className="text-[9px] font-black text-primary uppercase tracking-tight leading-tight truncate">{current?.label || 'Select Action'}</span>
                                                                                    <span className="text-[8px] text-primary/40 font-bold uppercase tracking-widest leading-tight truncate">{current?.desc}</span>
                                                                                </div>
                                                                            </div>
                                                                            <span className={`material-symbols-outlined text-gray-300 text-[14px] transition-all ${openDropdown?.actionId === action.id && openDropdown?.type === 'effect' ? 'rotate-180 text-primary' : ''}`}>keyboard_arrow_down</span>
                                                                        </div>
                                                                        {openDropdown?.actionId === action.id && openDropdown?.type === 'effect' && (
                                                                            <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-md overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
                                                                                <div className="flex flex-col max-h-[220px] overflow-y-auto custom-scrollbar">
                                                                                    {LP_ACTION_OPTIONS.map(opt => (
                                                                                        <button
                                                                                            key={opt.id}
                                                                                            onClick={() => {
                                                                                                const sc = stages.find(s => s.id === selectedStageId);
                                                                                                if (!sc) return;
                                                                                                const nextActions = [...(sc.actions || [])];
                                                                                                nextActions[idx] = { ...action, actionType: opt.id, config: {} };
                                                                                                onUpdateStage(sc.id, { actions: nextActions as LandingPageAction[] });
                                                                                                setOpenDropdown(null);
                                                                                            }}
                                                                                            className={`w-full px-3 py-2 flex items-center gap-2.5 hover:bg-primary/[0.04] transition-colors text-left ${action.actionType === opt.id ? 'bg-primary/[0.08]' : ''}`}
                                                                                        >
                                                                                            <span className={`material-symbols-outlined text-[14px] ${action.actionType === opt.id ? 'text-primary' : 'text-gray-400'}`}>{opt.icon}</span>
                                                                                            <div className="flex flex-col min-w-0">
                                                                                                <span className={`text-[9px] font-black uppercase tracking-tight leading-none truncate ${action.actionType === opt.id ? 'text-primary' : 'text-gray-700'}`}>{opt.label}</span>
                                                                                                <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest mt-1 opacity-70 truncate">{opt.desc}</span>
                                                                                            </div>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Action Config Panel */}
                                                            {action.actionType && (
                                                                <div className="mt-2 flex flex-col gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100/50">
                                                                    {(() => {
                                                                        const type = action.actionType as LandingPageActionType;
                                                                        const config = action.config || {};

                                                                        const updateConfig = (updates: any) => {
                                                                            const sc = stages.find(s => s.id === selectedStageId);
                                                                            if (!sc) return;
                                                                            const nextActions = [...(sc.actions || [])];
                                                                            nextActions[idx] = { ...action, config: { ...config, ...updates } };
                                                                            onUpdateStage(sc.id, { actions: nextActions as LandingPageAction[] });
                                                                        };

                                                                        if (type === 'navigate-url') {
                                                                            return (
                                                                                <div className="flex flex-col gap-2">
                                                                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest pl-1">URL</label>
                                                                                    <input
                                                                                        type="text"
                                                                                        placeholder="https://example.com"
                                                                                        value={config.url || ''}
                                                                                        onChange={e => updateConfig({ url: e.target.value })}
                                                                                        className="w-full h-8 px-2 bg-white border border-gray-100 rounded text-[10px] font-bold"
                                                                                    />
                                                                                    <div className="flex items-center gap-2">
                                                                                        <input type="checkbox" id={`newtab-${action.id}`} checked={!!config.openInNewTab} onChange={e => updateConfig({ openInNewTab: e.target.checked })} className="accent-primary" />
                                                                                        <label htmlFor={`newtab-${action.id}`} className="text-[9px] font-bold text-gray-500">Open in new tab</label>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        }

                                                                        if (['play-animation', 'stop-animation', 'toggle-animation'].includes(type)) {
                                                                            const targetLayer = allLayers.find(l => l.id === action.targetId);
                                                                            const isGroup = targetLayer?.type === 'group';
                                                                            return (
                                                                                <div className="flex flex-col gap-2">
                                                                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest pl-1">Animation Phase</label>
                                                                                    <div className="flex gap-1 flex-wrap">
                                                                                        {(['entry', 'main', 'exit', 'all'] as const).map(phase => (
                                                                                            <button
                                                                                                key={phase}
                                                                                                onClick={() => updateConfig({ animationPhase: phase })}
                                                                                                className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border transition-all ${config.animationPhase === phase ? 'bg-primary text-white border-primary shadow-sm' : 'bg-white text-gray-400 border-gray-200 hover:border-primary/40'}`}
                                                                                            >
                                                                                                {phase}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                    {isGroup && (
                                                                                        <div className="flex items-center gap-2 mt-1 pl-1">
                                                                                            <input 
                                                                                                type="checkbox" 
                                                                                                id={`children-${action.id}`} 
                                                                                                checked={!!config.includeChildren} 
                                                                                                onChange={e => updateConfig({ includeChildren: e.target.checked })} 
                                                                                                className="accent-primary" 
                                                                                            />
                                                                                            <label htmlFor={`children-${action.id}`} className="text-[9px] font-bold text-gray-500">Play children animations</label>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        }

                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-[5px] bg-gray-50/30 flex flex-col gap-3 min-h-full">
                            <div>
                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-4 px-2">
                                    <span className="material-symbols-outlined text-[16px] text-primary">ads_click</span>
                                    Select a Stage to Edit
                                </label>
                                <div className="flex gap-2 mb-4">
                                    <div className="relative flex-1">
                                        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[16px]">search</span>
                                        <input 
                                            type="text" 
                                            placeholder="Find stage..."
                                            className="w-full h-8 pl-8 pr-2 bg-white border border-gray-200 rounded text-[11px]"
                                            value={searchTerm}
                                            onChange={(e) => onSearchChange(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => {
                                                onBatchUpdateStages?.(stages.map(s => s.id), { visible: true });
                                                setTimeout(() => {
                                                    onArrangeStages?.();
                                                }, 100);
                                            }}
                                            className="size-8 flex items-center justify-center bg-white border border-gray-200 rounded hover:border-primary/50 hover:text-primary transition-all shadow-sm"
                                            title="Show All Stages"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                                        </button>
                                        <button 
                                            onClick={() => onBatchUpdateStages?.(stages.map(s => s.id), { visible: false })}
                                            className="size-8 flex items-center justify-center bg-white border border-gray-200 rounded hover:border-red-400 hover:text-red-500 transition-all shadow-sm"
                                            title="Hide All Stages"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">visibility_off</span>
                                        </button>
                                        <button 
                                            onClick={() => onArrangeStages?.()}
                                            className="size-8 flex items-center justify-center bg-white border border-gray-200 rounded hover:border-primary/50 hover:text-primary transition-all shadow-sm"
                                            title="Arrange Visible Stages"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">grid_view</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                {filteredStages.map(stage => (
                                    <div 
                                        key={stage.id}
                                        onClick={() => onStageSelect(stage.id)}
                                        className="group p-3 rounded-xl border border-transparent bg-white shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded bg-gray-100 text-gray-400 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                                <span className="material-symbols-outlined text-[18px]">aspect_ratio</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-[11px] font-bold text-gray-700 truncate">{stage.name}</h4>
                                                <p className="text-[9px] text-gray-400">{stage.width}x{stage.height}</p>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onUpdateStage(stage.id, { visible: stage.visible === false });
                                                }}
                                                className={`size-7 flex items-center justify-center rounded transition-colors ${stage.visible === false ? 'text-gray-300 hover:text-gray-400' : 'text-primary/90 hover:text-primary hover:bg-primary/5'}`}
                                            >
                                                <span className="material-symbols-outlined text-[18px]">
                                                    {stage.visible === false ? 'visibility_off' : 'visibility'}
                                                </span>
                                            </button>
                                            <span className="material-symbols-outlined text-gray-200 group-hover:text-primary transition-colors">arrow_forward</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                <div className="p-6 border-t border-gray-50 bg-gray-50/30">
                    <div className="flex items-center gap-3 text-gray-400">
                        <span className="material-symbols-outlined text-[18px]">info</span>
                        <p className="text-[10px] leading-relaxed">Select a layer on the stage to view and edit its detailed properties.</p>
                    </div>
                </div>

            </div>
        );
    }

    return (
        <div className="w-[280px] bg-white border-l border-[#e5e8eb] flex flex-col shrink-0 overflow-y-auto custom-scrollbar properties-bar-container relative z-[2000]">
            {arrowSlider && (
                <div
                    ref={arrowSliderPopoverRef}
                    className="fixed z-[9999] flex flex-row items-center justify-center gap-0.5 rounded-lg bg-white border border-gray-200 shadow-lg py-1.5 px-2 pointer-events-none"
                    style={{
                        left: arrowSlider.clientX,
                        top: arrowSlider.clientY,
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    <span className="material-symbols-outlined text-[18px] text-primary/40 leading-none">chevron_left</span>
                    <span className="material-symbols-outlined text-[18px] text-primary/40 leading-none">chevron_right</span>
                </div>
            )}
            <div className="px-3 py-4 border-b border-[#e5e8eb] flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">
                    {selectedLayers.length === 1 ? 'Layer Properties' : `${selectedLayers.length} Layers Selected`}
                </h3>
                <div className="flex items-center gap-2">
                    {onSendMessageClick && (
                        <button 
                            onClick={onSendMessageClick}
                            className="size-6 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                            title="Send Message"
                        >
                            <span className="material-symbols-outlined text-[18px]">chat</span>
                        </button>
                    )}
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">EDIT</span>
                </div>
            </div>

            
            <div className="p-[5px] flex flex-col gap-3">
                {/* Animation & Performance Section */}
                <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/animation-root">
                    <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[16px] text-primary">animation</span>
                        Animation & Performance
                    </label>

                    <div className="flex flex-col gap-2">
                        {/* Dynamic Loop Toggle */}
                        {selectedLayers.length === 1 && ['image', 'button', 'text', 'media', 'shape'].includes(selectedLayers[0].type) && (
                            <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-primary/20 transition-all group/dynamic">
                                <div className="flex items-center gap-3">
                                    <div className={`size-8 rounded-lg flex items-center justify-center transition-colors ${selectedLayers[0].isDynamic ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400 group-hover/dynamic:bg-gray-200'}`}>
                                        <span className="material-symbols-outlined text-[18px]">sync_saved_locally</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-700 leading-tight">Dynamic Loop</span>
                                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tight">Enable dynamic iterations</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onUpdateLayers(selectedLayerIds, { isDynamic: !selectedLayers[0].isDynamic })}
                                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${selectedLayers[0].isDynamic ? 'bg-primary shadow-sm shadow-primary/20' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${selectedLayers[0].isDynamic ? 'left-4.5' : 'left-0.5'}`}></div>
                                </button>
                            </div>
                        )}

                        {/* Mask Toggle - Only for Shape Layers */}
                        {selectedLayers.length === 1 && selectedLayers[0].type === 'shape' && (
                            <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-primary/20 transition-all group/mask">
                                <div className="flex items-center gap-3">
                                    <div className={`size-8 rounded-lg flex items-center justify-center transition-colors ${selectedLayers[0].isMask ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400 group-hover/mask:bg-gray-200'}`}>
                                        <span className="material-symbols-outlined text-[18px]">texture</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-700 leading-tight">Use as Mask</span>
                                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tight">Mark as mask for this group</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onUpdateLayers(selectedLayerIds, { isMask: !selectedLayers[0].isMask })}
                                    className={`w-9 h-5 rounded-full transition-all relative cursor-pointer ${selectedLayers[0].isMask ? 'bg-primary shadow-sm shadow-primary/20' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${selectedLayers[0].isMask ? 'left-4.5' : 'left-0.5'}`}></div>
                                </button>
                            </div>
                        )}

                        {/* Timeline Mode Animation */}
                        <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-primary/20 transition-all group/anim">
                            <div className="flex items-center gap-3">
                                <div className={`size-8 rounded-lg flex items-center justify-center bg-gray-50 text-gray-400 group-hover/anim:text-primary transition-colors`}>
                                    <span className="material-symbols-outlined text-[18px]">schedule</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-700 leading-tight">Timeline Mode</span>
                                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-tight">
                                        {selectedLayers.every(l => l.animation && l.animation.entry.duration === 0 && l.animation.main.duration === 0 && l.animation.exit.duration === 0) ? 'Custom / Manual' : 'Default Segments'}
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    const stageDuration = currentStage?.duration || 5;
                                    const totalUnits = stageDuration * 100;

                                    selectedLayerIds.forEach(id => {
                                        if (onUpdateLayerAnimation) {
                                            const layer = selectedLayers.find(l => l.id === id);
                                            const isCustomMode = layer?.animation && 
                                                             layer.animation.entry.duration === 0 && 
                                                             layer.animation.main.duration === 0 && 
                                                             layer.animation.exit.duration === 0;

                                            if (isCustomMode) {
                                                onUpdateLayerAnimation(id, {
                                                    entry: { start: 0, duration: 50 },
                                                    main: { start: Math.max(0, (totalUnits / 2) - 25), duration: 50 },
                                                    exit: { start: Math.max(0, totalUnits - 50), duration: 50 },
                                                    keyframes: []
                                                });
                                            } else {
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
                                                        skewY: 0
                                                    }
                                                };

                                                onUpdateLayerAnimation(id, {
                                                    entry: { start: 0, duration: 0 },
                                                    main: { start: 0, duration: 0 },
                                                    exit: { start: 0, duration: 0 },
                                                    keyframes: [initialKeyframe]
                                                });
                                            }
                                        }
                                    });
                                }}
                                className={`px-2 h-7 rounded-lg text-[8px] font-black uppercase transition-all shadow-sm active:scale-95 ${
                                    selectedLayers.every(l => l.animation && l.animation.entry.duration === 0 && l.animation.main?.duration === 0 && l.animation.exit?.duration === 0) 
                                    ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-orange-500/20' 
                                    : 'bg-primary text-white hover:bg-[#006666] shadow-primary/20'
                                }`}
                            >
                                {selectedLayers.every(l => l.animation && l.animation.entry.duration === 0 && l.animation.main?.duration === 0 && l.animation.exit?.duration === 0) ? 'Remove Custom' : 'Add Custom'}
                            </button>
                        </div>
                    </div>

                    {/* ── Playback Controls ──────────────────────────── */}
                    {selectedLayers.length > 0 && (() => {
                        const fl = selectedLayers[0];
                        return (
                            <div className="mt-1 pt-3 border-t border-gray-100 flex flex-col gap-2.5">
                                <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Playback</span>

                                {/* Auto-Play toggle */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-700">Auto-Play</span>
                                    {(() => {
                                        const isAutoPlay = fl.animationAutoPlay === undefined || fl.animationAutoPlay === true;
                                        return (
                                            <button
                                                className={`relative w-9 h-5 rounded-full transition-colors ${isAutoPlay ? 'bg-primary' : 'bg-gray-200'}`}
                                                onClick={() => onUpdateLayers(selectedLayerIds, { animationAutoPlay: !isAutoPlay })}
                                            >
                                                <div className={`absolute top-0.5 left-0.5 size-4 bg-white rounded-full shadow transition-transform ${isAutoPlay ? 'translate-x-4' : ''}`} />
                                            </button>
                                        );
                                    })()}
                                </div>

                                {/* Loop Count */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-gray-700">Loop Count</span>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number" min={0} step={1}
                                            value={fl.animationLoopCount ?? 1}
                                            onChange={e => onUpdateLayers(selectedLayerIds, { animationLoopCount: Math.max(0, parseInt(e.target.value) || 0) })}
                                            className="w-14 text-[10px] text-right border border-gray-200 rounded-lg px-2 py-1 focus:border-primary/50 outline-none"
                                        />
                                        <span className="text-[9px] text-gray-400">0=∞</span>
                                    </div>
                                </div>

                                {/* Stop At */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-[10px] font-bold text-gray-700">Stop At</span>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number" min={0} step={0.1}
                                            placeholder="end"
                                            value={fl.animationStopAt ?? ''}
                                            onChange={e => onUpdateLayers(selectedLayerIds, { animationStopAt: e.target.value === '' ? null : parseFloat(e.target.value) })}
                                            className="w-14 text-[10px] text-right border border-gray-200 rounded-lg px-2 py-1 focus:border-primary/50 outline-none"
                                        />
                                        <span className="text-[9px] text-gray-400">sec</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ── Interactions ──────────────────────────────────── */}
                {selectedLayers.length > 0 && (() => {
                    const fl = selectedLayers[0];
                    const actions: InteractionAction[] = fl.interactionActions || [];
                    const stageForIA = stages.find(s => s.id === selectedStageId);
                    const allLayersForIA = stageForIA ? getAllLayers(stageForIA.layers).filter(l => l.id !== fl.id) : [];

                    const updateActions = (updated: InteractionAction[]) => {
                        onUpdateLayers(selectedLayerIds, { interactionActions: updated });
                    };

                    const IA_EVENT_OPTIONS: { id: AnimationTriggerEvent; label: string; icon: string }[] = [
                        { id: 'click',            label: 'Click / Tap',       icon: 'touch_app' },
                        { id: 'dblclick',         label: 'Double Click',      icon: 'mouse' },
                        { id: 'hover',            label: 'Mouse Over',        icon: 'ads_click' },
                        { id: 'hoverEnd',         label: 'Mouse Out',         icon: 'eject' },
                        { id: 'long-press',       label: 'Long Press',        icon: 'back_hand' },
                        { id: 'touchStart',       label: 'Touch Start',       icon: 'swipe' },
                        { id: 'touchEnd',         label: 'Touch End',         icon: 'swipe_left' },
                        { id: 'focus',            label: 'Focus',             icon: 'center_focus_weak' },
                        { id: 'blur',             label: 'Blur',              icon: 'blur_on' },
                        { id: 'scroll-into-view', label: 'Scroll Into View',  icon: 'visibility' },
                        { id: 'scroll-out-view',  label: 'Scroll Out View',   icon: 'visibility_off' },
                        { id: 'keydown',          label: 'Key Press',         icon: 'keyboard' },
                        { id: 'idle',             label: 'Idle',              icon: 'hourglass_empty' },
                    ];

                    const IA_ACTION_OPTIONS: { id: AnimationTriggerAction; label: string; icon: string; desc: string }[] = [
                        { id: 'play-entry', label: 'Play Entry',  icon: 'play_arrow',          desc: 'Play entry animation' },
                        { id: 'play-main',  label: 'Play Loop',   icon: 'loop',                desc: 'Play looping animation' },
                        { id: 'play-exit',  label: 'Play Exit',   icon: 'skip_next',           desc: 'Play exit animation' },
                        { id: 'play-all',   label: 'Play Full',   icon: 'play_circle',         desc: 'Play all phases' },
                        { id: 'reverse',    label: 'Reverse',     icon: 'replay',              desc: 'Play animation in reverse' },
                        { id: 'stop',       label: 'Stop',        icon: 'stop_circle',         desc: 'Stop animation' },
                        { id: 'pause',      label: 'Pause',       icon: 'pause_circle',        desc: 'Pause animation' },
                        { id: 'resume',     label: 'Resume',      icon: 'play_circle_outline', desc: 'Resume from pause' },
                        { id: 'reset',      label: 'Reset',       icon: 'restart_alt',         desc: 'Reset to first frame' },
                    ];

                    return (
                        <div className="flex flex-col gap-3 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all action-selector-container">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-primary">touch_app</span>
                                    Interactions
                                </label>
                                <button
                                    onClick={() => {
                                        const newAction: InteractionAction = {
                                            id: Math.random().toString(36).slice(2, 9),
                                            event: 'click',
                                            action: 'play-all',
                                        };
                                        updateActions([...actions, newAction]);
                                    }}
                                    className="size-7 rounded-lg bg-primary text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow shadow-primary/20"
                                >
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                </button>
                            </div>

                            {actions.length === 0 ? (
                                <p className="text-[9px] text-gray-400 text-center py-2">No interactions. Click + to add one.</p>
                            ) : actions.map((ia, idx) => {
                                const currentEvent = IA_EVENT_OPTIONS.find(o => o.id === ia.event);
                                const currentAction = IA_ACTION_OPTIONS.find(o => o.id === ia.action);
                                const targetLayer = ia.targetLayerId ? allLayersForIA.find(l => l.id === ia.targetLayerId) : null;
                                const iaKey = ia.id;
                                return (
                                    <div key={ia.id} className="flex flex-col gap-2 p-3 bg-white border border-gray-100 rounded-xl">
                                        {/* Header: label + delete */}
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Interaction {idx + 1}</span>
                                            <button
                                                onClick={() => updateActions(actions.filter((_, i) => i !== idx))}
                                                className="size-5 rounded-md hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors flex items-center justify-center"
                                            >
                                                <span className="material-symbols-outlined text-[13px]">close</span>
                                            </button>
                                        </div>

                                        {/* Trigger event */}
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Trigger</span>
                                            <div className="relative">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenDropdown(openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-event' ? null : { actionId: iaKey, type: 'ia-event' });
                                                    }}
                                                    className={`flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border rounded-lg hover:border-primary/30 transition-all cursor-pointer ${openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-event' ? 'border-primary ring-2 ring-primary/10' : 'border-gray-100'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-[13px] text-primary">{currentEvent?.icon || 'touch_app'}</span>
                                                        <span className="text-[9px] font-black text-gray-700 uppercase tracking-tight">{currentEvent?.label || 'Select Trigger'}</span>
                                                    </div>
                                                    <span className={`material-symbols-outlined text-[13px] text-gray-300 transition-all ${openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-event' ? 'rotate-180 text-primary' : ''}`}>keyboard_arrow_down</span>
                                                </div>
                                                {openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-event' && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-y-auto max-h-48">
                                                        {IA_EVENT_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateActions(actions.map((x, i) => i === idx ? { ...x, event: opt.id } : x));
                                                                    setOpenDropdown(null);
                                                                }}
                                                                className={`w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-primary/[0.04] transition-colors text-left ${ia.event === opt.id ? 'bg-primary/[0.08]' : ''}`}
                                                            >
                                                                <span className={`material-symbols-outlined text-[14px] ${ia.event === opt.id ? 'text-primary' : 'text-gray-400'}`}>{opt.icon}</span>
                                                                <span className={`text-[9px] font-black uppercase tracking-tight ${ia.event === opt.id ? 'text-primary' : 'text-gray-700'}`}>{opt.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Target layer */}
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Target Layer</span>
                                            <div className="relative">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setDropdownSearchTerm('');
                                                        setOpenDropdown(openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-target' ? null : { actionId: iaKey, type: 'ia-target' });
                                                    }}
                                                    className={`flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border rounded-lg hover:border-primary/30 transition-all cursor-pointer ${openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-target' ? 'border-primary ring-2 ring-primary/10' : 'border-gray-100'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${targetLayer ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-400'}`}>
                                                            <span className="material-symbols-outlined text-[12px]">{targetLayer ? getLayerIcon(targetLayer.type) : 'my_location'}</span>
                                                        </div>
                                                        <span className={`text-[9px] font-black uppercase tracking-tight truncate ${targetLayer ? 'text-gray-800' : 'text-gray-400'}`}>
                                                            {targetLayer ? targetLayer.name : 'Self (this layer)'}
                                                        </span>
                                                    </div>
                                                    <span className={`material-symbols-outlined text-[13px] text-gray-300 transition-all shrink-0 ${openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-target' ? 'rotate-180 text-primary' : ''}`}>keyboard_arrow_down</span>
                                                </div>
                                                {openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-target' && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden max-h-[300px] flex flex-col">
                                                        <div className="p-2 border-b border-gray-50 flex items-center gap-2 sticky top-0 bg-white/80 backdrop-blur-sm z-10" onMouseDown={(e) => e.stopPropagation()}>
                                                            <span className="material-symbols-outlined text-[16px] text-gray-400">search</span>
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                value={dropdownSearchTerm}
                                                                onChange={(e) => setDropdownSearchTerm(e.target.value)}
                                                                placeholder="Search layer..."
                                                                className="w-full text-[10px] bg-transparent outline-none font-bold text-gray-700 uppercase"
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto custom-scrollbar flex-1 p-1" onMouseDown={(e) => e.stopPropagation()}>
                                                            {/* Self option */}
                                                            {(!dropdownSearchTerm || 'self'.includes(dropdownSearchTerm.toLowerCase()) || 'this layer'.includes(dropdownSearchTerm.toLowerCase())) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        updateActions(actions.map((x, i) => i === idx ? { ...x, targetLayerId: undefined } : x));
                                                                        setOpenDropdown(null);
                                                                    }}
                                                                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-primary/[0.04] transition-colors text-left rounded-lg ${!ia.targetLayerId ? 'bg-primary/[0.08]' : ''}`}
                                                                >
                                                                    <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${!ia.targetLayerId ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                                        <span className="material-symbols-outlined text-[12px]">my_location</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-start min-w-0">
                                                                        <span className={`text-[9px] font-black tracking-tight ${!ia.targetLayerId ? 'text-primary' : 'text-gray-700'}`}>Self</span>
                                                                        <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">This layer</span>
                                                                    </div>
                                                                </button>
                                                            )}
                                                            {allLayersForIA.filter(l => !dropdownSearchTerm || l.name?.toLowerCase().includes(dropdownSearchTerm.toLowerCase()) || l.type?.toLowerCase().includes(dropdownSearchTerm.toLowerCase())).map(l => (
                                                                <button
                                                                    key={l.id}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        updateActions(actions.map((x, i) => i === idx ? { ...x, targetLayerId: l.id } : x));
                                                                        setOpenDropdown(null);
                                                                    }}
                                                                    className={`w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-primary/[0.04] transition-colors text-left rounded-lg ${ia.targetLayerId === l.id ? 'bg-primary/[0.08]' : ''}`}
                                                                >
                                                                    <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${ia.targetLayerId === l.id ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400'}`}>
                                                                        <span className="material-symbols-outlined text-[12px]">{getLayerIcon(l.type)}</span>
                                                                    </div>
                                                                    <div className="flex flex-col items-start min-w-0">
                                                                        <span className={`text-[9px] font-black tracking-tight truncate w-full text-left ${ia.targetLayerId === l.id ? 'text-primary' : 'text-gray-700'}`}>{l.name}</span>
                                                                        <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest">{l.type}</span>
                                                                    </div>
                                                                </button>
                                                            ))}
                                                            {allLayersForIA.filter(l => !dropdownSearchTerm || l.name?.toLowerCase().includes(dropdownSearchTerm.toLowerCase())).length === 0 && dropdownSearchTerm && (
                                                                <div className="p-4 text-center">
                                                                    <span className="text-[9px] font-bold text-gray-400 uppercase">No layers found</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Action */}
                                        <div className="flex flex-col gap-1">
                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Action</span>
                                            <div className="relative">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenDropdown(openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-action' ? null : { actionId: iaKey, type: 'ia-action' });
                                                    }}
                                                    className={`flex items-center justify-between px-2.5 py-1.5 bg-primary/[0.03] border rounded-lg hover:border-primary/30 transition-all cursor-pointer ${openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-action' ? 'border-primary ring-2 ring-primary/10' : 'border-primary/10'}`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`size-5 rounded-md flex items-center justify-center shrink-0 ${currentAction ? 'bg-primary text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-400'}`}>
                                                            <span className="material-symbols-outlined text-[12px]">{currentAction?.icon || 'bolt'}</span>
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[9px] font-black text-primary uppercase tracking-tight leading-tight truncate">{currentAction?.label || 'Select Action'}</span>
                                                            <span className="text-[7px] text-primary/40 font-bold uppercase tracking-widest leading-tight truncate">{currentAction?.desc}</span>
                                                        </div>
                                                    </div>
                                                    <span className={`material-symbols-outlined text-[13px] text-gray-300 transition-all shrink-0 ${openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-action' ? 'rotate-180 text-primary' : ''}`}>keyboard_arrow_down</span>
                                                </div>
                                                {openDropdown?.actionId === iaKey && openDropdown?.type === 'ia-action' && (
                                                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
                                                        {IA_ACTION_OPTIONS.map(opt => (
                                                            <button
                                                                key={opt.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    updateActions(actions.map((x, i) => i === idx ? { ...x, action: opt.id } : x));
                                                                    setOpenDropdown(null);
                                                                }}
                                                                className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-primary/[0.04] transition-colors text-left ${ia.action === opt.id ? 'bg-primary/[0.08]' : ''}`}
                                                            >
                                                                <span className={`material-symbols-outlined text-[14px] shrink-0 ${ia.action === opt.id ? 'text-primary' : 'text-gray-400'}`}>{opt.icon}</span>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className={`text-[9px] font-black uppercase tracking-tight leading-none truncate ${ia.action === opt.id ? 'text-primary' : 'text-gray-700'}`}>{opt.label}</span>
                                                                    <span className="text-[7px] text-gray-400 font-bold uppercase tracking-widest mt-0.5 opacity-70 truncate">{opt.desc}</span>
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Keydown config */}
                                        {ia.event === 'keydown' && (
                                            <div className="flex flex-col gap-1 mt-1 border-t border-gray-50 pt-2">
                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Key (e.g. Space, KeyA, ArrowUp)</span>
                                                <input
                                                    type="text"
                                                    value={ia.keyCode ?? ''}
                                                    placeholder="Space"
                                                    onChange={e => updateActions(actions.map((x, i) => i === idx ? { ...x, keyCode: e.target.value || undefined } : x))}
                                                    className="px-2.5 py-1.5 text-[10px] font-mono bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-700"
                                                />
                                            </div>
                                        )}
                                        {/* Idle config */}
                                        {ia.event === 'idle' && (
                                            <div className="flex flex-col gap-1 mt-1 border-t border-gray-50 pt-2">
                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Idle seconds</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    step={1}
                                                    value={ia.idleSeconds ?? 3}
                                                    onChange={e => updateActions(actions.map((x, i) => i === idx ? { ...x, idleSeconds: Math.max(1, Number(e.target.value)) } : x))}
                                                    className="px-2.5 py-1.5 text-[10px] font-bold bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-700 w-full"
                                                />
                                            </div>
                                        )}
                                        {(() => {
                                            const actualTarget = targetLayer || fl;
                                            if (actualTarget?.type === 'group' && ['play-entry', 'play-main', 'play-exit', 'play-all', 'toggle-animation', 'stop-animation'].includes(ia.action)) {
                                                return (
                                                    <div className="flex items-center gap-2 mt-2 px-1 border-t border-gray-50 pt-2">
                                                        <input
                                                            type="checkbox"
                                                            id={`ia-children-${ia.id}`}
                                                            checked={!!ia.includeChildren}
                                                            onChange={e => updateActions(actions.map((x, i) => i === idx ? { ...x, includeChildren: e.target.checked } : x))}
                                                            className="accent-primary"
                                                        />
                                                        <label htmlFor={`ia-children-${ia.id}`} className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Play children animations</label>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}

                {/* Media Settings Section (Source + Fill) */}
                {selectedLayers.length > 0 && selectedLayers.every(l => ['image', 'media'].includes(l.type)) && (() => {
                    const firstLayer = selectedLayers[0];
                    let meta: any = {};
                    try { meta = JSON.parse(firstLayer.variant || '{}'); } catch {}
                    const fit = meta.imageFit || 'contain';
                    
                    const updateMetaProp = (updates: any) => {
                        selectedLayers.forEach(l => {
                            let lMeta: any = {};
                            try { lMeta = JSON.parse(l.variant || '{}'); } catch {}
                            const newMeta = { ...lMeta, ...updates };
                            onUpdateLayers([l.id], { variant: JSON.stringify(newMeta) }, true);
                        });
                    };

                    const updateFit = (val: string) => {
                        const updates: any = { imageFit: val };
                        if (val !== 'cover') {
                            updates.imagePosX = 50;
                            updates.imagePosY = 50;
                        }
                        updateMetaProp(updates);
                    };

                    return (
                        <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/source">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                                    {selectedLayers.every(l => l.type === 'video') ? 'Video Source' : 'Image Source'}
                                </label>
                            </div>
                            
                            <div className="flex flex-col gap-1.5 min-w-0">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                        <span className="material-symbols-outlined text-[16px] text-primary">cloud_upload</span>
                                        {selectedLayers.every(l => l.type === 'video') ? 'Video URL' : 'Image URL'}
                                    </label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="file" 
                                            id="media-source-file-input" 
                                            className="hidden" 
                                            accept={selectedLayers.every(l => l.type === 'video') ? 'video/*' : 'image/*'}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file, selectedLayers.every(l => l.type === 'video') ? 'videoUrl' : 'url');
                                            }}
                                        />
                                        <button 
                                            onClick={() => document.getElementById('media-source-file-input')?.click()}
                                            disabled={isUploading}
                                            className="text-[9px] font-bold text-primary hover:text-primary-dark transition-colors uppercase tracking-tight flex items-center gap-0.5"
                                        >
                                            {isUploading ? (
                                                <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                                            ) : (
                                                <span className="material-symbols-outlined text-[12px]">upload</span>
                                            )}
                                            {isUploading ? 'Uploading...' : 'Upload'}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setLibraryTarget(selectedLayers.every(l => l.type === 'video') ? 'videoUrl' : 'url');
                                                setIsMainLibraryOpen(true);
                                            }}
                                            className="text-[9px] font-bold text-primary hover:text-primary-dark transition-colors uppercase tracking-tight flex items-center gap-0.5"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">photo_library</span>
                                            Library
                                        </button>
                                    </div>
                                </div>
                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary">
                                    <input 
                                        type="text" 
                                        value={selectedLayers.every(l => l.type === 'video') ? (localValues['videoUrl'] || '') : (localValues['url'] || '')}
                                        onChange={(e) => handleInputChange(selectedLayers.every(l => l.type === 'video') ? 'videoUrl' : 'url', e.target.value)}
                                        onBlur={() => handleInputBlur(selectedLayers.every(l => l.type === 'video') ? 'videoUrl' : 'url')}
                                        className="flex-1 w-full text-[10px] font-medium px-3 h-8 bg-transparent outline-none"
                                        placeholder={selectedLayers.every(l => l.type === 'video') ? "Video URL..." : "Image URL..."}
                                    />
                                </div>
                            </div>

                            {/* Image Fill Settings (Only for Image/Media) */}
                            {selectedLayers.every(l => ['image', 'media'].includes(l.type)) && (
                                <div className="flex flex-col gap-3 pt-2 border-t border-gray-100/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">fit_screen</span>
                                            Image Fit
                                        </label>
                                        {fit === 'cover' && (
                                            <button 
                                                onClick={() => updateMetaProp({ imagePosX: 50, imagePosY: 50 })}
                                                className="text-[9px] font-bold text-gray-400 hover:text-primary transition-colors uppercase tracking-tight flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                                                Reset
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                                        {(['contain', 'cover', 'tile'] as const).map(m => (
                                            <button 
                                                key={m}
                                                onClick={() => updateFit(m)}
                                                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold capitalize transition-all ${fit === m ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                {m}
                                            </button>
                                        ))}
                                    </div>

                                    {fit === 'cover' && (
                                        <div className="grid grid-cols-2 gap-4 mt-1">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="material-symbols-outlined text-[14px]">align_horizontal_center</span>
                                                    Image X (%)
                                                </label>
                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary">
                                                    <input 
                                                        type="number" 
                                                        value={meta.imagePosX ?? 50}
                                                        onChange={(e) => updateMetaProp({ imagePosX: parseInt(e.target.value) || 0 })}
                                                        className="flex-1 w-full text-xs font-medium px-3 h-8 bg-transparent outline-none appearance-none"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                                                    <span className="material-symbols-outlined text-[14px]">align_vertical_center</span>
                                                    Image Y (%)
                                                </label>
                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary">
                                                    <input 
                                                        type="number" 
                                                        value={meta.imagePosY ?? 50}
                                                        onChange={(e) => updateMetaProp({ imagePosY: parseInt(e.target.value) || 0 })}
                                                        className="flex-1 w-full text-xs font-medium px-3 h-8 bg-transparent outline-none appearance-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* Layout & Transform Section */}
                <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/layout">
                    <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[16px] text-primary">transform</span>
                        Layout & Transform
                    </label>

                    {(() => {
                        const isGroup = selectedLayers.length === 1 && selectedLayers[0].type === 'group';
                        let groupMeta: any = {};
                        if (isGroup) {
                             try { groupMeta = JSON.parse(selectedLayers[0].variant || '{}'); } catch {}
                        }
                        const isAuto = isGroup && groupMeta.layoutMode === 'auto';

                        const singleLayer = selectedLayers.length === 1 ? selectedLayers[0] : null;
                        const parentGroup = currentStage && singleLayer ? findParentLayer(currentStage.layers, singleLayer.id) : null;
                        const parentIsAutoLayout = parentGroup?.type === 'group' && (() => {
                            try { return (JSON.parse(parentGroup.variant || '{}')).layoutMode === 'auto'; } catch { return false; }
                        })();
                        const parentMeta = (() => {
                            try { return JSON.parse(parentGroup?.variant || '{}'); } catch { return {}; }
                        })();
                        const parentIsHugW = parentMeta.layoutSizingHorizontal === 'hug';
                        const parentIsHugH = parentMeta.layoutSizingVertical === 'hug';

                        let childMeta: any = {};
                        if (singleLayer) try { childMeta = JSON.parse(singleLayer.variant || '{}'); } catch {}
                        const childFillW = childMeta.layoutSizingInGroupWidth || 'fixed';
                        const childFillH = childMeta.layoutSizingInGroupHeight || 'fixed';
                        const isLine = singleLayer?.type === 'shape' && childMeta.shapeType === 'line';


                        const updateChildMeta = (updates: any) => {
                            if (!singleLayer) return;
                            const newMeta = { ...childMeta, ...updates };
                            onUpdateLayers([singleLayer.id], { variant: JSON.stringify(newMeta) });
                        };
                        
                        return (
                            <div className="flex flex-col gap-3">
                                {isGroup && (
                                    <div className="flex items-center justify-between py-1 px-1 mb-1">
                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px]">crop_free</span>
                                            Clip Content
                                        </label>
                                        <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                                            <button 
                                                onClick={() => {
                                                    const newMeta = { ...groupMeta, clipContent: true };
                                                    onUpdateLayers([selectedLayers[0].id], { variant: JSON.stringify(newMeta) });
                                                }}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${groupMeta.clipContent ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                On
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    const newMeta = { ...groupMeta, clipContent: false };
                                                    onUpdateLayers([selectedLayers[0].id], { variant: JSON.stringify(newMeta) });
                                                }}
                                                className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!groupMeta.clipContent ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                            >
                                                Off
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex flex-col gap-2">
                                    {/* X & Y Row */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {/* X Pos */}
                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 h-9 transition-all">
                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">X</span>
                                            <input 
                                                type="text"
                                                className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                value={localValues['x'] || '0'}
                                                onChange={(e) => handleInputChange('x', e.target.value)}
                                                onBlur={() => handleInputBlur('x')}
                                                onKeyDown={(e) => handleKeyDown(e, 'x')}
                                            />
                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('x', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('x', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                            </div>
                                        </div>
                                        
                                        {/* Y Pos */}
                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 h-9 transition-all">
                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">Y</span>
                                            <input 
                                                type="text"
                                                className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                value={localValues['y'] || '0'}
                                                onChange={(e) => handleInputChange('y', e.target.value)}
                                                onBlur={() => handleInputBlur('y')}
                                                onKeyDown={(e) => handleKeyDown(e, 'y')}
                                            />
                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('y', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('y', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* W & H Row with Lock */}
                                    <div className="flex items-center gap-2">
                                        {/* Width */}
                                        <div className="flex-1 min-w-0">
                                            {isAuto && groupMeta.layoutSizingHorizontal === 'hug' ? (
                                                <div className="h-9 flex items-center justify-center text-[10px] font-bold text-gray-400 bg-gray-50 rounded-lg border border-gray-100 select-none">Hug</div>
                                            ) : parentIsAutoLayout ? (
                                                <div className="flex items-center gap-1.5 h-9">
                                                    <button
                                                        type="button"
                                                        title={parentIsHugW ? "Cannot Fill width when parent is set to 'Hug'" : "Fill width"}
                                                        disabled={parentIsHugW}
                                                        onClick={() => !parentIsHugW && updateChildMeta({ layoutSizingInGroupWidth: childFillW === 'fill' ? 'fixed' : 'fill' })}
                                                        className={`size-9 rounded-lg border flex items-center justify-center transition-all shrink-0 ${childFillW === 'fill' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200 hover:text-gray-600'} ${parentIsHugW ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[16px] rotate-90">expand</span>
                                                    </button>
                                                    {childFillW === 'fixed' && (
                                                        <div className="relative group/input flex-1 flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 h-9 transition-all">
                                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">W</span>
                                                            <input type="text" className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" value={localValues['width'] ?? ''} onChange={(e) => handleInputChange('width', e.target.value)} onBlur={() => handleInputBlur('width')} onKeyDown={(e) => handleKeyDown(e, 'width')} />
                                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity select-none">
                                                                <button type="button" tabIndex={-1} onClick={() => handleStep('width', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                                <button type="button" tabIndex={-1} onClick={() => handleStep('width', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 h-9 transition-all">
                                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">W</span>
                                                    <input 
                                                        type="text"
                                                        className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                        value={localValues['width'] || '0'}
                                                        onChange={(e) => handleInputChange('width', e.target.value)}
                                                        onBlur={() => handleInputBlur('width')}
                                                        onKeyDown={(e) => handleKeyDown(e, 'width')}
                                                    />
                                                    <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                        <button type="button" tabIndex={-1} onClick={() => handleStep('width', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                        <button type="button" tabIndex={-1} onClick={() => handleStep('width', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Lock Button */}
                                        <button 
                                            onClick={() => setLayerRatioLocked(!isLayerRatioLocked)}
                                            className={`size-9 flex items-center justify-center rounded-lg transition-all ${isLayerRatioLocked ? 'text-primary bg-primary/10 border border-primary/20 shadow-sm' : 'text-gray-300 hover:text-gray-400 border border-transparent'}`}
                                            title={isLayerRatioLocked ? 'Unlock Aspect Ratio' : 'Lock Aspect Ratio'}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">
                                                {isLayerRatioLocked ? 'link' : 'link_off'}
                                            </span>
                                        </button>

                                        {/* Height */}
                                        <div className="flex-1 min-w-0">
                                            {isAuto && groupMeta.layoutSizingVertical === 'hug' ? (
                                                <div className="h-9 flex items-center justify-center text-[10px] font-bold text-gray-400 bg-gray-50 rounded-lg border border-gray-100 select-none">Hug</div>
                                            ) : parentIsAutoLayout ? (
                                                <div className="flex items-center gap-1.5 h-9">
                                                    <button
                                                        type="button"
                                                        title={parentIsHugH ? "Cannot Fill height when parent is set to 'Hug'" : "Fill height"}
                                                        disabled={parentIsHugH}
                                                        onClick={() => !parentIsHugH && updateChildMeta({ layoutSizingInGroupHeight: childFillH === 'fill' ? 'fixed' : 'fill' })}
                                                        className={`size-9 rounded-lg border flex items-center justify-center transition-all shrink-0 ${childFillH === 'fill' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-200 hover:text-gray-600'} ${parentIsHugH ? 'opacity-30 cursor-not-allowed' : ''}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">expand</span>
                                                    </button>
                                                    {childFillH === 'fixed' && (
                                                        <div className="relative group/input flex-1 flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 h-9 transition-all">
                                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">H</span>
                                                            <input type="text" className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" value={localValues['height'] ?? ''} onChange={(e) => handleInputChange('height', e.target.value)} onBlur={() => handleInputBlur('height')} onKeyDown={(e) => handleKeyDown(e, 'height')} />
                                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity select-none">
                                                                <button type="button" tabIndex={-1} onClick={() => handleStep('height', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                                <button type="button" tabIndex={-1} onClick={() => handleStep('height', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 h-9 transition-all">
                                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">H</span>
                                                    <input 
                                                        type="text"
                                                        className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                        value={localValues['height'] || '0'}
                                                        onChange={(e) => handleInputChange('height', e.target.value)}
                                                        onBlur={() => handleInputBlur('height')}
                                                        onKeyDown={(e) => handleKeyDown(e, 'height')}
                                                    />
                                                    <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                        <button type="button" tabIndex={-1} onClick={() => handleStep('height', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                        <button type="button" tabIndex={-1} onClick={() => handleStep('height', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {(singleLayer?.type === 'text' || singleLayer?.type === 'button' || isAuto) && (
                                    <>
                                        {/* Padding Control Section */}
                                        <div className="flex flex-col gap-3 pt-3 mt-1 border-t border-gray-100/50">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                    <span className="material-symbols-outlined text-[16px] text-primary">padding</span>
                                                    Padding
                                                </label>
                                                <button 
                                                    onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                    onClick={() => setShowIndependentPadding(!showIndependentPadding)}
                                                    className={`p-1 rounded-lg hover:bg-gray-100 transition-colors ${showIndependentPadding ? 'text-primary bg-primary/5' : 'text-gray-400'}`}
                                                    title="Independent padding (T, R, B, L)"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        {showIndependentPadding ? 'padding' : 'crop_square'}
                                                    </span>
                                                </button>
                                            </div>

                                            {showIndependentPadding ? (
                                                <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
                                                    {/* Top */}
                                                    <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                                                        <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none">T</span>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 w-full text-xs font-medium pl-6 pr-1 h-8 bg-transparent outline-none" 
                                                            placeholder="0" 
                                                            value={childMeta.paddingTop ?? childMeta.paddingVertical ?? childMeta.padding ?? 0} 
                                                            onChange={(e) => updateChildMeta({ paddingTop: Number(e.target.value) || 0 })}
                                                            onKeyDown={(e) => {
                                                                const delta = e.shiftKey ? 10 : 1;
                                                                if(e.key === 'ArrowUp') { e.preventDefault(); updateChildMeta({ paddingTop: (Number(childMeta.paddingTop ?? childMeta.paddingVertical ?? childMeta.padding) || 0) + delta }); }
                                                                if(e.key === 'ArrowDown') { e.preventDefault(); updateChildMeta({ paddingTop: Math.max(0, (Number(childMeta.paddingTop ?? childMeta.paddingVertical ?? childMeta.padding) || 0) - delta) }); }
                                                            }}
                                                        />
                                                        {/* Stepper Arrows */}
                                                        <div className="flex flex-col border-l border-gray-100 group-focus-within/input:border-primary/30 opacity-0 group-hover/input:opacity-100 transition-all bg-white/50 backdrop-blur-sm select-none">
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingTop: (Number(childMeta.paddingTop ?? childMeta.paddingVertical ?? childMeta.padding) || 0) + 1 })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Increase"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingTop: Math.max(0, (Number(childMeta.paddingTop ?? childMeta.paddingVertical ?? childMeta.padding) || 0) - 1) })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Decrease"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                        </div>
                                                    </div>
                                                    {/* Right */}
                                                    <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                                                        <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none">R</span>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 w-full text-xs font-medium pl-6 pr-1 h-8 bg-transparent outline-none" 
                                                            placeholder="0" 
                                                            value={childMeta.paddingRight ?? childMeta.paddingHorizontal ?? childMeta.padding ?? 0} 
                                                            onChange={(e) => updateChildMeta({ paddingRight: Number(e.target.value) || 0 })}
                                                            onKeyDown={(e) => {
                                                                const delta = e.shiftKey ? 10 : 1;
                                                                if(e.key === 'ArrowUp') { e.preventDefault(); updateChildMeta({ paddingRight: (Number(childMeta.paddingRight ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) + delta }); }
                                                                if(e.key === 'ArrowDown') { e.preventDefault(); updateChildMeta({ paddingRight: Math.max(0, (Number(childMeta.paddingRight ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) - delta) }); }
                                                            }}
                                                        />
                                                        {/* Stepper Arrows */}
                                                        <div className="flex flex-col border-l border-gray-100 group-focus-within/input:border-primary/30 opacity-0 group-hover/input:opacity-100 transition-all bg-white/50 backdrop-blur-sm select-none">
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingRight: (Number(childMeta.paddingRight ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) + 1 })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Increase"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingRight: Math.max(0, (Number(childMeta.paddingRight ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) - 1) })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Decrease"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                        </div>
                                                    </div>
                                                    {/* Bottom */}
                                                    <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                                                        <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none">B</span>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 w-full text-xs font-medium pl-6 pr-1 h-8 bg-transparent outline-none" 
                                                            placeholder="0" 
                                                            value={childMeta.paddingBottom ?? childMeta.paddingVertical ?? childMeta.padding ?? 0} 
                                                            onChange={(e) => updateChildMeta({ paddingBottom: Number(e.target.value) || 0 })}
                                                            onKeyDown={(e) => {
                                                                const delta = e.shiftKey ? 10 : 1;
                                                                if(e.key === 'ArrowUp') { e.preventDefault(); updateChildMeta({ paddingBottom: (Number(childMeta.paddingBottom ?? childMeta.paddingVertical ?? childMeta.padding) || 0) + delta }); }
                                                                if(e.key === 'ArrowDown') { e.preventDefault(); updateChildMeta({ paddingBottom: Math.max(0, (Number(childMeta.paddingBottom ?? childMeta.paddingVertical ?? childMeta.padding) || 0) - delta) }); }
                                                            }}
                                                        />
                                                        {/* Stepper Arrows */}
                                                        <div className="flex flex-col border-l border-gray-100 group-focus-within/input:border-primary/30 opacity-0 group-hover/input:opacity-100 transition-all bg-white/50 backdrop-blur-sm select-none">
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingBottom: (Number(childMeta.paddingBottom ?? childMeta.paddingVertical ?? childMeta.padding) || 0) + 1 })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Increase"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingBottom: Math.max(0, (Number(childMeta.paddingBottom ?? childMeta.paddingVertical ?? childMeta.padding) || 0) - 1) })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Decrease"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                        </div>
                                                    </div>
                                                    {/* Left */}
                                                    <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                                                        <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none">L</span>
                                                        <input 
                                                            type="text" 
                                                            className="flex-1 w-full text-xs font-medium pl-6 pr-1 h-8 bg-transparent outline-none" 
                                                            placeholder="0" 
                                                            value={childMeta.paddingLeft ?? childMeta.paddingHorizontal ?? childMeta.padding ?? 0} 
                                                            onChange={(e) => updateChildMeta({ paddingLeft: Number(e.target.value) || 0 })}
                                                            onKeyDown={(e) => {
                                                                const delta = e.shiftKey ? 10 : 1;
                                                                if(e.key === 'ArrowUp') { e.preventDefault(); updateChildMeta({ paddingLeft: (Number(childMeta.paddingLeft ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) + delta }); }
                                                                if(e.key === 'ArrowDown') { e.preventDefault(); updateChildMeta({ paddingLeft: Math.max(0, (Number(childMeta.paddingLeft ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) - delta) }); }
                                                            }}
                                                        />
                                                        {/* Stepper Arrows */}
                                                        <div className="flex flex-col border-l border-gray-100 group-focus-within/input:border-primary/30 opacity-0 group-hover/input:opacity-100 transition-all bg-white/50 backdrop-blur-sm select-none">
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingLeft: (Number(childMeta.paddingLeft ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) + 1 })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Increase"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingLeft: Math.max(0, (Number(childMeta.paddingLeft ?? childMeta.paddingHorizontal ?? childMeta.padding) || 0) - 1) })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Decrease"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10" title="Horizontal Padding">
                                                         <div className="absolute left-2 flex items-center justify-center text-gray-400 pointer-events-none">
                                                            <span className="material-symbols-outlined text-[14px]">padding</span>
                                                         </div>
                                                        <input
                                                            type="text"
                                                            className="flex-1 w-full text-xs font-medium pl-8 pr-1 h-8 bg-transparent outline-none"
                                                            placeholder="H Padding"
                                                            value={childMeta.paddingHorizontal ?? childMeta.padding ?? 0}
                                                            onChange={(e) => updateChildMeta({ paddingHorizontal: Number(e.target.value) || 0 })}
                                                            onKeyDown={(e) => {
                                                                const delta = e.shiftKey ? 10 : 1;
                                                                if(e.key === 'ArrowUp') { e.preventDefault(); updateChildMeta({ paddingHorizontal: (Number(childMeta.paddingHorizontal ?? childMeta.padding) || 0) + delta }); }
                                                                if(e.key === 'ArrowDown') { e.preventDefault(); updateChildMeta({ paddingHorizontal: Math.max(0, (Number(childMeta.paddingHorizontal ?? childMeta.padding) || 0) - delta) }); }
                                                            }}
                                                        />
                                                        {/* Stepper Arrows */}
                                                        <div className="flex flex-col border-l border-gray-100 group-focus-within/input:border-primary/30 opacity-0 group-hover/input:opacity-100 transition-all bg-white/50 backdrop-blur-sm select-none">
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingHorizontal: (Number(childMeta.paddingHorizontal ?? childMeta.padding) || 0) + 1 })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Increase"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingHorizontal: Math.max(0, (Number(childMeta.paddingHorizontal ?? childMeta.padding) || 0) - 1) })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Decrease"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                        </div>
                                                    </div>
                                                    <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10" title="Vertical Padding">
                                                         <div className="absolute left-2 flex items-center justify-center text-gray-400 pointer-events-none rotate-90">
                                                            <span className="material-symbols-outlined text-[14px]">padding</span>
                                                         </div>
                                                        <input
                                                            type="text"
                                                            className="flex-1 w-full text-xs font-medium pl-8 pr-1 h-8 bg-transparent outline-none"
                                                            placeholder="V Padding"
                                                            value={childMeta.paddingVertical ?? childMeta.padding ?? 0}
                                                            onChange={(e) => updateChildMeta({ paddingVertical: Number(e.target.value) || 0 })}
                                                            onKeyDown={(e) => {
                                                                const delta = e.shiftKey ? 10 : 1;
                                                                if(e.key === 'ArrowUp') { e.preventDefault(); updateChildMeta({ paddingVertical: (Number(childMeta.paddingVertical ?? childMeta.padding) || 0) + delta }); }
                                                                if(e.key === 'ArrowDown') { e.preventDefault(); updateChildMeta({ paddingVertical: Math.max(0, (Number(childMeta.paddingVertical ?? childMeta.padding) || 0) - delta) }); }
                                                            }}
                                                        />
                                                        {/* Stepper Arrows */}
                                                        <div className="flex flex-col border-l border-gray-100 group-focus-within/input:border-primary/30 opacity-0 group-hover/input:opacity-100 transition-all bg-white/50 backdrop-blur-sm select-none">
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingVertical: (Number(childMeta.paddingVertical ?? childMeta.padding) || 0) + 1 })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Increase"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                            <button onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }} onClick={() => updateChildMeta({ paddingVertical: Math.max(0, (Number(childMeta.paddingVertical ?? childMeta.padding) || 0) - 1) })} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors" tabIndex={-1} title="Decrease"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })()}

                    <div className="grid grid-cols-2 gap-4">
                        {renderInput('Rotation', 'rotation', 'rotate_right')}
                        {renderInput('Opacity %', 'opacity', 'opacity')}
                    </div>
                </div>

                {/* Video Settings */}
                {selectedLayers.length > 0 && selectedLayers.every(l => l.type === 'video') && (
                    <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/video">
                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[16px] text-primary">movie</span>
                            Video Settings
                        </label>

                        {/* Video Source */}
                        <div className="flex flex-col gap-1.5 min-w-0">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">link</span>
                                    Video Source
                                </label>
                                <div className="flex gap-2">
                                    <input 
                                        type="file" 
                                        id="video-source-file-input" 
                                        className="hidden" 
                                        accept="video/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageUpload(file, 'videoUrl');
                                        }}
                                    />
                                    <button 
                                        onClick={() => document.getElementById('video-source-file-input')?.click()}
                                        disabled={isUploading}
                                        className="text-[9px] font-bold text-primary hover:text-primary-dark transition-colors uppercase tracking-tight flex items-center gap-0.5"
                                    >
                                        {isUploading ? (
                                            <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>
                                        ) : (
                                            <span className="material-symbols-outlined text-[12px]">upload</span>
                                        )}
                                        {isUploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setLibraryTarget('videoUrl');
                                            setIsMainLibraryOpen(true);
                                        }}
                                        className="text-[9px] font-bold text-primary hover:text-primary-dark transition-colors uppercase tracking-tight flex items-center gap-0.5"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">photo_library</span>
                                        Library
                                    </button>
                                </div>
                            </div>
                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary">
                                <input 
                                    type="text" 
                                    className="flex-1 w-full h-8 px-3 bg-transparent text-[10px] font-medium text-gray-900 outline-none"
                                    value={localValues['videoUrl'] || ''}
                                    onChange={(e) => handleInputChange('videoUrl', e.target.value)}
                                    onBlur={() => handleInputBlur('videoUrl')}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                        


                        <div className="flex flex-col gap-1.5 min-w-0">
                            <label className="text-[9px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[14px]">image</span>
                                Poster Image
                            </label>
                            
                            <div className="flex items-center gap-3">
                                <div className="size-14 rounded-xl border border-gray-100 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-xs group/poster relative">
                                    {localValues['posterUrl'] ? (
                                        <>
                                            <img src={localValues['posterUrl']} className="w-full h-full object-cover transition-transform group-hover/poster:scale-110" alt="Poster" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center">
                                                <button 
                                                    onClick={() => handleInputChange('posterUrl', '')}
                                                    className="size-6 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md flex items-center justify-center transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-0.5">
                                            <span className="material-symbols-outlined text-gray-200 text-[20px]">image</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex gap-3">
                                        <input 
                                            type="file" 
                                            id="video-poster-file-input" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleImageUpload(file, 'posterUrl');
                                            }}
                                        />
                                        <button 
                                            onClick={() => document.getElementById('video-poster-file-input')?.click()}
                                            className="text-[9px] font-bold text-primary hover:text-primary-dark transition-colors uppercase tracking-tight flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">upload</span>
                                            Upload
                                        </button>
                                        <button 
                                            onClick={() => {
                                                setLibraryTarget('posterUrl');
                                                setIsMainLibraryOpen(true);
                                            }}
                                            className="text-[9px] font-bold text-primary hover:text-primary-dark transition-colors uppercase tracking-tight flex items-center gap-1"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">photo_library</span>
                                            Gallery
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-xs group/loop transition-all hover:border-primary/20">
                            <div className="flex items-center gap-2.5">
                                <div className={`size-8 rounded-lg flex items-center justify-center transition-all ${localValues['loop'] === 'true' ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
                                    <span className="material-symbols-outlined text-[18px]">loop</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">Loop Video</span>
                                    <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{localValues['loop'] === 'true' ? 'Enabled' : 'Disabled'}</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    const next = localValues['loop'] === 'true' ? 'false' : 'true';
                                    handleInputChange('loop', next);
                                    triggerUpdate('loop', next);
                                }}
                                className={`relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-hidden ${localValues['loop'] === 'true' ? 'bg-primary' : 'bg-gray-200'}`}
                            >
                                <div className={`absolute top-1 left-1 size-3 bg-white rounded-full transition-all duration-300 shadow-sm ${localValues['loop'] === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {/* Video Controls Section */}
                        <div className="flex flex-col gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-xs group/controls transition-all hover:border-primary/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className={`size-8 rounded-lg flex items-center justify-center transition-all ${localValues['controls'] === 'true' ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
                                        <span className="material-symbols-outlined text-[18px]">settings_input_component</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">Video Controls</span>
                                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{localValues['controls'] === 'true' ? 'Enabled' : 'Disabled'}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => {
                                        const next = localValues['controls'] === 'true' ? 'false' : 'true';
                                        handleInputChange('controls', next);
                                        triggerUpdate('controls', next);
                                    }}
                                    className={`relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-hidden ${localValues['controls'] === 'true' ? 'bg-primary' : 'bg-gray-200'}`}
                                >
                                    <div className={`absolute top-1 left-1 size-3 bg-white rounded-full transition-all duration-300 shadow-sm ${localValues['controls'] === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {localValues['controls'] === 'true' && (
                                <div className="flex flex-col gap-4 pt-4 border-t border-gray-50 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { key: 'controlPlay', label: 'Play Button', icon: 'play_arrow' },
                                            { key: 'controlMute', label: 'Mute / Unmute', icon: 'volume_up' },
                                            { key: 'controlVolume', label: 'Volume Control', icon: 'tune' },
                                            { key: 'controlTimeline', label: 'Timeline', icon: 'linear_scale' },
                                        ].map((ctrl) => (
                                            <button
                                                key={ctrl.key}
                                                onClick={() => {
                                                    const current = localValues[ctrl.key] === 'true';
                                                    const next = !current ? 'true' : 'false';
                                                    handleInputChange(ctrl.key, next);
                                                    triggerUpdate(ctrl.key, next);
                                                }}
                                                className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                                    localValues[ctrl.key] === 'true' 
                                                    ? 'bg-primary/[0.03] border-primary/20 text-primary' 
                                                    : 'bg-gray-50 border-gray-100 text-gray-400 grayscale hover:grayscale-0'
                                                }`}
                                            >
                                                <div className={`size-5 rounded flex items-center justify-center ${localValues[ctrl.key] === 'true' ? 'bg-primary/10' : 'bg-white border border-gray-100'}`}>
                                                    <span className="material-symbols-outlined text-[14px]">{ctrl.icon}</span>
                                                </div>
                                                <span className="text-[8px] font-black uppercase tracking-tight">{ctrl.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <VideoControlSettings 
                                        values={localValues}
                                        onChange={(key: string, value: any) => {
                                            handleInputChange(key, value);
                                            triggerUpdate(key, value);
                                        }}
                                        onImageUpload={(file: File, targetField: string) => handleImageUpload(file, targetField)}
                                        isUploading={isUploading}
                                        documentColors={documentColors}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-4 space-y-2">

                    {/* Fills Section (Shape / Group) */}
                    {selectedLayers.length > 0 && selectedLayers.every(l => l.type === 'shape' || l.type === 'group') && (
                        <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/fills">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-[16px] text-primary">format_color_fill</span>
                                    Fills
                                </label>
                                <button 
                                    onClick={handleAddFill}
                                    className="h-6 px-2 rounded-lg bg-primary/5 hover:bg-primary/10 text-primary transition-all flex items-center gap-1 border border-primary/10 hover:border-primary/20 active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    <span className="text-[9px] font-black uppercase tracking-tighter">Add</span>
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                {localValues['fills'] === 'Mixed' && (
                                    <div className="p-3 text-[10px] text-gray-400 font-black uppercase tracking-widest bg-white border border-gray-100 rounded-xl text-center shadow-sm">Mixed Fills</div>
                                )}
                                {Array.isArray(localValues['fills']) && localValues['fills'].map((fill: any, idx: number) => (
                                    <div key={fill.id || idx} className="flex flex-col gap-3 p-3 bg-white border border-gray-100 rounded-xl group/fill shadow-sm hover:border-primary/20 transition-all">
                                        <div className="flex flex-col gap-2 border-b border-gray-50 pb-1.5">
                                            <div className="flex items-center justify-between">
                                                <button 
                                                    onClick={() => {
                                                        const newFills = [...localValues['fills']];
                                                        newFills[idx] = { ...fill, visible: fill.visible === false ? true : false };
                                                        handleUpdateFills(newFills);
                                                    }}
                                                    className={`size-6 rounded-lg flex items-center justify-center transition-all active:scale-95 ${fill.visible !== false ? 'text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20' : 'text-gray-400 bg-gray-50 border border-gray-100 hover:bg-gray-100'}`}
                                                >
                                                    <span className="material-symbols-outlined text-[15px]">{fill.visible !== false ? 'visibility' : 'visibility_off'}</span>
                                                </button>
                                                
                                                <button 
                                                    onClick={() => {
                                                        const newFills = localValues['fills'].filter((_: any, i: number) => i !== idx);
                                                        handleUpdateFills(newFills);
                                                    }}
                                                    className="size-6 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100 active:scale-95 shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-[15px]">delete</span>
                                                </button>
                                            </div>
                                            
                                            <div className="flex bg-gray-50 p-0.5 rounded-xl border border-gray-100 w-full">
                                                {(['solid', 'linear', 'radial', 'image', 'none'] as const).map(t => {
                                                    const icons = {
                                                        solid: 'colors',
                                                        linear: 'gradient',
                                                        radial: 'blur_circular',
                                                        image: 'image',
                                                        none: 'block'
                                                    };
                                                    return (
                                                        <button
                                                            key={t}
                                                            title={t.charAt(0).toUpperCase() + t.slice(1)}
                                                            onClick={() => {
                                                                handleUpdateFills(prev => {
                                                                    const next = [...prev];
                                                                    const currentFill = next[idx];
                                                                    const defaultProps: any = {};
                                                                    if (t === 'linear' && currentFill.gradientAngle === undefined) {
                                                                         defaultProps.gradientAngle = 135;
                                                                         defaultProps.gradientLength = 141;
                                                                         defaultProps.gradientCenterX = 0;
                                                                         defaultProps.gradientCenterY = 0;
                                                                    } else if (t === 'radial' && currentFill.gradientRadius === undefined) {
                                                                         defaultProps.gradientRadius = 100;
                                                                         defaultProps.gradientCenterX = 50;
                                                                         defaultProps.gradientCenterY = 50;
                                                                    }
                                                                    next[idx] = { ...currentFill, ...defaultProps, type: t };
                                                                    return next;
                                                                });
                                                            }}
                                                            className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all ${fill.type === t ? 'bg-white text-primary shadow-sm border border-gray-100/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                        >
                                                            <span className="material-symbols-outlined text-[14px]">{icons[t]}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {fill.type !== 'none' && (
                                            <div className="flex flex-col gap-2 mt-1">
                                                {fill.type !== 'image' ? (
                                                    <div className="grid grid-cols-1 gap-2">
                                                        <div className="space-y-2 mt-1">
                                                            {fill.type === 'solid' ? (
                                                                <ColorPicker 
                                                                    label="Color"
                                                                    value={fill.color || '#3B82F6'}
                                                                    onChange={(val) => {
                                                                        handleUpdateFills(prev => {
                                                                            const next = [...prev];
                                                                            const currentFill = next[idx];
                                                                            next[idx] = { ...currentFill, color: val };
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    swatches={documentColors}
                                                                />
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between px-1">
                                                                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest pl-1">Color Stops</label>
                                                                    </div>
                                                                    <div className="space-y-1.5">
                                                                        {(fill.stops || [
                                                                            { id: '1', color: fill.color || '#3B82F6', offset: 0 },
                                                                            { id: '2', color: fill.color2 || '#1D4ED8', offset: 1 }
                                                                        ]).map((stop: any, sIdx: number, allStops: any[]) => (
                                                                            <div key={stop.id || sIdx} className="flex items-center gap-2 bg-white border border-gray-100 rounded-lg p-1.5 shadow-sm">
                                                                                <ColorPicker
                                                                                    variant="minimal"
                                                                                    value={stop.color}
                                                                                    onChange={(val) => {
                                                                                        const newStops = [...allStops];
                                                                                        newStops[sIdx] = { ...stop, color: val };
                                                                                        handleUpdateFills(prev => {
                                                                                            const next = [...prev];
                                                                                            next[idx] = { ...fill, stops: newStops };
                                                                                            if (sIdx === 0) next[idx].color = val;
                                                                                            if (sIdx === newStops.length - 1) next[idx].color2 = val;
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                    swatches={documentColors}
                                                                                />
                                                                                <div className="flex-1 flex items-center gap-2">
                                                                                    <input 
                                                                                        type="range" min="0" max="1" step="0.01" 
                                                                                        value={stop.offset}
                                                                                        onChange={(e) => {
                                                                                            const val = parseFloat(e.target.value);
                                                                                            const newStops = [...allStops];
                                                                                            newStops[sIdx] = { ...stop, offset: val };
                                                                                            handleUpdateFills(prev => {
                                                                                                const next = [...prev];
                                                                                                next[idx] = { ...fill, stops: newStops.sort((a,b) => a.offset - b.offset) };
                                                                                                return next;
                                                                                            });
                                                                                        }}
                                                                                        className="flex-1 h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
                                                                                    />
                                                                                    <span className="text-[9px] font-bold text-gray-500 w-6 text-right">{Math.round(stop.offset * 100)}%</span>
                                                                                </div>
                                                                                <button 
                                                                                    onClick={() => {
                                                                                        if (allStops.length <= 2) return;
                                                                                        const newStops = allStops.filter((_, i) => i !== sIdx);
                                                                                        handleUpdateFills(prev => {
                                                                                            const next = [...prev];
                                                                                            next[idx] = { ...fill, stops: newStops };
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                    className={`text-gray-300 hover:text-red-500 transition-colors ${allStops.length <= 2 ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <button 
                                                                        onClick={() => {
                                                                            const currentStops = fill.stops || [
                                                                                { id: '1', color: fill.color || '#3B82F6', offset: 0 },
                                                                                { id: '2', color: fill.color2 || '#1D4ED8', offset: 1 }
                                                                            ];
                                                                            const lastStop = currentStops[currentStops.length - 1];
                                                                            const newOffset = Math.min(1, lastStop.offset + 0.1);
                                                                            const newStop = {
                                                                                id: Math.random().toString(36).substr(2, 9),
                                                                                color: lastStop.color,
                                                                                offset: Math.min(1, lastStop.offset + 0.05)
                                                                            };
                                                                            const newStops = [...currentStops, newStop].sort((a,b) => a.offset - b.offset);
                                                                            handleUpdateFills(prev => {
                                                                                const next = [...prev];
                                                                                next[idx] = { ...fill, stops: newStops };
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className="w-full py-2 border border-dashed border-gray-200 rounded-lg text-[9px] font-black text-gray-400 uppercase hover:text-primary hover:border-primary/30 transition-all flex items-center justify-center gap-1.5"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[16px]">add_circle</span>
                                                                        Add Color Stop
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>

                                                            {(fill.type === 'linear' || fill.type === 'radial') && (
                                                            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-3">
                                                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-900 uppercase tracking-widest pl-1 border-b border-gray-100 pb-2">
                                                                    <span className="material-symbols-outlined text-[16px] text-primary">tune</span>
                                                                    Handles
                                                                </div>
                                                                {fill.type === 'linear' && (
                                                                    <>
                                                                        <div className="flex flex-col gap-2">
                                                                            <div className="flex items-center justify-between px-1">
                                                                                <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Angle</label>
                                                                                <span className="text-[10px] font-black text-primary">{Math.round(fill.gradientAngle ?? 180)}°</span>
                                                                            </div>
                                                                            <input type="range" min="0" max="360" step="1" value={fill.gradientAngle ?? 180}
                                                                                onChange={(e) => { const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientAngle: parseInt(e.target.value, 10) }; handleUpdateFills(newFills); }}
                                                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                                                                        </div>
                                                                        <div className="flex flex-col gap-2">
                                                                            <div className="flex items-center justify-between px-1">
                                                                                <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Size %</label>
                                                                                <span className="text-[10px] font-black text-primary">{Math.round(fill.gradientLength ?? 100)}%</span>
                                                                            </div>
                                                                            <input type="range" min="10" max="130" step="1" value={fill.gradientLength ?? 100}
                                                                                onChange={(e) => { const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientLength: parseInt(e.target.value, 10) }; handleUpdateFills(newFills); }}
                                                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                                                                        </div>
                                                                    </>
                                                                )}
                                                                {fill.type === 'radial' && (
                                                                    <>
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9 transition-all">
                                                                                <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">X</span>
                                                                                <input type="number" min="0" max="100" value={fill.gradientCenterX ?? 50}
                                                                                    onChange={(e) => { const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)); const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientCenterX: v }; handleUpdateFills(newFills); }}
                                                                                    onKeyDown={(e) => {
                                                                                        const delta = e.shiftKey ? 10 : 1;
                                                                                        if (e.key === 'ArrowUp') { e.preventDefault(); const v = Math.min(100, (Number(fill.gradientCenterX ?? 50)) + delta); const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientCenterX: v }; handleUpdateFills(newFills); }
                                                                                        if (e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(0, (Number(fill.gradientCenterX ?? 50)) - delta); const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientCenterX: v }; handleUpdateFills(newFills); }
                                                                                    }}
                                                                                    className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                                            </div>
                                                                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9 transition-all">
                                                                                <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">Y</span>
                                                                                <input type="number" min="0" max="100" value={fill.gradientCenterY ?? 50}
                                                                                    onChange={(e) => { const v = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)); const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientCenterY: v }; handleUpdateFills(newFills); }}
                                                                                    onKeyDown={(e) => {
                                                                                        const delta = e.shiftKey ? 10 : 1;
                                                                                        if (e.key === 'ArrowUp') { e.preventDefault(); const v = Math.min(100, (Number(fill.gradientCenterY ?? 50)) + delta); const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientCenterY: v }; handleUpdateFills(newFills); }
                                                                                        if (e.key === 'ArrowDown') { e.preventDefault(); const v = Math.max(0, (Number(fill.gradientCenterY ?? 50)) - delta); const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientCenterY: v }; handleUpdateFills(newFills); }
                                                                                    }}
                                                                                    className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex flex-col gap-2">
                                                                            <div className="flex items-center justify-between px-1">
                                                                                <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Radius %</label>
                                                                                <span className="text-[10px] font-black text-primary">{Math.round(fill.gradientRadius ?? 100)}%</span>
                                                                            </div>
                                                                            <input type="range" min="10" max="150" step="1" value={fill.gradientRadius ?? 100}
                                                                                onChange={(e) => { const newFills = [...localValues['fills']]; newFills[idx] = { ...fill, gradientRadius: parseInt(e.target.value, 10) }; handleUpdateFills(newFills); }}
                                                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" />
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-100 min-h-[56px]">
                                                                    <button 
                                                                        onClick={() => {
                                                                            const input = document.createElement('input');
                                                                            input.type = 'file';
                                                                            input.accept = 'image/*';
                                                                            input.onchange = (e: any) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) handleImageUpload(file, `fill-${idx}`);
                                                                            };
                                                                            input.click();
                                                                        }}
                                                                        className="flex-1 px-2 py-1.5 bg-gray-50 hover:bg-white border border-gray-100 hover:border-primary/20 rounded-lg text-[9px] font-black text-gray-600 uppercase transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px] text-primary">upload</span>
                                                                        Upload
                                                                    </button>
                                                                    <div className="relative flex-1">
                                                                        <button 
                                                                            onClick={() => {
                                                                                setLibraryTarget(`fill-${idx}`);
                                                                                setIsMainLibraryOpen(true);
                                                                            }}
                                                                            className="w-full px-2 py-1.5 bg-gray-50 hover:bg-white border border-gray-100 hover:border-primary/20 text-gray-600 rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[14px] text-primary">photo_library</span>
                                                                            Library
                                                                        </button>
                                                                    </div>
                                                        </div>
                                                        
                                                        <div className="flex bg-gray-200/50 rounded-lg p-0.5">
                                                            {(['stretch', 'cover', 'contain', 'tile'] as const).map(m => (
                                                                <button
                                                                    key={m}
                                                                    onClick={() => {
                                                                        const newFills = [...localValues['fills']];
                                                                        const updates: any = { imageMode: m };
                                                                        if (m !== 'cover') {
                                                                            updates.imagePosX = 50;
                                                                            updates.imagePosY = 50;
                                                                        }
                                                                        newFills[idx] = { ...fill, ...updates };
                                                                        handleUpdateFills(newFills);
                                                                    }}
                                                                    className={`flex-1 py-1 rounded text-[8px] font-black uppercase tracking-tighter transition-all ${fill.imageMode === m || (!fill.imageMode && m === 'cover') ? 'bg-white text-primary shadow-xs' : 'text-gray-400 hover:text-gray-600'}`}
                                                                >
                                                                    {m === 'stretch' ? 'Fill' : m}
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {(fill.imageMode === 'cover' || (!fill.imageMode)) && (
                                                            <div className="flex flex-col gap-1 mt-1">
                                                                <div className="flex items-center justify-end pr-1">
                                                                    <button 
                                                                        onClick={() => {
                                                                            const newFills = [...localValues['fills']];
                                                                            newFills[idx] = { ...fill, imagePosX: 50, imagePosY: 50 };
                                                                            handleUpdateFills(newFills);
                                                                        }}
                                                                        className="text-[8px] font-bold text-gray-400 hover:text-primary transition-colors uppercase tracking-tight flex items-center gap-0.5"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[10px]">restart_alt</span>
                                                                        Reset Pos
                                                                    </button>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                                                                            <span className="material-symbols-outlined text-[14px]">align_horizontal_center</span>
                                                                            X (%)
                                                                        </label>
                                                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                                                                            <input 
                                                                                type="number" 
                                                                                value={fill.imagePosX ?? 50}
                                                                                onChange={(e) => {
                                                                                    const newFills = [...localValues['fills']];
                                                                                    newFills[idx] = { ...fill, imagePosX: parseInt(e.target.value) || 0 };
                                                                                    handleUpdateFills(newFills);
                                                                                }}
                                                                                className="flex-1 w-full text-xs font-medium px-3 h-9 bg-transparent outline-none appearance-none"
                                                                            />
                                                                             <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                                                 <button 
                                                                                     type="button"
                                                                                     tabIndex={-1}
                                                                                     onClick={() => {
                                                                                         const newFills = [...localValues['fills']];
                                                                                         newFills[idx] = { ...fill, imagePosX: (fill.imagePosX ?? 50) + 1 };
                                                                                         handleUpdateFills(newFills);
                                                                                     }}
                                                                                     className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                                                 >
                                                                                     <span className="material-symbols-outlined text-[12px] leading-none">expand_less</span>
                                                                                 </button>
                                                                                 <button 
                                                                                     type="button"
                                                                                     tabIndex={-1}
                                                                                     onClick={() => {
                                                                                         const newFills = [...localValues['fills']];
                                                                                         newFills[idx] = { ...fill, imagePosX: (fill.imagePosX ?? 50) - 1 };
                                                                                         handleUpdateFills(newFills);
                                                                                     }}
                                                                                     className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                                                 >
                                                                                     <span className="material-symbols-outlined text-[12px] leading-none">expand_more</span>
                                                                                 </button>
                                                                             </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex flex-col gap-1.5">
                                                                        <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 whitespace-nowrap">
                                                                            <span className="material-symbols-outlined text-[14px]">align_vertical_center</span>
                                                                            Y (%)
                                                                        </label>
                                                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                                                                            <input 
                                                                                type="number" 
                                                                                value={fill.imagePosY ?? 50}
                                                                                onChange={(e) => {
                                                                                    const newFills = [...localValues['fills']];
                                                                                    newFills[idx] = { ...fill, imagePosY: parseInt(e.target.value) || 0 };
                                                                                    handleUpdateFills(newFills);
                                                                                }}
                                                                                className="flex-1 w-full text-xs font-medium px-3 h-9 bg-transparent outline-none appearance-none"
                                                                            />
                                                                             <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                                                 <button 
                                                                                     type="button"
                                                                                     tabIndex={-1}
                                                                                     onClick={() => {
                                                                                         const newFills = [...localValues['fills']];
                                                                                         newFills[idx] = { ...fill, imagePosY: (fill.imagePosY ?? 50) + 1 };
                                                                                         handleUpdateFills(newFills);
                                                                                     }}
                                                                                     className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                                                 >
                                                                                     <span className="material-symbols-outlined text-[12px] leading-none">expand_less</span>
                                                                                 </button>
                                                                                 <button 
                                                                                     type="button"
                                                                                     tabIndex={-1}
                                                                                     onClick={() => {
                                                                                         const newFills = [...localValues['fills']];
                                                                                         newFills[idx] = { ...fill, imagePosY: (fill.imagePosY ?? 50) - 1 };
                                                                                         handleUpdateFills(newFills);
                                                                                     }}
                                                                                     className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                                                 >
                                                                                     <span className="material-symbols-outlined text-[12px] leading-none">expand_more</span>
                                                                                 </button>
                                                                             </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-1.5 px-1 mt-1">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Intensity / Opacity</label>
                                                        <span className="text-[9px] font-black text-primary">{Math.round((fill.opacity ?? 1) * 100)}%</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="range" min="0" max="1" step="0.01"
                                                            value={fill.opacity ?? 1}
                                                            onChange={(e) => {
                                                                const newFills = [...localValues['fills']];
                                                                newFills[idx] = { ...fill, opacity: parseFloat(e.target.value) };
                                                                handleUpdateFills(newFills);
                                                            }}
                                                            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Radius Section */}
                    <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/radius">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-[16px] text-primary">rounded_corner</span>
                                Radius
                            </label>
                            <button 
                                onClick={() => {
                                    if (!showIndependentCorners) {
                                        selectedLayers.forEach(l => {
                                            try {
                                                const meta = JSON.parse(l.variant || '{}');
                                                const currentRadius = meta.borderRadius ?? 0;
                                                meta.borderRadiusTopLeft = meta.borderRadiusTopLeft ?? currentRadius;
                                                meta.borderRadiusTopRight = meta.borderRadiusTopRight ?? currentRadius;
                                                meta.borderRadiusBottomRight = meta.borderRadiusBottomRight ?? currentRadius;
                                                meta.borderRadiusBottomLeft = meta.borderRadiusBottomLeft ?? currentRadius;
                                                onUpdateLayers([l.id], { variant: JSON.stringify(meta) }, true);
                                            } catch (e) {}
                                        });
                                        setShowIndependentCorners(true);
                                    } else {
                                        setShowIndependentCorners(false);
                                        selectedLayers.forEach(l => {
                                            try {
                                                const meta = JSON.parse(l.variant || '{}');
                                                delete meta.borderRadiusTopLeft;
                                                delete meta.borderRadiusTopRight;
                                                delete meta.borderRadiusBottomRight;
                                                delete meta.borderRadiusBottomLeft;
                                                onUpdateLayers([l.id], { variant: JSON.stringify(meta) });
                                            } catch (e) {}
                                        });
                                        setLocalValues(prev => {
                                            const next = { ...prev };
                                            delete next.borderRadiusTopLeft;
                                            delete next.borderRadiusTopRight;
                                            delete next.borderRadiusBottomRight;
                                            delete next.borderRadiusBottomLeft;
                                            return next;
                                        });
                                    }
                                }}
                                className={`p-1 rounded-lg hover:bg-gray-100 transition-colors ${showIndependentCorners ? 'text-primary bg-primary/5' : 'text-gray-400'}`}
                                title={showIndependentCorners ? "Uniform Radius" : "Independent Corners"}
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {showIndependentCorners ? 'crop_square' : 'crop_free'}
                                </span>
                            </button>
                        </div>

                        {!showIndependentCorners ? (
                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9 transition-all">
                                <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">R</span>
                                <input
                                    type="text"
                                    className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none"
                                    value={localValues['borderRadius'] || '0'}
                                    onChange={(e) => handleInputChange('borderRadius', e.target.value)}
                                    onBlur={() => handleInputBlur('borderRadius')}
                                    onKeyDown={(e) => handleKeyDown(e, 'borderRadius')}
                                />
                                <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                    <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadius', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                    <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadius', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
                                {/* TL */}
                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9 transition-all">
                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">TL</span>
                                    <input 
                                        type="text" 
                                        className="flex-1 w-full text-xs font-bold pl-8 pr-1 h-full bg-transparent outline-none" 
                                        placeholder="0"
                                        value={localValues['borderRadiusTopLeft'] || localValues['borderRadius'] || '0'}
                                        onChange={(e) => handleInputChange('borderRadiusTopLeft', e.target.value)}
                                        onBlur={() => handleInputBlur('borderRadiusTopLeft')}
                                        onKeyDown={(e) => handleKeyDown(e, 'borderRadiusTopLeft')}
                                    />
                                    <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusTopLeft', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusTopLeft', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                    </div>
                                </div>
                                {/* TR */}
                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9 transition-all">
                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">TR</span>
                                    <input 
                                        type="text" 
                                        className="flex-1 w-full text-xs font-bold pl-8 pr-1 h-full bg-transparent outline-none" 
                                        placeholder="0"
                                        value={localValues['borderRadiusTopRight'] || localValues['borderRadius'] || '0'}
                                        onChange={(e) => handleInputChange('borderRadiusTopRight', e.target.value)}
                                        onBlur={() => handleInputBlur('borderRadiusTopRight')}
                                        onKeyDown={(e) => handleKeyDown(e, 'borderRadiusTopRight')}
                                    />
                                    <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusTopRight', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusTopRight', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                    </div>
                                </div>
                                {/* BL */}
                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9 transition-all">
                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">BL</span>
                                    <input 
                                        type="text" 
                                        className="flex-1 w-full text-xs font-bold pl-8 pr-1 h-full bg-transparent outline-none" 
                                        placeholder="0"
                                        value={localValues['borderRadiusBottomLeft'] || localValues['borderRadius'] || '0'}
                                        onChange={(e) => handleInputChange('borderRadiusBottomLeft', e.target.value)}
                                        onBlur={() => handleInputBlur('borderRadiusBottomLeft')}
                                        onKeyDown={(e) => handleKeyDown(e, 'borderRadiusBottomLeft')}
                                    />
                                    <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusBottomLeft', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusBottomLeft', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                    </div>
                                </div>
                                {/* BR */}
                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9 transition-all">
                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">BR</span>
                                    <input 
                                        type="text" 
                                        className="flex-1 w-full text-xs font-bold pl-8 pr-1 h-full bg-transparent outline-none" 
                                        placeholder="0"
                                        value={localValues['borderRadiusBottomRight'] || localValues['borderRadius'] || '0'}
                                        onChange={(e) => handleInputChange('borderRadiusBottomRight', e.target.value)}
                                        onBlur={() => handleInputBlur('borderRadiusBottomRight')}
                                        onKeyDown={(e) => handleKeyDown(e, 'borderRadiusBottomRight')}
                                    />
                                    <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusBottomRight', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                        <button type="button" tabIndex={-1} onClick={() => handleStep('borderRadiusBottomRight', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-px bg-gray-100 my-2" />

                {/* Border Settings */}
                {!selectedLayers.some(l => {
                    try {
                        const m = JSON.parse(l.variant || '{}');
                        return l.type === 'shape' && m.shapeType === 'line';
                    } catch (e) { return false; }
                }) && (
                    <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/border">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-[16px] text-primary">border_all</span>
                                Border
                            </label>
                            <button 
                                onClick={() => {
                                    if (!showIndependentBorders) {
                                        selectedLayers.forEach(l => {
                                            try {
                                                const meta = JSON.parse(l.variant || '{}');
                                                const currentWidth = meta.borderWidth ?? 0;
                                                meta.borderTopWidth = meta.borderTopWidth ?? currentWidth;
                                                meta.borderRightWidth = meta.borderRightWidth ?? currentWidth;
                                                meta.borderBottomWidth = meta.borderBottomWidth ?? currentWidth;
                                                meta.borderLeftWidth = meta.borderLeftWidth ?? currentWidth;
                                                onUpdateLayers([l.id], { variant: JSON.stringify(meta) }, true);
                                            } catch (e) {}
                                        });
                                    } else {
                                        selectedLayers.forEach(l => {
                                            try {
                                                const meta = JSON.parse(l.variant || '{}');
                                                delete meta.borderTopWidth;
                                                delete meta.borderRightWidth;
                                                delete meta.borderBottomWidth;
                                                delete meta.borderLeftWidth;
                                                onUpdateLayers([l.id], { variant: JSON.stringify(meta) }, true);
                                            } catch (e) {}
                                        });
                                    }
                                    setShowIndependentBorders(!showIndependentBorders);
                                }}
                                className={`p-1 rounded hover:bg-gray-100 transition-colors ${showIndependentBorders ? 'text-primary bg-primary/5' : 'text-gray-400'}`}
                                title="Independent Borders"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {showIndependentBorders ? 'border_inner' : 'border_outer'}
                                </span>
                            </button>
                        </div>
                        
                        <div className="flex flex-col gap-3 p-3 bg-gray-50/50 border border-gray-100 rounded-2xl">
                            {!showIndependentBorders ? (
                                <div className="grid grid-cols-[40%_60%] gap-3">
                                    {/* Border Width */}
                                    <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary h-9">
                                        <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">W</span>
                                        <input 
                                            type="text"
                                            className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                            placeholder="0"
                                            value={localValues['borderWidth'] || '0'}
                                            onChange={(e) => handleInputChange('borderWidth', e.target.value)}
                                            onBlur={() => handleInputBlur('borderWidth')}
                                            onKeyDown={(e) => handleKeyDown(e, 'borderWidth')}
                                        />
                                        <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                            <button type="button" tabIndex={-1} onClick={() => handleStep('borderWidth', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                            <button type="button" tabIndex={-1} onClick={() => handleStep('borderWidth', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                        </div>
                                    </div>
                                    {/* Border Style */}
                                    <BorderStyleSelector 
                                        value={localValues['borderStyle'] || 'solid'}
                                        onChange={(value) => {
                                            handleInputChange('borderStyle', value);
                                            triggerUpdate('borderStyle', value);
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        {/* Top */}
                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg focus-within:border-primary h-9">
                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">T</span>
                                            <input 
                                                type="text" 
                                                className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                value={localValues['borderTopWidth'] || localValues['borderWidth'] || '0'}
                                                onChange={(e) => handleInputChange('borderTopWidth', e.target.value)}
                                                onBlur={() => handleInputBlur('borderTopWidth')}
                                                onKeyDown={(e) => handleKeyDown(e, 'borderTopWidth')}
                                            />
                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderTopWidth', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderTopWidth', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                            </div>
                                        </div>
                                        {/* Left */}
                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg focus-within:border-primary h-9">
                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">L</span>
                                            <input 
                                                type="text" 
                                                className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                value={localValues['borderLeftWidth'] || localValues['borderWidth'] || '0'}
                                                onChange={(e) => handleInputChange('borderLeftWidth', e.target.value)}
                                                onBlur={() => handleInputBlur('borderLeftWidth')}
                                                onKeyDown={(e) => handleKeyDown(e, 'borderLeftWidth')}
                                            />
                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderLeftWidth', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderLeftWidth', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                            </div>
                                        </div>
                                        {/* Bottom */}
                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg focus-within:border-primary h-9">
                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">B</span>
                                            <input 
                                                type="text" 
                                                className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                value={localValues['borderBottomWidth'] || localValues['borderWidth'] || '0'}
                                                onChange={(e) => handleInputChange('borderBottomWidth', e.target.value)}
                                                onBlur={() => handleInputBlur('borderBottomWidth')}
                                                onKeyDown={(e) => handleKeyDown(e, 'borderBottomWidth')}
                                            />
                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderBottomWidth', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderBottomWidth', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                            </div>
                                        </div>
                                        {/* Right */}
                                        <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg focus-within:border-primary h-9">
                                            <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold">R</span>
                                            <input 
                                                type="text" 
                                                className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none" 
                                                value={localValues['borderRightWidth'] || localValues['borderWidth'] || '0'}
                                                onChange={(e) => handleInputChange('borderRightWidth', e.target.value)}
                                                onBlur={() => handleInputBlur('borderRightWidth')}
                                                onKeyDown={(e) => handleKeyDown(e, 'borderRightWidth')}
                                            />
                                            <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderRightWidth', 1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_less</span></button>
                                                <button type="button" tabIndex={-1} onClick={() => handleStep('borderRightWidth', -1)} className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"><span className="material-symbols-outlined text-[12px] leading-none">expand_more</span></button>
                                            </div>
                                        </div>
                                    </div>
                                    <BorderStyleSelector 
                                        value={localValues['borderStyle'] || 'solid'}
                                        onChange={(value) => {
                                            handleInputChange('borderStyle', value);
                                            triggerUpdate('borderStyle', value);
                                        }}
                                    />
                                </div>
                            )}
                            {/* Border Color */}
                            <ColorPicker 
                                label="Border Color"
                                value={localValues['borderColor'] || '#000000'}
                                onChange={(val) => {
                                    handleInputChange('borderColor', val);
                                    triggerUpdate('borderColor', val);
                                }}
                                swatches={documentColors}
                            />
                        </div>
                    </div>
                )}

                <div className="h-px bg-gray-100 my-2" />

                {/* Visual Effects Section */}
                <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/effects">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[16px] text-primary">blur_on</span>
                            Visual Effects
                        </label>
                        <div className="relative group/add">
                            <button className="p-1 px-2 rounded hover:bg-gray-100 text-primary transition-colors flex items-center gap-1">
                                <span className="material-symbols-outlined text-[18px]">add</span>
                                <span className="text-[9px] font-bold">ADD</span>
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all">
                                {[
                                    { id: 'blur', label: 'Blur', icon: 'blur_on' },
                                    { id: 'dropShadow', label: 'Drop Shadow', icon: 'shadow' },
                                    { id: 'innerShadow', label: 'Inner Shadow', icon: 'layers' },
                                    { id: 'textShadow', label: 'Text Shadow', icon: 'text_fields' },
                                    { id: 'brightness', label: 'Brightness', icon: 'light_mode' },
                                    { id: 'contrast', label: 'Contrast', icon: 'contrast' },
                                    { id: 'grayscale', label: 'Grayscale', icon: 'gradient' },
                                    { id: 'hueRotate', label: 'Hue Rotate', icon: 'rotate_right' },
                                    { id: 'invert', label: 'Invert', icon: 'invert_colors' },
                                    { id: 'saturate', label: 'Saturate', icon: 'water_drop' },
                                    { id: 'sepia', label: 'Sepia', icon: 'filter_vintage' },
                                ].map(fx => (
                                    <button 
                                        key={fx.id}
                                        onClick={() => handleAddEffect(fx.id)}
                                        className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-gray-50 text-[10px] font-bold text-gray-600 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[14px] text-gray-400">{fx.icon}</span>
                                        {fx.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        {Array.isArray(localValues['effects']) && localValues['effects'].map((fx: any, idx: number) => (
                            <div key={fx.id} className="flex flex-col gap-2 p-3 bg-gray-50/50 border border-gray-100 rounded-xl group/fx">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => {
                                                const newEffects = [...localValues['effects']];
                                                newEffects[idx] = { ...fx, active: !fx.active };
                                                handleUpdateEffects(newEffects);
                                            }}
                                            className={`size-5 rounded flex items-center justify-center transition-colors ${fx.active ? 'text-primary bg-primary/10' : 'text-gray-400 bg-gray-100'}`}
                                        >
                                            <span className="material-symbols-outlined text-[14px]">{fx.active ? 'visibility' : 'visibility_off'}</span>
                                        </button>
                                        <span className="text-[10px] font-bold text-gray-700 capitalize">{fx.type.replace(/([A-Z])/g, ' $1')}</span>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            const newEffects = localValues['effects'].filter((_: any, i: number) => i !== idx);
                                            handleUpdateEffects(newEffects);
                                        }}
                                        className="size-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">delete</span>
                                    </button>
                                </div>

                                {['dropShadow', 'innerShadow', 'textShadow'].includes(fx.type) ? (
                                    <div className="grid grid-cols-2 gap-2 mt-1">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[8px] text-gray-400 font-bold uppercase pl-1">X / Y</label>
                                            <div className="grid grid-cols-2 gap-1 h-7">
                                                <input 
                                                    type="number" 
                                                    className="w-full h-full bg-white border border-gray-100 rounded text-[10px] text-center font-bold outline-none focus:border-primary"
                                                    value={fx.x} 
                                                    onChange={(e) => {
                                                        const newEffects = [...localValues['effects']];
                                                        newEffects[idx] = { ...fx, x: parseInt(e.target.value) || 0 };
                                                        handleUpdateEffects(newEffects);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        const delta = e.shiftKey ? 10 : 1;
                                                        if (e.key === 'ArrowUp') { e.preventDefault(); const newEffects = [...localValues['effects']]; newEffects[idx] = { ...fx, x: (Number(fx.x) || 0) + delta }; handleUpdateEffects(newEffects); }
                                                        if (e.key === 'ArrowDown') { e.preventDefault(); const newEffects = [...localValues['effects']]; newEffects[idx] = { ...fx, x: (Number(fx.x) || 0) - delta }; handleUpdateEffects(newEffects); }
                                                    }}
                                                />
                                                <input 
                                                    type="number" 
                                                    className="w-full h-full bg-white border border-gray-100 rounded text-[10px] text-center font-bold outline-none focus:border-primary"
                                                    value={fx.y} 
                                                    onChange={(e) => {
                                                        const newEffects = [...localValues['effects']];
                                                        newEffects[idx] = { ...fx, y: parseInt(e.target.value) || 0 };
                                                        handleUpdateEffects(newEffects);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        const delta = e.shiftKey ? 10 : 1;
                                                        if (e.key === 'ArrowUp') { e.preventDefault(); const newEffects = [...localValues['effects']]; newEffects[idx] = { ...fx, y: (Number(fx.y) || 0) + delta }; handleUpdateEffects(newEffects); }
                                                        if (e.key === 'ArrowDown') { e.preventDefault(); const newEffects = [...localValues['effects']]; newEffects[idx] = { ...fx, y: (Number(fx.y) || 0) - delta }; handleUpdateEffects(newEffects); }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[8px] text-gray-400 font-bold uppercase pl-1">Blur / Spread</label>
                                            <div className="grid grid-cols-2 gap-1 h-7">
                                                <input 
                                                    type="number" 
                                                    className="w-full h-full bg-white border border-gray-100 rounded text-[10px] text-center font-bold outline-none focus:border-primary"
                                                    value={fx.blur} 
                                                    onChange={(e) => {
                                                        const newEffects = [...localValues['effects']];
                                                        newEffects[idx] = { ...fx, blur: parseInt(e.target.value) || 0 };
                                                        handleUpdateEffects(newEffects);
                                                    }}
                                                />
                                                <input 
                                                    type="number" 
                                                    className="w-full h-full bg-white border border-gray-100 rounded text-[10px] text-center font-bold outline-none focus:border-primary"
                                                    value={fx.spread} 
                                                    onChange={(e) => {
                                                        const newEffects = [...localValues['effects']];
                                                        newEffects[idx] = { ...fx, spread: parseInt(e.target.value) || 0 };
                                                        handleUpdateEffects(newEffects);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 col-span-2 mt-1 px-1">
                                            <ColorPicker 
                                                variant="minimal"
                                                value={fx.color}
                                                onChange={(val) => {
                                                    const newEffects = [...localValues['effects']];
                                                    newEffects[idx] = { ...fx, color: val };
                                                    handleUpdateEffects(newEffects);
                                                }}
                                                swatches={documentColors}
                                            />
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Shadow Color</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-1 mt-1">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[8px] text-gray-400 font-bold uppercase">Value</span>
                                            <span className="text-[9px] text-gray-600 font-bold">
                                                {fx.value}{fx.type === 'blur' ? 'px' : fx.type === 'hueRotate' ? 'deg' : '%'}
                                            </span>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="range" 
                                                min={fx.type === 'hueRotate' ? 0 : 0} 
                                                max={['brightness', 'contrast', 'saturate'].includes(fx.type) ? 300 : (fx.type === 'hueRotate' ? 360 : 100)} 
                                                value={fx.value}
                                                onChange={(e) => {
                                                    const newEffects = [...localValues['effects']];
                                                    newEffects[idx] = { ...fx, value: parseInt(e.target.value) };
                                                    handleUpdateEffects(newEffects);
                                                }}
                                                className="flex-1 h-1 accent-primary appearance-none cursor-pointer bg-gray-200 rounded-lg"
                                            />
                                            <input 
                                                type="number" 
                                                className="w-10 h-6 bg-white border border-gray-100 rounded text-[10px] text-center font-bold outline-none focus:border-primary"
                                                value={fx.value}
                                                onChange={(e) => {
                                                    const newEffects = [...localValues['effects']];
                                                    newEffects[idx] = { ...fx, value: parseInt(e.target.value) || 0 };
                                                    handleUpdateEffects(newEffects);
                                                }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Group Auto Layout Settings */}
                {selectedLayers.length === 1 && selectedLayers[0].type === 'group' && (() => {
                    let meta: any = { 
                        layoutMode: 'fixed',
                        flexDirection: 'row',
                        gap: 0,
                        padding: 0,
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                        flexWrap: 'nowrap',
                        layoutSizingHorizontal: 'fixed',
                        layoutSizingVertical: 'fixed',
                        bgType: 'none',
                        colorCode: 'transparent'
                    };
                    try {
                        meta = { ...meta, ...JSON.parse(selectedLayers[0].variant || '{}') };
                    } catch (e) {}

                    const updateMeta = (keyOrUpdates: string | Record<string, any>, value?: any) => {
                        let updates: Record<string, any> = {};
                        if (typeof keyOrUpdates === 'string') {
                            updates[keyOrUpdates] = value;
                        } else {
                            updates = keyOrUpdates;
                        }

                        const newMeta = { ...meta, ...updates };
                        onUpdateLayers(selectedLayerIds, { variant: JSON.stringify(newMeta) });

                        // FIX: If group sizing is set to 'hug', children cannot be 'fill' on that axis.
                        Object.entries(updates).forEach(([key, val]) => {
                            if (val === 'hug') {
                                const group = selectedLayers[0];
                                if (group && group.children) {
                                    group.children.forEach(child => {
                                        try {
                                            const cMeta = JSON.parse(child.variant || '{}');
                                            let changed = false;
                                            if (key === 'layoutSizingHorizontal' && cMeta.layoutSizingInGroupWidth === 'fill') {
                                                cMeta.layoutSizingInGroupWidth = 'fixed';
                                                changed = true;
                                            }
                                            if (key === 'layoutSizingVertical' && cMeta.layoutSizingInGroupHeight === 'fill') {
                                                cMeta.layoutSizingInGroupHeight = 'fixed';
                                                changed = true;
                                            }
                                            if (changed) {
                                                onUpdateLayers([child.id], { variant: JSON.stringify(cMeta) });
                                            }
                                        } catch (e) {}
                                    });
                                }
                            }
                        });
                    };

                    const isAuto = meta.layoutMode === 'auto';

                    return (
                        <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/autolayout">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-[16px] text-primary">view_agenda</span>
                                    Auto layout
                                </label>
                                <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                                    <button 
                                        onClick={() => {
                                            if (meta.layoutMode === 'auto') {
                                                const group = selectedLayers[0];
                                                const children = group?.children || [];
                                                onUpdateLayers(selectedLayerIds, { 
                                                    variant: JSON.stringify({ ...meta, layoutMode: 'fixed' }),
                                                    children: [...children].reverse()
                                                });
                                            } else {
                                                updateMeta('layoutMode', 'fixed');
                                            }
                                        }}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${!isAuto ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        title="Frame without auto layout"
                                    >
                                        Off
                                    </button>
                                    <button 
                                        onClick={() => {
                                            if (meta.layoutMode === 'auto') return;
                                            const group = selectedLayers[0];
                                            const children = group?.children || [];
                                            let computedGap = 0;
                                            if (children.length >= 2) {
                                                const isColumn = (meta.flexDirection || 'row') === 'column';
                                                if (isColumn) {
                                                    const sorted = [...children].sort((a: any, b: any) => (a.y || 0) - (b.y || 0));
                                                    let totalGap = 0;
                                                    for (let i = 0; i < sorted.length - 1; i++) {
                                                        const cur = sorted[i];
                                                        const next = sorted[i + 1];
                                                        const curBottom = (Number(cur.y) || 0) + (Number(cur.height) || 0);
                                                        totalGap += (Number(next.y) || 0) - curBottom;
                                                    }
                                                    computedGap = Math.max(0, Math.round(totalGap / (sorted.length - 1)));
                                                } else {
                                                    const sorted = [...children].sort((a: any, b: any) => (a.x || 0) - (b.x || 0));
                                                    let totalGap = 0;
                                                    for (let i = 0; i < sorted.length - 1; i++) {
                                                        const cur = sorted[i];
                                                        const next = sorted[i + 1];
                                                        const curRight = (Number(cur.x) || 0) + (Number(cur.width) || 0);
                                                        totalGap += (Number(next.x) || 0) - curRight;
                                                    }
                                                    computedGap = Math.max(0, Math.round(totalGap / (sorted.length - 1)));
                                                }
                                            }
                                            // Reorder children to put Topmost element first in flex
                                            const reversedChildren = [...children].reverse();
                                            const newMeta = { ...meta, layoutMode: 'auto', gap: computedGap };
                                            onUpdateLayers(selectedLayerIds, { 
                                                variant: JSON.stringify(newMeta),
                                                children: reversedChildren
                                            });
                                        }}
                                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isAuto ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        title="Add auto layout (Figma-style)"
                                    >
                                        On
                                    </button>
                                </div>
                            </div>

                                {isAuto && (
                                    <div className="flex flex-col gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
                                        {/* Flow (Figma: direction) */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-[16px] text-primary">move_down</span>
                                                Flow
                                            </label>
                                            <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200/50">
                                                <button 
                                                    onClick={() => updateMeta('flexDirection', 'row')}
                                                    className={`flex-1 h-8 flex items-center justify-center gap-1 rounded-lg transition-all ${meta.flexDirection === 'row' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                    title="Horizontal"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">arrow_right_alt</span>
                                                    <span className="text-[10px] font-bold hidden sm:inline">Horizontal</span>
                                                </button>
                                                <div className="w-px bg-gray-200 my-1"></div>
                                                <button 
                                                    onClick={() => updateMeta('flexDirection', 'column')}
                                                    className={`flex-1 h-8 flex items-center justify-center gap-1 rounded-lg transition-all ${meta.flexDirection === 'column' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                    title="Vertical"
                                                >
                                                    <span className="material-symbols-outlined text-[18px] rotate-90">arrow_right_alt</span>
                                                    <span className="text-[10px] font-bold hidden sm:inline">Vertical</span>
                                                </button>
                                                <div className="w-px bg-gray-200 my-1"></div>
                                                <button 
                                                    onClick={() => {
                                                        const nextWrap = meta.flexWrap === 'wrap' ? 'nowrap' : 'wrap';
                                                        if (nextWrap === 'wrap') {
                                                            // Wrap seçilince diğer seçimler kalksın: gap auto ve alignment
                                                            const newMeta = { ...meta, flexWrap: 'wrap', gap: 0, justifyContent: 'flex-start', alignItems: 'flex-start', alignContent: 'flex-start' };
                                                            onUpdateLayers(selectedLayerIds, { variant: JSON.stringify(newMeta) });
                                                        } else {
                                                            updateMeta('flexWrap', 'nowrap');
                                                        }
                                                    }}
                                                    className={`flex-1 h-8 flex items-center justify-center rounded-lg transition-all ${meta.flexWrap === 'wrap' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                    title="Wrap"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">wrap_text</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Resizing (Figma: Hug contents / Fixed) */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-[16px] text-primary">aspect_ratio</span>
                                                Resizing
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all h-8">
                                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold select-none h-full flex items-center">W</span>
                                                    <select
                                                        className="flex-1 w-full text-[11px] font-medium pl-6 pr-6 h-full bg-transparent outline-none cursor-pointer appearance-none text-gray-700 py-0 leading-[30px] m-0"
                                                        value={meta.layoutSizingHorizontal || 'fixed'}
                                                        onChange={(e) => updateMeta('layoutSizingHorizontal', e.target.value)}
                                                    >
                                                        <option value="fixed">Fixed</option>
                                                        <option value="hug">Hug contents</option>
                                                    </select>
                                                    <div className="absolute right-2 pointer-events-none text-gray-400 flex items-center h-full">
                                                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                                    </div>
                                                </div>
                                                <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all h-8">
                                                    <span className="absolute left-2 text-[10px] text-gray-400 pointer-events-none font-bold select-none h-full flex items-center">H</span>
                                                    <select
                                                        className="flex-1 w-full text-[11px] font-medium pl-6 pr-6 h-full bg-transparent outline-none cursor-pointer appearance-none text-gray-700 py-0 leading-[30px] m-0"
                                                        value={meta.layoutSizingVertical || 'fixed'}
                                                        onChange={(e) => updateMeta('layoutSizingVertical', e.target.value)}
                                                    >
                                                        <option value="fixed">Fixed</option>
                                                        <option value="hug">Hug contents</option>
                                                    </select>
                                                    <div className="absolute right-2 pointer-events-none text-gray-400 flex items-center h-full">
                                                        <span className="material-symbols-outlined text-[16px]">expand_more</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-gray-100 my-1"></div>


                                        {/* Gap between items (Figma) */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-[16px] text-primary">space_bar</span>
                                                Gap between items
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 relative group/input flex items-center overflow-visible bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10" title="Distance between objects">
                                                    <div className="absolute left-2 flex items-center justify-center text-gray-400 pointer-events-none">
                                                        <span className="material-symbols-outlined text-[14px]">space_bar</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        className="flex-1 w-full text-xs font-medium pl-8 pr-9 h-8 bg-transparent outline-none min-w-0"
                                                        placeholder="0"
                                                        value={meta.gap === 'auto' ? 'Auto' : (meta.gap ?? '')}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val.toLowerCase() === 'auto') updateMeta('gap', 'auto');
                                                            else updateMeta('gap', Number(val));
                                                        }}
                                                        onKeyDown={(e) => {
                                                            const delta = e.shiftKey ? 10 : 1;
                                                            if(e.key === 'ArrowUp') {
                                                                e.preventDefault();
                                                                const current = meta.gap === 'auto' ? 0 : Number(meta.gap) || 0;
                                                                updateMeta('gap', current + delta);
                                                            }
                                                            if(e.key === 'ArrowDown') {
                                                                e.preventDefault();
                                                                const current = meta.gap === 'auto' ? 0 : Number(meta.gap) || 0;
                                                                updateMeta('gap', Math.max(0, current - delta));
                                                            }
                                                        }}
                                                    />
                                                    <div className="absolute right-0 top-0 bottom-0 w-7 flex flex-col border-l border-gray-200 group-focus-within/input:border-primary/30 bg-white/50 backdrop-blur-sm rounded-r-lg shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const current = meta.gap === 'auto' ? 0 : Number(meta.gap) || 0;
                                                                updateMeta('gap', current + 1);
                                                            }}
                                                            className="flex-1 min-h-[14px] px-0.5 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors rounded-tr-lg"
                                                            tabIndex={-1}
                                                            title="Artır"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px] leading-none">expand_less</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const current = meta.gap === 'auto' ? 0 : Number(meta.gap) || 0;
                                                                updateMeta('gap', Math.max(0, current - 1));
                                                            }}
                                                            className="flex-1 min-h-[14px] px-0.5 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary active:bg-gray-200 transition-colors border-t border-gray-200 rounded-br-lg"
                                                            tabIndex={-1}
                                                            title="Azalt"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px] leading-none">expand_more</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            {meta.gap === 'auto' && (
                                                <span className="text-[9px] text-purple-500 font-bold bg-purple-50 px-1.5 py-0.5 rounded w-fit">Space between</span>
                                            )}
                                        </div>

                                        {/* Alignment (Figma: alignment box) */}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                    <span className="material-symbols-outlined text-[16px] text-primary">grid_view</span>
                                                    Alignment
                                                </label>
                                            </div>
                                            <div className="p-1 bg-gray-50 border border-gray-100 rounded-lg grid grid-cols-3 gap-1 w-full">
                                                {[
                                                    // Visual Grid: [X, Y]
                                                    ['flex-start', 'flex-start'], ['center', 'flex-start'], ['flex-end', 'flex-start'], // Top Row
                                                    ['flex-start', 'center'],     ['center', 'center'],     ['flex-end', 'center'], // Middle Row
                                                    ['flex-start', 'flex-end'],   ['center', 'flex-end'],   ['flex-end', 'flex-end']  // Bottom Row
                                                ].map(([x, y], i) => {
                                                    const isRow = meta.flexDirection !== 'column';
                                                    const targetJustify = isRow ? x : y;
                                                    const targetAlign = isRow ? y : x;
                                                    
                                                    // Check if active (ignore gap='auto' for visual selection if strictly matching)
                                                    // Actually, if gap='auto', justify is ignored by renderer, but we show what WOULD be active if packed.
                                                    const isActive = meta.justifyContent === targetJustify && meta.alignItems === targetAlign && meta.gap !== 'auto';
                                                    
                                                    return (
                                                        <button 
                                                            key={i}
                                                            onClick={() => {
                                                                const updates: any = {};
                                                                if (meta.gap === 'auto') updates.gap = 0;
                                                                updates.justifyContent = targetJustify;
                                                                updates.alignItems = targetAlign;
                                                                updates.alignContent = targetAlign;
                                                                const finalMeta = { ...meta, ...updates };
                                                                onUpdateLayers(selectedLayerIds, { variant: JSON.stringify(finalMeta) });
                                                            }}
                                                            className={`h-8 w-full rounded-lg flex items-center justify-center transition-all ${isActive ? 'bg-white shadow-sm ring-1 ring-primary/20 text-primary' : 'text-gray-300 hover:bg-gray-200 hover:text-gray-500'}`}
                                                        >
                                                            <div className={`size-2 rounded-full ${isActive ? 'bg-primary' : 'bg-current'}`}></div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Texts Management Area */}
                                {(() => {
                                    const textLayers = findAllTextLayers(selectedLayers[0]);
                                    if (textLayers.length === 0) return null;
                                    return (
                                        <div className="flex flex-col">
                                            <div className="h-px bg-gray-100 my-4" />
                                            <div className="flex flex-col gap-4">
                                                <div 
                                                    className="flex items-center justify-between cursor-pointer hover:bg-gray-50/50 p-1 -m-1 rounded-lg transition-colors group" 
                                                    onClick={() => setIsLayerTextsCollapsed(!isLayerTextsCollapsed)}
                                                >
                                                    <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1 cursor-pointer">
                                                        <span className="material-symbols-outlined text-[16px] text-primary">text_fields</span>
                                                        Layer Texts
                                                        <span className="ml-1 text-[8px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200">
                                                            {textLayers.length}
                                                        </span>
                                                    </label>
                                                    <span className={`material-symbols-outlined text-[18px] text-gray-300 group-hover:text-primary transition-all duration-200 ${isLayerTextsCollapsed ? '' : 'rotate-180'}`}>expand_more</span>
                                                </div>
                                                
                                                {!isLayerTextsCollapsed && (
                                                    <div className="space-y-6 animate-in slide-in-from-top-2 fade-in duration-300">
                                                        {textLayers.map(txt => {
                                                            let txtMeta: any = {};
                                                            try { txtMeta = JSON.parse(txt.variant || '{}'); } catch(e){}
                                                            return (
                                                                <div key={txt.id} className="p-2 bg-gray-50/10 rounded-2xl border border-gray-100 space-y-4 hover:border-primary/20 hover:bg-gray-50/50 transition-all group/text-item">
                                                                    <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="material-symbols-outlined text-[14px] text-primary">abc</span>
                                                                            <span className="text-[11px] font-black text-gray-900 truncate max-w-[180px]">{txt.name}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-1 gap-3">
                                                                        <div className="flex flex-col gap-1.5 w-[90%]">
                                                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                                <span className="material-symbols-outlined text-[16px] text-primary">match_case</span>
                                                                                Font Family
                                                                            </label>
                                                                            <FontSelector 
                                                                                hideSearch={surgicalStyles.isSelected}
                                                                                value={txtMeta.fontFamily || 'Inter'}
                                                                                onChange={(val) => {
                                                                                    const currentMeta = JSON.parse(txt.variant || '{}');
                                                                                    const newMeta = { ...currentMeta, fontFamily: val };
                                                                                    onUpdateLayers([txt.id], { variant: JSON.stringify(newMeta) });
                                                                                }}
                                                                                fonts={fonts}
                                                                                className="h-10 bg-white border-gray-100 rounded-xl w-full pl-9 pr-3 text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white relative"
                                                                            />
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-3">
                                                                            <div className="flex flex-col gap-1.5">
                                                                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                                    <span className="material-symbols-outlined text-[16px] text-primary">line_weight</span>
                                                                                    Weight
                                                                                </label>
                                                                                <WeightSelector 
                                                                                    value={txtMeta.fontWeight || '400'}
                                                                                    weights={(() => {
                                                                                        const selectedFont = fonts.find(f => f.family === (txtMeta.fontFamily || 'Inter'));
                                                                                        if (selectedFont?.variants?.length) {
                                                                                            const w = selectedFont.variants.filter(v => /^\d+$/.test(v));
                                                                                            if (w.length > 0) return w;
                                                                                        }
                                                                                        return ['300', '400', '500', '600', '700', '800', '900'];
                                                                                    })()}
                                                                                    onChange={(val) => {
                                                                                        const currentMeta = JSON.parse(txt.variant || '{}');
                                                                                        const newMeta = { ...currentMeta, fontWeight: val };
                                                                                        onUpdateLayers([txt.id], { variant: JSON.stringify(newMeta) });
                                                                                    }}
                                                                                    className="h-10 bg-white border-gray-100 rounded-xl w-full pl-9 pr-3 text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white relative"
                                                                                />
                                                                            </div>
                                                                            <div className="flex flex-col gap-1.5">
                                                                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                                    <span className="material-symbols-outlined text-[16px] text-primary">format_size</span>
                                                                                    Size
                                                                                </label>
                                                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                                                                                    <span className="absolute left-3 text-gray-400 pointer-events-none">
                                                                                        <span className="material-symbols-outlined text-[18px]">format_size</span>
                                                                                    </span>
                                                                                    <input 
                                                                                        type="number"
                                                                                        className="w-full pl-10 pr-6 text-xs font-bold outline-none h-full bg-transparent"
                                                                                        value={txtMeta.fontSize || 16}
                                                                                        onChange={(e) => {
                                                                                            const currentMeta = JSON.parse(txt.variant || '{}');
                                                                                            const newMeta = { ...currentMeta, fontSize: e.target.value };
                                                                                            onUpdateLayers([txt.id], { variant: JSON.stringify(newMeta) });
                                                                                        }}
                                                                                    />
                                                                                    <div className="flex flex-col absolute right-1">
                                                                                        <button 
                                                                                            type="button"
                                                                                            tabIndex={-1}
                                                                                            onClick={() => {
                                                                                                const currentMeta = JSON.parse(txt.variant || '{}');
                                                                                                const newSize = (Number(currentMeta.fontSize) || 16) + 1;
                                                                                                onUpdateLayers([txt.id], { variant: JSON.stringify({ ...currentMeta, fontSize: String(newSize) }) });
                                                                                            }}
                                                                                            className="size-4 flex items-center justify-center text-gray-300 hover:text-primary transition-colors"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[14px]">expand_less</span>
                                                                                        </button>
                                                                                        <button 
                                                                                            type="button"
                                                                                            tabIndex={-1}
                                                                                            onClick={() => {
                                                                                                const currentMeta = JSON.parse(txt.variant || '{}');
                                                                                                const newSize = Math.max(1, (Number(currentMeta.fontSize) || 16) - 1);
                                                                                                onUpdateLayers([txt.id], { variant: JSON.stringify({ ...currentMeta, fontSize: String(newSize) }) });
                                                                                            }}
                                                                                            className="size-4 flex items-center justify-center text-gray-300 hover:text-primary transition-colors"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[14px]">expand_more</span>
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="pt-1">
                                                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                                                <span className="material-symbols-outlined text-[16px] text-primary">palette</span>
                                                                                Text Color
                                                                            </label>
                                                                            <ColorPicker 
                                                                                value={txtMeta.textColor || '#000000'}
                                                                                onChange={(val) => {
                                                                                    const currentMeta = JSON.parse(txt.variant || '{}');
                                                                                    const newMeta = { ...currentMeta, textColor: val };
                                                                                    onUpdateLayers([txt.id], { variant: JSON.stringify(newMeta) });
                                                                                }}
                                                                                swatches={documentColors}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                            {/* Appearance Card */}
                            <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/appearance">
                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-primary">palette</span>
                                        Appearance
                                    </div>
                                    <div className="text-[8px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full border border-blue-100">
                                        GROUP FILL
                                    </div>
                                </label>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="space-y-4 pt-1 border-t border-gray-50/50">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest pl-1">Fill Type</label>
                                            <div className="flex bg-gray-100/50 p-0.5 rounded-xl border border-gray-100 w-full">
                                                {['none', 'solid', 'radial', 'linear'].map(type => (
                                                    <button 
                                                        key={type}
                                                        onClick={() => {
                                                            const updates: any = { bgType: type };
                                                            if (type === 'linear') {
                                                                updates.gradientAngle = 135;
                                                                updates.gradientLength = 141;
                                                                updates.gradientCenterX = 0;
                                                                updates.gradientCenterY = 0;
                                                            } else if (type === 'radial') {
                                                                updates.gradientRadius = 100;
                                                                updates.gradientCenterX = 50;
                                                                updates.gradientCenterY = 50;
                                                            }
                                                            if (type === 'none') updates.colorCode = 'transparent';
                                                            else if (meta.colorCode === 'transparent') updates.colorCode = '#008080';
                                                            updateMeta(updates);
                                                            setLocalValues(prev => ({ ...prev, bgType: type }));
                                                        }}
                                                        className={`flex-1 px-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95 ${meta.bgType === type ? 'bg-white text-primary shadow-sm border border-gray-100/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            <ColorPicker 
                                                label={meta.bgType === 'radial' ? 'Center Color' : meta.bgType === 'linear' ? 'Start Color' : 'Background Color'}
                                                value={meta.bgType === 'none' ? 'transparent' : (meta.colorCode || '#ffffff')}
                                                 onChange={(val) => {
                                                     const updates: any = { colorCode: val };
                                                     const currentBgType = localValues.bgType || meta.bgType;
                                                     if (!currentBgType || currentBgType === 'none') {
                                                         updates.bgType = 'solid';
                                                         setLocalValues(prev => ({ ...prev, bgType: 'solid' }));
                                                     }
                                                     updateMeta(updates);
                                                 }}
                                                swatches={documentColors}
                                            />

                                            {(meta.bgType === 'radial' || meta.bgType === 'linear') && (
                                                <div className="space-y-3">
                                                    <ColorPicker 
                                                        label={meta.bgType === 'radial' ? 'Outer Color' : 'End Color'}
                                                        value={meta.colorCode2 || '#004040'}
                                                        onChange={(val) => updateMeta('colorCode2', val)}
                                                        swatches={documentColors}
                                                    />

                                                    {meta.bgType === 'linear' && (
                                                        <div className="space-y-3 pt-2 border-t border-gray-50">
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Angle</label>
                                                                    <span className="text-[10px] font-black text-primary">{Math.round(meta.gradientAngle ?? 180)}°</span>
                                                                </div>
                                                                <input 
                                                                    type="range" min="0" max="360" step="1" 
                                                                    value={meta.gradientAngle ?? 180}
                                                                    onChange={(e) => updateMeta('gradientAngle', parseInt(e.target.value, 10))}
                                                                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary" 
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Length %</label>
                                                                    <span className="text-[10px] font-black text-primary">{Math.round(meta.gradientLength ?? 100)}%</span>
                                                                </div>
                                                                <input 
                                                                    type="range" min="10" max="500" step="1" 
                                                                    value={meta.gradientLength ?? 100}
                                                                    onChange={(e) => updateMeta('gradientLength', parseInt(e.target.value, 10))}
                                                                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary" 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {meta.bgType === 'radial' && (
                                                        <div className="space-y-3 pt-2 border-t border-gray-50">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Center X%</label>
                                                                    <input 
                                                                        type="number" min="0" max="100" 
                                                                        value={meta.gradientCenterX ?? 50}
                                                                        onChange={(e) => updateMeta('gradientCenterX', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                                                        onKeyDown={(e) => {
                                                                            const delta = e.shiftKey ? 10 : 1;
                                                                            if (e.key === 'ArrowUp') { e.preventDefault(); updateMeta('gradientCenterX', Math.min(100, (Number(meta.gradientCenterX ?? 50)) + delta)); }
                                                                            if (e.key === 'ArrowDown') { e.preventDefault(); updateMeta('gradientCenterX', Math.max(0, (Number(meta.gradientCenterX ?? 50)) - delta)); }
                                                                        }}
                                                                        className="w-full px-2 py-1 text-[11px] font-bold rounded-lg border border-gray-100 bg-gray-50/50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all" 
                                                                    />
                                                                </div>
                                                                <div className="flex flex-col gap-1.5">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Center Y%</label>
                                                                    <input 
                                                                        type="number" min="0" max="100" 
                                                                        value={meta.gradientCenterY ?? 50}
                                                                        onChange={(e) => updateMeta('gradientCenterY', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                                                        onKeyDown={(e) => {
                                                                            const delta = e.shiftKey ? 10 : 1;
                                                                            if (e.key === 'ArrowUp') { e.preventDefault(); updateMeta('gradientCenterY', Math.min(100, (Number(meta.gradientCenterY ?? 50)) + delta)); }
                                                                            if (e.key === 'ArrowDown') { e.preventDefault(); updateMeta('gradientCenterY', Math.max(0, (Number(meta.gradientCenterY ?? 50)) - delta)); }
                                                                        }}
                                                                        className="w-full px-2 py-1 text-[11px] font-bold rounded-lg border border-gray-100 bg-gray-50/50 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all" 
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Radius %</label>
                                                                    <span className="text-[10px] font-black text-primary">{Math.round(meta.gradientRadius ?? 100)}%</span>
                                                                </div>
                                                                <input 
                                                                    type="range" min="10" max="150" step="1" 
                                                                    value={meta.gradientRadius ?? 100}
                                                                    onChange={(e) => updateMeta('gradientRadius', parseInt(e.target.value, 10))}
                                                                    className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary" 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })() as React.ReactNode}

                    {/* Widget Specific Settings */}
                    {selectedLayers.length === 1 && selectedLayers[0].type === 'widget' && (() => {
                        let meta: any = {};
                        try { meta = JSON.parse(selectedLayers[0].variant || '{}'); } catch (e) {}
                        
                        return (
                            <div className="flex flex-col gap-5">
                                {/* Widget Identity Card */}
                                <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/widget-id">
                                    <div className="flex items-center gap-2 text-primary mb-1">
                                        <div className="size-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[20px]">widgets</span>
                                        </div>
                                        <div>
                                            <h4 className="text-[11px] font-bold text-gray-900 leading-none mb-0.5">Widget Component</h4>
                                            <p className="text-[9px] text-gray-400 font-medium">Standard properties</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between pl-1">
                                                <label className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Label</label>
                                                <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">ID: {selectedLayers[0].id.slice(-4).toUpperCase()}</span>
                                            </div>
                                            <input 
                                                type="text"
                                                className="w-full h-9 px-3 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                                                value={meta.label || ''}
                                                onChange={(e) => {
                                                    const newMeta = { ...meta, label: e.target.value };
                                                    onUpdateLayers([selectedLayers[0].id], { variant: JSON.stringify(newMeta) });
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Widget Properties (Variables) */}
                                {meta.properties && meta.properties.length > 0 && (
                                    <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/variables">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">tune</span>
                                            Variables
                                        </label>
                                        
                                        <div className="flex flex-col gap-5">
                                            {meta.properties.map((prop: any) => (
                                                <div key={prop.id} className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-tight pl-1 flex items-center gap-2">
                                                        <div className="size-5 rounded bg-gray-50 flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-[12px] text-primary">
                                                                {prop.type === 'text' ? 'text_fields' : 
                                                                 prop.type === 'number' ? '123' : 
                                                                 prop.type === 'date' ? 'calendar_today' : 
                                                                 prop.type === 'color' ? 'palette' : 
                                                                 prop.type === 'font' ? 'font_download' : 
                                                                 prop.type === 'select' ? 'list' : 'data_object'}
                                                            </span>
                                                        </div>
                                                        {prop.name}
                                                    </label>
                                                    {prop.type === 'select' ? (
                                                        <div className="relative">
                                                            <select 
                                                                className="w-full h-9 px-3 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all appearance-none cursor-pointer pr-8"
                                                                value={prop.value || ''}
                                                                onChange={(e) => {
                                                                    const newProps = meta.properties.map((p: any) => 
                                                                        p.id === prop.id ? { ...p, value: e.target.value } : p
                                                                    );
                                                                    const newMeta = { ...meta, properties: newProps };
                                                                    onUpdateLayers([selectedLayers[0].id], { variant: JSON.stringify(newMeta) });
                                                                }}
                                                            >
                                                                <option value="">Select...</option>
                                                                {prop.options?.map((opt: string) => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                            <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-gray-400 pointer-events-none">expand_more</span>
                                                        </div>
                                                    ) : prop.type === 'color' ? (
                                                        <ColorPicker 
                                                            value={prop.value || '#000000'}
                                                            onChange={(val) => {
                                                                const newProps = meta.properties.map((p: any) => 
                                                                    p.id === prop.id ? { ...p, value: val } : p
                                                                );
                                                                const newMeta = { ...meta, properties: newProps };
                                                                onUpdateLayers([selectedLayers[0].id], { variant: JSON.stringify(newMeta) });
                                                            }}
                                                            swatches={documentColors}
                                                        />
                                                     ) : prop.type === 'font' ? (
                                                        <div className="relative group/font">
                                                            <FontSelector 
                                                                fonts={fonts}
                                                                hideSearch={surgicalStyles.isSelected}
                                                                value={prop.value || ''}
                                                                onMouseDown={(e) => e.stopPropagation()}
                                                                onChange={(value) => {
                                                                    const newProps = meta.properties.map((p: any) => 
                                                                        p.id === prop.id ? { ...p, value: value } : p
                                                                    );
                                                                    const newMeta = { ...meta, properties: newProps };
                                                                    onUpdateLayers([selectedLayers[0].id], { variant: JSON.stringify(newMeta) });
                                                                }}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input 
                                                            type={prop.type === 'number' ? 'number' : prop.type === 'date' ? 'datetime-local' : 'text'}
                                                            className="w-full h-9 px-3 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all"
                                                            value={prop.value || ''}
                                                            onChange={(e) => {
                                                                const newProps = meta.properties.map((p: any) => 
                                                                    p.id === prop.id ? { ...p, value: e.target.value } : p
                                                                );
                                                                const newMeta = { ...meta, properties: newProps };
                                                                onUpdateLayers([selectedLayers[0].id], { variant: JSON.stringify(newMeta) });
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Advanced Code Edit Action */}
                                <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/widget-code">
                                    <button 
                                        onClick={handleOpenWidgetEditor}
                                        className="w-full flex items-center justify-center gap-2 py-3 bg-primary/5 border border-primary/20 text-primary rounded-xl hover:bg-primary hover:text-white transition-all group"
                                    >
                                        <span className="material-symbols-outlined text-[18px] group-hover:rotate-12 transition-transform">code</span>
                                        <span className="text-[11px] font-black uppercase tracking-tight">Edit Widget Code</span>
                                    </button>

                                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                                        <p className="text-[9px] text-blue-600 font-bold flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[14px]">info</span>
                                            PRO TIP
                                        </p>
                                        <p className="text-[9px] text-gray-500 font-medium leading-relaxed">
                                            You can modify the HTML, CSS, and JS of this specific widget instance to create unique behaviors.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Rich Media Editor (Button & Text) */}
                {selectedLayers.length === 1 && (selectedLayers[0].type === 'button' || selectedLayers[0].type === 'text') && (() => {
                    const isTextLayer = selectedLayers[0].type === 'text';
                    let meta = { 
                        label: '', 
                        fontFamily: 'Outfit', 
                        fontWeight: '800', 
                        fontSize: '', 
                        lineHeight: '1.2',
                        letterSpacing: '0',
                        textTransform: 'none',
                        textDecoration: 'none',
                        textAlign: 'center',
                        verticalAlign: 'middle',
                        colorCode: isTextLayer ? 'transparent' : '#008080', 
                        textColor: isTextLayer ? '#121717' : '#ffffff',
                        bgType: isTextLayer ? 'none' : 'solid',
                        effect: 'none',
                        hoverColorCode: '',
                        hoverTextColor: '',
                        activeColorCode: '',
                        activeTextColor: '',
                        hoverFontFamily: '',
                        hoverFontWeight: '',
                        hoverFontSize: '',
                        hoverLineHeight: '',
                        hoverLetterSpacing: '',
                        hoverTextTransform: '',
                        hoverTextDecoration: '',
                        hoverTextAlign: '',
                        hoverVerticalAlign: '',
                        activeFontFamily: '',
                        activeFontWeight: '',
                        activeFontSize: '',
                        activeLineHeight: '',
                        activeLetterSpacing: '',
                        activeTextTransform: '',
                        activeTextDecoration: '',
                        activeTextAlign: '',
                        activeVerticalAlign: '',
                        layoutType: 'none',
                        maxLines: 0,
                        borderWidth: '0',
                        borderColor: '#000000',
                        borderStyle: 'solid',
                        linkUrl: '',
                        textStrokeColor: 'transparent',
                        textStrokeWidth: 0,
                    };
                    try {
                        meta = { ...meta, ...JSON.parse(selectedLayers[0].variant || '{}') };
                    } catch (e) {
                        console.error('Failed to parse variant JSON', e);
                    }

                    const patchLabelHTML = (oldHtml: string, newText: string) => {
                        if (!oldHtml || !oldHtml.includes('<')) return newText;
                        try {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(oldHtml, 'text/html');
                            // Get all top-level elements (likely char spans)
                            const nodes = Array.from(doc.body.childNodes);
                            const spans = nodes.filter(n => n.nodeType === 1) as HTMLElement[];
                            
                            if (spans.length === 0) return newText;

                            let patchedHtml = '';
                            for (let i = 0; i < newText.length; i++) {
                                const char = newText[i];
                                if (spans[i]) {
                                    spans[i].innerText = char;
                                    patchedHtml += spans[i].outerHTML;
                                } else {
                                    // Clone last known element for new characters to preserve styling
                                    const lastSpan = spans[spans.length - 1];
                                    const newSpan = lastSpan ? (lastSpan.cloneNode(true) as HTMLElement) : document.createElement('span');
                                    newSpan.innerText = char;
                                    patchedHtml += newSpan.outerHTML;
                                }
                            }
                            return patchedHtml;
                        } catch (e) {
                            console.error('Failed to patch label HTML:', e);
                            return newText;
                        }
                    };

                    const stripInlineStyles = (html: string, changedProps: string[]) => {
                        if (!html || !html.includes('<')) return html;
                        try {
                            const tmp = document.createElement('div');
                            tmp.innerHTML = html;
                            
                            const tags = tmp.querySelectorAll('span, font, b, i, u, strike, s');
                            if (tags.length === 0) return html;
                            
                            tags.forEach(el => {
                                const htmlEl = el as HTMLElement;
                                changedProps.forEach(prop => {
                                    if (prop === 'textColor' || prop === 'textBgType' || prop === 'textStops' || prop.startsWith('textGradient')) { 
                                        htmlEl.style.color = ''; 
                                        htmlEl.style.backgroundImage = '';
                                        htmlEl.style.webkitBackgroundClip = '';
                                        (htmlEl.style as any).webkitTextFillColor = '';
                                        htmlEl.removeAttribute('color'); 
                                    }
                                    if (prop === 'fontFamily') { htmlEl.style.fontFamily = ''; htmlEl.removeAttribute('face'); }
                                    if (prop === 'fontWeight') { htmlEl.style.fontWeight = ''; if (htmlEl.tagName.toLowerCase() === 'b') { const bg = htmlEl.style.backgroundColor; const span = document.createElement('span'); span.innerHTML = htmlEl.innerHTML; if(bg) span.style.backgroundColor = bg; htmlEl.replaceWith(span); } }
                                    if (prop === 'fontStyle') htmlEl.style.fontStyle = '';
                                    if (prop === 'fontSize') { htmlEl.style.fontSize = ''; htmlEl.removeAttribute('size'); }
                                    if (prop === 'lineHeight') htmlEl.style.lineHeight = '';
                                    if (prop === 'letterSpacing') htmlEl.style.letterSpacing = '';
                                    if (prop === 'textTransform') htmlEl.style.textTransform = '';
                                    if (prop === 'textDecoration') { htmlEl.style.textDecoration = ''; if (['u', 'strike', 's'].includes(htmlEl.tagName.toLowerCase())) { const span = document.createElement('span'); span.innerHTML = htmlEl.innerHTML; htmlEl.replaceWith(span); } }
                                });
                                
                                if (htmlEl.tagName.toLowerCase() === 'span' && (htmlEl.getAttribute('style') === '' || !htmlEl.getAttribute('style'))) htmlEl.removeAttribute('style');
                                
                                // Unwrap span if no attributes and no style
                                if (htmlEl.tagName.toLowerCase() === 'span' && htmlEl.attributes.length === 0) {
                                    while (htmlEl.firstChild) htmlEl.parentNode?.insertBefore(htmlEl.firstChild, htmlEl);
                                    htmlEl.parentNode?.removeChild(htmlEl);
                                }
                            });
                            
                            return tmp.innerHTML;
                        } catch (e) {
                            console.error('Failed to strip inline styles:', e);
                            return html;
                        }
                    };

                    const updateMeta = (keyOrUpdates: string | Record<string, any>, value?: any) => {
                        let batchUpdates: Record<string, any> = {};
                        if (typeof keyOrUpdates === 'string') {
                            batchUpdates[keyOrUpdates] = value;
                        } else {
                            batchUpdates = keyOrUpdates;
                        }

                        console.log('[PropertiesBar] updateMeta called:', { batchUpdates, isTextLayer, editingLayerId });

                        // Capture focus state before any manipulation
                        const savedActiveElement = document.activeElement as HTMLElement;
                        const wasInSidebar = savedActiveElement && (savedActiveElement.tagName === 'INPUT' || savedActiveElement.tagName === 'SELECT' || savedActiveElement.tagName === 'TEXTAREA');

                        const textProps = ['textColor', 'textColor2', 'textBgType', 'textGradientAngle', 'textGradientLength', 'textGradientCenterX', 'textGradientCenterY', 'textGradientRadius', 'fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing', 'bgType', 'colorCode', 'colorCode2', 'textStrokeColor', 'textStrokeWidth', 'textAlign', 'verticalAlign', 'maxLines', 'overflowBehavior'];
                        
                        // Check if ANY update is for surgical styling
                        const surgicalPropsList = ['textColor', 'fontFamily', 'fontWeight', 'fontSize', 'fontStyle', 'textDecoration', 'textStops', 'textBgType', 'textGradientAngle', 'textGradientRadius', 'textGradientCenterX', 'textGradientCenterY', 'textGradientLength'];
                        const hasSurgicalProp = Object.keys(batchUpdates).some(k => surgicalPropsList.includes(k));

                        const editor = editingLayerId ? (document.getElementById(`editor-${editingLayerId}`) as HTMLElement) : null;

                        if (isTextLayer && (hasSurgicalProp || Object.keys(batchUpdates).some(k => textProps.includes(k)))) {
                            const selection = window.getSelection();
                            let range = (selection && selection.rangeCount > 0) ? selection.getRangeAt(0) : lastRangeRef.current;
                            
                            // Re-check selection quality
                            let rangeNode = range ? range.commonAncestorContainer : null;
                            if (rangeNode && rangeNode.nodeType === 3) rangeNode = rangeNode.parentNode!;
                            let isSelectionInEditor = !!(rangeNode && (rangeNode as HTMLElement).closest && (rangeNode as HTMLElement).closest(`#editor-${editingLayerId}`));

                            if (editor && hasSurgicalProp) {
                                try {
                                    if (!range || !isSelectionInEditor) {
                                        // Fallback to last known good range if current one is lost/outside
                                        if (lastRangeRef.current) {
                                            const lastNode = lastRangeRef.current.commonAncestorContainer;
                                            const lastParent = (lastNode.nodeType === 3 ? lastNode.parentNode : lastNode) as HTMLElement;
                                            if (lastParent?.closest?.(`#editor-${editingLayerId}`)) {
                                                range = lastRangeRef.current;
                                                isSelectionInEditor = true;
                                            }
                                        }
                                    }

                                    // If we are in edit mode, we MUST have a range in the editor.
                                    // If we lost it, fallback to selecting everything surgically.
                                    if (!range || !isSelectionInEditor) {
                                        const fullRange = document.createRange();
                                        fullRange.selectNodeContents(editor);
                                        range = fullRange;
                                        lastRangeRef.current = fullRange;
                                        isSelectionInEditor = true;
                                    }

                                    // Check if it's an actual user selection BEFORE we mutate the DOM and potentially collapse the range
                                    const isActualSelection = range && !range.collapsed && isSelectionInEditor;

                                    // Apply surgical updates using the unified utility
                                    Object.entries(batchUpdates).forEach(([k, v]) => {
                                        let command = k;
                                        let finalValue = v;

                                        // Map component prop keys to richText utility commands
                                        if (k === 'textColor' || k === 'textStops' || k === 'textBgType' || k === 'textGradientAngle' || k.startsWith('textGradient')) {
                                            command = 'foreColor';
                                            const bgType = (batchUpdates as any).textBgType || (meta as any).textBgType || 'solid';
                                            if (bgType !== 'solid') {
                                                const stops = (batchUpdates as any).textStops || (meta as any).textStops || [];
                                                const angle = (batchUpdates as any).textGradientAngle ?? (meta as any).textGradientAngle ?? 135;
                                                const radius = (batchUpdates as any).textGradientRadius ?? (meta as any).textGradientRadius ?? 100;
                                                const cx = (batchUpdates as any).textGradientCenterX ?? (meta as any).textGradientCenterX ?? 50;
                                                const cy = (batchUpdates as any).textGradientCenterY ?? (meta as any).textGradientCenterY ?? 50;
                                                
                                                const sortedStops = [...stops].sort((a: any, b: any) => a.offset - b.offset);
                                                const stopsStr = sortedStops.map((s: any) => `${s.color} ${s.offset * 100}%`).join(', ');
                                                
                                                if (bgType === 'linear') {
                                                    finalValue = `linear-gradient(${angle}deg, ${stopsStr})`;
                                                } else {
                                                    finalValue = `radial-gradient(circle at ${cx}% ${cy}%, ${stopsStr})`;
                                                }
                                            }
                                        }
                                        if (k === 'fontFamily') command = 'fontName';
                                        
                                        // Special handling for textDecoration which might come as a composite string
                                        if (k === 'textDecoration') {
                                            if (v.includes('underline')) applyRichTextFormat(`editor-${editingLayerId}`, 'underline', true, range);
                                            if (v.includes('overline')) applyRichTextFormat(`editor-${editingLayerId}`, 'overline', true, range);
                                            if (v.includes('line-through') || v.includes('strikethrough')) applyRichTextFormat(`editor-${editingLayerId}`, 'strikethrough', true, range);
                                            if (v === 'none') {
                                                // Clear all decorations
                                                applyRichTextFormat(`editor-${editingLayerId}`, 'underline', false, range);
                                                applyRichTextFormat(`editor-${editingLayerId}`, 'overline', false, range);
                                                applyRichTextFormat(`editor-${editingLayerId}`, 'strikethrough', false, range);
                                            }
                                        } else {
                                            applyRichTextFormat(`editor-${editingLayerId}`, command, finalValue, range);
                                        }
                                    });

                                    const finalSel = window.getSelection();
                                    if (finalSel && finalSel.rangeCount > 0) {
                                        lastRangeRef.current = finalSel.getRangeAt(0).cloneRange();
                                    }

                                    // Attach the safely captured boolean to a wider scope
                                    (batchUpdates as any)._wasActualSelection = isActualSelection;

                                } catch (e) {
                                    console.error('Surgical Styling failed:', e);
                                }
                            }

                            // If we have an actual selection and are surgical, we avoid updating the top-level style props
                            // to prevent the entire text box from inheriting the new value as a "default".
                            let finalBatchUpdates = { ...batchUpdates };
                            const isActualSelection = (batchUpdates as any)._wasActualSelection;
                            delete (finalBatchUpdates as any)._wasActualSelection;
                            
                                if (editor && isSelectionInEditor) {
                                    const filteredUpdates: Record<string, any> = {};
                                    Object.keys(finalBatchUpdates).forEach(k => {
                                        if (!surgicalPropsList.includes(k)) {
                                            filteredUpdates[k] = finalBatchUpdates[k];
                                        } else if (range && range.collapsed) {
                                            filteredUpdates[k] = finalBatchUpdates[k];
                                        }
                                    });
                                    if (isActualSelection) {
                                        surgicalPropsList.forEach(p => delete filteredUpdates[p]);
                                    }
                                    finalBatchUpdates = filteredUpdates;
                                }
                            
                            // If updating label from sidebar (plain text), try to patch HTML structure
                            if (finalBatchUpdates.label !== undefined && wasInSidebar) {
                                finalBatchUpdates.label = patchLabelHTML(meta.label || '', finalBatchUpdates.label);
                            }

                            if (!editor) {
                                const changedProps = Object.keys(finalBatchUpdates).filter(k => k !== 'label');
                                if (changedProps.length > 0) {
                                    const baseLabel = finalBatchUpdates.label !== undefined ? finalBatchUpdates.label : (meta.label || '');
                                    const stripped = stripInlineStyles(baseLabel, changedProps);
                                    if (stripped !== baseLabel) {
                                        finalBatchUpdates.label = stripped;
                                    }
                                }
                            }

                            const nextMeta = { ...meta, ...finalBatchUpdates };
                            if (editor) {
                                const changedPropsForStripping = Object.keys(finalBatchUpdates).filter(k => {
                                    if (k === 'label') return false;
                                    // If we have an active selection range in the editor, NEVER strip surgical props
                                    if (isSelectionInEditor && surgicalPropsList.includes(k)) return false;
                                    return true;
                                });
                                if (changedPropsForStripping.length > 0) {
                                    const currentHTML = editor.innerHTML;
                                    const stripped = stripInlineStyles(currentHTML, changedPropsForStripping);
                                    if (stripped !== currentHTML) {
                                        editor.innerHTML = stripped;
                                    }
                                }
                                nextMeta.label = editor.innerHTML;
                            }
                            onUpdateLayers(selectedLayerIds, { variant: JSON.stringify(nextMeta) });
                            setLocalValues(prev => ({ ...prev, ...finalBatchUpdates }));

                            if (editor) {
                                setTimeout(() => {
                                    if (wasInSidebar && savedActiveElement && document.body.contains(savedActiveElement)) {
                                        savedActiveElement.focus();
                                    } else {
                                        editor.focus();
                                        const currentSel = window.getSelection();
                                        const finalRange = (currentSel && currentSel.rangeCount > 0) ? currentSel.getRangeAt(0) : lastRangeRef.current;
                                        if (currentSel && finalRange) {
                                            currentSel.removeAllRanges();
                                            currentSel.addRange(finalRange);
                                        }
                                    }
                                }, 0);
                            }
                            return;
                        }

                        // Normal updates (non-text or non-surgical)
                        const finalUpdates: any = {};
                        Object.entries(batchUpdates).forEach(([k, v]) => {
                            let finalKey = k;
                            const isGlobalKey = k === 'effect';
                            if (!isTextLayer && buttonState !== 'default' && !isGlobalKey) {
                                const statePrefix = buttonState === 'hover' ? 'hover' : 'active';
                                finalKey = statePrefix + k.charAt(0).toUpperCase() + k.slice(1);
                            }
                            
                            // If updating label from sidebar, patch HTML
                            if (k === 'label' && wasInSidebar) {
                                finalUpdates[finalKey] = patchLabelHTML(meta.label || '', v);
                            } else {
                                finalUpdates[finalKey] = v;
                            }
                        });

                        const newMeta = { ...meta, ...finalUpdates };
                        onUpdateLayers(selectedLayerIds, { variant: JSON.stringify(newMeta) });
                        if (isTextLayer) {
                            setLocalValues(prev => ({ ...prev, ...finalUpdates }));
                        }
                    };

                    const getMetaValue = (key: string) => {
                        // Prioritize surgical styles (actual DOM selection state) if editing
                        if (editingLayerId && surgicalStyles[key] !== undefined) return surgicalStyles[key];
                        
                        if (isTextLayer && editingLayerId && localValues[key] !== undefined) return localValues[key];
                        if (isTextLayer || buttonState === 'default') return (meta as any)[key];
                        const statePrefix = buttonState === 'hover' ? 'hover' : 'active';
                        const finalKey = statePrefix + key.charAt(0).toUpperCase() + key.slice(1);
                        return (meta as any)[finalKey] || (meta as any)[key];
                    };

                    return (
                        <div className="flex flex-col gap-5">
                            {!isTextLayer && (
                                <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200/50">
                                    {(['default', 'hover', 'active'] as const).map((s) => (
                                        <button 
                                            key={s}
                                            onClick={() => setButtonState(s)}
                                            className={`flex-1 h-8 flex items-center justify-center rounded-lg transition-all text-[10px] font-bold capitalize ${buttonState === s ? 'bg-white text-primary shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {s === 'active' ? 'Click' : s}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Main Content Area */}
                            <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/rich-media">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="size-8 rounded-lg bg-primary/5 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[20px] text-primary">
                                            {isTextLayer ? 'description' : 'smart_button'}
                                        </span>
                                    </div>
                                    <div>
                                        <h4 className="text-[11px] font-bold text-gray-900 leading-none mb-0.5">
                                            {isTextLayer ? 'Text Content' : 'Button Content'}
                                        </h4>
                                        <p className="text-[9px] text-gray-400 font-medium">Configure content and typography</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    {/* Edit Text - HTML rendered and editable (WYSIWYG) */}
                                    <div className="flex flex-col gap-2">
                                        <div
                                            ref={(el) => {
                                                if (!el) return;
                                                textContentEditorRef.current = el;
                                                const layerId = selectedLayers[0].id;
                                                
                                                // Function to strip HTML tags if present
                                                const stripHtml = (html: string) => {
                                                    const tmp = document.createElement('div');
                                                    tmp.innerHTML = html;
                                                    return tmp.innerText || tmp.textContent || "";
                                                };

                                                const currentVal = meta.label || '';
                                                const cleanVal = stripHtml(currentVal);
                                                const layerChanged = el.dataset.layerId !== layerId;
                                                const notFocused = document.activeElement !== el;
                                                
                                                if (layerChanged || (notFocused && cleanVal !== el.innerText)) {
                                                    el.innerText = cleanVal;
                                                    el.dataset.layerId = layerId;
                                                }
                                            }}
                                            contentEditable
                                            suppressContentEditableWarning
                                            role="textbox"
                                            aria-multiline="true"
                                            data-placeholder={`Type your ${isTextLayer ? 'text' : 'button'} here...`}
                                            className="w-full min-h-[52px] p-3 bg-gray-50/50 border border-gray-100 rounded-xl text-xs font-medium focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-gray-900 [&:empty::before]:content-[attr(data-placeholder)] [&:empty::before]:text-gray-400"
                                            onInput={() => {
                                                const text = textContentEditorRef.current?.innerText ?? '';
                                                updateMeta('label', text);
                                            }}
                                            onBlur={() => {
                                                const text = textContentEditorRef.current?.innerText ?? '';
                                                updateMeta('label', text);
                                            }}
                                        />
                                    </div>
                                    {/* Link URL */}
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">link</span>
                                            Link URL
                                        </label>
                                        <div className="relative group/link flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-xl focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                                            <span className="absolute left-3 text-gray-400 pointer-events-none">
                                                <span className="material-symbols-outlined text-[18px]">link</span>
                                            </span>
                                            <input 
                                                type="text"
                                                className="w-full pl-10 pr-6 text-xs font-bold outline-none h-9 bg-transparent"
                                                placeholder="https://example.com"
                                                value={meta.linkUrl || ''}
                                                onChange={(e) => updateMeta('linkUrl', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div className="h-px bg-gray-50"></div>

                                    {/* Layout Mode */}
                                    {isTextLayer && (
                                        <div className="space-y-2">
                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-[16px] text-primary">view_quilt</span>
                                                Layout
                                            </label>
                                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100/50">
                                                {[
                                                    { id: 'none', label: 'None', icon: 'text_fields' },
                                                    { id: 'autoHeight', label: 'Auto Height', icon: 'height' },
                                                    { id: 'fit', label: 'Fit Text', icon: 'fit_screen' }
                                                ].map((mode) => (
                                                    <button 
                                                        key={mode.id}
                                                        onMouseDown={(e) => {
                                                            if (editingLayerId) {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                            }
                                                        }}
                                                        onClick={() => updateMeta('layoutType', mode.id)}
                                                        title={mode.label}
                                                        className={`flex-1 h-8 flex items-center justify-center rounded-lg transition-all ${meta.layoutType === mode.id || (!meta.layoutType && mode.id === 'none') ? 'bg-white text-primary shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">{mode.icon}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {(meta.layoutType === 'autoHeight' || meta.layoutType === 'none' || !meta.layoutType) && (
                                                <div className="space-y-2 mt-2">
                                                    <div className="flex items-center justify-between pl-1">
                                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                            <span className="material-symbols-outlined text-[16px] text-primary">format_list_numbered</span>
                                                            Max Lines
                                                        </label>
                                                        <span className="text-[10px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">{meta.maxLines || 'Off'}</span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input 
                                                            type="range" 
                                                            min="0" 
                                                            max="10" 
                                                            value={meta.maxLines || 0} 
                                                            onChange={(e) => updateMeta('maxLines', parseInt(e.target.value))}
                                                            className="flex-1 accent-primary h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer mt-2"
                                                        />
                                                        <input 
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={meta.maxLines || 0}
                                                            onChange={(e) => updateMeta('maxLines', parseInt(e.target.value) || 0)}
                                                            className="w-10 h-6 bg-gray-50/50 border border-gray-100 rounded text-[10px] text-center font-bold text-gray-600 focus:border-primary focus:bg-white outline-none"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="h-px bg-gray-50"></div>

                                    {/* Typography Grid */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">match_case</span>
                                            Typography
                                        </label>
                                        
                                        <div className="flex flex-col gap-2">
                                            <div className="relative group/font">
                                                <FontSelector 
                                                    fonts={fonts}
                                                    value={getMetaValue('fontFamily')}
                                                    hideSearch={surgicalStyles.isSelected}
                                                    onMouseDown={(e) => {
                                                        if (editingLayerId) {
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                    onChange={(value) => {
                                                        updateMeta('fontFamily', value);
                                                        const newFont = fonts.find(f => f.family === value);
                                                        if (newFont?.variants) {
                                                            const numericWeights = newFont.variants.filter(v => /^\d+$/.test(v));
                                                            const currentWeight = getMetaValue('fontWeight');
                                                            if (numericWeights.length > 0 && !numericWeights.includes(currentWeight)) {
                                                                updateMeta('fontWeight', numericWeights.includes('400') ? '400' : numericWeights[0]);
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>

                                            <div className="grid grid-cols-1 gap-2">
                                                <div className="relative group/weight">
                                                    <WeightSelector 
                                                        value={getMetaValue('fontWeight')}
                                                        hideSearch={surgicalStyles.isSelected}
                                                        weights={(() => {
                                                            const selectedFont = fonts.find(f => f.family === getMetaValue('fontFamily'));
                                                            if (selectedFont?.variants?.length) {
                                                                // Filter to keep only numeric weights (e.g. "400", not "400italic")
                                                                const weights = selectedFont.variants
                                                                    .filter(v => /^\d+$/.test(v));
                                                                if (weights.length > 0) return weights;
                                                            }
                                                            return ['300', '400', '500', '600', '700', '800', '900'];
                                                        })()}
                                                        onMouseDown={(e) => {
                                                            if (editingLayerId) e.stopPropagation();
                                                        }}
                                                        onChange={(value) => updateMeta('fontWeight', value)}
                                                    />
                                                </div>

                                                <div className="flex gap-2">
                                                    <div className="relative flex-1 group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                                                    <input 
                                                            type="text"
                                                            className="flex-1 w-full h-9 pl-9 pr-2 bg-transparent text-xs font-bold text-gray-900 outline-none"
                                                            value={getMetaValue('fontSize')}
                                                            onMouseDown={(e) => {
                                                                if (editingLayerId) {
                                                                    // Do NOT preventDefault here, otherwise user can't click to type
                                                                    e.stopPropagation();
                                                                }
                                                            }}
                                                            onChange={(e) => updateMeta('fontSize', e.target.value)}
                                                            placeholder="Auto"
                                                        />
                                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">format_size</span>
                                                        <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                            <button 
                                                                onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                                onClick={() => {
                                                                    const current = getMetaValue('fontSize');
                                                                    const base = (current === 'Mixed' || !current) ? 12 : Number(current);
                                                                    updateMeta('fontSize', String(base + 1));
                                                                }} 
                                                                className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px]">expand_less</span>
                                                            </button>
                                                            <button 
                                                                onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                                onClick={() => {
                                                                    const current = getMetaValue('fontSize');
                                                                    const base = (current === 'Mixed' || !current) ? 12 : Number(current);
                                                                    updateMeta('fontSize', String(Math.max(1, base - 1)));
                                                                }} 
                                                                className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px]">expand_more</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => updateMeta('fontSize', '')}
                                                        className={`h-9 px-4 rounded-lg border text-[10px] font-bold transition-all flex items-center justify-center gap-2 ${!getMetaValue('fontSize') ? 'bg-primary/5 border-primary text-primary shadow-sm' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}
                                                    >
                                                        <span className={`size-1.5 rounded-full ${!getMetaValue('fontSize') ? 'bg-primary animate-pulse' : 'bg-gray-300'}`}></span>
                                                        Auto
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-gray-50"></div>

                                    {/* Paragraph Section */}
                                    <div className="space-y-3">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">format_align_left</span>
                                            Paragraph & Spacing
                                        </label>
                                        
                                        <div className="flex flex-col gap-2">
                                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100/50 mb-2">
                                                {[
                                                    { id: 'bold', icon: 'format_bold', title: 'Bold', active: (getMetaValue('fontWeight') === '700' || getMetaValue('fontWeight') === '800' || getMetaValue('fontWeight') === 'bold'), onClick: () => {
                                                        const current = getMetaValue('fontWeight') || '400';
                                                        const isBold = current === '700' || current === '800' || current === 'bold';
                                                        updateMeta('fontWeight', isBold ? '400' : '800');
                                                    }},
                                                    { id: 'italic', icon: 'format_italic', title: 'Italic', active: getMetaValue('fontStyle') === 'italic', onClick: () => {
                                                        const current = getMetaValue('fontStyle') || 'normal';
                                                        updateMeta('fontStyle', current === 'italic' ? 'normal' : 'italic');
                                                    }},
                                                    { id: 'underline', icon: 'format_underlined', title: 'Underline' },
                                                    { id: 'overline', icon: 'format_underlined', title: 'Overline', extra: 'scale-y-[-1]' },
                                                    { id: 'line-through', icon: 'format_strikethrough', title: 'Strikethrough' }
                                                ].map((d) => (
                                                    <button 
                                                        key={d.id}
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => {
                                                            if (d.onClick) {
                                                                d.onClick();
                                                                return;
                                                            }
                                                            const current = getMetaValue('textDecoration') || 'none';
                                                            let next = 'none';
                                                            if (current.includes(d.id)) {
                                                                next = current.replace(d.id, '').trim() || 'none';
                                                            } else {
                                                                next = (current === 'none' || current === 'normal' ? d.id : current + ' ' + d.id).trim();
                                                            }
                                                            updateMeta('textDecoration', next);
                                                        }}
                                                        title={d.title}
                                                        className={`flex-1 h-7 flex items-center justify-center rounded-lg transition-all ${
                                                            d.active || (d.id !== 'bold' && d.id !== 'italic' && getMetaValue('textDecoration').includes(d.id)) 
                                                            ? 'bg-white text-primary shadow-sm border border-gray-200/50' 
                                                            : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <span className={`material-symbols-outlined text-[18px] ${d.extra || ''}`}>{d.icon}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100/50">
                                                {[
                                                    { id: 'uppercase', icon: 'uppercase', title: 'Uppercase' },
                                                    { id: 'lowercase', icon: 'lowercase', title: 'Lowercase' },
                                                    { id: 'capitalize', icon: 'match_case', title: 'Capitalize' }
                                                ].map((t) => (
                                                    <button 
                                                        key={t.id}
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => {
                                                            const current = getMetaValue('textTransform') || 'none';
                                                            const next = current === t.id ? 'none' : t.id;
                                                            updateMeta('textTransform', next);
                                                        }}
                                                        title={t.title}
                                                        className={`flex-1 h-7 flex items-center justify-center rounded-lg transition-all ${getMetaValue('textTransform') === t.id ? 'bg-white text-primary shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            {/* Alignment Controls */}
                                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100/50">
                                                {[
                                                    { id: 'left', icon: 'format_align_left' },
                                                    { id: 'center', icon: 'format_align_center' },
                                                    { id: 'right', icon: 'format_align_right' }
                                                ].map((a) => (
                                                    <button 
                                                        key={a.id}
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => updateMeta('textAlign', a.id)}
                                                        className={`flex-1 h-7 flex items-center justify-center rounded-lg transition-all ${getMetaValue('textAlign') === a.id ? 'bg-white text-primary shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">{a.icon}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100/50">
                                                {[
                                                    { id: 'top', icon: 'vertical_align_top' },
                                                    { id: 'middle', icon: 'vertical_align_center' },
                                                    { id: 'bottom', icon: 'vertical_align_bottom' }
                                                ].map((a) => (
                                                    <button 
                                                        key={a.id}
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => updateMeta('verticalAlign', a.id)}
                                                        className={`flex-1 h-7 flex items-center justify-center rounded-lg transition-all ${getMetaValue('verticalAlign') === a.id ? 'bg-white text-primary shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">{a.icon}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1.5 block">Overflow Behavior</label>
                                            <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100/50">
                                                {[
                                                    { id: 'truncate', icon: 'short_text', label: 'Truncate' },
                                                    { id: 'shrink', icon: 'compress', label: 'Shrink to Fit' }
                                                ].map((o) => (
                                                    <button 
                                                        key={o.id}
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => updateMeta('overflowBehavior', o.id)}
                                                        className={`flex-1 h-7 flex items-center gap-2 px-3 justify-center rounded-lg transition-all ${getMetaValue('overflowBehavior') === o.id ? 'bg-white text-primary shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">{o.icon}</span>
                                                        <span className="text-[11px] font-bold">{o.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                                                <input 
                                                    type="text"
                                                    className="flex-1 w-full h-8 pl-9 pr-2 bg-transparent text-xs font-medium text-gray-900 outline-none"
                                                    value={getMetaValue('lineHeight')}
                                                    onMouseDown={(e) => {
                                                        if (editingLayerId) {
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                    onChange={(e) => updateMeta('lineHeight', e.target.value)}
                                                    placeholder="1.2"
                                                />
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[17px]">format_line_spacing</span>
                                                     <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                        <button 
                                                            type="button"
                                                            tabIndex={-1}
                                                            onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                            onClick={() => {
                                                                const current = getMetaValue('lineHeight');
                                                                const base = (current === 'Mixed' || !current) ? 1.2 : parseFloat(current);
                                                                updateMeta('lineHeight', (base + 0.1).toFixed(1));
                                                            }} 
                                                            className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">expand_less</span>
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            tabIndex={-1}
                                                            onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                            onClick={() => {
                                                                const current = getMetaValue('lineHeight');
                                                                const base = (current === 'Mixed' || !current) ? 1.2 : parseFloat(current);
                                                                updateMeta('lineHeight', Math.max(0.1, base - 0.1).toFixed(1));
                                                            }} 
                                                            className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">expand_more</span>
                                                        </button>
                                                    </div>
                                            </div>

                                            <div className="relative group/input flex items-center overflow-hidden bg-gray-50/50 border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
                                                <input 
                                                    type="text"
                                                    className="flex-1 w-full h-8 pl-9 pr-2 bg-transparent text-xs font-medium text-gray-900 outline-none"
                                                    value={getMetaValue('letterSpacing')}
                                                    onMouseDown={(e) => {
                                                        if (editingLayerId) {
                                                            e.stopPropagation();
                                                        }
                                                    }}
                                                    onChange={(e) => updateMeta('letterSpacing', e.target.value)}
                                                    placeholder="0"
                                                />
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[17px]">format_letter_spacing</span>
                                                 <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                                                    <button 
                                                        type="button"
                                                        tabIndex={-1}
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => {
                                                            const current = getMetaValue('letterSpacing');
                                                            const base = (current === 'Mixed' || !current) ? 0 : parseFloat(current);
                                                            updateMeta('letterSpacing', (base + 1).toString());
                                                        }} 
                                                        className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">expand_less</span>
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        tabIndex={-1}
                                                        onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}
                                                        onClick={() => {
                                                            const current = getMetaValue('letterSpacing');
                                                            const base = (current === 'Mixed' || !current) ? 0 : parseFloat(current);
                                                            updateMeta('letterSpacing', (base - 1).toString());
                                                        }} 
                                                        className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">expand_more</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-px bg-gray-50"></div>

                                    <div className="h-px bg-gray-50"></div>     <div className="h-px bg-gray-50"></div>

                                    {/* Effects Section */}
                                    {!isTextLayer && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                                <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
                                                Interactive Effects
                                            </label>
                                            <div 
                                                className="flex items-center justify-between p-3 bg-gray-50/50 border border-gray-100 rounded-xl hover:border-primary/20 transition-all group/effect cursor-pointer" 
                                                onClick={(e) => setEffectPopupAnchor(e.currentTarget.getBoundingClientRect())}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`size-7 rounded-lg flex items-center justify-center transition-colors ${meta.effect && meta.effect !== 'none' ? 'bg-primary/10 text-primary' : 'bg-white text-gray-400 shadow-sm'}`}>
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            {interactiveEffects.find(f => f.id === (meta.effect || 'none'))?.icon || 'auto_awesome'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] font-bold text-gray-700">
                                                            {interactiveEffects.find(f => f.id === (meta.effect || 'none'))?.label || 'None'}
                                                        </span>
                                                        <span className="text-[8px] text-gray-400 font-medium whitespace-nowrap overflow-hidden text-ellipsis w-32">
                                                            {interactiveEffects.find(f => f.id === (meta.effect || 'none'))?.description}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="material-symbols-outlined text-gray-300 group-hover/effect:text-primary transition-colors">keyboard_arrow_right</span>
                                            </div>
                                        </div>
                                    )}

                                    {effectPopupAnchor && (
                                        <InteractiveEffectPopup 
                                            currentEffect={meta.effect || 'none'}
                                            onSelect={(id) => updateMeta('effect', id)}
                                            onClose={() => setEffectPopupAnchor(null)}
                                            anchorRect={effectPopupAnchor}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Appearance Card */}
                            <div className="flex flex-col gap-4 p-4 bg-gray-50/50 border border-gray-100 rounded-2xl mb-2 hover:border-primary/20 transition-all group/rich-appearance">
                                <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center justify-between gap-2 mb-1">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-primary">palette</span>
                                        Appearance
                                    </div>
                                    {selectedLayers[0].type === 'button' ? (
                                        <div className="text-[8px] bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                                            {buttonState.toUpperCase()} STATE
                                        </div>
                                    ) : (
                                        <div className="text-[8px] bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full border border-blue-100">
                                            TEXT FILL
                                        </div>
                                    )}
                                </label>
                                    <div className="flex flex-col gap-2 mb-1">
                                        <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest pl-1">Text Fill Type</label>
                                        <div className="flex bg-gray-100/50 p-0.5 rounded-xl border border-gray-100 w-full">
                                            {['solid', 'linear', 'radial'].map(type => {
                                                const isDisabled = Boolean(editingLayerId && surgicalStyles.isSelected && type !== 'solid');
                                                
                                                return (
                                                    <button 
                                                        key={type}
                                                        disabled={isDisabled}
                                                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                        title={isDisabled ? "Gradients cannot be applied to partial text selections yet." : ""}
                                                        onClick={() => {
                                                            if (isDisabled) return;
                                                            const updates: any = { textBgType: type };
                                                            if (type === 'linear') {
                                                                updates.textGradientAngle = 135;
                                                                updates.textGradientLength = 100;
                                                            } else if (type === 'radial') {
                                                                updates.textGradientRadius = 100;
                                                                updates.textGradientCenterX = 50;
                                                                updates.textGradientCenterY = 50;
                                                            }

                                                            if (type !== 'solid' && !getMetaValue('textStops')) {
                                                                const c1 = getMetaValue('textColor') || '#3B82F6';
                                                                const c2 = getMetaValue('textColor2') || '#1D4ED8';
                                                                updates.textStops = [
                                                                    { id: '1', color: c1, offset: 0 },
                                                                    { id: '2', color: c2, offset: 1 }
                                                                ];
                                                            }

                                                            updateMeta(updates);
                                                            setLocalValues(prev => ({ ...prev, ...updates }));
                                                        }}
                                                        className={`flex-1 px-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95 ${getMetaValue('textBgType') === type || (type === 'solid' && !getMetaValue('textBgType')) ? 'bg-white text-primary shadow-sm border border-gray-100/50' : 'text-gray-400 hover:text-gray-600'} ${isDisabled ? 'opacity-30 cursor-not-allowed contrast-75' : ''}`}
                                                    >
                                                        {type}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        { (getMetaValue('textBgType') === 'solid' || !getMetaValue('textBgType')) ? (
                                            <div onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}>
                                                <ColorPicker 
                                                    label="Text Color"
                                                    value={getMetaValue('textColor') === 'Mixed' ? '#000000' : (getMetaValue('textColor') || '#000000')}
                                                    onChange={(val) => updateMeta('textColor', val)}
                                                    swatches={documentColors}
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                {renderGradientStopsManager(
                                                    getMetaValue('textStops'),
                                                    getMetaValue('textBgType'),
                                                    (stops) => updateMeta('textStops', stops),
                                                    getMetaValue('textColor') || '#3B82F6',
                                                    getMetaValue('textColor2') || '#1D4ED8'
                                                )}

                                                {getMetaValue('textBgType') === 'linear' && (
                                                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-3 mt-1">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">Angle</span>
                                                                <input type="number" min="0" max="360" value={Math.round(getMetaValue('textGradientAngle') ?? 135)}
                                                                    onChange={(e) => updateMeta('textGradientAngle', parseInt(e.target.value, 10) || 0)}
                                                                    className="flex-1 w-full text-xs font-bold pl-12 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                            </div>
                                                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">Size %</span>
                                                                <input type="number" min="10" max="150" value={Math.round(getMetaValue('textGradientLength') ?? 100)}
                                                                    onChange={(e) => updateMeta('textGradientLength', parseInt(e.target.value, 10) || 100)}
                                                                    className="flex-1 w-full text-xs font-bold pl-12 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <input 
                                                                type="range" min="0" max="360" step="1" 
                                                                value={getMetaValue('textGradientAngle') ?? 135}
                                                                onChange={(e) => updateMeta('textGradientAngle', parseInt(e.target.value, 10))}
                                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" 
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {getMetaValue('textBgType') === 'radial' && (
                                                    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-3 mt-1">
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">X</span>
                                                                <input type="number" min="0" max="100" value={getMetaValue('textGradientCenterX') ?? 50}
                                                                    onChange={(e) => updateMeta('textGradientCenterX', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                                                    className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                            </div>
                                                            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">Y</span>
                                                                <input type="number" min="0" max="100" value={getMetaValue('textGradientCenterY') ?? 50}
                                                                    onChange={(e) => updateMeta('textGradientCenterY', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                                                    className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center justify-between px-1">
                                                                <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Radius %</label>
                                                                <span className="text-[10px] font-black text-primary">{Math.round(getMetaValue('textGradientRadius') ?? 100)}%</span>
                                                            </div>
                                                            <input 
                                                                type="range" min="10" max="150" step="1" 
                                                                value={getMetaValue('textGradientRadius') ?? 100}
                                                                onChange={(e) => updateMeta('textGradientRadius', parseInt(e.target.value, 10))}
                                                                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" 
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-3 border-t border-gray-50/50">
                                        <label className="text-[10px] text-gray-900 font-black uppercase tracking-widest flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-[16px] text-primary">border_color</span>
                                            Text Stroke
                                        </label>
                                        <div className="grid grid-cols-1 gap-3">
                                            <div onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}>
                                                <ColorPicker 
                                                    label="Stroke Color"
                                                    value={getMetaValue('textStrokeColor') || 'transparent'}
                                                    onChange={(val) => updateMeta('textStrokeColor', val)}
                                                    swatches={documentColors}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between pl-1">
                                                    <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Stroke Width</label>
                                                    <span className="text-[10px] font-black text-primary">{getMetaValue('textStrokeWidth') || 0}px</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="range" min="0" max="10" step="0.1" 
                                                        value={getMetaValue('textStrokeWidth') || 0}
                                                        onChange={(e) => updateMeta('textStrokeWidth', parseFloat(e.target.value))}
                                                        className="flex-1 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary mt-2" 
                                                    />
                                                    <input 
                                                        type="number" min="0" max="20" step="0.1"
                                                        value={getMetaValue('textStrokeWidth') || 0}
                                                        onChange={(e) => updateMeta('textStrokeWidth', parseFloat(e.target.value) || 0)}
                                                        className="w-12 h-7 px-2 bg-gray-50/50 border border-gray-100 rounded-md text-[10px] font-bold text-gray-900 focus:border-primary outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-1 border-t border-gray-50/50">
                                        <div className="flex flex-col gap-2">
                                            <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest pl-1">Fill Type</label>
                                            <div className="flex bg-gray-100/50 p-0.5 rounded-xl border border-gray-100 w-full">
                                                {['none', 'solid', 'radial', 'linear'].map(type => (
                                                    <button 
                                                        key={type}
                                                        onClick={() => {
                                                            const updates: any = { bgType: type };
                                                            if (type === 'linear') {
                                                                updates.gradientAngle = 135;
                                                                updates.gradientLength = 100;
                                                            } else if (type === 'radial') {
                                                                updates.gradientRadius = 100;
                                                                updates.gradientCenterX = 50;
                                                                updates.gradientCenterY = 50;
                                                            }
                                                            if (type === 'none') updates.colorCode = 'transparent';
                                                            else if (getMetaValue('colorCode') === 'transparent') updates.colorCode = '#008080';

                                                            if (type !== 'solid' && type !== 'none' && !getMetaValue('stops')) {
                                                                const c1 = getMetaValue('colorCode') || '#3B82F6';
                                                                const c2 = getMetaValue('colorCode2') || '#1D4ED8';
                                                                updates.stops = [
                                                                    { id: '1', color: c1, offset: 0 },
                                                                    { id: '2', color: c2, offset: 1 }
                                                                ];
                                                            }

                                                            updateMeta(updates);
                                                            setLocalValues(prev => ({ ...prev, bgType: type }));
                                                        }}
                                                        className={`flex-1 px-1 py-1 rounded-lg text-[9px] font-black uppercase transition-all active:scale-95 ${getMetaValue('bgType') === type ? 'bg-white text-primary shadow-sm border border-gray-100/50' : 'text-gray-400 hover:text-gray-600'}`}
                                                    >
                                                        {type}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2">
                                            { (getMetaValue('bgType') === 'solid' || getMetaValue('bgType') === 'none' || !getMetaValue('bgType')) ? (
                                                <div onMouseDown={(e) => { if (editingLayerId) { e.preventDefault(); e.stopPropagation(); } }}>
                                                    <ColorPicker 
                                                        label={getMetaValue('bgType') === 'none' ? 'Background (Disabled)' : 'Background Color'}
                                                        value={getMetaValue('bgType') === 'none' ? 'transparent' : (getMetaValue('colorCode') || '#ffffff')}
                                                        onChange={(val) => {
                                                            const updates: any = { colorCode: val };
                                                            const currentBgType = localValues.bgType || getMetaValue('bgType');
                                                            if (!currentBgType || currentBgType === 'none') {
                                                                updates.bgType = 'solid';
                                                                setLocalValues(prev => ({ ...prev, bgType: 'solid' }));
                                                            }
                                                            updateMeta(updates);
                                                        }}
                                                        swatches={documentColors}
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    {renderGradientStopsManager(
                                                        getMetaValue('stops'),
                                                        getMetaValue('bgType'),
                                                        (stops) => updateMeta('stops', stops),
                                                        getMetaValue('colorCode') || '#3B82F6',
                                                        getMetaValue('colorCode2') || '#1D4ED8'
                                                    )}

                                                    {getMetaValue('bgType') === 'linear' && (
                                                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-3 mt-1">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                    <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">Angle</span>
                                                                    <input type="number" min="0" max="360" value={Math.round(getMetaValue('gradientAngle') ?? 135)}
                                                                        onChange={(e) => updateMeta('gradientAngle', parseInt(e.target.value, 10) || 0)}
                                                                        className="flex-1 w-full text-xs font-bold pl-12 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                                </div>
                                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                    <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">Size %</span>
                                                                    <input type="number" min="10" max="150" value={Math.round(getMetaValue('gradientLength') ?? 100)}
                                                                        onChange={(e) => updateMeta('gradientLength', parseInt(e.target.value, 10) || 100)}
                                                                        className="flex-1 w-full text-xs font-bold pl-12 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <input 
                                                                    type="range" min="0" max="360" step="1" 
                                                                    value={getMetaValue('gradientAngle') ?? 135}
                                                                    onChange={(e) => updateMeta('gradientAngle', parseInt(e.target.value, 10))}
                                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {getMetaValue('bgType') === 'radial' && (
                                                        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3 space-y-3 mt-1">
                                                            <div className="grid grid-cols-2 gap-2">
                                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                    <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">X</span>
                                                                    <input type="number" min="0" max="100" value={getMetaValue('gradientCenterX') ?? 50}
                                                                        onChange={(e) => updateMeta('gradientCenterX', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                                                        className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                                </div>
                                                                <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg h-9 transition-all">
                                                                    <span className="absolute left-2 text-[10px] text-gray-400 font-bold uppercase">Y</span>
                                                                    <input type="number" min="0" max="100" value={getMetaValue('gradientCenterY') ?? 50}
                                                                        onChange={(e) => updateMeta('gradientCenterY', Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                                                                        className="flex-1 w-full text-xs font-bold pl-7 pr-1 h-full bg-transparent outline-none appearance-none" />
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <div className="flex items-center justify-between px-1">
                                                                    <label className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Radius %</label>
                                                                    <span className="text-[10px] font-black text-primary">{Math.round(getMetaValue('gradientRadius') ?? 100)}%</span>
                                                                </div>
                                                                <input 
                                                                    type="range" min="10" max="150" step="1" 
                                                                    value={getMetaValue('gradientRadius') ?? 100}
                                                                    onChange={(e) => updateMeta('gradientRadius', parseInt(e.target.value, 10))}
                                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary" 
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                        </div>
                    );
                })()}

                {/* ── Form Input Properties ────────────────────────── */}
                {selectedLayers.length === 1 && selectedLayers[0].type === 'form-input' && (() => {
                    const fl = selectedLayers[0];
                    let fm: any = {
                        formType: 'text-input', label: '', placeholder: '',
                        defaultValue: '', required: false, disabled: false,
                        showLabel: true, labelPosition: 'top',
                        helperText: '', errorMessage: '',
                        borderRadius: '8', borderColor: '#e5e7eb',
                        backgroundColor: '#ffffff', textColor: '#111827',
                        labelColor: '#374151', fontSize: '14',
                    };
                    try { fm = { ...fm, ...JSON.parse(fl.variant || '{}') }; } catch {}
                    const ft: string = fm.formType || 'text-input';

                    const updateFm = (updates: Record<string, any>) => {
                        onUpdateLayers([fl.id], { variant: JSON.stringify({ ...fm, ...updates }) });
                    };

                    const inputCls = "w-full px-2.5 py-1.5 text-[10px] font-bold bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 text-gray-700";
                    const numInputCls = `${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;
                    const labelCls = "text-[8px] font-black text-gray-400 uppercase tracking-widest";
                    const sectionCls = "flex flex-col gap-3 pt-3 pb-3 border-b border-gray-50";

                    const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
                        <button onClick={onChange} className={`relative w-8 h-4 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-gray-200'}`}>
                            <span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all" style={{ left: value ? '18px' : '2px' }} />
                        </button>
                    );

                    const ColorRow = ({ keyName, label }: { keyName: string; label: string }) => (
                        <div className="flex items-center justify-between">
                            <span className={labelCls}>{label}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-gray-400">{fm[keyName]}</span>
                                <label className="relative cursor-pointer">
                                    <div className="w-6 h-6 rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="w-full h-full" style={{ backgroundColor: fm[keyName] }} />
                                    </div>
                                    <input type="color" value={fm[keyName] || '#000000'} onChange={e => updateFm({ [keyName]: e.target.value })} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                </label>
                            </div>
                        </div>
                    );

                    const ICONS: Record<string, string> = {
                        'text-input': 'text_fields', 'email-input': 'alternate_email',
                        'number-input': 'pin', 'textarea': 'notes',
                        'checkbox': 'check_box', 'select': 'expand_circle_down',
                        'radio': 'radio_button_checked', 'form-button': 'touch_app',
                    };
                    const TITLES: Record<string, string> = {
                        'text-input': 'Text Input', 'email-input': 'Email Input',
                        'number-input': 'Number Input', 'textarea': 'Textarea',
                        'checkbox': 'Checkbox', 'select': 'Select / Dropdown',
                        'radio': 'Radio Button', 'form-button': 'Submit Button',
                    };

                    return (
                        <div className="flex flex-col">
                            {/* Header */}
                            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
                                <span className="material-symbols-outlined text-[14px] text-primary">{ICONS[ft] || 'input'}</span>
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{TITLES[ft] || 'Form Input'}</span>
                            </div>

                            <div className="px-4 flex flex-col gap-0">

                                {/* ── Common Settings ── */}
                                <div className={sectionCls}>
                                    <span className={labelCls}>Settings</span>

                                    {/* Field Name (for form submission data key) */}
                                    {ft !== 'form-button' && (
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Field Name</span>
                                            <input type="text" value={fm.name || ''} onChange={e => updateFm({ name: e.target.value })} className={inputCls} placeholder="e.g. email, firstName" />
                                        </div>
                                    )}

                                    {/* Label field */}
                                    {ft === 'checkbox' && (
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Checkbox Text</span>
                                            <input type="text" value={fm.label || ''} onChange={e => updateFm({ label: e.target.value })} className={inputCls} placeholder="I agree to the Terms..." />
                                        </div>
                                    )}
                                    {ft === 'form-button' && (
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Button Text</span>
                                            <input type="text" value={fm.label || ''} onChange={e => updateFm({ label: e.target.value })} className={inputCls} placeholder="Submit" />
                                        </div>
                                    )}
                                    {ft !== 'checkbox' && ft !== 'form-button' && (
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Label</span>
                                            <input type="text" value={fm.label || ''} onChange={e => updateFm({ label: e.target.value })} className={inputCls} placeholder="Label text" />
                                        </div>
                                    )}

                                    {/* Placeholder — text/email/number/textarea/select only */}
                                    {(ft === 'text-input' || ft === 'email-input' || ft === 'textarea') && (
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Placeholder</span>
                                            <input type="text" value={fm.placeholder || ''} onChange={e => updateFm({ placeholder: e.target.value })} className={inputCls} placeholder="—" />
                                        </div>
                                    )}

                                    {/* Select placeholder */}
                                    {ft === 'select' && (
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Placeholder</span>
                                            <input type="text" value={fm.placeholder || ''} onChange={e => updateFm({ placeholder: e.target.value })} className={inputCls} placeholder="Choose..." />
                                        </div>
                                    )}

                                    {/* Default value — text/email/number */}
                                    {(ft === 'text-input' || ft === 'email-input' || ft === 'textarea') && (
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Default Value</span>
                                            <input type="text" value={fm.defaultValue || ''} onChange={e => updateFm({ defaultValue: e.target.value })} className={inputCls} placeholder="—" />
                                        </div>
                                    )}

                                    {/* Number-specific: min/max/step */}
                                    {ft === 'number-input' && (<>
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Default Value</span>
                                            <input type="number" value={fm.defaultValue || ''} onChange={e => updateFm({ defaultValue: e.target.value })} className={numInputCls} placeholder="—" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            {[['min','Min'],['max','Max'],['step','Step']].map(([k,l]) => (
                                                <div key={k} className="flex flex-col gap-1">
                                                    <span className={labelCls}>{l}</span>
                                                    <input type="number" value={fm[k] || ''} onChange={e => updateFm({ [k]: e.target.value })} className={numInputCls} placeholder="—" />
                                                </div>
                                            ))}
                                        </div>
                                    </>)}

                                    {/* Textarea rows */}
                                    {ft === 'textarea' && (
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Rows</span>
                                                <input type="number" min="2" max="20" value={fm.rows || 4} onChange={e => updateFm({ rows: parseInt(e.target.value) || 4 })} className={numInputCls} />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Resize</span>
                                                <select value={fm.resize || 'vertical'} onChange={e => updateFm({ resize: e.target.value })} className={inputCls}>
                                                    <option value="none">None</option>
                                                    <option value="vertical">Vertical</option>
                                                    <option value="horizontal">Horizontal</option>
                                                    <option value="both">Both</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Checkbox: default checked + link */}
                                    {ft === 'checkbox' && (<>
                                        <div className="flex items-center justify-between">
                                            <span className={labelCls}>Default Checked</span>
                                            <Toggle value={!!fm.defaultChecked} onChange={() => updateFm({ defaultChecked: !fm.defaultChecked })} />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Link Text</span>
                                            <input type="text" value={fm.linkText || ''} onChange={e => updateFm({ linkText: e.target.value })} className={inputCls} placeholder="Terms & Conditions" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Link URL</span>
                                            <input type="text" value={fm.linkUrl || ''} onChange={e => updateFm({ linkUrl: e.target.value })} className={inputCls} placeholder="https://..." />
                                        </div>
                                    </>)}

                                    {/* Select options */}
                                    {ft === 'select' && (<>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className={labelCls}>Options</span>
                                                <button
                                                    onClick={() => updateFm({ options: [...(fm.options || []), { label: `Option ${(fm.options || []).length + 1}`, value: `option${(fm.options || []).length + 1}` }] })}
                                                    className="text-[8px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                                                >+ Add</button>
                                            </div>
                                            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                                                {(fm.options || []).map((opt: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={opt.label}
                                                            onChange={e => {
                                                                const opts = [...(fm.options || [])];
                                                                opts[i] = { ...opts[i], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                                                                updateFm({ options: opts });
                                                            }}
                                                            className={`${inputCls} flex-1`}
                                                            placeholder={`Option ${i + 1}`}
                                                        />
                                                        <button
                                                            onClick={() => updateFm({ options: (fm.options || []).filter((_: any, j: number) => j !== i) })}
                                                            className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                                                        ><span className="material-symbols-outlined text-[12px]">close</span></button>
                                                    </div>
                                                ))}
                                                {(!fm.options || fm.options.length === 0) && (
                                                    <p className="text-[9px] text-gray-400 text-center py-2">No options yet. Click + Add.</p>
                                                )}
                                            </div>
                                        </div>
                                    </>)}

                                    {/* Radio options */}
                                    {ft === 'radio' && (<>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className={labelCls}>Options</span>
                                                <button
                                                    onClick={() => updateFm({ options: [...(fm.options || []), { label: `Option ${(fm.options || []).length + 1}`, value: `option${(fm.options || []).length + 1}` }] })}
                                                    className="text-[8px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                                                >+ Add</button>
                                            </div>
                                            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                                                {(fm.options || []).map((opt: any, i: number) => (
                                                    <div key={i} className="flex items-center gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={opt.label}
                                                            onChange={e => {
                                                                const opts = [...(fm.options || [])];
                                                                opts[i] = { ...opts[i], label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') };
                                                                updateFm({ options: opts });
                                                            }}
                                                            className={`${inputCls} flex-1`}
                                                            placeholder={`Option ${i + 1}`}
                                                        />
                                                        <button
                                                            onClick={() => updateFm({ options: (fm.options || []).filter((_: any, j: number) => j !== i) })}
                                                            className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                                                        ><span className="material-symbols-outlined text-[12px]">close</span></button>
                                                    </div>
                                                ))}
                                                {(!fm.options || fm.options.length === 0) && (
                                                    <p className="text-[9px] text-gray-400 text-center py-2">No options yet. Click + Add.</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Default Selected</span>
                                            <select value={fm.defaultValue || ''} onChange={e => updateFm({ defaultValue: e.target.value })} className={inputCls}>
                                                <option value="">None</option>
                                                {(fm.options || []).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Direction</span>
                                            <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                                {(['vertical', 'horizontal'] as const).map(dir => (
                                                    <button key={dir} onClick={() => updateFm({ direction: dir })}
                                                        className={`flex-1 py-1 text-[9px] font-black uppercase rounded-md transition-all ${fm.direction === dir || (!fm.direction && dir === 'vertical') ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{dir}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </>)}

                                    {/* Form button: full width toggle */}
                                    {ft === 'form-button' && (
                                        <div className="flex items-center justify-between">
                                            <span className={labelCls}>Full Width</span>
                                            <Toggle value={fm.fullWidth !== false} onChange={() => updateFm({ fullWidth: !(fm.fullWidth !== false) })} />
                                        </div>
                                    )}

                                    {/* Required + Disabled */}
                                    {ft !== 'form-button' && (
                                    <div className="flex items-center justify-between">
                                        <span className={labelCls}>Required</span>
                                        <Toggle value={!!fm.required} onChange={() => updateFm({ required: !fm.required })} />
                                    </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className={labelCls}>Disabled</span>
                                        <Toggle value={!!fm.disabled} onChange={() => updateFm({ disabled: !fm.disabled })} />
                                    </div>
                                </div>

                                {/* ── Display ── (not for checkbox, radio, form-button) */}
                                {ft !== 'checkbox' && ft !== 'form-button' && (
                                    <div className={sectionCls}>
                                        <span className={labelCls}>Display</span>

                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Label Position</span>
                                            <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                                {(['top', 'left', 'none'] as const).map(pos => (
                                                    <button key={pos} onClick={() => updateFm({ labelPosition: pos, showLabel: pos !== 'none' })}
                                                        className={`flex-1 py-1 text-[9px] font-black uppercase rounded-md transition-all ${fm.labelPosition === pos ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{pos}</button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Prefix / Suffix for text-input, email-input, number-input */}
                                        {(ft === 'text-input' || ft === 'email-input' || ft === 'number-input') && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className={labelCls}>Prefix</span>
                                                    <input type="text" value={fm.prefix || ''} onChange={e => updateFm({ prefix: e.target.value })} className={inputCls} placeholder="$" />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className={labelCls}>Suffix</span>
                                                    <input type="text" value={fm.suffix || ''} onChange={e => updateFm({ suffix: e.target.value })} className={inputCls} placeholder="kg" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Email icon toggle */}
                                        {ft === 'email-input' && (
                                            <div className="flex items-center justify-between">
                                                <span className={labelCls}>Show @ Icon</span>
                                                <Toggle value={fm.showIcon !== false} onChange={() => updateFm({ showIcon: !(fm.showIcon !== false) })} />
                                            </div>
                                        )}

                                        {/* Number steppers */}
                                        {ft === 'number-input' && (
                                            <div className="flex items-center justify-between">
                                                <span className={labelCls}>Show Steppers</span>
                                                <Toggle value={fm.showSteppers !== false} onChange={() => updateFm({ showSteppers: !(fm.showSteppers !== false) })} />
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Helper Text</span>
                                            <input type="text" value={fm.helperText || ''} onChange={e => updateFm({ helperText: e.target.value })} className={inputCls} placeholder="Optional hint" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Error Message</span>
                                            <input type="text" value={fm.errorMessage || ''} onChange={e => updateFm({ errorMessage: e.target.value })} className={inputCls} placeholder="This field is required" />
                                        </div>
                                    </div>
                                )}

                                {/* ── Form Submission (form-button only) ── */}
                                {ft === 'form-button' && (() => {
                                    const currentStage = stages.find(s => s.id === selectedStageId);
                                    const stageFormInputs = (currentStage?.layers || []).reduce<{ id: string; name: string; formType: string; hasName: boolean }[]>((acc, l) => {
                                        if (l.type !== 'form-input') return acc;
                                        try {
                                            const m = JSON.parse(l.variant || '{}');
                                            if (m.formType !== 'form-button') acc.push({ id: l.id, name: m.name || m.label || m.formType, formType: m.formType, hasName: !!m.name });
                                        } catch {}
                                        return acc;
                                    }, []);
                                    const submitFields: string[] = Array.isArray(fm.submitFields) ? fm.submitFields : stageFormInputs.map(f => f.name);
                                    return (
                                        <div className={sectionCls}>
                                            <span className={labelCls}>Form Submission</span>

                                            {/* Endpoint */}
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Endpoint URL</span>
                                                <input type="text" value={fm.endpoint || ''} onChange={e => updateFm({ endpoint: e.target.value })} className={inputCls} placeholder="https://api.example.com/submit" />
                                            </div>

                                            {/* Headers */}
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Headers (JSON)</span>
                                                <textarea 
                                                    value={fm.headers || ''} 
                                                    onChange={e => updateFm({ headers: e.target.value })} 
                                                    className={`${inputCls} min-h-[60px] font-mono text-[9px] py-1.5 leading-relaxed`} 
                                                    placeholder='{"Authorization": "Bearer ...", "X-Custom": "Value"}' 
                                                />
                                            </div>

                                            {/* Method */}
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Method</span>
                                                <div className="flex bg-gray-100 p-0.5 rounded-lg gap-px">
                                                    {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                                                        <button key={m} onClick={() => updateFm({ method: m })}
                                                            className={`flex-1 py-1 text-[7px] font-black uppercase rounded-md transition-all ${(fm.method || 'POST') === m ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{m}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Format */}
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Data Format</span>
                                                <div className="flex bg-gray-100 p-0.5 rounded-lg">
                                                    {[['json','JSON'],['xml','XML']].map(([val, lbl]) => (
                                                        <button key={val} onClick={() => updateFm({ submitFormat: val })}
                                                            className={`flex-1 py-1 text-[9px] font-black uppercase rounded-md transition-all ${(fm.submitFormat || 'json') === val ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{lbl}</button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Field Mapping */}
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Fields</span>
                                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                                                    {stageFormInputs.length === 0 && (
                                                        <p className="text-[9px] text-gray-400 py-1 text-center">No form elements on this stage yet.</p>
                                                    )}
                                                    {[...stageFormInputs].sort((a, b) => a.name.localeCompare(b.name)).map(f => {
                                                        const isIncluded = submitFields.includes(f.name);
                                                        const typeLabel = TITLES[f.formType] || f.formType;
                                                        return (
                                                            <div key={f.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${isIncluded ? 'border-primary/20 bg-primary/5' : 'border-gray-100 bg-gray-50'}`}>
                                                                <span className={`material-symbols-outlined text-[11px] ${isIncluded ? 'text-primary' : 'text-gray-300'}`}>{ICONS[f.formType] || 'input'}</span>
                                                                <div className="flex-1 min-w-0">
                                                                    <input 
                                                                        type="text"
                                                                        value={f.hasName ? f.name : ''}
                                                                        placeholder={f.name}
                                                                        className={`w-full bg-transparent text-[9px] font-bold outline-none focus:text-primary ${f.hasName ? 'text-gray-800' : 'text-gray-400 italic'}`}
                                                                        onChange={(e) => {
                                                                            const newName = e.target.value;
                                                                            const inputLayer = (currentStage?.layers || []).find(l => l.id === f.id);
                                                                            if (inputLayer) {
                                                                                try {
                                                                                    const m = JSON.parse(inputLayer.variant || '{}');
                                                                                    const oldName = m.name || m.label || m.formType;
                                                                                    m.name = newName;
                                                                                    onUpdateLayers([f.id], { variant: JSON.stringify(m) });
                                                                                    
                                                                                    if (Array.isArray(fm.submitFields)) {
                                                                                        updateFm({ submitFields: fm.submitFields.map((n: string) => n === oldName ? newName : n) });
                                                                                    }
                                                                                } catch {}
                                                                            }
                                                                        }}
                                                                    />
                                                                </div>
                                                                <span className="text-[8px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 font-semibold shrink-0">{typeLabel}</span>
                                                                {!f.hasName && <span className="material-symbols-outlined text-[10px] text-amber-400" title="Field Name not set">warning</span>}
                                                                <Toggle value={isIncluded} onChange={() => {
                                                                    updateFm({ submitFields: isIncluded ? submitFields.filter(n => n !== f.name) : [...submitFields, f.name] });
                                                                }} />
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Messages */}
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Success Message</span>
                                                <input type="text" value={fm.successMessage || ''} onChange={e => updateFm({ successMessage: e.target.value })} className={inputCls} placeholder="Form submitted!" />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Error Message</span>
                                                <input type="text" value={fm.errorMessage || ''} onChange={e => updateFm({ errorMessage: e.target.value })} className={inputCls} placeholder="Something went wrong" />
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ── Style ── */}
                                <div className={`${sectionCls} border-b-0 pb-4`}>
                                    <span className={labelCls}>Style</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Font Size</span>
                                            <input type="number" min="8" max="48" value={fm.fontSize || '14'} onChange={e => updateFm({ fontSize: e.target.value })} className={numInputCls} />
                                        </div>
                                        {ft !== 'checkbox' && ft !== 'radio' && (
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Border Radius</span>
                                                <input type="number" min="0" max="32" value={fm.borderRadius || '8'} onChange={e => updateFm({ borderRadius: e.target.value })} className={numInputCls} />
                                            </div>
                                        )}
                                        {ft === 'checkbox' && (
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Check Color</span>
                                                <label className="relative cursor-pointer w-full">
                                                    <div className="w-full h-7 rounded-lg border border-gray-100 overflow-hidden" style={{ backgroundColor: fm.checkboxColor || '#136c6c' }} />
                                                    <input type="color" value={fm.checkboxColor || '#136c6c'} onChange={e => updateFm({ checkboxColor: e.target.value })} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                                </label>
                                            </div>
                                        )}
                                        {ft === 'radio' && (
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Radio Color</span>
                                                <label className="relative cursor-pointer w-full">
                                                    <div className="w-full h-7 rounded-lg border border-gray-100 overflow-hidden" style={{ backgroundColor: fm.radioColor || '#136c6c' }} />
                                                    <input type="color" value={fm.radioColor || '#136c6c'} onChange={e => updateFm({ radioColor: e.target.value })} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                                                </label>
                                            </div>
                                        )}
                                        {ft === 'form-button' && (
                                            <div className="flex flex-col gap-1">
                                                <span className={labelCls}>Border Radius</span>
                                                <input type="number" min="0" max="32" value={fm.borderRadius || '8'} onChange={e => updateFm({ borderRadius: e.target.value })} className={numInputCls} />
                                            </div>
                                        )}
                                    </div>

                                    {ft === 'form-button' && <ColorRow keyName="buttonColor" label="Button Color" />}
                                    {ft !== 'checkbox' && ft !== 'radio' && ft !== 'form-button' && <ColorRow keyName="borderColor" label="Border Color" />}
                                    {ft !== 'checkbox' && ft !== 'radio' && ft !== 'form-button' && <ColorRow keyName="backgroundColor" label="Background" />}
                                    <ColorRow keyName="textColor" label="Text Color" />
                                    {ft !== 'checkbox' && ft !== 'radio' && ft !== 'form-button' && <ColorRow keyName="labelColor" label="Label Color" />}
                                </div>

                                {/* ── Dropdown Style (select only) ── */}
                                {ft === 'select' && (
                                    <div className={`${sectionCls} border-b-0 pb-4`}>
                                        <span className={labelCls}>Dropdown Style</span>

                                        <div className="flex items-center justify-between">
                                            <span className={labelCls}>Show Shadow</span>
                                            <Toggle value={fm.dropdownShadow !== false} onChange={() => updateFm({ dropdownShadow: !(fm.dropdownShadow !== false) })} />
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <span className={labelCls}>Dropdown Radius</span>
                                            <input type="number" min="0" max="32" value={fm.dropdownRadius || '8'} onChange={e => updateFm({ dropdownRadius: e.target.value })} className={numInputCls} />
                                        </div>

                                        <ColorRow keyName="optionBg" label="Option Background" />
                                        <ColorRow keyName="optionText" label="Option Text" />

                                        <div className="pt-1 border-t border-gray-50 flex flex-col gap-2">
                                            <span className={`${labelCls} text-gray-300`}>On Hover</span>
                                            <ColorRow keyName="optionHoverBg" label="Hover Background" />
                                            <ColorRow keyName="optionHoverText" label="Hover Text" />
                                        </div>

                                        <div className="pt-1 border-t border-gray-50 flex flex-col gap-2">
                                            <span className={`${labelCls} text-gray-300`}>Selected</span>
                                            <ColorRow keyName="optionSelectedBg" label="Selected Background" />
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    );
                })()}
            </div>
            <WidgetCodeEditor 
                isOpen={isWidgetEditorOpen}
                onClose={() => setIsWidgetEditorOpen(false)}
                initialHtml={widgetCode.html}
                initialCss={widgetCode.css}
                initialJs={widgetCode.js}
                initialProperties={widgetCode.properties}
                widgetName={widgetCode.name}
                initialIcon={widgetCode.icon}
                onSave={handleSaveWidgetCode}
                fonts={fonts}
            />

            {isMainLibraryOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setIsMainLibraryOpen(false)}
                    />
                    <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[80vh] overflow-hidden animate-in zoom-in-95 fade-in duration-200">
                        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">photo_library</span>
                                <span className="text-sm font-bold text-gray-800">Media Library</span>
                            </div>
                            <button 
                                onClick={() => setIsMainLibraryOpen(false)}
                                className="size-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto bg-white min-h-[400px]">
                            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                                {mediaAssets.map((url, imgIdx) => (
                                    <button 
                                        key={imgIdx}
                                        onClick={() => {
                                            if (libraryTarget === 'url') {
                                                onUpdateLayers(selectedLayerIds, { url: url });
                                            } else if (libraryTarget.startsWith('fill-')) {
                                                const fillIdx = parseInt(libraryTarget.split('-')[1]);
                                                if (Array.isArray(localValues['fills'])) {
                                                    const newFills = [...localValues['fills']];
                                                    if (newFills[fillIdx]) {
                                                        newFills[fillIdx] = { ...newFills[fillIdx], imageUrl: url };
                                                        handleUpdateFills(newFills);
                                                    }
                                                }
                                            } else {
                                                selectedLayers.forEach(l => {
                                                    try {
                                                        const meta = JSON.parse(l.variant || '{}');
                                                        meta[libraryTarget] = url;
                                                        const updates: any = { variant: JSON.stringify(meta) };
                                                        if (libraryTarget === 'videoUrl') updates.url = url;
                                                        onUpdateLayers([l.id], updates);
                                                    } catch {}
                                                });
                                            }
                                            setIsMainLibraryOpen(false);
                                        }}
                                        className="aspect-square bg-white rounded-xl hover:scale-105 hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all shadow-xs border border-gray-100 group/img flex items-center justify-center overflow-hidden p-2"
                                    >
                                        <div className="w-full h-full checkerboard rounded-md overflow-hidden relative">
                                            <img 
                                                src={url} 
                                                className="w-full h-full object-contain absolute inset-0" 
                                                alt="Media Asset" 
                                            />
                                        </div>
                                    </button>
                                ))}
                                <label className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-primary hover:border-primary transition-all cursor-pointer">
                                    <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) handleImageUpload(file, libraryTarget);
                                        }}
                                    />
                                    <span className="material-symbols-outlined text-[24px]">upload</span>
                                    <span className="text-[9px] font-bold mt-1 uppercase">Upload</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(PropertiesBar);
