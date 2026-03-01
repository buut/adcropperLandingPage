import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    label?: string;
    className?: string;
    swatches?: string[];
    variant?: 'default' | 'minimal';
    renderTrigger?: (onClick: () => void, isOpen: boolean) => React.ReactNode;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ 
    value = '#136c6c', 
    onChange, 
    label, 
    className, 
    swatches,
    variant = 'default',
    renderTrigger
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [popoverCoords, setPopoverCoords] = useState<{ top: number, left: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const eyeDropperInputRef = useRef<HTMLInputElement>(null);

    const updateCoords = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const pickerHeight = swatches && swatches.length > 0 ? 460 : 360;
            const pickerWidth = 240;
            const sidebarWidth = 72; // LeftSidebar width
            const gap = 12;
            
            // Default: try to place near the trigger
            let top = rect.bottom + 8;
            let left = rect.left;

            // If triggered from the right side (PropertiesBar), move to be touching 
            // the properties bar's left side.
            if (rect.left > window.innerWidth / 2) {
                const propertiesBarWidth = 280;
                left = window.innerWidth - propertiesBarWidth - pickerWidth - 8;
                top = rect.top; // Align top with the trigger
            }

            // Adjust vertical position if overflowing bottom
            if (top + pickerHeight > window.innerHeight - 12) {
                // If it's on the right side, we can also try to align the bottom of the picker with the bottom of the trigger
                if (rect.left > window.innerWidth / 2) {
                   top = rect.bottom - pickerHeight;
                } else {
                   top = rect.top - pickerHeight - 8;
                }
            }
            
            // Final safety clamps (prevent overflowing both top and bottom)
            top = Math.max(12, Math.min(top, window.innerHeight - pickerHeight - 12));
            
            // Ensure it doesn't overlap the left sidebar
            if (left < sidebarWidth + gap) {
                left = sidebarWidth + gap;
            }

            // Adjust horizontal position if overflowing right
            if (left + pickerWidth > window.innerWidth - 12) {
                left = window.innerWidth - pickerWidth - 12;
            }

            setPopoverCoords({ top, left });
        }
    }, [swatches]);

    useEffect(() => {
        if (isOpen) {
            updateCoords();
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
        } else {
            setPopoverCoords(null);
        }
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [isOpen, updateCoords]);
    const parseColorToRgb = (color: string) => {
        if (!color) return { r: 0, g: 0, b: 0, a: 1 };
        
        // Handle rgb/rgba
        if (color.startsWith('rgb')) {
            const matches = color.match(/[\d.]+/g);
            if (matches && matches.length >= 3) {
                return {
                    r: parseInt(matches[0]),
                    g: parseInt(matches[1]),
                    b: parseInt(matches[2]),
                    a: matches.length === 4 ? parseFloat(matches[3]) : 1
                };
            }
        }

        // Handle hex
        const hex = color.startsWith('#') ? color : '#000000';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
        return { r, g, b, a };
    };

    const hexToRgb = parseColorToRgb; // Keep alias for existing code

    const rgbToHex = (r: number, g: number, b: number, a: number = 1) => {
        const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
        const alpha = a < 1 ? toHex(a * 255) : '';
        return `#${toHex(r)}${toHex(g)}${toHex(b)}${alpha}`.toUpperCase();
    };

    const rgbToHsv = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s, v = max;
        const d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max !== min) {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, v: v * 100 };
    };

    const hsvToRgb = (h: number, s: number, v: number) => {
        h /= 360; s /= 100; v /= 100;
        let r = 0, g = 0, b = 0;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v; g = t; b = p; break;
            case 1: r = q; g = v; b = p; break;
            case 2: r = p; g = v; b = t; break;
            case 3: r = p; g = q; b = v; break;
            case 4: r = t; g = p; b = v; break;
            case 5: r = v; g = p; b = q; break;
        }
        return { r: r * 255, g: g * 255, b: b * 255 };
    };

    // State derived from props
    const colorData = hexToRgb(value);
    const hsv = rgbToHsv(colorData.r, colorData.g, colorData.b);
    
    const [h, setH] = useState(hsv.h);
    const [s, setS] = useState(hsv.s);
    const [v, setV] = useState(hsv.v);
    const [a, setA] = useState(colorData.a);

    // Update internal state when value prop changes externally
    useEffect(() => {
        const newColor = hexToRgb(value);
        const newHsv = rgbToHsv(newColor.r, newColor.g, newColor.b);
        setH(newHsv.h);
        setS(newHsv.s);
        setV(newHsv.v);
        setA(newColor.a);
    }, [value]);



    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const updateColor = (newH: number, newS: number, newV: number, newA: number) => {
        const rgb = hsvToRgb(newH, newS, newV);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b, newA);
        onChangeRef.current(hex);
    };

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // If the target is no longer in the document (e.g. removed by React update), ignore the click
            if (!document.contains(event.target as Node)) return;

            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Check if click is inside the popover content using ref for reliability
                if (popoverRef.current && popoverRef.current.contains(event.target as Node)) return;
                
                // Fallback: Check class name just in case ref is not ready
                const target = event.target as HTMLElement;
                if (target.closest('.color-picker-popover-content')) return;

                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Saturation/Value Picker
    const svRef = useRef<HTMLDivElement>(null);
    const handleSvMove = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!svRef.current) return;
        const rect = svRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
        
        let newS = ((clientX - rect.left) / rect.width) * 100;
        let newV = 100 - ((clientY - rect.top) / rect.height) * 100;
        
        newS = Math.max(0, Math.min(100, newS));
        newV = Math.max(0, Math.min(100, newV));
        
        setS(newS);
        setV(newV);
        updateColor(h, newS, newV, a);
    }, [h, a]);

    const onSvMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleSvMove(e);
        const onMouseMove = (moveEvent: MouseEvent) => handleSvMove(moveEvent);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // Hue Slider
    const hueRef = useRef<HTMLDivElement>(null);
    const handleHueMove = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!hueRef.current) return;
        const rect = hueRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        let newH = ((clientX - rect.left) / rect.width) * 360;
        newH = Math.max(0, Math.min(360, newH));
        setH(newH);
        updateColor(newH, s, v, a);
    }, [s, v, a]);

    const onHueMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleHueMove(e);
        const onMouseMove = (moveEvent: MouseEvent) => handleHueMove(moveEvent);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // Opacity Slider
    const alphaRef = useRef<HTMLDivElement>(null);
    const handleAlphaMove = useCallback((e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if (!alphaRef.current) return;
        const rect = alphaRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
        let newA = (clientX - rect.left) / rect.width;
        newA = Math.max(0, Math.min(1, newA));
        setA(newA);
        updateColor(h, s, v, newA);
    }, [h, s, v]);

    const onAlphaMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleAlphaMove(e);
        const onMouseMove = (moveEvent: MouseEvent) => handleAlphaMove(moveEvent);
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const handleEyeDropper = async () => {
        if ('EyeDropper' in window) {
            try {
                const eyeDropper = new (window as any).EyeDropper();
                const result = await eyeDropper.open();
                const color = result.sRGBHex;
                
                const rgb = parseColorToRgb(color);
                const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                
                setH(hsv.h);
                setS(hsv.s);
                setV(hsv.v);
                setA(rgb.a);
                onChange(color);
                return;
            } catch (e) {
                console.log('EyeDropper cancelled or failed', e);
            }
        }
        
        // Fallback for HTTP or unsupported browsers: Use html2canvas to capture screen
        try {
            // Close the popover to allow picking colors behind it
            setIsOpen(false);
            
            // Set global cursor to crosshair
            const style = document.createElement('style');
            style.id = 'eyedropper-cursor-style';
            style.innerHTML = '* { cursor: crosshair !important; }';
            document.head.appendChild(style);

            // Dynamically import html2canvas to avoid increasing initial bundle size unnecessarily
            const html2canvas = (await import('html2canvas')).default;
            
            // Render the body. Note: this might take a moment.
            const canvas = await html2canvas(document.body, { 
                useCORS: true, 
                logging: false,
                ignoreElements: (element) => element.classList.contains('color-picker-popover-content') 
            });
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
                document.head.removeChild(style);
                return;
            }

            const cleanup = () => {
                const s = document.getElementById('eyedropper-cursor-style');
                if (s) s.remove();
                document.removeEventListener('click', onClick, true);
                document.removeEventListener('keydown', onKeyDown, true);
            };

            const onClick = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                
                const x = e.clientX;
                const y = e.clientY;
                
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                const r = pixel[0];
                const g = pixel[1];
                const b = pixel[2];
                const a = pixel[3] / 255;
                
                // Usually we just want the solid RGB color from the screen, ignoring actual alpha if blended
                const hex = rgbToHex(r, g, b, 1);
                const hsv = rgbToHsv(r, g, b);
                
                setH(hsv.h);
                setS(hsv.s);
                setV(hsv.v);
                setA(1); // Force alpha to 1 for solid color picking
                onChange(hex);
                
                cleanup();
            };

            const onKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    cleanup();
                }
            };

            // Use capture phase (true) to intercept the click before other elements handle it
            document.addEventListener('click', onClick, true);
            document.addEventListener('keydown', onKeyDown, true);

        } catch (error) {
            console.error('html2canvas fallback failed:', error);
            const s = document.getElementById('eyedropper-cursor-style');
            if (s) s.remove();
        }
    };

    const pureHueRgb = hsvToRgb(h, 100, 100);
    const displayRgb = hsvToRgb(h, s, v);

    const popoverContent = (
        <div 
            ref={popoverRef}
            className="fixed bg-white border border-gray-200/80 rounded-xl shadow-xl z-[9999] flex flex-col color-picker-popover-content overflow-hidden"
            style={{ 
                top: popoverCoords?.top || 0,
                left: popoverCoords?.left || 0,
                width: 248
            }}
            onMouseDown={(e) => {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') {
                    e.preventDefault();
                }
                e.stopPropagation();
            }}
        >
            <div className="p-3 pb-2 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
              
                    <button
                        type="button"
                        onClick={handleEyeDropper}
                        className="flex items-center justify-center size-8 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-primary hover:border-primary/40 hover:bg-white transition-all shadow-sm active:scale-95 group"
                        title="Select Color"
                    >
                        <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">colorize</span>
                    </button>
               
                <div className="relative size-8 rounded-lg shadow-sm overflow-hidden checkerboard border border-gray-200/60">
                    <div className="absolute inset-0" style={{ backgroundColor: `rgba(${displayRgb.r}, ${displayRgb.g}, ${displayRgb.b}, ${a})` }} />
                </div>
            </div>
            <div className="p-3 flex flex-col gap-3">
                {/* Saturation/Value Square */}
                <div 
                    ref={svRef}
                    onMouseDown={onSvMouseDown}
                    className="relative w-full aspect-square rounded-lg overflow-hidden cursor-crosshair border border-gray-200/60"
                    style={{ backgroundColor: `rgb(${pureHueRgb.r}, ${pureHueRgb.g}, ${pureHueRgb.b})` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                    <div 
                        className="absolute size-4 border-2 border-white rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.3)] -translate-x-1/2 translate-y-1/2 pointer-events-none"
                        style={{ left: `${s}%`, bottom: `${v}%` }}
                    />
                </div>

                <div className="flex flex-col gap-2.5">
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Ton</span>
                        <div 
                            ref={hueRef}
                            onMouseDown={onHueMouseDown}
                            className="relative h-3 w-full rounded-full cursor-pointer hue-gradient border border-gray-200/50"
                        >
                            <div className="absolute size-4 bg-white border border-gray-200 rounded-full shadow -top-0.5 -translate-x-1/2" style={{ left: `${(h / 360) * 100}%` }} />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Opaklık</span>
                        <div 
                            ref={alphaRef}
                            onMouseDown={onAlphaMouseDown}
                            className="relative h-3 w-full rounded-full cursor-pointer checkerboard overflow-hidden border border-gray-200/50"
                        >
                            <div className="absolute inset-0" style={{ background: `linear-gradient(to right, transparent, rgba(${displayRgb.r}, ${displayRgb.g}, ${displayRgb.b}, 1))` }} />
                            <div className="absolute size-4 bg-white border border-gray-200 rounded-full shadow -top-0.5 -translate-x-1/2 z-10" style={{ left: `${a * 100}%` }} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">HEX</span>
                        <input 
                            type="text"
                            value={rgbToHex(displayRgb.r, displayRgb.g, displayRgb.b).toUpperCase()}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (/^#[0-9A-F]{0,6}$/i.test(val)) {
                                    if (val.length === 7) {
                                        const rgb = parseColorToRgb(val);
                                        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                                        setH(hsv.h); setS(hsv.s); setV(hsv.v);
                                        updateColor(hsv.h, hsv.s, hsv.v, a);
                                    } else {
                                        onChange(val);
                                    }
                                }
                            }}
                            className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-mono font-semibold uppercase tracking-tight focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Alpha %</span>
                        <input 
                            type="number"
                            min="0"
                            max="100"
                            value={Math.round(a * 100)}
                            onChange={(e) => {
                                const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                setA(val / 100);
                                updateColor(h, s, v, val / 100);
                            }}
                            className="h-8 px-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] font-semibold focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/10 outline-none"
                        />
                    </div>
                </div>

                {swatches && swatches.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Doküman renkleri</span>
                        <div className="flex flex-wrap gap-1.5 max-h-[88px] overflow-y-auto">
                            {swatches.map((color, i) => (
                                <button
                                    key={`${color}-${i}`}
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const rgb = hexToRgb(color);
                                        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                                        setH(hsv.h); setS(hsv.s); setV(hsv.v); setA(rgb.a);
                                        onChange(color);
                                    }}
                                    className="size-6 rounded-md border border-gray-200/80 transition-all hover:scale-105 active:scale-95 hover:border-primary/50 hover:shadow-sm"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={`relative ${variant === 'default' ? className : 'shrink-0'}`} ref={containerRef}>
            {label && variant === 'default' && !renderTrigger && (
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                    {label}
                </label>
            )}
            
            {renderTrigger ? (
                renderTrigger(() => setIsOpen(!isOpen), isOpen)
            ) : variant === 'default' ? (
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-gray-200 bg-white hover:border-primary/40 hover:bg-gray-50/50 transition-all text-left"
                >
                    <div className="relative size-8 shrink-0 rounded-lg overflow-hidden checkerboard border border-gray-200/70 shadow-sm flex items-center justify-center">
                        {value === 'transparent' ? (
                            <span className="material-symbols-outlined text-gray-400 text-[18px] relative z-10">block</span>
                        ) : (
                            <div className="absolute inset-0" style={{ backgroundColor: `rgba(${displayRgb.r}, ${displayRgb.g}, ${displayRgb.b}, ${a})` }} />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-semibold text-gray-700 font-mono block truncate">
                            {value === 'transparent' ? 'NONE' : rgbToHex(displayRgb.r, displayRgb.g, displayRgb.b).toUpperCase()}
                        </span>
                        <span className="text-[9px] text-gray-400 font-medium">
                            {value === 'transparent' ? 'No Fill' : `${Math.round(a * 100)}% opaklık`}
                        </span>
                    </div>
                    <span className={`material-symbols-outlined text-[20px] text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        expand_more
                    </span>
                </button>
            ) : (
                <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={() => setIsOpen(!isOpen)}
                    className="size-9 flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:border-primary/40 hover:bg-gray-50/50 transition-all"
                    title={value === 'transparent' ? 'NONE' : rgbToHex(displayRgb.r, displayRgb.g, displayRgb.b).toUpperCase()}
                >
                    <div className="relative size-7 rounded-md overflow-hidden checkerboard border border-gray-200/70 flex items-center justify-center">
                        {value === 'transparent' ? (
                            <span className="material-symbols-outlined text-gray-400 text-[16px] relative z-10">block</span>
                        ) : (
                            <div className="absolute inset-0" style={{ backgroundColor: `rgba(${displayRgb.r}, ${displayRgb.g}, ${displayRgb.b}, ${a})` }} />
                        )}
                    </div>
                </button>
            )}

            {isOpen && popoverCoords && createPortal(popoverContent, document.body)}

            <input 
                ref={eyeDropperInputRef}
                type="color"
                className="sr-only"
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', visibility: 'hidden' }}
                onChange={(e) => {
                    const color = e.target.value;
                    const rgb = parseColorToRgb(color);
                    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
                    setH(hsv.h);
                    setS(hsv.s);
                    setV(hsv.v);
                    setA(1); // Native color input doesn't support alpha
                    onChange(color);
                }}
            />

            <style>{`
                .checkerboard {
                    background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
                                    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                                    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                                    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
                    background-size: 8px 8px;
                    background-position: 0 0, 0 4px, 4px -4px, -4px 0px;
                    background-color: white;
                }
                .hue-gradient {
                    background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);
                }
            `}</style>
        </div>
    );
};

export default ColorPicker;
