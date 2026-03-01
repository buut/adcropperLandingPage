import React, { useState } from 'react';

interface SliderZoomProps {
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: number;
    value?: number;
    onChange?: (value: number) => void;
    className?: string;
}

const SliderZoom: React.FC<SliderZoomProps> = ({
    min = 0,
    max = 100,
    step = 1,
    defaultValue = 50,
    value,
    onChange,
    className = ""
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value, 10);
        if (onChange) {
            onChange(newValue);
        }
    };

    const displayValue = value !== undefined ? value : defaultValue;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <span className="material-symbols-outlined text-[15px] text-gray-400 select-none">zoom_out</span>
            <input
                className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                type="range"
                min={min}
                max={max}
                step={step}
                value={displayValue}
                onChange={handleChange}
            />
            <span className="material-symbols-outlined text-[15px] text-gray-400 select-none">zoom_in</span>
            <span className="text-[10px] font-bold text-gray-400 min-w-[32px]">{displayValue}%</span>
        </div>
    );
};

export default SliderZoom;
