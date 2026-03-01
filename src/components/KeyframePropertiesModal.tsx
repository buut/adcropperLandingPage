import React, { useState, useEffect, useRef } from 'react';

interface KeyframeProperties {
    transformX: number;
    transformY: number;
    transformZ: number;
    rotateX: number;
    rotateY: number;
    rotateZ: number;
    rotation?: number; // Added for compatibility
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

interface KeyframePropertiesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (props: KeyframeProperties) => void;
    onChange?: (props: KeyframeProperties) => void;
    initialProps?: Partial<KeyframeProperties>;
}

const defaultProps: KeyframeProperties = {
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
                className="w-full h-9 pl-9 pr-3 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white relative"
            >
                <span className="truncate">{selectedLabel || placeholder}</span>
                <span className={`material-symbols-outlined text-[18px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px] pointer-events-none z-10">{icon}</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[500] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="overflow-y-auto max-h-[200px] p-1 custom-scrollbar">
                        {options.map(option => (
                            <button
                                key={option.value}
                                onClick={() => { onChange(option.value); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === option.value ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                            >
                                <span>{option.label}</span>
                                {value === option.value && <span className="material-symbols-outlined text-[14px]">check</span>}
                            </button>
                        ))}
                    </div>
                </div>
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
};

const easingOptions = [
    { label: 'Linear', value: 'linear' },
    { label: 'Ease-In (Slow Start)', value: 'ease-in' },
    { label: 'Ease-Out (Slow End)', value: 'ease-out' },
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

const KeyframePropertiesModal: React.FC<KeyframePropertiesModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    onChange,
    initialProps,
}) => {
    const [props, setProps] = useState<KeyframeProperties>(defaultProps);

    useEffect(() => {
        if (isOpen) {
            const init = { ...initialProps };

            // Unify rotation keys: prioritize 'rotation' over 'rotateZ'
            if (init.rotateZ !== undefined && init.rotation === undefined) {
                init.rotation = init.rotateZ;
            }
            
            // Ensure numeric types
            if (typeof init.rotation === 'string') init.rotation = parseFloat(init.rotation) || 0;

            setProps({ ...defaultProps, ...init });
        }
    }, [isOpen, initialProps]);

    if (!isOpen) return null;

    const handleChange = (key: keyof KeyframeProperties, value: any) => {
        const newProps = { ...props, [key]: value };
        setProps(newProps);
        onChange?.(newProps);
    };

    const renderInput = (label: string, key: keyof KeyframeProperties, icon: string, step = 1, min?: number, max?: number) => (
        <div className="flex flex-col gap-1">
            <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider whitespace-nowrap">{label}</label>
            <div className="relative group/input flex items-center overflow-hidden bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/10">
                {icon.length > 1 ? (
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[16px] pointer-events-none">{icon}</span>
                ) : (
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] font-bold pointer-events-none">{icon}</span>
                )}
                <input
                    type="number"
                    step={step}
                    min={min}
                    max={max}
                    value={props[key]}
                    onChange={(e) => {
                        let val = parseFloat(e.target.value);
                        if (isNaN(val)) val = 0;
                        handleChange(key, val);
                    }}
                    className="flex-1 w-full text-xs font-medium pl-8 pr-3 h-8 bg-transparent outline-none appearance-none"
                    onKeyDown={(e) => e.stopPropagation()}
                />
                <div className="flex flex-col pr-1 opacity-0 group-hover/input:opacity-100 transition-opacity">
                    <button 
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                            let val = (parseFloat(props[key] as any) || 0) + step;
                            if (max !== undefined) val = Math.min(max, val);
                            handleChange(key, parseFloat(val.toFixed(3)));
                        }}
                        className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-[12px] leading-none">expand_less</span>
                    </button>
                    <button 
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                            let val = (parseFloat(props[key] as any) || 0) - step;
                            if (min !== undefined) val = Math.max(min, val);
                            handleChange(key, parseFloat(val.toFixed(3)));
                        }}
                        className="size-4 flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                    >
                        <span className="material-symbols-outlined text-[12px] leading-none">expand_more</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
            <div 
                className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[400px] overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800 text-sm">Keyframe Properties</h3>
                    <button 
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {/* Timing / Easing Group - MOVED TO TOP */}
                    <div className="space-y-2 pb-2 border-b border-gray-100">
                        <div className="flex gap-3">
                            <div className="flex-1 flex flex-col gap-1 z-20">
                                <label className="text-[10px] text-primary font-bold uppercase tracking-wider">Easing</label>
                                <CustomSelect
                                    value={props.easing}
                                    onChange={(val) => handleChange('easing', val)}
                                    options={easingOptions}
                                    icon="show_chart"
                                    placeholder="Select Easing"
                                />
                            </div>
                            <div className="flex-1 flex flex-col gap-1 z-10">
                                <label className="text-[10px] text-primary font-bold uppercase tracking-wider">Origin</label>
                                <CustomSelect
                                    value={props.transformOrigin || 'center center'}
                                    onChange={(val) => handleChange('transformOrigin', val)}
                                    options={originOptions}
                                    icon="filter_center_focus"
                                    placeholder="Select Origin"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Transform Group */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Translate (%)</h4>
                        <div className="grid grid-cols-3 gap-3">
                            {renderInput('X (%)', 'transformX', 'X')}
                            {renderInput('Y (%)', 'transformY', 'Y')}
                            {renderInput('Z (%)', 'transformZ', 'Z')}
                        </div>
                    </div>

                    {/* Scale Group */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Scale</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {renderInput('Scale X', 'scaleX', 'width', 0.1)}
                            {renderInput('Scale Y', 'scaleY', 'height', 0.1)}
                        </div>
                    </div>

                    {/* Rotate & Opacity Group */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Appearance</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {renderInput('Rotate', 'rotation', 'rotate_right')}
                            {renderInput('Opacity', 'opacity', 'opacity', 0.01, 0, 1)}
                        </div>
                    </div>

                    {/* Skew Group */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Motion / Skew</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {renderInput('Skew X', 'skewX', 'format_italic')}
                            {renderInput('Skew Y', 'skewY', 'format_italic')}
                        </div>
                    </div>

                    {/* Filters Group */}
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Filters</h4>
                        <div className="grid grid-cols-3 gap-3">
                            {renderInput('Blur', 'blur', 'blur_on', 1, 0)}
                            {renderInput('Brightness', 'brightness', 'brightness_6', 0.1, 0)}
                            {renderInput('Contrast', 'contrast', 'contrast', 0.1, 0)}
                            {renderInput('Grayscale', 'grayscale', 'gradient', 0.1, 0, 1)}
                            {renderInput('Sepia', 'sepia', 'settings_brightness', 0.1, 0, 1)}
                            {renderInput('Saturate', 'saturate', 'colorize', 0.1, 0)}
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(props)}
                        className="px-4 py-2 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KeyframePropertiesModal;
