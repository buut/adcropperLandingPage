import React, { useState, useEffect } from 'react';
import { BreakpointName, BREAKPOINT_PRESETS, BREAKPOINT_COLORS, BREAKPOINT_ABBR } from '../App';

interface AddStageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (stages: { name: string; width: number; height: number; breakpoint?: BreakpointName }[]) => void;
}

const BREAKPOINT_ORDER: BreakpointName[] = ['xlarge', 'large', 'medium', 'small', 'xsmall'];

const BREAKPOINT_ICONS: Record<BreakpointName, string> = {
    xlarge: 'tv',
    large:  'laptop',
    medium: 'tablet',
    small:  'tablet_android',
    xsmall: 'smartphone',
};

const AddStageModal: React.FC<AddStageModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [sectionName, setSectionName] = useState('');
    const [selectedBreakpoints, setSelectedBreakpoints] = useState<BreakpointName[]>(['large']);
    const [showCustom, setShowCustom] = useState(false);
    const [customWidth, setCustomWidth] = useState<number>(1280);
    const [customHeight, setCustomHeight] = useState<number>(800);

    useEffect(() => {
        if (isOpen) {
            setSectionName('');
            setSelectedBreakpoints(['large']);
            setShowCustom(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const toggleBreakpoint = (bp: BreakpointName) => {
        setSelectedBreakpoints(prev =>
            prev.includes(bp) ? prev.filter(b => b !== bp) : [...prev, bp]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const stagesToAdd: { name: string; width: number; height: number; breakpoint?: BreakpointName }[] = selectedBreakpoints.map(bp => {
            const preset = BREAKPOINT_PRESETS[bp];
            return {
                name: sectionName.trim() || preset.label,
                width: preset.width,
                height: preset.height,
                breakpoint: bp,
            };
        });

        if (showCustom && customWidth > 0 && customHeight > 0) {
            stagesToAdd.push({
                name: sectionName.trim() || `Custom ${customWidth}×${customHeight}`,
                width: customWidth,
                height: customHeight,
            });
        }

        if (stagesToAdd.length > 0) {
            onAdd(stagesToAdd);
            onClose();
        }
    };

    const totalCount = selectedBreakpoints.length + (showCustom && customWidth > 0 && customHeight > 0 ? 1 : 0);

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[24px]">responsive_layout</span>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-800">Add Breakpoint Stage</h2>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                Choose responsive sizes for your section
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <span className="material-symbols-outlined text-[22px]">close</span>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-5 overflow-y-auto">
                    {/* Section name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Section Name</label>
                        <input
                            type="text"
                            placeholder="e.g. Hero, Features, Footer…"
                            value={sectionName}
                            onChange={e => setSectionName(e.target.value)}
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:outline-none text-sm font-medium"
                            autoFocus
                        />
                    </div>

                    {/* Breakpoint cards */}
                    <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Breakpoints</label>
                        <div className="flex flex-col gap-2">
                            {BREAKPOINT_ORDER.map(bp => {
                                const preset = BREAKPOINT_PRESETS[bp];
                                const color = BREAKPOINT_COLORS[bp];
                                const abbr = BREAKPOINT_ABBR[bp];
                                const icon = BREAKPOINT_ICONS[bp];
                                const isSelected = selectedBreakpoints.includes(bp);
                                return (
                                    <button
                                        key={bp}
                                        type="button"
                                        onClick={() => toggleBreakpoint(bp)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                                            isSelected
                                                ? 'border-opacity-40 shadow-sm'
                                                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                        style={isSelected ? { background: `${color}10`, borderColor: `${color}60` } : {}}
                                    >
                                        {/* Badge */}
                                        <span
                                            className="text-[9px] font-black text-white rounded-md px-1.5 py-0.5 shrink-0 w-8 text-center"
                                            style={{ background: color }}
                                        >
                                            {abbr}
                                        </span>

                                        {/* Icon */}
                                        <span
                                            className="material-symbols-outlined text-[20px] shrink-0"
                                            style={{ color: isSelected ? color : '#9ca3af' }}
                                        >
                                            {icon}
                                        </span>

                                        {/* Label + dimensions */}
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[11px] font-bold text-gray-700">{preset.label}</span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-gray-400 shrink-0">
                                            {preset.width}×{preset.height}
                                        </span>

                                        {/* Check indicator */}
                                        <div
                                            className={`size-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                isSelected ? 'border-transparent text-white' : 'border-gray-300 bg-transparent'
                                            }`}
                                            style={isSelected ? { background: color } : {}}
                                        >
                                            {isSelected && (
                                                <span className="material-symbols-outlined text-[13px]">check</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom size disclosure */}
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => setShowCustom(v => !v)}
                            className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">{showCustom ? 'expand_less' : 'expand_more'}</span>
                            Custom Size (Advanced)
                        </button>
                        {showCustom && (
                            <div className="grid grid-cols-2 gap-3 pl-5">
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">Width (px)</span>
                                    <input
                                        type="number"
                                        value={customWidth}
                                        onChange={e => setCustomWidth(parseInt(e.target.value) || 0)}
                                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm font-mono font-bold transition-all"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase">Height (px)</span>
                                    <input
                                        type="number"
                                        value={customHeight}
                                        onChange={e => setCustomHeight(parseInt(e.target.value) || 0)}
                                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none text-sm font-mono font-bold transition-all"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4 shrink-0">
                    <span className="text-[10px] text-gray-400 font-bold">
                        {totalCount > 0 ? `${totalCount} stage${totalCount > 1 ? 's' : ''} will be added` : 'Select at least one breakpoint'}
                    </span>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={totalCount === 0}
                            className="px-7 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-[#0f5757] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 text-sm flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[18px]">add_circle</span>
                            Add Stage{totalCount > 1 ? 's' : ''}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddStageModal;
