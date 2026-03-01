import React, { useState, useRef, useEffect } from 'react';

interface ZoomComboBoxProps {
    value: number; // percentage value e.g. 100
    onChange: (value: number) => void;
    className?: string;
}

const PRESETS = [25, 50, 75, 100, 125, 150, 200];

const ZoomComboBox: React.FC<ZoomComboBoxProps> = ({ value, onChange, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(`${Math.round(value)}%`);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

    useEffect(() => {
        setInputValue(`${Math.round(value)}%`);
    }, [value]);

    const updateCoords = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width
            });
        }
    };

    React.useLayoutEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
        }
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setInputValue(`${Math.round(value)}%`);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow numeric values and the percent sign
        if (/^[0-9]*%?$/.test(val)) {
            setInputValue(val);
        }
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const numValue = parseInt(inputValue.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numValue)) {
                onChange(Math.max(10, Math.min(500, numValue)));
            }
            setIsOpen(false);
            inputRef.current?.blur();
        }
    };

    const handleSelectPreset = (preset: number) => {
        onChange(preset);
        setIsOpen(false);
    };

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div 
                className={`flex items-center bg-gray-50 border border-gray-200 rounded-lg hover:border-primary/50 transition-all px-2 py-1 gap-1 cursor-pointer group ${isOpen ? 'ring-2 ring-primary/10 border-primary' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleInputKeyDown}
                    className="w-12 bg-transparent text-[11px] font-bold text-gray-700 outline-none cursor-text focus:cursor-text text-right"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(true);
                        inputRef.current?.select();
                    }}
                />
                <span className={`material-symbols-outlined text-[16px] text-gray-400 group-hover:text-primary transition-all ${isOpen ? 'rotate-180' : ''}`}>
                    keyboard_arrow_down
                </span>
            </div>

            {isOpen && (
                <div 
                    className="fixed bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 z-[9999]"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        minWidth: coords.width > 80 ? coords.width : 80,
                        opacity: coords.width === 0 ? 0 : 1
                    }}
                >
                    <div className="px-2 py-1 text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">
                        Zoom Level
                    </div>
                    {PRESETS.map((preset) => (
                        <button
                            key={preset}
                            onClick={() => handleSelectPreset(preset)}
                            className={`w-full text-left px-3 py-1.5 text-[10px] font-bold transition-colors hover:bg-primary/5 ${Math.round(value) === preset ? 'text-primary bg-primary/[0.03]' : 'text-gray-600 hover:text-primary'}`}
                        >
                            {preset}%
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ZoomComboBox;
