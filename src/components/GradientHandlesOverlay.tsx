import React, { useRef, useState, useEffect } from 'react';
import ColorPicker from './ColorPicker';

export type GradientStop = {
    id: string;
    color: string;
    offset: number; // 0 to 1
};

export type GradientFill = {
    type: 'linear' | 'radial';
    color?: string;
    color2?: string;
    stops?: GradientStop[];
    gradientAngle?: number;
    gradientLength?: number;
    gradientCenterX?: number;
    gradientCenterY?: number;
    gradientRadius?: number;
};

interface GradientHandlesOverlayProps {
    width: number;
    height: number;
    fill: GradientFill;
    fillIndex: number;
    onUpdate: (updates: Partial<GradientFill>) => void;
    zoom: number;
    rotation?: number;
}

function pointToAngle(x1: number, y1: number, x2: number, y2: number): number {
    let a = (Math.atan2(x2 - x1, -(y2 - y1)) * 180 / Math.PI);
    if (a < 0) a += 360;
    return a;
}

const GradientHandlesOverlay: React.FC<GradientHandlesOverlayProps> = ({
    width: w,
    height: h,
    fill,
    fillIndex,
    onUpdate,
    zoom,
    rotation = 0
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<{ type: 'linear-start' | 'linear-end' | 'radial-center' | 'radial-radius' | 'stop', stopId?: string } | null>(null);
    const dragHasMoved = useRef(false);
    const initialAltKey = useRef(false);
    const dragOffsetStart = useRef(0);

    const HANDLE_SIZE = 14;
    const HANDLE_INNER = 8;

    const angle = fill.gradientAngle ?? 180;
    const len = fill.gradientLength ?? 100;
    const cx = fill.gradientCenterX ?? 50;
    const cy = fill.gradientCenterY ?? 50;
    const radius = fill.gradientRadius ?? 100;

    // Normalize stops
    const stops = React.useMemo(() => {
        if (Array.isArray(fill.stops) && fill.stops.length > 0) return fill.stops;
        return [
            { id: 'start', color: fill.color || '#FFFFFF', offset: 0 },
            { id: 'end', color: fill.color2 || '#000000', offset: 1 }
        ];
    }, [fill.stops, fill.color, fill.color2]);

    useEffect(() => {
        if (!dragging) return;

        const onMove = (e: MouseEvent) => {
            dragHasMoved.current = true;
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            // Step 1: Get center of the rotated div (AABB center is the same as rotated div center)
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            // Step 2: Mouse offset from center in screen pixels
            const dx = e.clientX - centerX;
            const dy = e.clientY - centerY;

            // Step 3: Un-rotate the offset to get local coordinates (zoomed)
            const rad = rotation * Math.PI / 180;
            const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
            const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad);

            // Step 4: Convert to logical pixels by dividing by zoom
            const logicalLocalX = localX / zoom;
            const logicalLocalY = localY / zoom;

            // Step 5: Convert to percentages relative to unrotated logical box (w, h)
            // Note: Since (logicalLocalX, logicalLocalY) are relative to center, we add w/2, h/2
            const px = ((logicalLocalX + w / 2) / w) * 100;
            const py = ((logicalLocalY + h / 2) / h) * 100;

            if (dragging.type === 'linear-start') {
                const r = angle * Math.PI / 180;
                const ex_px = (cx / 100) * w + (len / 100 * w) * Math.sin(r);
                const ey_px = (cy / 100) * h - (len / 100 * w) * Math.cos(r);
                const px_px = (px / 100) * w;
                const py_px = (py / 100) * h;

                const newAngle = pointToAngle(px_px, py_px, ex_px, ey_px);
                const dist_px = Math.sqrt((ex_px - px_px) ** 2 + (ey_px - py_px) ** 2);
                const newLen = (dist_px / w) * 100;

                onUpdate({
                    gradientCenterX: Math.round(px * 100) / 100,
                    gradientCenterY: Math.round(py * 100) / 100,
                    gradientAngle: Math.round(newAngle),
                    gradientLength: Math.round(newLen * 100) / 100
                });
            } else if (dragging.type === 'linear-end') {
                const cx_px = (cx / 100) * w;
                const cy_px = (cy / 100) * h;
                const px_px = (px / 100) * w;
                const py_px = (py / 100) * h;

                const newAngle = pointToAngle(cx_px, cy_px, px_px, py_px);
                const dist_px = Math.sqrt((px_px - cx_px) ** 2 + (py_px - cy_px) ** 2);
                const newLen = (dist_px / w) * 100;

                onUpdate({
                    gradientAngle: Math.round(newAngle),
                    gradientLength: Math.round(newLen * 100) / 100
                });
            } else if (dragging.type === 'radial-center') {
                onUpdate({
                    gradientCenterX: Math.round(px * 100) / 100,
                    gradientCenterY: Math.round(py * 100) / 100
                });
            } else if (dragging.type === 'radial-radius') {
                const cx_px = (cx / 100) * w;
                const cy_px = (cy / 100) * h;
                const px_px = (px / 100) * w;
                const py_px = (py / 100) * h;
                const dist_px = Math.sqrt((px_px - cx_px) ** 2 + (py_px - cy_px) ** 2);
                const newRad = (dist_px / w) * 100;
                onUpdate({ gradientRadius: Math.round(newRad * 100) / 100 });
            } else if (dragging.type === 'stop' && dragging.stopId) {
                // Determine offset along the axis
                const cx_px = (cx / 100) * w;
                const cy_px = (cy / 100) * h;
                const px_px = (px / 100) * w;
                const py_px = (py / 100) * h;

                let newOffset = 0;
                let distFromLine = 0;

                if (fill.type === 'linear') {
                    const r = angle * Math.PI / 180;
                    const ex_px = cx_px + (len / 100 * w) * Math.sin(r);
                    const ey_px = cy_px - (len / 100 * w) * Math.cos(r);

                    // Project point on line (cx_px, cy_px) -> (ex_px, ey_px)
                    const dx = ex_px - cx_px;
                    const dy = ey_px - cy_px;
                    const l2 = dx * dx + dy * dy;
                    if (l2 === 0) {
                        newOffset = 0;
                    } else {
                        const t = ((px_px - cx_px) * dx + (py_px - cy_px) * dy) / l2;
                        newOffset = t;
                    }
                    // Distance from line segment
                    const projX = cx_px + newOffset * dx;
                    const projY = cy_px + newOffset * dy;
                    distFromLine = Math.sqrt((px_px - projX) ** 2 + (py_px - projY) ** 2);
                } else {
                    // Radial axis is naturally from center to radius point
                    // Actually for radial, the "axis" is any radius. But we use a horizontal one for the handle.
                    const d = Math.sqrt((px_px - cx_px) ** 2 + (py_px - cy_px) ** 2);
                    newOffset = d / (radius / 100 * w);
                    distFromLine = 0; // Harder to "drag away" from radial circles
                }

                // Drag away to remove (only for new stops or non-endpoint stops if we want to be strict)
                // Let's say any stop can be removed if dragged > 50px away
                if (distFromLine > 50 * handleScale && stops.length > 2) {
                    const newStops = stops.filter(s => s.id !== dragging.stopId);
                    onUpdate({ stops: newStops });
                    setDragging(null);
                    return;
                }

                const newStops = stops.map(s => s.id === dragging.stopId ? { ...s, offset: Math.max(0, Math.min(1, newOffset)) } : s);
                onUpdate({ stops: newStops });
            }
        };

        const onUp = () => setDragging(null);

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [dragging, cx, cy, angle, len, radius, w, h, stops, onUpdate]);

    const handleScale = 1 / zoom;
    const r = angle * Math.PI / 180;
    const vx1 = (cx / 100) * w;
    const vy1 = (cy / 100) * h;
    const vx2 = vx1 + (len / 100 * w) * Math.sin(r);
    const vy2 = vy1 - (len / 100 * w) * Math.cos(r);

    const visualRadius = (radius / 100 * w);

    const renderStopHandle = (stop: GradientStop) => {
        let sx, sy;
        if (fill.type === 'linear') {
            sx = vx1 + (vx2 - vx1) * stop.offset;
            sy = vy1 + (vy2 - vy1) * stop.offset;
        } else {
            sx = vx1 + visualRadius * stop.offset;
            sy = vy1;
        }

        return (
            <ColorPicker
                key={stop.id}
                value={stop.color}
                onChange={(c) => {
                    const newStops = stops.map(s => s.id === stop.id ? { ...s, color: c } : s);
                    onUpdate({ stops: newStops });
                }}
                renderTrigger={(onClick) => (
                    <div
                        onMouseDown={(e) => {
                            e.stopPropagation();
                            dragHasMoved.current = false;
                            
                            if (e.altKey || e.metaKey) {
                                const newId = Math.random().toString(36).substr(2, 9);
                                const newStop = { ...stop, id: newId };
                                onUpdate({ stops: [...stops, newStop] });
                                setDragging({ type: 'stop', stopId: newId });
                            } else {
                                setDragging({ type: 'stop', stopId: stop.id });
                            }
                        }}
                        onClick={(e) => { e.stopPropagation(); if (!dragHasMoved.current) onClick(); }}
                        className="group pointer-events-auto cursor-grab active:cursor-grabbing"
                        style={{ 
                            position: 'absolute', 
                            left: sx, 
                            top: sy, 
                            transform: `translate(-50%, -50%) scale(${handleScale})`, 
                            zIndex: 110 
                        }}
                    >
                        <div className="rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                            style={{ 
                                width: HANDLE_SIZE, 
                                height: HANDLE_SIZE, 
                                backgroundColor: 'white', 
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.15), 0 2px 5px rgba(0,0,0,0.4)',
                                border: dragging?.stopId === stop.id ? '2px solid #136c6c' : 'none'
                            }}>
                            <div className="rounded-full w-[10px] h-[10px]" style={{ backgroundColor: stop.color, border: '1px solid rgba(0,0,0,0.1)' }} />
                        </div>
                    </div>
                )}
            />
        );
    };

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
            {fill.type === 'linear' && (
                <>
                    <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                        <line x1={vx1} y1={vy1} x2={vx2} y2={vy2} stroke="white" strokeWidth={10 * handleScale} strokeOpacity={0.01} />
                        <line x1={vx1} y1={vy1} x2={vx2} y2={vy2} stroke="white" strokeWidth={2.5 * handleScale} strokeOpacity={0.6} />
                        <line x1={vx1} y1={vy1} x2={vx2} y2={vy2} stroke="#136c6c" strokeWidth={1.5 * handleScale} />
                    </svg>
                    
                    {/* Start Handle */}
                    <div
                        onMouseDown={(e) => { e.stopPropagation(); setDragging({ type: 'linear-start' }); }}
                        className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
                        style={{ left: vx1, top: vy1, transform: `translate(-50%, -50%) scale(${handleScale})`, zIndex: 120 }}
                    >
                        <div className="size-4 rounded-sm bg-white border-2 border-[#136c6c] shadow-md flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-[#136c6c]" />
                        </div>
                    </div>

                    {/* End Handle */}
                    <div
                        onMouseDown={(e) => { e.stopPropagation(); setDragging({ type: 'linear-end' }); }}
                        className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
                        style={{ left: vx2, top: vy2, transform: `translate(-50%, -50%) scale(${handleScale})`, zIndex: 120 }}
                    >
                        <div className="size-4 rounded-sm bg-white border-2 border-[#136c6c] shadow-md flex items-center justify-center">
                           <span className="material-symbols-outlined text-[12px] text-[#136c6c] font-black">close</span>
                        </div>
                    </div>

                    {stops.map(renderStopHandle)}
                </>
            )}
            {fill.type === 'radial' && (
                <>
                    <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
                        <circle cx={vx1} cy={vy1} r={visualRadius} fill="none" stroke="white" strokeWidth={2 * handleScale} strokeOpacity={0.4} strokeDasharray={`${4 * handleScale} ${2 * handleScale}`} />
                        
                        <line x1={vx1} y1={vy1} x2={vx1 + visualRadius} y2={vy1} stroke="white" strokeWidth={10 * handleScale} strokeOpacity={0.01} />
                        <line x1={vx1} y1={vy1} x2={vx1 + visualRadius} y2={vy1} stroke="white" strokeWidth={2.5 * handleScale} strokeOpacity={0.6} />
                        <line x1={vx1} y1={vy1} x2={vx1 + visualRadius} y2={vy1} stroke="#136c6c" strokeWidth={1.5 * handleScale} />
                    </svg>

                    {/* Center Handle */}
                    <div
                        onMouseDown={(e) => { e.stopPropagation(); setDragging({ type: 'radial-center' }); }}
                        className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
                        style={{ left: vx1, top: vy1, transform: `translate(-50%, -50%) scale(${handleScale})`, zIndex: 120 }}
                    >
                        <div className="size-4 rounded-full bg-white border-2 border-[#136c6c] shadow-md flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-[#136c6c]" />
                        </div>
                    </div>

                    {/* Radius Handle */}
                    <div
                        onMouseDown={(e) => { e.stopPropagation(); setDragging({ type: 'radial-radius' }); }}
                        className="absolute pointer-events-auto cursor-grab active:cursor-grabbing"
                        style={{ left: vx1 + visualRadius, top: vy1, transform: `translate(-50%, -50%) scale(${handleScale})`, zIndex: 120 }}
                    >
                        <div className="size-4 rounded-full bg-white border-2 border-[#136c6c] shadow-md flex items-center justify-center">
                            <div className="size-1.5 rounded-full bg-[#136c6c]" />
                        </div>
                    </div>

                    {stops.map(renderStopHandle)}
                </>
            )}
        </div>
    );
};

export default GradientHandlesOverlay;
