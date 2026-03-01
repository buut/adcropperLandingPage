import React, { useState, useMemo } from 'react';
import { FontData } from '../App';
import FontUploadModal from './FontUploadModal';

interface FontAssetContainerProps {
    fonts: FontData[];
    onUpload?: (font: any) => void;
    brandId?: string;
}

interface FontGroup {
    family: string;
    variants: FontData[];
}

const FontAssetContainer: React.FC<FontAssetContainerProps> = ({ fonts, onUpload, brandId = '671a1666d786fa251fca95d0' }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    // Group fonts by family, filtering for brand fonts only
    const groupedFonts = useMemo(() => {
        const groups: { [key: string]: FontGroup } = {};
        
        fonts.filter(f => f.isBrandFont).forEach(font => {
            const family = font.family || 'Unknown Family';
            if (!groups[family]) {
                groups[family] = { family, variants: [] };
            }
            groups[family].variants.push(font);
        });

        return Object.values(groups).filter(g => 
            g.family.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => a.family.localeCompare(b.family));
    }, [fonts, searchTerm]);

    return (
        <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
            <div className="p-5 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">Brand Fonts</h2>
                    <button 
                        onClick={() => setIsUploadModalOpen(true)}
                        className="h-9 px-4 bg-primary hover:bg-primary/90 text-white text-[12px] font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">upload</span>
                        Upload Font
                    </button>
                </div>

                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">search</span>
                    <input 
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search fonts..."
                        className="w-full h-10 pl-10 pr-4 bg-gray-50 border-none outline-none focus:ring-2 focus:ring-primary/10 rounded-xl text-xs font-bold text-gray-700"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
                {groupedFonts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <span className="material-symbols-outlined text-gray-200 text-[48px] mb-3">font_download</span>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">No brand fonts found</p>
                        <p className="text-[10px] text-gray-400 mt-1">Upload font files to get started</p>
                    </div>
                ) : (
                    groupedFonts.map((group) => (
                        <div key={group.family} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-primary/20 transition-all group">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-black text-gray-800 uppercase tracking-widest leading-none">{group.family}</h3>
                                <span className="px-2 py-0.5 bg-white rounded-lg text-[9px] font-bold text-gray-400 border border-gray-100 uppercase tracking-wider">
                                    {group.variants.length} WEIGHTS
                                </span>
                            </div>
                            
                            <div className="space-y-2">
                                {group.variants.map((v) => (
                                    <div 
                                        key={v._id} 
                                        className="p-3 bg-white rounded-xl border border-gray-100 flex flex-col gap-2 hover:shadow-sm transition-all relative overflow-hidden group/item"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="px-2 py-0.5 bg-gray-50 rounded-lg text-[9px] font-black text-gray-400 border border-gray-100 uppercase tracking-widest leading-none">
                                                {v.variants?.[0] || 'Regular'}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-blue-500 text-[14px]" title="Brand Font">verified</span>
                                            </div>
                                        </div>
                                        <div 
                                            className="text-base truncate h-6 flex items-center"
                                            style={{ fontFamily: `'${v.family}'`, fontWeight: v.variants?.[0] || 'normal' }}
                                        >
                                            The quick brown fox jumps...
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <FontUploadModal 
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                brandId={brandId}
                onUploadSuccess={() => {
                    if (onUpload) onUpload(null);
                }}
            />
        </div>
    );
};

export default FontAssetContainer;
