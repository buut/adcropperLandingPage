import React, { useState, useEffect, useRef } from 'react';
import { BreakpointName, BREAKPOINT_COLORS, BREAKPOINT_ABBR, LandingPageAction } from '../App';

interface StageContainerProps {
    id: string;
    name: string;
    width: number;
    height: number;
    children?: React.ReactNode;
    className?: string;
    isSelected?: boolean;
    onSelect?: () => void;
    onDrop?: (source: string | File, x: number, y: number, assetType: string, meta?: any) => void;
    breadcrumbs?: Array<{ id: string, name: string }>;
    onBreadcrumbClick?: (id: string | null) => void;
    zoom: number;
    viewportRef?: React.RefObject<HTMLDivElement | null>;
    backgroundColor?: string;
    backgroundColor2?: string;
    bgType?: 'none' | 'solid' | 'radial' | 'linear';
    onHeaderMouseDown?: (e: React.MouseEvent) => void;
    actions?: any[];
    actionStates?: Record<string, boolean>;
    onTriggerAction?: (actionId: string, isActive: boolean) => void;
    isPreviewMode?: boolean;
    isInteractive?: boolean;
    maskStyle?: React.CSSProperties;
    overlay?: React.ReactNode;
    overflow?: 'hidden' | 'visible' | 'clip';
    isTextToolActive?: boolean;
    onUpdateName?: (name: string) => void;
    cursor?: string;
    breakpoint?: BreakpointName;
    onLandingPageAction?: (action: LandingPageAction) => void;
}

const StageContainer: React.FC<StageContainerProps> = ({
    id,
    name,
    width,
    height,
    children,
    className = "",
    isSelected = false,
    onSelect,
    onDrop,
    breadcrumbs = [],
    onBreadcrumbClick,
    zoom,
    viewportRef,
    backgroundColor = '#ffffff',
    backgroundColor2 = '#ffffff',
    bgType = 'solid',
    onHeaderMouseDown,
    actions = [],
    actionStates = {},
    onTriggerAction,
    isPreviewMode = false,
    isInteractive = false,
    maskStyle,
    overlay,
    overflow,
    isTextToolActive = false,
    onUpdateName,
    cursor,
    breakpoint,
    onLandingPageAction,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isGlowing, setIsGlowing] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const prevIsSelectedRef = useRef(isSelected);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isSelected && !prevIsSelectedRef.current) {
            setIsVisible(true);
            setIsGlowing(true);
            // Flash effect for 1000ms
            const timer = setTimeout(() => setIsGlowing(false), 1000);
            return () => clearTimeout(timer);
        }
        prevIsSelectedRef.current = isSelected;
    }, [isSelected]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            {
                root: viewportRef?.current || null,
                rootMargin: '100px', // Pre-load slightly before view
                threshold: 0
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, [viewportRef]);

    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const contentEl = document.getElementById(id);
        if (!contentEl) return;

        const rect = contentEl.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        // Handle local file drops
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                if (file.type.startsWith('image/')) {
                    onDrop?.(file as any, x, y, 'image', { label: file.name });
                } else if (file.type.startsWith('video/')) {
                    onDrop?.(file as any, x, y, 'video', { label: file.name });
                }
            });
            return;
        }

        const url = e.dataTransfer.getData('text/plain');
        const assetType = e.dataTransfer.getData('assetType') || 'media';
        if (!url) return;

        const meta: any = {};
        const assetMetaStr = e.dataTransfer.getData('asset-meta');
        if (assetMetaStr) {
            try {
                Object.assign(meta, JSON.parse(assetMetaStr));
            } catch (e) { console.error('Meta parse error', e); }
        }

        const fullMetaStr = e.dataTransfer.getData('fullMeta');
        if (fullMetaStr) {
            try {
                Object.assign(meta, JSON.parse(fullMetaStr));
            } catch (e) { console.error('FullMeta parse error', e); }
        }

        // Fallbacks
        if (assetType === 'button') {
            if (!meta.label) meta.label = e.dataTransfer.getData('label') || url;
            if (!meta.color) meta.color = e.dataTransfer.getData('color');
            if (!meta.hoverColor) meta.hoverColor = e.dataTransfer.getData('hoverColor');
            if (!meta.activeColor) meta.activeColor = e.dataTransfer.getData('activeColor');
            if (!meta.effect) meta.effect = e.dataTransfer.getData('effect');
            if (!meta.bgType) meta.bgType = e.dataTransfer.getData('bgType');
            if (!meta.colorCode2) meta.colorCode2 = e.dataTransfer.getData('color2');
        } else if (assetType === 'widget') {
            if (!meta.icon) meta.icon = e.dataTransfer.getData('icon');
            if (!meta.color) meta.color = e.dataTransfer.getData('color');
            if (!meta.url) meta.url = e.dataTransfer.getData('url');
            if (!meta.widgetId) meta.widgetId = e.dataTransfer.getData('widgetId');
        }
        
        onDrop?.(url, x, y, assetType, meta);
    };

    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState(name);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTempName(name);
    }, [name]);

    useEffect(() => {
        if (isEditingName) {
            editInputRef.current?.focus();
            editInputRef.current?.select();
        }
    }, [isEditingName]);

    const handleNameSubmit = () => {
        setIsEditingName(false);
        if (tempName.trim() && tempName !== name) {
            onUpdateName?.(tempName.trim());
        } else {
            setTempName(name);
        }
    };

    return (
        <div 
            ref={containerRef}
            className={`flex flex-col gap-2 ${className} group pointer-events-auto transition-all duration-200 ${isDragOver && !isSelected ? 'scale-[1.01] ring-[6px] ring-primary/40 rounded-2xl bg-primary/5 p-4 -m-4 z-[1000]' : ''}`}
            style={{ cursor: cursor || (isTextToolActive ? 'default' : 'pointer') }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={(e) => {
                if (e.button !== 0) return; // Only left click for stage selection
                e.stopPropagation();
                onSelect?.();
            }}
        >
            <div 
                className={`relative z-[300] font-bold uppercase tracking-wider transition-colors select-none py-1 flex items-center ${isSelected ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'}`}
                onMouseDown={(e) => {
                    if (onHeaderMouseDown) {
                        onHeaderMouseDown(e);
                    }
                }}
                style={{
                    fontSize: `${12 / zoom}px`,
                    width: `${width}px`,
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    setIsEditingName(true);
                }}
            >
                {isEditingName ? (
                    <input
                        ref={editInputRef}
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={handleNameSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNameSubmit();
                            if (e.key === 'Escape') {
                                setIsEditingName(false);
                                setTempName(name);
                            }
                        }}
                        className="bg-white border border-primary text-primary px-1 outline-none w-full normal-case font-bold"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span onClick={(e) => {
                        e.stopPropagation();
                        onBreadcrumbClick?.(null);
                    }} className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 truncate w-full" title={`${name} - ${width}x${height}`}>
                        <span className="truncate">{name} - {width}x{height}</span>
                        {breakpoint && (
                            <span
                                className="shrink-0 px-1 py-0.5 rounded text-white font-black normal-case leading-none"
                                style={{ background: BREAKPOINT_COLORS[breakpoint], fontSize: `${9 / zoom}px` }}
                            >
                                {BREAKPOINT_ABBR[breakpoint]}
                            </span>
                        )}
                    </span>
                )}
            </div>
            <div className="relative">
                    <div 
                        id={id}
                        className={`shadow-2xl relative transition-all duration-300 ${isGlowing ? 'stage-selection-flash' : ''}`}
                        style={{ 
                            width: `${width}px`, 
                            height: `${height}px`,
                            minWidth: `${width}px`,
                            maxWidth: `${width}px`,
                            minHeight: `${height}px`,
                            maxHeight: `${height}px`,
                            flexShrink: 0,
                            flexGrow: 0,
                            zIndex: isSelected || isGlowing ? 200 : 1,
                            pointerEvents: 'auto',
                            cursor: cursor || (isTextToolActive ? 'text' : 'pointer'),
                            ...maskStyle,
                            overflow: 'visible',
                            clipPath: (isPreviewMode || overflow === 'visible' || maskStyle?.WebkitMaskImage || maskStyle?.maskImage) 
                                ? 'none' 
                                : (maskStyle?.clipPath || 'inset(0px)'),
                            transformStyle: 'preserve-3d',
                            contain: 'size layout'
                        }}
                        onClick={(e) => {
                            if (!isInteractive) return;
                            actions.forEach(a => {
                                if (a.triggerSourceId === 'stage' && (a.eventType === 'click' || !a.eventType)) {
                                    onTriggerAction?.(a.id, !actionStates[a.id]);
                                }
                            });
                        }}
                        onMouseEnter={() => {
                            setIsHovered(true);
                            if (!isInteractive) return;
                            actions.forEach(a => {
                                if (a.triggerSourceId === 'stage') {
                                    if (a.eventType === 'mouseover') {
                                        onTriggerAction?.(a.id, true);
                                    } else if (a.eventType === 'mouseout') {
                                        onTriggerAction?.(a.id, false);
                                    }
                                }
                            });
                        }}
                        onMouseLeave={() => {
                            setIsHovered(false);
                            if (!isInteractive) return;
                            actions.forEach(a => {
                                if (a.triggerSourceId === 'stage') {
                                    if (a.eventType === 'mouseover') {
                                        onTriggerAction?.(a.id, false);
                                    } else if (a.eventType === 'mouseout') {
                                        onTriggerAction?.(a.id, true);
                                    }
                                }
                            });
                        }}
                    >
                        {/* 3D Content Wrapper - Separated from overflow:hidden to allow projection */}
                        <div 
                            className="absolute inset-0 w-full h-full"
                            style={{ 
                                perspective: '1000px',
                                transformStyle: 'preserve-3d',
                                pointerEvents: 'none'
                            }}
                        >
                             {/* Background Layer - Pushed back in Z to avoid occluding 3D layers */}
                            <div 
                                className="absolute inset-0 pointer-events-none overflow-hidden" 
                                style={{ 
                                    zIndex: -1, 
                                    transformStyle: 'preserve-3d',
                                    borderRadius: (maskStyle as any)?.borderRadius || 'inherit',
                                    clipPath: 'inset(0px)' // Force clip even in 3D space
                                }}
                            >
                                <div 
                                    id={`${id}-bg`}
                                    className="absolute inset-0"
                                    style={{
                                        background: bgType === 'none' || backgroundColor === 'transparent'
                                            ? 'transparent'
                                            : bgType === 'radial' 
                                            ? `radial-gradient(circle, ${backgroundColor}, ${backgroundColor2})` 
                                            : bgType === 'linear' 
                                            ? `linear-gradient(180deg, ${backgroundColor}, ${backgroundColor2})` 
                                            : backgroundColor,
                                        transform: 'translateZ(-9990px) scale(20)', // Keep it behind everything
                                        transformStyle: 'flat'
                                    }}
                                />
                            </div>

                            {isVisible ? children : (
                               <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                   <span className="text-[9px] text-gray-300 animate-pulse uppercase tracking-[0.2em] font-bold opacity-50">Loading Stage...</span>
                               </div>
                            )}
                            
                            {/* Outside Stage Dimmer (shades content outside the stage area) */}
                            {isSelected && !isPreviewMode && overflow !== 'visible' && (
                                <div 
                                    className="absolute inset-0 pointer-events-none z-[190]" 
                                    style={{
                                        boxShadow: '0 0 0 10000px rgba(240, 242, 245, 0.4)',
                                        borderRadius: (maskStyle as any)?.borderRadius || 'inherit',
                                        transform: 'translateZ(999px)' // Keep dimmer in front
                                    }}
                                />
                            )}
                        </div>
                    </div>
                    <div className="absolute inset-0 pointer-events-none overflow-visible">
                        <div id={`stage-overlay-${id}`} className="absolute inset-0 pointer-events-none overflow-visible" />
                        {overlay}
                        
                        {/* Dedicated Border Overlay - Always on Top */}
                        <div 
                            className={`absolute inset-0 pointer-events-none transition-all duration-300 ${isGlowing ? 'stage-border-flash' : ''}`}
                            style={{
                                boxSizing: 'border-box',
                                borderStyle: 'solid',
                                borderWidth: isGlowing ? undefined : (isSelected ? '0px' : isHovered ? '2px' : '1px'),
                                borderColor: isGlowing ? undefined : (isSelected ? 'transparent' : isHovered ? '#146C6C' : '#e5e7eb'),
                                zIndex: 1000
                            }}
                        />
                    </div>
                </div>
            
            <style>{`
                @keyframes stageBorderPulse {
                    0% {
                        border-width: 8px;
                        border-color: #146C6C;
                    }
                    100% {
                        border-width: 0px;
                        border-color: transparent;
                    }
                }
                .stage-border-flash {
                    animation: stageBorderPulse 1s ease-out forwards !important;
                    border-style: solid !important;
                }
            `}</style>
        </div>
    );
};

export default StageContainer;
