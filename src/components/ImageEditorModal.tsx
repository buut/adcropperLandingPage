import React, { useState, useRef, useEffect } from 'react';

interface ImageEditorModalProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (file: File) => void;
}

const PRESETS: Record<string, any> = {
    Normal: { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, blur: 0, hueRotate: 0 },
    Grayscale: { brightness: 100, contrast: 100, saturate: 100, grayscale: 100, sepia: 0, blur: 0, hueRotate: 0 },
    Clarendon: { brightness: 120, contrast: 120, saturate: 135, grayscale: 0, sepia: 0, blur: 0, hueRotate: 0 },
    Gingham: { brightness: 105, contrast: 90, saturate: 100, grayscale: 0, sepia: 0, blur: 0, hueRotate: 350 },
    Moon: { brightness: 110, contrast: 110, saturate: 0, grayscale: 100, sepia: 0, blur: 0, hueRotate: 0 },
    Lark: { brightness: 108, contrast: 90, saturate: 110, grayscale: 0, sepia: 0, blur: 0, hueRotate: 0 },
    Reyes: { brightness: 110, contrast: 85, saturate: 75, grayscale: 0, sepia: 22, blur: 0, hueRotate: 0 },
    Juno: { brightness: 100, contrast: 115, saturate: 140, grayscale: 0, sepia: 0, blur: 0, hueRotate: 0 },
    Slumber: { brightness: 105, contrast: 105, saturate: 66, grayscale: 0, sepia: 30, blur: 0, hueRotate: 0 },
    Crema: { brightness: 115, contrast: 95, saturate: 90, grayscale: 0, sepia: 0, blur: 0, hueRotate: 0 },
    Ludwig: { brightness: 105, contrast: 105, saturate: 110, grayscale: 0, sepia: 0, blur: 0, hueRotate: 0 },
    Aden: { brightness: 120, contrast: 90, saturate: 85, grayscale: 0, sepia: 0, blur: 0, hueRotate: 20 },
    Perpetua: { brightness: 105, contrast: 105, saturate: 100, grayscale: 0, sepia: 0, blur: 0, hueRotate: 0 }
};

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ imageUrl, onClose, onSave }) => {
    const [zoom, setZoom] = useState(1);
    const [filters, setFilters] = useState({ ...PRESETS.Normal });
    
    // History State
    const [history, setHistory] = useState<{ url: string }[]>([{ url: imageUrl }]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const currentImageUrl = history[historyIndex].url;

    // Background Removal State
    const [isRemovingBackground, setIsRemovingBackground] = useState(false);
    const [bgRemovalSuccess, setBgRemovalSuccess] = useState(false);
    const [bgProgress, setBgProgress] = useState('');

    const handleRemoveBackground = async () => {
        setIsRemovingBackground(true);
        setBgRemovalSuccess(false);
        setBgProgress('');
        try {
            // @ts-ignore
            const { removeBackground, preload } = await import("https://esm.run/@imgly/background-removal");
            
            const config = {
                device: "cpu",
                model: "isnet_fp16",
                progress: (key: string, current: number, total: number) => {
                    // Progress is tracked but not displayed as per user request
                    if (total) {
                        const pct = Math.round(100 * current / total);
                        console.log(`[AI Background Removal] ${key}: ${pct}%`);
                    }
                }
            };
            
            await preload(config).catch(() => {});
            
            const response = await fetch(currentImageUrl, { mode: 'cors' }).catch(() => null);
            let imgBlob;
            if (response && response.ok) {
                imgBlob = await response.blob();
            } else {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(currentImageUrl)}`;
                const proxyResponse = await fetch(proxyUrl);
                imgBlob = await proxyResponse.blob();
            }

            const outBlob = await removeBackground(imgBlob, config);
            const newUrl = URL.createObjectURL(outBlob);
            pushHistory(newUrl);
            
            setBgRemovalSuccess(true);
            setTimeout(() => setBgRemovalSuccess(false), 3000);
            
        } catch (err: any) {
            console.error(err);
            alert("Background removal failed: " + (err.message || String(err)));
        } finally {
            setIsRemovingBackground(false);
        }
    };

    const undo = () => {
        if (historyIndex > 0) setHistoryIndex(historyIndex - 1);
    };

    const redo = () => {
        if (historyIndex < history.length - 1) setHistoryIndex(historyIndex + 1);
    };

    const pushHistory = (newUrl: string) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ url: newUrl });
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const applyCrop = async () => {
        if (!cropBox || cropBox.w < 10 || cropBox.h < 10) return;
        try {
            const response = await fetch(currentImageUrl, { mode: 'cors' }).catch(() => null);
            let blob;
            if (response && response.ok) {
                blob = await response.blob();
            } else {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(currentImageUrl)}`;
                const proxyResponse = await fetch(proxyUrl);
                blob = await proxyResponse.blob();
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = URL.createObjectURL(blob);
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = cropBox.w;
            canvas.height = cropBox.h;
            ctx.drawImage(img, cropBox.x, cropBox.y, cropBox.w, cropBox.h, 0, 0, cropBox.w, cropBox.h);

            canvas.toBlob((blobData) => {
                if (blobData) {
                    const newUrl = URL.createObjectURL(blobData);
                    pushHistory(newUrl);
                    setCropMode(false);
                    setCropBox(null);
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
        }
    };

    const [cropMode, setCropMode] = useState(false);
    const [cropBox, setCropBox] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
    const [cropAction, setCropAction] = useState<'create' | 'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
    
    // Eraser State
    const [eraserMode, setEraserMode] = useState(false);
    const [eraserRadius, setEraserRadius] = useState(20);
    const [eraserBlur, setEraserBlur] = useState(0);
    const [isErasing, setIsErasing] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });

    const cropStartRef = useRef({ x: 0, y: 0 });
    const cropActionRef = useRef<{ startX: number, startY: number, initialBox: any } | null>(null);
    const eraserCanvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const w = e.currentTarget.naturalWidth;
        const h = e.currentTarget.naturalHeight;
        setNaturalSize({ w, h });

        // Calculate initial zoom to fit within container
        if (containerRef.current) {
            const cw = containerRef.current.clientWidth - 40;
            const ch = containerRef.current.clientHeight - 40;
            const scaleX = cw / w;
            const scaleY = ch / h;
            const initialZoom = Math.min(1, scaleX, scaleY);
            setZoom(initialZoom);
        }

        // Initialize eraser canvas
        if (eraserCanvasRef.current) {
            eraserCanvasRef.current.width = w;
            eraserCanvasRef.current.height = h;
            const ctx = eraserCanvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, w, h);
            }
        }
    };

    const filterString = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px) hue-rotate(${filters.hueRotate}deg)`;

    const applyEraser = async () => {
        if (!eraserCanvasRef.current) return;
        
        try {
            const response = await fetch(currentImageUrl, { mode: 'cors' }).catch(() => null);
            let blob;
            if (response && response.ok) {
                blob = await response.blob();
            } else {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(currentImageUrl)}`;
                const proxyResponse = await fetch(proxyUrl);
                blob = await proxyResponse.blob();
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = URL.createObjectURL(blob);
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Draw original image
            ctx.drawImage(img, 0, 0);
            
            // Draw eraser strokes with destination-out to erase pixels
            ctx.globalCompositeOperation = 'destination-out';
            ctx.drawImage(eraserCanvasRef.current, 0, 0);

            canvas.toBlob((blobData) => {
                if (blobData) {
                    const newUrl = URL.createObjectURL(blobData);
                    pushHistory(newUrl);
                    
                    // Clear the eraser canvas for the next edits
                    if (eraserCanvasRef.current) {
                        const eraserCtx = eraserCanvasRef.current.getContext('2d');
                        if (eraserCtx) {
                            eraserCtx.clearRect(0, 0, eraserCanvasRef.current.width, eraserCanvasRef.current.height);
                        }
                    }
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
        }
    };

    const handleMouseDown = (e: React.MouseEvent, action?: 'create' | 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
        if (!contentRef.current) return;
        
        const rect = contentRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        
        if (eraserMode) {
            e.preventDefault();
            e.stopPropagation();
            setIsErasing(true);
            if (eraserCanvasRef.current) {
                const ctx = eraserCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                }
            }
            return;
        }

        if (!cropMode) return;
        e.preventDefault();
        e.stopPropagation();
        
        const cropResolveAction = action || 'create';
        setCropAction(cropResolveAction);
        
        if (cropResolveAction === 'create') {
            cropStartRef.current = { x, y };
            setCropBox({ x, y, w: 0, h: 0 });
        } else {
            cropActionRef.current = { startX: x, startY: y, initialBox: { ...cropBox } };
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!contentRef.current) return;
        const rect = contentRef.current.getBoundingClientRect();
        let x = (e.clientX - rect.left) / zoom;
        let y = (e.clientY - rect.top) / zoom;
        
        if (eraserMode) {
            const cursor = document.getElementById('eraser-cursor');
            if (cursor) {
                cursor.style.display = 'block';
                cursor.style.left = `${e.clientX}px`;
                cursor.style.top = `${e.clientY}px`;
            }
        }
        
        if (eraserMode && isErasing) {
            e.stopPropagation();
            if (eraserCanvasRef.current) {
                const ctx = eraserCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.lineTo(x, y);
                    ctx.lineWidth = eraserRadius * 2;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    ctx.strokeStyle = `rgba(255,0,0,1)`;
                    ctx.shadowColor = `rgba(255,0,0,1)`;
                    ctx.shadowBlur = eraserBlur;
                    ctx.stroke();
                }
            }
            return;
        }

        if (!cropAction || !cropMode) return;
        
        // Clamp to image bounds for crop
        x = Math.max(0, Math.min(x, naturalSize.w));
        y = Math.max(0, Math.min(y, naturalSize.h));

        if (cropAction === 'create') {
            const startX = cropStartRef.current.x;
            const startY = cropStartRef.current.y;
            setCropBox({
                x: Math.min(x, startX),
                y: Math.min(y, startY),
                w: Math.abs(x - startX),
                h: Math.abs(y - startY)
            });
        } else if (cropActionRef.current && cropBox) {
            const { startX, startY, initialBox } = cropActionRef.current;
            const dx = x - startX;
            const dy = y - startY;

            let newX = initialBox.x;
            let newY = initialBox.y;
            let newW = initialBox.w;
            let newH = initialBox.h;

            if (cropAction === 'move') {
                newX = Math.max(0, Math.min(newX + dx, naturalSize.w - newW));
                newY = Math.max(0, Math.min(newY + dy, naturalSize.h - newH));
            } else if (cropAction === 'nw') {
                newX = Math.min(newX + dx, initialBox.x + initialBox.w - 10);
                newW = initialBox.x + initialBox.w - newX;
                newY = Math.min(newY + dy, initialBox.y + initialBox.h - 10);
                newH = initialBox.y + initialBox.h - newY;
            } else if (cropAction === 'ne') {
                newW = Math.max(10, x - newX);
                newY = Math.min(newY + dy, initialBox.y + initialBox.h - 10);
                newH = initialBox.y + initialBox.h - newY;
            } else if (cropAction === 'sw') {
                newX = Math.min(newX + dx, initialBox.x + initialBox.w - 10);
                newW = initialBox.x + initialBox.w - newX;
                newH = Math.max(10, y - newY);
            } else if (cropAction === 'se') {
                newW = Math.max(10, x - newX);
                newH = Math.max(10, y - newY);
            }
            
            
            setCropBox({ x: newX, y: newY, w: newW, h: newH });
        }
    };

    const handleMouseUp = () => {
        if (eraserMode && isErasing) {
            setIsErasing(false);
            if (eraserCanvasRef.current) {
                const ctx = eraserCanvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.closePath();
                }
            }
            applyEraser();
            return;
        }
        setCropAction(null);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(currentImageUrl, { mode: 'cors' }).catch(() => null);
            let blob;
            if (response && response.ok) {
                blob = await response.blob();
            } else {
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(currentImageUrl)}`;
                const proxyResponse = await fetch(proxyUrl);
                blob = await proxyResponse.blob();
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = URL.createObjectURL(blob);
            });

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("No canvas context");

            let cw = img.naturalWidth;
            let ch = img.naturalHeight;
            let sx = 0, sy = 0, sw = cw, sh = ch;

            // Notice we do NOT apply cropBox here anymore, because applyCrop handles the structure,
            // while Save just applies filters on top of the already cropped `currentImageUrl`.
            // But if the user presses Save while cropMode is active, we should crop too.
            if (cropMode && cropBox && cropBox.w > 10 && cropBox.h > 10) {
                sx = cropBox.x;
                sy = cropBox.y;
                sw = cropBox.w;
                sh = cropBox.h;
                cw = sw;
                ch = sh;
            }

            canvas.width = cw;
            canvas.height = ch;

            // Apply filters
            ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px) hue-rotate(${filters.hueRotate}deg)`;

            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);

            canvas.toBlob((blobData) => {
                if (blobData) {
                    const file = new File([blobData], `edited_${Date.now()}.png`, { type: 'image/png' });
                    onSave(file);
                }
            }, 'image/png');
        } catch (e) {
            console.error(e);
            alert("Error saving image. It may be due to CORS or image format restrictions.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
             onMouseUp={handleMouseUp}
             onMouseLeave={handleMouseUp}>

            {/* Eraser Cursor Overlay */}
            {eraserMode && (
                <div 
                    className="fixed pointer-events-none rounded-full border border-white bg-black/10 z-[99999]"
                    style={{
                        width: eraserRadius * 2 * zoom,
                        height: eraserRadius * 2 * zoom,
                        transform: 'translate(-50%, -50%)',
                        display: 'none', // Using JS to update position efficiently
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.5)'
                    }}
                    id="eraser-cursor"
                />
            )}

            {/* AI Background Removal Overlay Loader */}
            {isRemovingBackground && (
                <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="size-16 border-4 border-gray-100 border-t-[#146C6C] rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[#146C6C] animate-pulse">auto_awesome</span>
                            </div>
                        </div>
                        <div className="text-sm font-bold text-gray-800 tracking-tight">AI is working...</div>
                    </div>
                </div>
            )}

            {/* Success Notification */}
            {bgRemovalSuccess && (
                <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[10001] bg-[#146C6C] text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-500">
                    <span className="material-symbols-outlined">check_circle</span>
                    <span className="font-bold">Background Removed!</span>
                </div>
            )}

            <div className="bg-white rounded-2xl w-full max-w-6xl h-[85vh] flex flex-col md:flex-row overflow-hidden shadow-2xl relative">
                
                {/* Editor Area */}
                <div className="flex-1 bg-gray-100 flex flex-col relative overflow-hidden" ref={containerRef}>
                    <div className="absolute top-4 left-4 z-10 flex gap-2">
                        <button 
                            onClick={undo} disabled={historyIndex === 0}
                            className="bg-white/90 shadow-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
                            title="Undo Crop"
                        >
                            <span className="material-symbols-outlined text-[18px]">undo</span>
                        </button>
                        <button 
                            onClick={redo} disabled={historyIndex === history.length - 1}
                            className="bg-white/90 shadow-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:bg-white transition-colors disabled:opacity-50 mr-4"
                            title="Redo Crop"
                        >
                            <span className="material-symbols-outlined text-[18px]">redo</span>
                        </button>

                        <button 
                            className="bg-white/90 shadow-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
                            onClick={() => setZoom(Math.max(0.1, zoom - 0.2))}
                        >
                            <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                        </button>
                        <span className="bg-white/90 shadow-sm px-3 py-1.5 rounded-lg flex items-center text-sm font-bold text-gray-700">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button 
                            className="bg-white/90 shadow-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:bg-white transition-colors"
                            onClick={() => setZoom(Math.min(5, zoom + 0.2))}
                        >
                            <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                        </button>
                        <button 
                            className="bg-white/90 shadow-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:bg-white transition-colors ml-4"
                            onClick={() => setZoom(1)}
                        >
                            100%
                        </button>
                    </div>

                    <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white/90 p-1 rounded-lg shadow-sm items-center">
                        {cropMode && cropBox && (
                            <div className="flex gap-2 items-center px-3 text-[11px] font-bold text-gray-500 uppercase">
                                <div className="flex items-center gap-1">
                                    <span>W</span>
                                    <input type="number" className="w-14 border border-gray-200 rounded px-1.5 py-1 text-center bg-white text-gray-800 focus:outline-primary" value={Math.round(cropBox.w)} onChange={(e) => setCropBox({...cropBox, w: Number(e.target.value)})} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <span>H</span>
                                    <input type="number" className="w-14 border border-gray-200 rounded px-1.5 py-1 text-center bg-white text-gray-800 focus:outline-primary" value={Math.round(cropBox.h)} onChange={(e) => setCropBox({...cropBox, h: Number(e.target.value)})} />
                                </div>
                            </div>
                        )}
                        <button 
                            className={`px-4 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold transition-colors ${eraserMode ? 'bg-[#146C6C] text-white' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => {
                                setEraserMode(!eraserMode);
                                if (!eraserMode) setCropMode(false);
                            }}
                        >
                            <span className="material-symbols-outlined text-[18px]">ink_eraser</span>
                            Eraser
                        </button>
                        <button 
                            className={`px-4 py-1.5 rounded-md flex items-center gap-2 text-sm font-bold transition-colors ${cropMode ? 'bg-[#146C6C] text-white' : 'bg-transparent text-gray-700 hover:bg-gray-100'}`}
                            onClick={() => {
                                setCropMode(!cropMode);
                                if (!cropMode) {
                                    setCropBox(null);
                                    setEraserMode(false);
                                }
                            }}
                        >
                            <span className="material-symbols-outlined text-[18px]">crop</span>
                            {cropMode ? 'Cancel Crop' : 'Cut (Crop)'}
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto flex items-center justify-center p-10 select-none cursor-crosshair">
                        <div style={{ width: naturalSize.w * zoom, height: naturalSize.h * zoom }} className="relative pointer-events-none">
                            <div 
                                ref={contentRef}
                                className={`absolute top-0 left-0 shadow-md ${eraserMode ? 'cursor-none' : (cropMode ? (cropAction ? 'cursor-grabbing' : 'cursor-crosshair') : 'cursor-grab')} bg-checkerboard pointer-events-auto`}
                                style={{ 
                                    width: naturalSize.w, 
                                    height: naturalSize.h, 
                                    transform: `scale(${zoom})`, 
                                    transformOrigin: 'top left',
                                    backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="10" height="10" fill="gray" fill-opacity="0.1"/><rect x="10" y="10" width="10" height="10" fill="gray" fill-opacity="0.1"/></svg>')`
                                }}
                                onMouseDown={(e) => handleMouseDown(e, 'create')}
                                onMouseMove={handleMouseMove}
                            onMouseLeave={() => {
                                const cursor = document.getElementById('eraser-cursor');
                                if (cursor) cursor.style.display = 'none';
                            }}
                            draggable={false}
                        >
                            <div className="absolute inset-0 isolate pointer-events-none">
                                <img 
                                    src={currentImageUrl} 
                                    alt="Editor" 
                                    onLoad={handleImageLoad}
                                    className="w-full h-full object-contain pointer-events-none absolute inset-0"
                                    style={{ filter: filterString }}
                                    draggable={false}
                                />
                                
                                <canvas
                                    ref={eraserCanvasRef}
                                    className="absolute inset-0 w-full h-full pointer-events-none opacity-50"
                                    style={{ zIndex: 10 }}
                                />
                            </div>
                            
                            {/* Crop Overlay */}
                            {cropMode && (
                                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                            )}
                            
                            {cropMode && cropBox && (
                                <div 
                                    className={`absolute border-2 border-dashed border-white bg-transparent ${cropAction === 'move' ? 'cursor-grabbing' : 'cursor-grab'} shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] z-20`}
                                    style={{
                                        left: cropBox.x,
                                        top: cropBox.y,
                                        width: cropBox.w,
                                        height: cropBox.h,
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)', // Outer dark overlay
                                        pointerEvents: 'auto'
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                                    onDoubleClick={(e) => { e.stopPropagation(); applyCrop(); }}
                                    title="Double-click to apply crop"
                                >
                                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-full cursor-nwse-resize shadow-md" onMouseDown={(e) => handleMouseDown(e, 'nw')}></div>
                                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-full cursor-nesw-resize shadow-md" onMouseDown={(e) => handleMouseDown(e, 'ne')}></div>
                                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-full cursor-nesw-resize shadow-md" onMouseDown={(e) => handleMouseDown(e, 'sw')}></div>
                                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-full cursor-nwse-resize shadow-md" onMouseDown={(e) => handleMouseDown(e, 'se')}></div>
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 -translate-y-2 bg-black/80 text-white text-[10px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap font-mono">
                                        {Math.round(cropBox.w)} × {Math.round(cropBox.h)}
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Controls */}
                <div className="w-full md:w-80 bg-white border-l border-gray-100 flex flex-col h-full">
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Image Editor</h2>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 pb-20 space-y-6">
                        
                        {/* AI Tools */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">AI Tools</h3>
                            <button 
                                onClick={handleRemoveBackground}
                                disabled={isRemovingBackground}
                                className={`w-full py-2.5 px-4 font-bold rounded-xl transition-all flex justify-center items-center gap-2 text-sm disabled:opacity-50 mb-4 ${bgRemovalSuccess ? 'bg-emerald-500 text-white border-emerald-600' : 'text-[#146C6C] bg-[#146C6C]/10 border border-[#146C6C]/20 hover:bg-[#146C6C]/20'}`}
                            >
                                {isRemovingBackground ? (
                                    <>
                                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                        Processing...
                                    </>
                                ) : bgRemovalSuccess ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">check</span>
                                        Done!
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                                        Remove Background
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <hr className="border-gray-100" />

                        {/* Eraser Tools */}
                        {eraserMode && (
                            <>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Eraser Settings</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                                                <span>Radius / Size</span>
                                                <span>{eraserRadius}</span>
                                            </div>
                                            <input 
                                                type="range" min={1} max={100} step={1}
                                                value={eraserRadius}
                                                onChange={(e) => setEraserRadius(Number(e.target.value))}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#146C6C]"
                                            />
                                        </div>
                                        <div>
                                            <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                                                <span>Softness (Blur)</span>
                                                <span>{eraserBlur}</span>
                                            </div>
                                            <input 
                                                type="range" min={0} max={50} step={1}
                                                value={eraserBlur}
                                                onChange={(e) => setEraserBlur(Number(e.target.value))}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#146C6C]"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <hr className="border-gray-100" />
                            </>
                        )}

                        {/* Filters (Presets) */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Filters</h3>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.keys(PRESETS).map(presetName => (
                                    <button 
                                        key={presetName}
                                        onClick={() => setFilters({ ...PRESETS[presetName] })}
                                        className="py-2 px-1 text-xs font-semibold rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center gap-1 truncate"
                                    >
                                        <div 
                                            className="w-8 h-8 rounded-full border border-gray-300" 
                                            style={{ 
                                                background: `url(${currentImageUrl}) center/cover`,
                                                filter: `brightness(${PRESETS[presetName].brightness}%) contrast(${PRESETS[presetName].contrast}%) saturate(${PRESETS[presetName].saturate}%) grayscale(${PRESETS[presetName].grayscale}%) sepia(${PRESETS[presetName].sepia}%) hue-rotate(${PRESETS[presetName].hueRotate}deg)`
                                            }}
                                        />
                                        <span className="truncate w-full text-center px-1 text-[10px]">{presetName}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        {/* Adjustments */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-wider">Adjustments</h3>
                            
                            <div className="space-y-4">
                                {Object.entries(filters).map(([key, value]) => {
                                    const numValue = value as number;
                                    return (
                                        <div key={key}>
                                            <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                                                <span className="capitalize">{key.replace('hueRotate', 'Hue (Rotate)')}</span>
                                                <span>{numValue}</span>
                                            </div>
                                            <input 
                                                type="range"
                                                min={key === 'hueRotate' ? 0 : 0}
                                                max={key === 'hueRotate' ? 360 : (key === 'blur' ? 20 : 200)}
                                                step={1}
                                                value={numValue}
                                                onChange={(e) => setFilters({ ...filters, [key]: Number(e.target.value) })}
                                                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#146C6C]"
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                    </div>

                    {/* Actions */}
                    <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 mt-auto shrink-0">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-2.5 px-4 font-bold text-white bg-[#146C6C] rounded-xl hover:bg-[#0f5454] transition-colors flex justify-center items-center gap-2 text-sm disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                    Saving...
                                </>
                            ) : (
                                "Save Edit"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageEditorModal;
