import React, { useState } from 'react';

interface LandingPageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (selectedSizes: string[]) => void;
}

const LANDING_PAGE_SIZES = [
    { id: 'xlarge', name: 'XLarge (Desktop)', width: 1440, height: 900, icon: 'desktop_windows' },
    { id: 'large', name: 'Large (Laptop)', width: 1024, height: 768, icon: 'laptop' },
    { id: 'medium', name: 'Medium (Tablet)', width: 768, height: 1024, icon: 'tablet_android' },
    { id: 'small', name: 'Small (Mobile)', width: 430, height: 932, icon: 'smartphone' },
    { id: 'xsmall', name: 'XSmall (S Mobile)', width: 375, height: 812, icon: 'phone_android' },
];

const LandingPageModal: React.FC<LandingPageModalProps> = ({ isOpen, onClose, onAdd }) => {
    const [selectedIds, setSelectedIds] = useState<string[]>(LANDING_PAGE_SIZES.map(s => s.id));

    if (!isOpen) return null;

    const toggleSize = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => setSelectedIds(LANDING_PAGE_SIZES.map(s => s.id));
    const handleDeselectAll = () => setSelectedIds([]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedIds.length > 0) {
            onAdd(selectedIds);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
                onClick={onClose}
            ></div>
            
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-[24px]">web</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Add Landing Page Stages</h2>
                            <p className="text-xs text-gray-500 font-medium">Select the responsive versions you want to create</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <span className="material-symbols-outlined text-[24px]">close</span>
                    </button>
                </div>

                <div className="p-8">
                    <div className="flex items-center justify-between mb-4">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Available Layouts</label>
                        <div className="flex gap-4">
                            <button onClick={handleSelectAll} className="text-[10px] font-bold text-primary hover:underline">Select All</button>
                            <button onClick={handleDeselectAll} className="text-[10px] font-bold text-gray-400 hover:text-gray-600">Deselect All</button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {LANDING_PAGE_SIZES.map(size => {
                            const isSelected = selectedIds.includes(size.id);
                            return (
                                <button
                                    key={size.id}
                                    onClick={() => toggleSize(size.id)}
                                    className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between group ${
                                        isSelected 
                                        ? 'bg-primary/5 border-primary/40 text-primary' 
                                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`size-5 rounded border flex items-center justify-center transition-colors ${
                                            isSelected ? 'bg-primary border-primary' : 'bg-transparent border-gray-300'
                                        }`}>
                                            {isSelected && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold">{size.name}</span>
                                            <span className="text-[10px] opacity-60 font-mono">{size.width} x {size.height} px</span>
                                        </div>
                                    </div>
                                    <span className={`material-symbols-outlined text-[20px] ${isSelected ? 'text-primary' : 'text-gray-300'}`}>
                                        {size.icon}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2.5 text-gray-500 font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={selectedIds.length === 0}
                        className="px-8 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-[#0f5757] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 text-sm"
                    >
                        Create {selectedIds.length} Stages
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LandingPageModal;
