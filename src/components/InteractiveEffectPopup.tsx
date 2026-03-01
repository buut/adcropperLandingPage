import React, { useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export const interactiveEffects = [
    { id: 'none', label: 'None', icon: 'block', description: 'No effect' },
    { id: 'shine', label: 'Shine', icon: 'auto_awesome', description: 'Classic light sweep' },
    { id: 'pulse', label: 'Pulse', icon: 'vibration', description: 'Subtle breathing' },
    { id: 'lift', label: 'Lift', icon: 'arrow_upward', description: 'Scale & deep shadow' },
    { id: 'glow', label: 'Neon Glow', icon: 'wb_sunny', description: 'Outer color bloom' },
    { id: 'jelly', label: 'Jelly', icon: 'Bakery_Dining', description: 'Elastic squeeze' },
    { id: 'glitch', label: 'Glitch', icon: 'dvr', description: 'RGB split flicker' },
    { id: 'shake', label: 'Shake', icon: 'shutter_speed', description: 'Fast vibration' },
    { id: 'reveal', label: 'Sweep Reveal', icon: 'view_carousel', description: 'Color slide overlay' },
    { id: 'tilt', label: 'Glass Tilt', icon: '3d_rotation', description: '3D specular shift' },
];

export const visualEffects = [
    { id: 'none', label: 'None', icon: 'block', description: 'No effect' },
    { id: 'blur', label: 'Blur', icon: 'blur_on', description: 'Focus softening' },
    { id: 'dropShadow', label: 'Drop Shadow', icon: 'shadow', description: 'Depth shadow' },
    { id: 'innerShadow', label: 'Inner Shadow', icon: 'layers', description: 'Inset shadow' },
    { id: 'textShadow', label: 'Text Shadow', icon: 'text_fields', description: 'Letters shadow' },
    { id: 'brightness', label: 'Brightness', icon: 'light_mode', description: 'Light intensity' },
    { id: 'contrast', label: 'Contrast', icon: 'contrast', description: 'Color difference' },
    { id: 'grayscale', label: 'Grayscale', icon: 'gradient', description: 'B&W filter' },
    { id: 'hueRotate', label: 'Hue Rotate', icon: 'rotate_right', description: 'Color shift' },
    { id: 'invert', label: 'Invert', icon: 'invert_colors', description: 'Negative colors' },
    { id: 'saturate', label: 'Saturate', icon: 'water_drop', description: 'Color vibrancy' },
    { id: 'sepia', label: 'Sepia', icon: 'filter_vintage', description: 'Antique tone' },
    { id: 'position', label: 'Position', icon: 'open_with', description: 'Interactive move' },
];

interface InteractiveEffectPopupProps {
    currentEffect: string;
    onSelect: (effectId: string) => void;
    onClose: () => void;
    anchorRect: DOMRect | null;
    title?: string;
    description?: string;
    effects?: typeof interactiveEffects;
}

const InteractiveEffectPopup: React.FC<InteractiveEffectPopupProps> = ({ 
    currentEffect, 
    onSelect, 
    onClose, 
    anchorRect,
    title = 'Interactive Effects',
    description = 'Choose a hover behavior',
    effects = interactiveEffects
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [adjustedStyle, setAdjustedStyle] = useState<React.CSSProperties>({ opacity: 0 });

    useLayoutEffect(() => {
        if (containerRef.current && anchorRect) {
            const rect = containerRef.current.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            
            let top = anchorRect.bottom + 10;
            let left = anchorRect.left + anchorRect.width / 2 - rect.width / 2;

            if (left + rect.width > winW - 20) left = winW - rect.width - 20;
            if (left < 20) left = 20;
            if (top + rect.height > winH - 20) top = anchorRect.top - rect.height - 10;

            setAdjustedStyle({
                top: `${top}px`,
                left: `${left}px`,
                opacity: 1
            });
        }
    }, [anchorRect]);

    return createPortal(
        <>
            <div className="fixed inset-0 z-[99998]" onClick={onClose} />
            <div 
                ref={containerRef}
                style={adjustedStyle}
                className="fixed z-[99999] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-100 w-[320px] overflow-hidden animate-in fade-in zoom-in duration-200"
            >
                <div className="px-5 py-4 border-b border-gray-50 bg-gray-50/50 flex flex-col">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{title}</span>
                    <span className="text-xs text-gray-500 font-medium mt-0.5">{description}</span>
                </div>

                <div className="p-3 grid grid-cols-2 gap-2 overflow-y-auto max-h-[400px] custom-scrollbar">
                    {effects.map((effect) => (
                        <button
                            key={effect.id}
                            onClick={() => {
                                onSelect(effect.id);
                                onClose();
                            }}
                            className={`group flex flex-col items-center p-3 rounded-xl border-2 transition-all relative overflow-hidden ${
                                currentEffect === effect.id 
                                ? 'border-primary bg-primary/[0.03]' 
                                : 'border-transparent bg-gray-50 hover:border-gray-200 hover:bg-white'
                            }`}
                        >
                            <div className={`size-10 rounded-lg flex items-center justify-center mb-2 transition-all ${
                                currentEffect === effect.id ? 'bg-primary text-white' : 'bg-white text-gray-400 group-hover:text-primary'
                            }`}>
                                <span className="material-symbols-outlined text-[20px]">{effect.icon}</span>
                            </div>
                            <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tighter text-center">{effect.label}</span>
                            
                            {/* Hover Preview Element */}
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none">
                                <div className={`preview-effect-${effect.id} w-full h-full opacity-10`} />
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-3 border-t border-gray-50 bg-gray-50/50">
                    <button 
                        onClick={onClose}
                        className="w-full py-2 rounded-lg text-[10px] font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all uppercase tracking-widest"
                    >
                        Close Menu
                    </button>
                </div>

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    
                    @keyframes preview-pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                    }
                    @keyframes preview-glitch {
                        0% { transform: translate(0); }
                        20% { transform: translate(-2px, 2px); }
                        40% { transform: translate(-2px, -2px); }
                        60% { transform: translate(2px, 2px); }
                        80% { transform: translate(2px, -2px); }
                        100% { transform: translate(0); }
                    }
                    @keyframes preview-shake {
                        0%, 100% { transform: rotate(0); }
                        25% { transform: rotate(5deg); }
                        75% { transform: rotate(-5deg); }
                    }
                    .group:hover .preview-effect-pulse { animation: preview-pulse 0.6s infinite ease-in-out; background: var(--primary); }
                    .group:hover .preview-effect-glitch { animation: preview-glitch 0.2s infinite; background: #ff0000; }
                    .group:hover .preview-effect-shake { animation: preview-shake 0.1s infinite; background: #f59e0b; }
                    .group:hover .preview-effect-glow { box-shadow: inset 0 0 20px var(--primary); background: var(--primary); }
                    .group:hover .preview-effect-lift { transform: translateY(-3px) scale(1.02); box-shadow: 0 10px 15px rgba(0,0,0,0.1); background: var(--primary); }
                `}</style>
            </div>
        </>,
        document.body
    );
};

export default InteractiveEffectPopup;
