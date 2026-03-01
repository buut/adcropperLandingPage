import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import opentype from 'opentype.js';
import { cleanFileName } from '../utils/fileUtils';
import { UPLOAD_URL } from '../App';

interface FontUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploadSuccess: () => void;
    brandId?: string;
}

interface PendingFont {
    file: File;
    family: string;
    weight: string;
    style: string;
    previewUrl?: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    id: string;
}

const FONT_WEIGHT_OPTIONS = ['Thin', 'UltraLight', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black'] as const;

const FontUploadModal: React.FC<FontUploadModalProps> = ({ isOpen, onClose, onUploadSuccess, brandId = '671a1666d786fa251fca95d0' }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [pendingFonts, setPendingFonts] = useState<PendingFont[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [openTypeId, setOpenTypeId] = useState<string | null>(null);
    const [typeDropdownRect, setTypeDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
    const [draggedFontId, setDraggedFontId] = useState<string | null>(null);
    const [dropTargetFamily, setDropTargetFamily] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const typeTriggerRef = useRef<HTMLButtonElement>(null);
    const typePortalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!openTypeId) {
            setTypeDropdownRect(null);
            return;
        }
        const measure = () => {
            const el = typeTriggerRef.current;
            if (el) {
                const r = el.getBoundingClientRect();
                setTypeDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
            }
        };
        measure();
        const raf = requestAnimationFrame(measure);
        return () => cancelAnimationFrame(raf);
    }, [openTypeId]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            const inTrigger = typeTriggerRef.current?.contains(target);
            const inPortal = typePortalRef.current?.contains(target);
            if (openTypeId && !inTrigger && !inPortal) setOpenTypeId(null);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openTypeId]);

    const fallbackMetadataFromFilename = (file: File): { family: string, weight: string, style: string } => {
        const base = file.name.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
        const weightKeywords = ['Thin', 'UltraLight', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black', 'Italic'];
        const parts = base.split(' ').filter(Boolean);
        const detected: string[] = [];
        const rest = parts.filter((p: string) => {
            const isKw = weightKeywords.some(k => k.toLowerCase() === p.toLowerCase());
            if (isKw) detected.push(p);
            return !isKw;
        });
        const family = rest.join(' ').trim() || base || 'Unnamed Font';
        const weight = detected.length ? detected.join(' ') : 'Regular';
        return { family, weight, style: weight.toLowerCase().includes('italic') ? 'italic' : 'normal' };
    };

    const extractMetadata = async (file: File): Promise<{ family: string, weight: string, style: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const buffer = e.target?.result as ArrayBuffer;
                    const bytes = new Uint8Array(buffer);
                    const sig = bytes.length >= 4
                        ? String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
                        : '';
                    if (sig === 'wOF2') {
                        resolve(fallbackMetadataFromFilename(file));
                        return;
                    }
                    const font = opentype.parse(buffer);

                    const names = font.names as any;
                    let family = names.fontFamily?.en ||
                                 names.preferredFamily?.en ||
                                 names.fullName?.en ||
                                 file.name.split('.')[0].replace(/[-_]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

                    let subFamily = names.fontSubfamily?.en ||
                                    names.preferredSubfamily?.en ||
                                    'Regular';

                    const weightKeywords = [
                        'Thin', 'UltraThin', 'UltraLight', 'ExtraLight', 'Light', 'Regular', 'Book',
                        'Medium', 'DemiBold', 'SemiBold', 'Bold', 'ExtraBold', 'UltraBold', 'Black',
                        'Heavy', 'Ultra', 'Extra', 'Condensed', 'Compressed', 'Narrow', 'Extended', 'Italic'
                    ];
                    const familyParts = family.split(' ');
                    const detectedWeights: string[] = [];

                    const cleanedFamilyParts = familyParts.filter((part: string) => {
                        const isKeyword = weightKeywords.some(k => k.toLowerCase() === part.toLowerCase());
                        if (isKeyword) {
                            detectedWeights.push(part);
                            return false;
                        }
                        return true;
                    });

                    if (detectedWeights.length > 0) {
                        family = cleanedFamilyParts.join(' ').trim();
                        if (subFamily === 'Regular' || subFamily === 'normal') {
                            subFamily = detectedWeights.join(' ');
                        } else {
                            detectedWeights.forEach(w => {
                                if (!subFamily.toLowerCase().includes(w.toLowerCase())) {
                                    subFamily = `${subFamily} ${w}`;
                                }
                            });
                        }
                    }

                    resolve({
                        family: family || 'Unnamed Font',
                        weight: subFamily,
                        style: subFamily.toLowerCase().includes('italic') ? 'italic' : 'normal'
                    });
                } catch (err) {
                    console.warn('Metadata extraction failed (e.g. WOFF2), using filename:', err);
                    resolve(fallbackMetadataFromFilename(file));
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };

    const handleFiles = async (files: FileList | File[]) => {
        const fontFiles = Array.from(files).filter(f => f.name.match(/\.(ttf|otf|woff2|woff)$/i));
        
        const newPending: PendingFont[] = [];
        for (const file of fontFiles) {
            try {
                const meta = await extractMetadata(file);
                newPending.push({
                    file,
                    ...meta,
                    status: 'pending',
                    id: Math.random().toString(36).substr(2, 9)
                });
            } catch (err) {
                newPending.push({
                    file,
                    family: file.name.split('.')[0],
                    weight: 'Regular',
                    style: 'normal',
                    status: 'pending',
                    id: Math.random().toString(36).substr(2, 9)
                });
            }
        }
        setPendingFonts(prev => [...prev, ...newPending]);
    };

    const handleUploadAll = async () => {
        setIsUploading(true);
        const companyId = '66db07778b5e35892545578c';
        const templateId = '670fa914c2f0842143d5932';

        for (const font of pendingFonts) {
            if (font.status === 'success') continue;
            
            setPendingFonts(prev => prev.map(p => p.id === font.id ? { ...p, status: 'uploading' } : p));
            
            try {
                const formData = new FormData();
                const cleanedFontName = cleanFileName(font.file.name);
                const renamedFontFile = new File([font.file], cleanedFontName, { type: font.file.type });
                formData.append('file', renamedFontFile);
                formData.append('companyId', companyId);
                formData.append('brandId', brandId);
                formData.append('templateId', templateId);
                formData.append('family', font.family);
                formData.append('weight', font.weight);
                formData.append('style', font.style);

                const response = await fetch(`${UPLOAD_URL}/upload-asset`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) throw new Error('Upload failed');
                setPendingFonts(prev => prev.map(p => p.id === font.id ? { ...p, status: 'success' } : p));
            } catch (error) {
                setPendingFonts(prev => prev.map(p => p.id === font.id ? { ...p, status: 'error' } : p));
            }
        }
        setIsUploading(false);
        onUploadSuccess();
    };

    const removePending = (id: string) => {
        setPendingFonts(prev => prev.filter(p => p.id !== id));
    };

    const updateWeight = (id: string, newWeight: string) => {
        setPendingFonts(prev => prev.map(p => p.id === id ? { ...p, weight: newWeight } : p));
    };

    const moveFontToFamily = (fontId: string, targetFamily: string) => {
        setPendingFonts(prev => prev.map(p => p.id === fontId ? { ...p, family: targetFamily } : p));
    };

    const handleClose = () => {
        setPendingFonts([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 z-[3000]">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Upload Brand Fonts</h2>
                        <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">DRAG AND DROP TTF, OTF OR WOFF FILES</p>
                    </div>
                    <button 
                        onClick={handleClose}
                        className="size-10 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-400 hover:text-gray-900"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {pendingFonts.length === 0 ? (
                        <div 
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                aspect-[16/9] border-4 border-dashed rounded-[24px] flex flex-col items-center justify-center gap-4 transition-all cursor-pointer
                                ${isDragging ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-primary/40 hover:bg-gray-50/50'}
                            `}
                        >
                            <input type="file" ref={fileInputRef} className="hidden" multiple accept=".ttf,.otf,.woff,.woff2" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                            <div className={`size-20 rounded-full flex items-center justify-center transition-colors ${isDragging ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                                <span className="material-symbols-outlined text-[40px]">font_download</span>
                            </div>
                            <div className="text-center">
                                <p className="text-base font-black text-gray-900 uppercase tracking-tight">Drop your fonts here</p>
                                <p className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">or click to browse files</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{pendingFonts.length} FONTS READY TO UPLOAD</span>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs font-black text-primary hover:underline uppercase tracking-widest"
                                >
                                    Add More
                                </button>
                                <input type="file" ref={fileInputRef} className="hidden" multiple accept=".ttf,.otf,.woff,.woff2" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
                            </div>
                            
                            {Object.entries(
                                pendingFonts.reduce((acc, font) => {
                                    if (!acc[font.family]) acc[font.family] = [];
                                    acc[font.family].push(font);
                                    return acc;
                                }, {} as Record<string, PendingFont[]>)
                            ).map(([family, fonts]) => {
                                const isDropTarget = dropTargetFamily === family;
                                const draggedFont = draggedFontId ? pendingFonts.find(p => p.id === draggedFontId) : null;
                                const canDrop = draggedFontId && draggedFont && draggedFont.family !== family;
                                return (
                                <div
                                    key={fonts[0].id}
                                    className={`bg-gray-50 rounded-[32px] border overflow-hidden shadow-sm transition-all ${isDropTarget && canDrop ? 'border-primary ring-2 ring-primary/30' : 'border-gray-100'}`}
                                    onDragOver={(e) => {
                                        if (!canDrop) return;
                                        e.preventDefault();
                                        e.stopPropagation();
                                        e.dataTransfer.dropEffect = 'move';
                                        setDropTargetFamily(family);
                                    }}
                                    onDragLeave={(e) => {
                                        const related = e.relatedTarget as Node | null;
                                        if (related && e.currentTarget.contains(related)) return;
                                        setDropTargetFamily(null);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (!draggedFontId) return;
                                        const targetFamily = family;
                                        const sourceFont = pendingFonts.find(p => p.id === draggedFontId);
                                        if (sourceFont && sourceFont.family !== targetFamily) {
                                            moveFontToFamily(draggedFontId, targetFamily);
                                        }
                                        setDraggedFontId(null);
                                        setDropTargetFamily(null);
                                    }}
                                >
                                    <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-4">
                                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                            <span className="material-symbols-outlined">font_download</span>
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Font Family Group</label>
                                            <input 
                                                type="text" 
                                                value={family}
                                                onChange={(e) => {
                                                    const newName = e.target.value;
                                                    const groupIds = new Set(fonts.map(f => f.id));
                                                    setPendingFonts(prev => prev.map(p => groupIds.has(p.id) ? { ...p, family: newName } : p));
                                                }}
                                                className="bg-transparent border-none p-0 text-base font-black text-gray-900 w-full focus:ring-0 placeholder-gray-300"
                                                placeholder="Enter family name..."
                                            />
                                        </div>
                                        <div className="px-3 py-1 bg-gray-50 rounded-lg border border-gray-100 text-[10px] font-black text-gray-400 uppercase">
                                            {fonts.length} Variants
                                        </div>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {isDropTarget && canDrop && (
                                            <div className="mb-2 py-2 px-3 rounded-xl bg-primary/10 border border-primary/30 border-dashed text-[10px] font-bold text-primary uppercase tracking-widest flex items-center justify-center gap-2">
                                                <span className="material-symbols-outlined text-[16px]">move_to_inbox</span>
                                                Font'u bu aileye taşıyın
                                            </div>
                                        )}
                                        {fonts.map((font) => {
                                            const weightOptions = FONT_WEIGHT_OPTIONS.includes(font.weight as any)
                                                ? [...FONT_WEIGHT_OPTIONS]
                                                : [font.weight, ...FONT_WEIGHT_OPTIONS];
                                            const isDragging = draggedFontId === font.id;
                                            return (
                                                <div
                                                    key={font.id}
                                                    draggable
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('text/plain', font.id);
                                                        e.dataTransfer.effectAllowed = 'move';
                                                        setDraggedFontId(font.id);
                                                    }}
                                                    onDragEnd={() => setDraggedFontId(null)}
                                                    className={`flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100/50 group/item hover:border-primary/30 transition-all flex-wrap cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
                                                >
                                                    <span className="material-symbols-outlined text-gray-300 hover:text-gray-500 text-[20px] shrink-0 cursor-grab active:cursor-grabbing" aria-hidden>drag_indicator</span>
                                                    <div className="w-[140px] shrink-0">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Type</label>
                                                        <div className="relative w-full">
                                                            <button
                                                                ref={openTypeId === font.id ? typeTriggerRef : undefined}
                                                                type="button"
                                                                onClick={() => setOpenTypeId(openTypeId === font.id ? null : font.id)}
                                                                className="w-full h-9 pl-9 pr-3 bg-gray-50/50 border border-gray-100 rounded-lg text-xs font-bold text-gray-900 outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white focus:border-primary"
                                                            >
                                                                <span className="truncate">{font.weight}</span>
                                                                <span className={`material-symbols-outlined text-[18px] text-gray-400 transition-transform duration-200 shrink-0 ${openTypeId === font.id ? 'rotate-180' : ''}`}>expand_more</span>
                                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">format_bold</span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-end gap-3 pb-0.5 ml-auto">
                                                        <div className="min-w-0 max-w-[160px] shrink text-right">
                                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">File</label>
                                                            <span className="text-[11px] font-bold text-gray-400 truncate block text-right" title={font.file.name}>{font.file.name}</span>
                                                        </div>
                                                        <div className="flex items-end gap-1">
                                                            {font.status === 'uploading' && <span className="animate-spin material-symbols-outlined text-primary text-[18px]">progress_activity</span>}
                                                            {font.status === 'success' && <span className="material-symbols-outlined text-green-500 text-[20px]">check_circle</span>}
                                                            {font.status === 'error' && <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>}
                                                            {font.status === 'pending' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removePending(font.id)}
                                                                    className="size-8 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center text-gray-300 hover:text-red-500"
                                                                >
                                                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-4">
                    <button 
                        onClick={handleClose}
                        className="h-12 px-6 rounded-2xl text-xs font-black text-gray-500 hover:bg-gray-100 transition-colors uppercase tracking-widest"
                    >
                        Cancel
                    </button>
                    <button 
                        disabled={pendingFonts.length === 0 || isUploading}
                        onClick={handleUploadAll}
                        className="h-12 px-8 bg-primary hover:bg-primary/90 disabled:bg-gray-200 text-white text-xs font-black rounded-2xl transition-all shadow-lg shadow-primary/20 uppercase tracking-widest flex items-center gap-2"
                    >
                        {isUploading ? (
                            <>
                                <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>
                                UPLOADING...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                START UPLOAD
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
        {openTypeId && typeDropdownRect && (() => {
            const font = pendingFonts.find(f => f.id === openTypeId);
            if (!font) return null;
            const weightOptions = FONT_WEIGHT_OPTIONS.includes(font.weight as any) ? [...FONT_WEIGHT_OPTIONS] : [font.weight, ...FONT_WEIGHT_OPTIONS];
            return createPortal(
                <div
                    ref={typePortalRef}
                    className="bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
                    style={{
                        position: 'fixed',
                        top: typeDropdownRect.top,
                        left: typeDropdownRect.left,
                        width: typeDropdownRect.width,
                        zIndex: 10000,
                    }}
                >
                    <div className="overflow-y-auto max-h-[220px] p-1">
                        {weightOptions.map((w) => (
                            <button
                                key={w}
                                type="button"
                                onClick={() => { updateWeight(font.id, w); setOpenTypeId(null); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all flex items-center justify-between ${font.weight === w ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                            >
                                <span>{w}</span>
                                {font.weight === w && <span className="material-symbols-outlined text-[14px]">check</span>}
                            </button>
                        ))}
                    </div>
                </div>,
                document.body
            );
        })()}
    </>
    );
};

export default FontUploadModal;
