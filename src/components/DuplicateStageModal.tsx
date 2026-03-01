import React, { useState, useEffect } from 'react';
import { Stage, BreakpointName, BREAKPOINT_PRESETS } from '../App';

interface DuplicateStageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDuplicate: (stageId: string, name: string, width: number, height: number) => void;
    sourceStage: { id: string; name: string; width: number; height: number } | null;
    stages: Stage[];
}

interface SelectedTarget {
    id: string;
    name: string;
    width: number;
    height: number;
    isCustom?: boolean;
}

const DuplicateStageModal: React.FC<DuplicateStageModalProps> = ({ isOpen, onClose, onDuplicate, sourceStage, stages }) => {
    const [namePrefix, setNamePrefix] = useState('');
    const [selectedTargets, setSelectedTargets] = useState<SelectedTarget[]>([]);
    const [customWidth, setCustomWidth] = useState<number>(1080);
    const [customHeight, setCustomHeight] = useState<number>(1080);

    const BREAKPOINT_ORDER: BreakpointName[] = ['xlarge', 'large', 'medium', 'small', 'xsmall'];

    const standardPresets = BREAKPOINT_ORDER.map(bp => {
        const p = BREAKPOINT_PRESETS[bp];
        return { name: p.label, width: p.width, height: p.height };
    });

    // Filter out presets that already exist in stages
    const availablePresets = standardPresets.filter(p => {
        return !stages.some(s => s.width === p.width && s.height === p.height);
    });

    useEffect(() => {
        if (sourceStage) {
            // Strip size suffix (e.g., " - 300x250") from the name
            const strippedName = sourceStage.name.replace(/\s*-\s*\d+x\d+.*$/, '').trim();
            setNamePrefix(strippedName);
            // Default select the source dimension
            setSelectedTargets([{
                id: 'original',
                name: 'Current Size',
                width: sourceStage.width,
                height: sourceStage.height
            }]);
        }
    }, [sourceStage, isOpen]);

    if (!isOpen || !sourceStage) return null;

    const togglePreset = (preset: { name: string, width: number, height: number }) => {
        const id = `${preset.name}-${preset.width}x${preset.height}`;
        if (selectedTargets.find(t => t.id === id)) {
            setSelectedTargets(prev => prev.filter(t => t.id !== id));
        } else {
            setSelectedTargets(prev => [...prev, {
                id,
                name: preset.name,
                width: preset.width,
                height: preset.height
            }]);
        }
    };

    const addCustomSize = () => {
        if (customWidth > 0 && customHeight > 0) {
            const id = `custom-${customWidth}x${customHeight}`;
            if (!selectedTargets.find(t => t.id === id)) {
                setSelectedTargets(prev => [...prev, {
                    id,
                    name: `Custom ${customWidth}x${customHeight}`,
                    width: customWidth,
                    height: customHeight,
                    isCustom: true
                }]);
            }
        }
    };

    const removeTarget = (id: string) => {
        setSelectedTargets(prev => prev.filter(t => t.id !== id));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTargets.length > 0) {
            selectedTargets.forEach(target => {
                const finalName = `${target.width}x${target.height}`;
                onDuplicate(sourceStage.id, finalName, target.width, target.height);
            });
            onClose();
            setSelectedTargets([]);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            ></div>
            
            {/* Modal */}
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col animate-in fade-in zoom-in duration-200 h-[85vh]">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[24px]">content_copy</span>
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-xl font-bold text-gray-800">Batch Duplicate Banner</h2>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Select multiple sizes to generate banners in bulk</span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>
                
                <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Config & Custom */}
                        <div className="flex flex-col gap-6 lg:border-r border-gray-100 lg:pr-8">
                            {/* Banner Name Prefix removed as per request */}

                            <div className="flex flex-col gap-3">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Add Custom Size</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Width</span>
                                        <input 
                                            type="number"
                                            value={customWidth}
                                            onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:outline-none text-sm font-mono font-bold"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Height</span>
                                        <input 
                                            type="number"
                                            value={customHeight}
                                            onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:outline-none text-sm font-mono font-bold"
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={addCustomSize}
                                    className="w-full py-2.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-[18px]">add</span>
                                    Add Custom Size
                                </button>
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Selection Summary</label>
                                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-600">Total Banners:</span>
                                        <span className="text-lg font-black text-primary">{selectedTargets.length}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 italic">
                                        All content will be automatically scaled and anchored to fit target dimensions.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Middle Column: Presets */}
                        <div className="lg:col-span-2 flex flex-col gap-6">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ready Ad Sizes</label>
                                    <div className="flex gap-4">
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const all = availablePresets.map(p => ({
                                                    id: `${p.name}-${p.width}x${p.height}`,
                                                    name: p.name,
                                                    width: p.width,
                                                    height: p.height
                                                }));
                                                setSelectedTargets(all);
                                            }}
                                            className="text-[10px] font-bold text-primary hover:underline"
                                        >
                                            Select All
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setSelectedTargets([])}
                                            className="text-[10px] font-bold text-gray-400 hover:text-gray-600"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-2" style={{ maxHeight: 'min(500px, 50vh)' }}>
                                    <div className="col-span-full grid grid-cols-2 px-4 py-1.5 bg-gray-50 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest border border-gray-100">
                                        <span>Breakpoint Type</span>
                                        <span className="text-right">Dimension (Pixel)</span>
                                    </div>
                                    {availablePresets.map((p, index) => {
                                        const id = `${p.name}-${p.width}x${p.height}`;
                                        const isSelected = !!selectedTargets.find(t => t.id === id);
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => togglePreset(p)}
                                                className={`px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                                                    isSelected 
                                                    ? 'bg-primary/5 border-primary/40 text-primary shadow-sm' 
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`text-[9px] font-black text-white rounded-md px-1.5 py-0.5 shrink-0 w-6 text-center transition-all ${
                                                            isSelected ? 'bg-primary' : 'bg-gray-300'
                                                        }`}
                                                    >
                                                        {index + 1}
                                                    </div>
                                                    <div className={`size-5 rounded border flex items-center justify-center transition-colors ${
                                                        isSelected ? 'bg-primary border-primary' : 'bg-transparent border-gray-300'
                                                    }`}>
                                                        {isSelected && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold">{p.name}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[10px] opacity-60 font-mono font-bold">{p.width} x {p.height}</span>
                                                    <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider hidden lg:block ${
                                                        p.width > p.height ? 'bg-blue-50 text-blue-600' : p.width < p.height ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'
                                                    }`}>
                                                        {p.width > p.height ? 'L' : p.width < p.height ? 'P' : 'S'}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedTargets.length > 0 && (
                                <div className="flex flex-col gap-2 mt-auto">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Selected List</label>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedTargets.map((t, index) => (
                                            <div 
                                                key={t.id}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full border border-gray-200 group animate-in slide-in-from-right-2 duration-200"
                                            >
                                                <span className="text-[9px] font-black bg-gray-300 text-white size-4 rounded-full flex items-center justify-center shrink-0">
                                                    {index + 1}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-600">{t.name}</span>
                                                <button 
                                                    onClick={() => removeTarget(t.id)}
                                                    className="size-4 rounded-full bg-gray-200 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-4 shrink-0">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3 text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={selectedTargets.length === 0}
                        className="px-10 py-3 bg-primary text-white font-bold rounded-xl hover:bg-[#0f5757] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]">dynamic_feed</span>
                        Run Batch Duplicate ({selectedTargets.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateStageModal;
