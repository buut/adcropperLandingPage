import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FontData } from '../App';

interface FontSelectorProps {
    fonts: FontData[];
    value: string;
    onChange: (value: string) => void;
    style?: React.CSSProperties;
    className?: string;
    onMouseDown?: (e: React.MouseEvent) => void;
    hideSearch?: boolean;
}

const FontSelector: React.FC<FontSelectorProps> = ({ fonts, value, onChange, style, className, onMouseDown, hideSearch }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const systemFonts = ['Outfit', 'Inter', 'Poppins', 'Roboto', 'Montserrat', 'Lato', 'Open Sans', 'Oswald', 'Raleway', 'Bebas Neue', 'Manrope'];
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredBrand = fonts.filter(f => f.isBrandFont && f.family.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredSystem = systemFonts.filter(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredGoogle = fonts.filter(f => f.isGoogleFonts && !f.isBrandFont && !systemFonts.includes(f.family) && f.family.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredCustom = fonts.filter(f => !f.isGoogleFonts && !f.isBrandFont && f.family.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                onMouseDown={onMouseDown}
                onClick={() => setIsOpen(!isOpen)}
                className={className || "w-full h-9 pl-9 pr-3 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white"}
                style={{ ...style, fontFamily: `'${value}', sans-serif` }}
            >
                <span className="truncate">{value || 'Select Font'}</span>
                <span className={`material-symbols-outlined text-[18px] text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">font_download</span>
            </button>

            {isOpen && createPortal(
                <div 
                    className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] z-[99999] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200"
                    data-text-toolbar="true"
                    style={{
                        width: dropdownRef.current ? dropdownRef.current.offsetWidth : '200px',
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
                                    placeholder="Search fonts..."
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
                        {filteredBrand.length > 0 && (
                            <div className="mb-2">
                                <div className="px-3 py-1.5 text-[9px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[14px]">verified</span>
                                    Brand Fonts
                                </div>
                                {filteredBrand.map(font => (
                                    <button
                                        key={font._id}
                                        onClick={() => { onChange(font.family); setIsOpen(false); setSearchTerm(''); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === font.family ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                                        style={{ fontFamily: `'${font.family}', sans-serif` }}
                                    >
                                        <span>{font.family}</span>
                                        {value === font.family && <span className="material-symbols-outlined text-[14px]">check</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {filteredSystem.length > 0 && (
                            <div className="mb-2">
                                <div className="px-3 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Standard Fonts</div>
                                {filteredSystem.map(font => (
                                    <button
                                        key={font}
                                        onClick={() => { onChange(font); setIsOpen(false); setSearchTerm(''); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === font ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                                        style={{ fontFamily: `'${font}', sans-serif` }}
                                    >
                                        <span>{font}</span>
                                        {value === font && <span className="material-symbols-outlined text-[14px]">check</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {filteredGoogle.length > 0 && (
                            <div className="mb-2">
                                <div className="px-3 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Google Fonts</div>
                                {filteredGoogle.map(font => (
                                    <button
                                        key={font._id}
                                        onClick={() => { onChange(font.family); setIsOpen(false); setSearchTerm(''); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === font.family ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                                        style={{ fontFamily: `'${font.family}', sans-serif` }}
                                    >
                                        <span>{font.family}</span>
                                        {value === font.family && <span className="material-symbols-outlined text-[14px]">check</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {filteredCustom.length > 0 && (
                            <div className="mb-2">
                                <div className="px-3 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">Custom Fonts</div>
                                {filteredCustom.map(font => (
                                    <button
                                        key={font._id}
                                        onClick={() => { onChange(font.family); setIsOpen(false); setSearchTerm(''); }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center justify-between ${value === font.family ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                                        style={{ fontFamily: `'${font.family}', sans-serif` }}
                                    >
                                        <span>{font.family}</span>
                                        {value === font.family && <span className="material-symbols-outlined text-[14px]">check</span>}
                                    </button>
                                ))}
                            </div>
                        )}
                        {filteredSystem.length === 0 && filteredGoogle.length === 0 && filteredCustom.length === 0 && (
                            <div className="px-3 py-6 text-center">
                                <span className="material-symbols-outlined text-gray-200 text-[32px] mb-2">search_off</span>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">No fonts found</div>
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

export default FontSelector;
