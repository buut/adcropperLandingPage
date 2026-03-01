import React from 'react';

interface TextAssetContainerProps {
    onClose?: () => void;
    onDoubleClickAsset?: (url: string, type: string, meta?: any) => void;
}

const TextAssetContainer: React.FC<TextAssetContainerProps> = ({ onClose, onDoubleClickAsset }) => {
    return (
        <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
            <div className="p-5 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">Text Assets</h2>
                </div>
                
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <span className="material-symbols-outlined text-[20px]">search</span>
                    </span>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-entry/20 focus:border-entry bg-gray-50/50 transition-all focus:outline-hidden" 
                        placeholder="Search text styles..." 
                        type="text"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Basic Typography</h3>
                        <div className="space-y-2">
                            {[
                                { label: 'Heading 1', size: '32', weight: '800', font: 'Outfit' },
                                { label: 'Heading 2', size: '24', weight: '700', font: 'Outfit' },
                                { label: 'Subheading', size: '18', weight: '600', font: 'Outfit' },
                                { label: 'Body Text', size: '14', weight: '400', font: 'Inter' },
                                { label: 'Caption', size: '12', weight: '400', font: 'Inter' },
                            ].map((text, idx) => (
                                <div 
                                    key={idx}
                                    className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl hover:border-primary/30 hover:bg-white transition-all cursor-pointer group"
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', text.label);
                                        e.dataTransfer.setData('assetType', 'text');
                                        e.dataTransfer.setData('label', text.label);
                                        e.dataTransfer.setData('fontSize', text.size);
                                        e.dataTransfer.setData('fontWeight', text.weight);
                                        e.dataTransfer.setData('fontFamily', text.font);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation();
                                        onDoubleClickAsset?.(text.label, 'text', {
                                            label: text.label,
                                            fontSize: text.size,
                                            fontWeight: text.weight,
                                            fontFamily: text.font
                                        });
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div style={{ fontFamily: text.font, fontSize: '14px', fontWeight: text.weight as any }}>
                                            {text.label}
                                        </div>
                                        <span className="text-[9px] text-gray-400 font-mono">{text.size}px</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Drop to add text</h3>
                        <p className="text-[10px] text-gray-400 italic">Drag any style above onto the canvas to create a text layer.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TextAssetContainer;
