import React, { useState, useRef, useEffect } from 'react';

interface BorderStyleSelectorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    onMouseDown?: (e: React.MouseEvent) => void;
}

const BorderStyleSelector: React.FC<BorderStyleSelectorProps> = ({ value, onChange, className, onMouseDown }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const styles = [
        { id: 'solid', label: 'Solid', icon: 'segment' },
        { id: 'dashed', label: 'Dashed', icon: 'reorder' },
        { id: 'dotted', label: 'Dotted', icon: 'more_horiz' },
        { id: 'double', label: 'Double', icon: 'menu' },
        { id: 'none', label: 'None', icon: 'block' },
    ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedStyle = styles.find(s => s.id === (value || 'solid')) || styles[0];

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                onMouseDown={onMouseDown}
                onClick={() => setIsOpen(!isOpen)}
                className={className || "w-full h-9 pl-10 pr-2 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white"}
            >
                <span className="truncate uppercase tracking-tight text-[10px]">{selectedStyle.label}</span>
                <span className={`material-symbols-outlined text-[14px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[9px]">
                    {selectedStyle.icon}
                </span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[500] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="overflow-y-auto max-h-[250px] p-1 custom-scrollbar">
                        {styles.map(style => (
                            <button
                                key={style.id}
                                onClick={() => { onChange(style.id); setIsOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-[10px] hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === style.id ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-bold uppercase tracking-tight'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-[6px]">{style.icon}</span>
                                    <span>{style.label}</span>
                                </div>
                                {value === style.id && <span className="material-symbols-outlined text-[8px]">check</span>}
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

export default BorderStyleSelector;
