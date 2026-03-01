import React, { useState } from 'react';
import ColorPicker from './ColorPicker';

interface Size {
    width: number;
    height: number;
}

interface CreateTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (sizes: Size[], backgroundColor: string) => void;
    sourceStageName?: string;
}

const PRESET_SIZES: { name: string, w: number, h: number }[] = [
    { name: 'Instagram Story', w: 1080, h: 1920 },
    { name: 'Instagram Post', w: 1080, h: 1080 },
    { name: 'Facebook Ad', w: 1200, h: 628 },
    { name: 'Twitter Post', w: 1200, h: 675 },
    { name: 'LinkedIn Post', w: 1200, h: 627 },
    { name: 'YouTube Thumbnail', w: 1280, h: 720 },
    { name: 'Standard Banner', w: 300, h: 250 },
    { name: 'Leaderboard', w: 728, h: 90 },
    { name: 'Skyscraper', w: 160, h: 600 },
];

const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ isOpen, onClose, onGenerate, sourceStageName }) => {
    const [selectedSizes, setSelectedSizes] = useState<Size[]>([]);
    const [customWidth, setCustomWidth] = useState<string>('1200');
    const [customHeight, setCustomHeight] = useState<string>('628');
    const [bgColor, setBgColor] = useState<string>('#ffffff');

    if (!isOpen) return null;

    const toggleSize = (w: number, h: number) => {
        const index = selectedSizes.findIndex(s => s.width === w && s.height === h);
        if (index > -1) {
            setSelectedSizes(prev => prev.filter((_, i) => i !== index));
        } else {
            setSelectedSizes(prev => [...prev, { width: w, height: h }]);
        }
    };

    const addCustomSize = () => {
        const w = parseInt(customWidth);
        const h = parseInt(customHeight);
        if (w > 0 && h > 0) {
            if (!selectedSizes.some(s => s.width === w && s.height === h)) {
                setSelectedSizes(prev => [...prev, { width: w, height: h }]);
            }
        }
    };

    const handleGenerate = () => {
        if (selectedSizes.length === 0) return;
        onGenerate(selectedSizes, bgColor);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-[600px] max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 scale-in-center">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Create Smart Templates</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Generate multiple sizes from <span className="text-primary font-semibold">{sourceStageName || 'Current Stage'}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Color Panel Section */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Background Theme Color</label>
                        <div className="flex items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <ColorPicker 
                                value={bgColor} 
                                onChange={(val) => setBgColor(val)}
                            />
                            <div className="flex-1">
                                <div className="flex gap-1.5 mt-2">
                                    {['#ffffff', '#000000', '#f3f4f6', '#3b82f6', '#ef4444', '#10b981', '#f59e0b'].map(c => (
                                        <button 
                                            key={c} 
                                            className="size-5 rounded-full border border-gray-200 shadow-xs" 
                                            style={{ background: c }}
                                            onClick={() => setBgColor(c)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Presets */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Suggested Sizes</label>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESET_SIZES.map(preset => (
                                <button
                                    key={preset.name}
                                    onClick={() => toggleSize(preset.w, preset.h)}
                                    className={`flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all ${
                                        selectedSizes.some(s => s.width === preset.w && s.height === preset.h)
                                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <span className="text-[11px] font-bold text-gray-700 truncate w-full">{preset.name}</span>
                                    <span className="text-[10px] text-gray-400 mt-1">{preset.w} × {preset.h}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Size */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Custom Size</label>
                        <div className="flex gap-2">
                            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center border border-gray-100">
                                <span className="text-[10px] font-bold text-gray-400 mr-2">W</span>
                                <input 
                                    type="number" 
                                    className="bg-transparent w-full text-sm font-semibold text-gray-700 outline-none" 
                                    value={customWidth}
                                    onChange={(e) => setCustomWidth(e.target.value)}
                                />
                            </div>
                            <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 flex items-center border border-gray-100">
                                <span className="text-[10px] font-bold text-gray-400 mr-2">H</span>
                                <input 
                                    type="number" 
                                    className="bg-transparent w-full text-sm font-semibold text-gray-700 outline-none" 
                                    value={customHeight}
                                    onChange={(e) => setCustomHeight(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={addCustomSize}
                                className="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors"
                            >
                                Add size
                            </button>
                        </div>
                    </div>

                    {/* Selection Summary */}
                    {selectedSizes.length > 0 && (
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
                            <p className="text-[11px] font-bold text-blue-700">Generating {selectedSizes.length} new templates</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {selectedSizes.map((s, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-white border border-blue-200 text-[9px] font-bold text-blue-600 rounded-full">
                                        {s.width}×{s.height}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2 text-sm font-bold text-gray-500 hover:text-gray-700"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleGenerate}
                        disabled={selectedSizes.length === 0}
                        className="px-8 py-3 bg-primary text-white text-sm font-bold rounded-xl shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-30 disabled:shadow-none transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">magic_button</span>
                        Create Templates
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateTemplateModal;
