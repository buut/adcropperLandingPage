import React, { useState, useMemo } from 'react';
import { animations, animationInfo } from '../data/animationData';

interface TextAnimationPopupProps {
    onClose: () => void;
    onSelect: (animation: string) => void;
    layerId: string;
    type: 'entry' | 'main' | 'exit';
    style?: React.CSSProperties;
}

const toCssValue = (v: string | number) => typeof v === 'number' ? `${v}px` : v;

const generateKeyframes = (animName: string) => {
    const trimmedName = animName.trim();
    const info = animationInfo[trimmedName];
    if (!info) return '';

    if (info.raw) {
        return info.raw.replace(new RegExp(`@keyframes ${trimmedName}`, 'g'), `@keyframes kf-${trimmedName}`)
            .replace(new RegExp(`@-webkit-keyframes ${trimmedName}`, 'g'), `@-webkit-keyframes kf-${trimmedName}`);
    }

    return ''; // Simplified for now as we only use raw for text effects
};

const AnimationPreviewButton = React.memo(({
    anim,
    isSelected,
    onSelect
}: {
    anim: string,
    isSelected: boolean,
    onSelect: () => void
}) => {
    const keyframes = useMemo(() => generateKeyframes(anim), [anim]);
    const animId = useMemo(() => `anim-${anim.replace(/\s+/g, '-')}`, [anim]);

    return (
        <button
            onClick={onSelect}
            className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${isSelected
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                }`}
        >
            <style>{keyframes}</style>
            <div className="h-16 w-full flex items-center justify-center mb-2 overflow-hidden">
                <span
                    className="text-xl font-black text-gray-800 whitespace-nowrap px-4"
                    style={{
                        animation: `kf-${anim} 2s infinite ease-in-out`
                    }}
                >
                    Text
                </span>
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider text-center line-clamp-1 ${isSelected ? 'text-primary' : 'text-gray-500'
                }`}>
                {anim.replace(/-/g, ' ')}
            </span>
            {isSelected && (
                <div className="absolute top-2 right-2 size-4 bg-primary rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-[10px] font-bold">check</span>
                </div>
            )}
        </button>
    );
});

const TextAnimationPopup: React.FC<TextAnimationPopupProps> = ({ onClose, onSelect, layerId, type, style }) => {
    const segmentCategories: Record<'entry' | 'main' | 'exit', string[]> = {
        entry: ["Tracking In (Text)", "Focus In (Text)", "Flicker In (Text)"],
        main: ["Shadow Pop (Text)", "vibrate", "flicker", "shake", "jello", "wobble", "bounce", "pulsate", "blink"],
        exit: ["Tracking Out (Text)", "Blur Out (Text)", "Flicker Out (Text)"]
    };

    const textCategories = segmentCategories[type] || segmentCategories.entry;

    // Use state but sync with type changes if necessary
    const [selectedCategory, setSelectedCategory] = useState(textCategories[0]);
    
    // Reset category when type changes
    React.useEffect(() => {
        setSelectedCategory(textCategories[0]);
    }, [type]);

    const categoryIcons: Record<string, string> = {
        "Tracking In (Text)": "text_fields",
        "Focus In (Text)": "center_focus_strong",
        "Flicker In (Text)": "bolt",
        "Shadow Pop (Text)": "layers",
        "Tracking Out (Text)": "text_fields",
        "Blur Out (Text)": "blur_off",
        "Flicker Out (Text)": "flash_off",
        "vibrate": "vibration",
        "flicker": "flash_on",
        "shake": "handshake",
        "jello": "animation",
        "wobble": "vibration",
        "bounce": "keyboard_double_arrow_up",
        "pulsate": "favorite",
        "blink": "visibility"
    };

    const currentAnimations = useMemo(() => {
        const typeMap = { entry: 'start', main: 'middle', exit: 'end' };
        const animGroup = (animations as any)[typeMap[type]];
        return animGroup?.[selectedCategory] || [];
    }, [selectedCategory, type]);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const [adjustedStyle, setAdjustedStyle] = React.useState<React.CSSProperties>(style || {});

    React.useLayoutEffect(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            const width = rect.width;
            const height = rect.height;

            const initialLeft = typeof style?.left === 'number' ? style.left : (typeof style?.left === 'string' ? parseFloat(style.left) : rect.left);
            const initialTop = typeof style?.top === 'number' ? style.top : (typeof style?.top === 'string' ? parseFloat(style.top) : rect.top);

            // Default behavior: show ABOVE the click point
            let newLeft = initialLeft - (width / 2); // Center horizontally
            let newTop = initialTop - height - 20; // Show 20px above click point

            if (newLeft + width > winW - 20) {
                newLeft = winW - width - 20;
            }
            if (newLeft < 20) newLeft = 20;

            if (newTop + height > winH - 20) {
                newTop = winH - height - 20;
            }
            if (newTop < 20) {
                // If top overflows (no space above), show BELOW the click point or at least stick to top
                newTop = initialTop + 20;
                if (newTop + height > winH - 20) {
                    newTop = 20; // Last resort: top of screen
                }
            }

            setAdjustedStyle({
                position: 'fixed',
                left: `${newLeft}px`,
                top: `${newTop}px`,
                opacity: 1
            });
        }
    }, [style]);

    return (
        <>
            <div
                className="fixed inset-0 z-[99998] bg-black/5 backdrop-blur-[2px]"
                onClick={onClose}
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            />
            <div
                ref={containerRef}
                className="fixed z-[99999] bg-white rounded-[32px] shadow-[0_30px_90px_-20px_rgba(0,0,0,0.3)] border border-gray-100 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300"
                style={{
                    ...style,
                    ...adjustedStyle,
                    width: '1050px',
                    height: '560px',
                    maxHeight: '90vh',
                    maxWidth: '95vw',
                    opacity: containerRef.current ? 1 : 0
                }}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-2xl">title</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.25em]">Typography</span>
                            <h3 className="text-xl font-black text-gray-900 leading-tight">
                                {type === 'entry' ? 'Entrance' : type === 'exit' ? 'Exit' : 'Middle'} Effects
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="size-10 rounded-xl hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Categories */}
                    <div className="w-20 border-r border-gray-50 bg-gray-50/30 overflow-y-auto p-4 flex flex-col gap-1.5">
                        {textCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                title={cat.replace(' (Text)', '')}
                                className={`flex items-center justify-center min-h-[48px] h-12 rounded-xl transition-all duration-200 ${selectedCategory === cat
                                        ? 'bg-white shadow-sm border border-gray-100 text-primary'
                                        : 'text-gray-500 hover:bg-gray-100/50 hover:text-gray-900'
                                    }`}
                            >
                                <span className={`material-symbols-outlined text-[24px] ${selectedCategory === cat ? 'text-primary' : 'text-gray-400'
                                    }`}>
                                    {categoryIcons[cat] || 'animation'}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Animations Grid */}
                    <div className="flex-1 overflow-y-auto p-6 bg-white">
                        <div className="grid grid-cols-4 gap-4">
                            {currentAnimations.map((anim: string) => (
                                <AnimationPreviewButton
                                    key={anim}
                                    anim={anim}
                                    isSelected={false} // Would need current selection state
                                    onSelect={() => onSelect(anim)}
                                />
                            ))}
                        </div>
                        {currentAnimations.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 opacity-50">
                                <span className="material-symbols-outlined text-5xl">auto_awesome_motion</span>
                                <span className="text-sm font-bold">No variations available</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="size-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {currentAnimations.length} Variations Loaded
                        </span>
                    </div>
                    <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                        Double-click to apply instantly
                    </span>
                </div>
            </div>
        </>
    );
};

export default TextAnimationPopup;
