import React, { useState, useRef, useEffect } from 'react';

import { createPortal } from 'react-dom';

interface WeightSelectorProps {
    value: string;
    onChange: (value: string) => void;
    weights: string[];
    onMouseDown?: (e: React.MouseEvent) => void;
    className?: string;
    hideSearch?: boolean;
}

const WeightSelector: React.FC<WeightSelectorProps> = ({ value, onChange, weights, onMouseDown, className, hideSearch }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const weightLabels: Record<string, string> = {
        '100': 'Thin',
        '200': 'Extra Light',
        '300': 'Light',
        '400': 'Regular',
        '500': 'Medium',
        '600': 'Semi Bold',
        '700': 'Bold',
        '800': 'Extra Bold',
        '900': 'Black',
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const normalizedUniqueWeights = Array.from(new Set(weights.map(w => w.replace(/\D/g, '') || '400')));

    const filteredWeights = normalizedUniqueWeights.filter(w => {
        const label = weightLabels[w] || w;
        return label.toLowerCase().includes(searchTerm.toLowerCase()) || w.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const displayValue = weightLabels[value] || value || 'Regular';

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                onMouseDown={onMouseDown}
                onClick={() => setIsOpen(!isOpen)}
                className={className || "w-full h-9 pl-9 pr-3 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white"}
            >
                <span className="truncate">{displayValue}</span>
                <span className={`material-symbols-outlined text-[18px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">format_bold</span>
            </button>

            {isOpen && createPortal(
                <div 
                    className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[99999] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
                    data-text-toolbar="true"
                    style={{
                        width: dropdownRef.current ? dropdownRef.current.offsetWidth : '160px',
                        left: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().left : 0,
                        top: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().bottom + 4 : 0,
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {!hideSearch && (
                        <div className="p-2 border-b border-gray-50 bg-gray-50/30">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[16px]">search</span>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search weights..."
                                    className="w-full h-8 pl-8 pr-3 bg-white border border-gray-100 rounded-lg text-[11px] font-bold outline-none focus:border-primary transition-all placeholder:text-gray-300"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Escape') setIsOpen(false);
                                    }}
                                />
                            </div>
                        </div>
                    )}
                    <div className="overflow-y-auto max-h-[250px] p-1 custom-scrollbar">
                        <div className="px-3 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Font Weights</div>
                        {filteredWeights.map(weight => {
                            const label = weightLabels[weight] || weight;
                            return (
                                <button
                                    key={weight}
                                    onClick={() => { onChange(weight); setIsOpen(false); setSearchTerm(''); }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === weight ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                                    style={{ fontWeight: weight as any }}
                                >
                                    <span>{label}</span>
                                    {value === weight && <span className="material-symbols-outlined text-[14px]">check</span>}
                                </button>
                            );
                        })}
                        {filteredWeights.length === 0 && (
                            <div className="px-3 py-6 text-center">
                                <span className="material-symbols-outlined text-gray-200 text-[32px] mb-2">search_off</span>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No weights found</div>
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            `}</style>
        </div>
    );
};

export default WeightSelector;
