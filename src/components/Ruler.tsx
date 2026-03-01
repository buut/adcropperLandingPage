import React, { useEffect, useRef } from 'react';

interface RulerProps {
    orientation: 'horizontal' | 'vertical';
    zoom: number;
    scrollPos: number;
    size: number; // width for vertical, height for horizontal (usually 20-30px)
    length: number; // total visible length (viewport size)
    backgroundColor?: string;
    tickColor?: string;
    textColor?: string;
    mousePos?: number;
    origin?: number;
    onMouseDown?: (e: React.MouseEvent) => void;
}

const Ruler: React.FC<RulerProps> = ({
    orientation,
    zoom,
    scrollPos,
    size,
    length,
    backgroundColor = '#f3f4f6',
    tickColor = '#9ca3af',
    textColor = '#4b5563',
    mousePos,
    origin = 0,
    onMouseDown
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Support high DPI screens
        const dpr = window.devicePixelRatio || 1;
        canvas.width = (orientation === 'horizontal' ? length : size) * dpr;
        canvas.height = (orientation === 'horizontal' ? size : length) * dpr;
        ctx.scale(dpr, dpr);

        // Styling
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, (orientation === 'horizontal' ? length : size), (orientation === 'horizontal' ? size : length));
        ctx.strokeStyle = tickColor;
        ctx.fillStyle = textColor;
        ctx.font = '10px Manrope, sans-serif';
        ctx.lineWidth = 1;

        const isHoriz = orientation === 'horizontal';
        
        // Calculate step sizes based on zoom
        const worldUnitsBetweenMajorTicksCandidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
        
        let worldStep = 100;
        for (const candidate of worldUnitsBetweenMajorTicksCandidates) {
            if (candidate * zoom >= 60) {
                worldStep = candidate;
                break;
            }
        }

        const screenStep = worldStep * zoom;
        
        // Calculate start based on grid index k where worldVal = k * worldStep
        // We want (origin + k * worldStep) * zoom >= scrollPos (approximately)
        // Actually we want startOffset to be just offscreen left/top
        const startK = Math.floor(((scrollPos / zoom) - origin) / worldStep);
        const startWorld = origin + startK * worldStep;
        const startOffset = (startWorld * zoom) - scrollPos;

     //   console.log(`Ruler [${orientation}]:`, { zoom, scrollPos, origin, startK, startWorld, startOffset });

        for (let x = startOffset; x < length; x += screenStep) {
            const worldVal = Math.round((x + scrollPos) / zoom - origin);
            
            // Major tick
            ctx.beginPath();
            ctx.strokeStyle = tickColor;
            if (isHoriz) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, size);
            } else {
                ctx.moveTo(0, x);
                ctx.lineTo(size, x);
            }
            ctx.stroke();

            // Label
            if (isHoriz) {
                ctx.textAlign = 'left';
                ctx.fillText(worldVal.toString(), x + 4, size - 4);
            } else {
                ctx.save();
                ctx.textAlign = 'right'; // Right align to the size-4 point
                ctx.translate(size - 4, x); // Translate to the exact X coordinate
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(worldVal.toString(), 0, 0);
                ctx.restore();
            }

            // Minor ticks (10 subdivisions)
            const minorStep = screenStep / 10;
            for (let i = 1; i < 10; i++) {
                const mx = x + i * minorStep;
                if (mx > length) break;
                if (mx < 0) continue;

                const tickLen = i === 5 ? size / 2 : size / 4;
                ctx.beginPath();
                if (isHoriz) {
                    ctx.moveTo(mx, size - tickLen);
                    ctx.lineTo(mx, size);
                } else {
                    ctx.moveTo(size - tickLen, mx);
                    ctx.lineTo(size, mx);
                }
                ctx.stroke();
            }
        }

        // Draw Mouse Indicator
        if (mousePos !== undefined && mousePos >= 0 && mousePos <= length) {
            ctx.strokeStyle = '#ef4444'; // red-500
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (isHoriz) {
                ctx.moveTo(mousePos, 0);
                ctx.lineTo(mousePos, size);
            } else {
                ctx.moveTo(0, mousePos);
                ctx.lineTo(size, mousePos);
            }
            ctx.stroke();
        }

        // Draw border
        ctx.strokeStyle = '#e5e7eb';
        ctx.beginPath();
        if (isHoriz) {
            ctx.moveTo(0, size - 0.5);
            ctx.lineTo(length, size - 0.5);
        } else {
            ctx.moveTo(size - 0.5, 0);
            ctx.lineTo(size - 0.5, length);
        }
        ctx.stroke();

    }, [orientation, zoom, scrollPos, size, length, backgroundColor, tickColor, textColor, mousePos, origin]);

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={onMouseDown}
            style={{
                width: orientation === 'horizontal' ? length : size,
                height: orientation === 'horizontal' ? size : length,
                display: 'block'
            }}
        />
    );
};

export default Ruler;
