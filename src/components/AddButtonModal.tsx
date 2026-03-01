import React, { useState } from 'react';

interface AddButtonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (buttonData: {
        label: string;
        color: string;
        hoverColor: string;
        activeColor: string;
        effect: string;
        bgType: string;
        color2: string;
    }) => void;
}

const effects = [
    { label: 'None', value: 'none' },
    { label: 'Shine', value: 'shine' },
    { label: 'Glow', value: 'glow' },
    { label: 'Jelly', value: 'jelly' },
    { label: 'Tilt', value: 'tilt' },
    { label: 'Lift', value: 'lift' },
    { label: 'Glitch', value: 'glitch' },
];

const bgTypes = [
    { label: 'Solid', value: 'solid' },
    { label: 'Radial', value: 'radial' },
];

const AddButtonModal: React.FC<AddButtonModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [label, setLabel] = useState('Click Me');
    const [color, setColor] = useState('#10b981');
    const [hoverColor, setHoverColor] = useState('#059669');
    const [activeColor, setActiveColor] = useState('#047857');
    const [effect, setEffect] = useState('none');
    const [bgType, setBgType] = useState('solid');
    const [color2, setColor2] = useState('#004040');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd({
            label,
            color,
            hoverColor,
            activeColor,
            effect,
            bgType,
            color2
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div 
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-2xl bg-entry/10 text-entry flex items-center justify-center">
                            <span className="material-symbols-outlined text-[24px]">smart_button</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">Create New Button</h2>
                            <p className="text-xs text-gray-500 font-medium">Configure your custom button style</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white hover:shadow-md rounded-xl transition-all text-gray-400 hover:text-gray-600 active:scale-90"
                    >
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar max-h-[70vh]">
                    {/* Label Input */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">title</span>
                            Button Label
                        </label>
                        <input 
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            className="w-full h-11 px-4 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold focus:ring-2 focus:ring-entry/20 focus:border-entry outline-none transition-all"
                            placeholder="Enter button text..."
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Background Type */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">gradient</span>
                                BG Type
                            </label>
                            <select 
                                value={bgType}
                                onChange={(e) => setBgType(e.target.value)}
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-entry/20 focus:border-entry outline-none transition-all appearance-none"
                            >
                                {bgTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>

                        {/* Effect */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                Action Effect
                            </label>
                            <select 
                                value={effect}
                                onChange={(e) => setEffect(e.target.value)}
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-entry/20 focus:border-entry outline-none transition-all appearance-none"
                            >
                                {effects.map(ef => <option key={ef.value} value={ef.value}>{ef.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Color Pickers */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">palette</span>
                            Color Configuration
                        </label>
                        
                        <div className="grid grid-cols-1 gap-3">
                            {/* Main Color */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-700 uppercase">Main Color</span>
                                    <span className="text-[9px] text-gray-400 font-mono mt-0.5">{color.toUpperCase()}</span>
                                </div>
                                <input 
                                    type="color" 
                                    value={color}
                                    onChange={(e) => setColor(e.target.value)}
                                    className="size-8 rounded-lg cursor-pointer border-none bg-transparent"
                                />
                            </div>

                            {bgType === 'radial' && (
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100 animate-in slide-in-from-top-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-700 uppercase">Gradient Color</span>
                                        <span className="text-[9px] text-gray-400 font-mono mt-0.5">{color2.toUpperCase()}</span>
                                    </div>
                                    <input 
                                        type="color" 
                                        value={color2}
                                        onChange={(e) => setColor2(e.target.value)}
                                        className="size-8 rounded-lg cursor-pointer border-none bg-transparent"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-700 uppercase text-blue-500">Hover</span>
                                        <input 
                                            type="color" 
                                            value={hoverColor}
                                            onChange={(e) => setHoverColor(e.target.value)}
                                            className="size-6 mt-1 rounded-md cursor-pointer border-none bg-transparent"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-gray-700 uppercase text-purple-500">Active</span>
                                        <input 
                                            type="color" 
                                            value={activeColor}
                                            onChange={(e) => setActiveColor(e.target.value)}
                                            className="size-6 mt-1 rounded-md cursor-pointer border-none bg-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="pt-4 border-t border-gray-100 flex flex-col items-center gap-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest self-start">Live Preview</span>
                        <div className="w-full flex items-center justify-center p-8 bg-gray-100 rounded-3xl relative overflow-hidden">
                             {/* Preview Background Pattern */}
                             <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                             
                             <div 
                                className={`w-40 h-12 outer-button-container shadow-xl transition-all effect-${effect} cursor-default`}
                                style={{ 
                                    backgroundColor: bgType === 'solid' ? color : undefined,
                                    background: bgType === 'radial' ? `radial-gradient(circle, ${color}, ${color2})` : undefined,
                                    // @ts-ignore
                                    '--h-bg': hoverColor,
                                    // @ts-ignore
                                    '--a-bg': activeColor
                                }}
                            >
                                <div className="rich-media-text-v !text-[10px]">
                                    {label}
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <div className="p-8 bg-gray-50/80 border-t border-gray-100 flex items-center gap-3">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-12 border border-gray-200 text-gray-500 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-white hover:text-gray-700 transition-all active:scale-95"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        className="flex-[2] h-12 bg-entry text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-entry/20 hover:bg-entry/90 hover:-translate-y-0.5 active:scale-95 transition-all"
                    >
                        Create Button
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddButtonModal;
