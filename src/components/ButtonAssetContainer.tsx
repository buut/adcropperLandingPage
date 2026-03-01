import React, { useState } from 'react';
import AddButtonModal from './AddButtonModal';

interface ButtonAssetContainerProps {
    onClose?: () => void;
    onDoubleClickAsset?: (url: string, type: string, meta?: any) => void;
    onDeleteAsset?: (index: number) => void;
    customAssets?: any[];
}

const ButtonAssetContainer: React.FC<ButtonAssetContainerProps> = ({ onClose, onDoubleClickAsset, onDeleteAsset, customAssets = [] }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const handleAddCustomButton = (data: any) => {
        onDoubleClickAsset?.(data.label, 'button', data);
    };

    const renderButtonAsset = (button: any, idx: number, isCustom: boolean = false) => (
        <div key={idx} className="aspect-video bg-white border border-gray-100 rounded-xl overflow-hidden group cursor-pointer hover:border-entry hover:shadow-lg transition-all flex flex-col relative">
            <div className="flex-1 flex items-center justify-center p-3 pointer-events-none">
                <div 
                    className={`w-full h-10 outer-button-container shadow-sm transition-all effect-${button.effect} flex items-center justify-center`}
                    style={{ 
                        background: button.bgType === 'radial' 
                            ? `radial-gradient(circle, ${button.color || '#10b981'}, ${button.color2 || '#004040'})` 
                            : (button.color || button.colorCode || '#10b981'),
                        // @ts-ignore
                        '--h-bg': button.hoverColor || button.hoverColorCode || '#059669',
                        // @ts-ignore
                        '--a-bg': button.activeColor || button.activeColorCode || '#047857'
                    }}
                >
                    <div className="rich-media-text-v !text-[8px] !px-2 !tracking-tight truncate">
                        {button.label}
                    </div>
                </div>
            </div>

            <div className="px-2 py-1.5 text-[8px] font-black text-gray-500 bg-gray-50 border-t border-gray-100 truncate pointer-events-none uppercase tracking-wider text-center">
                {button.label}
            </div>

            {/* Invisible overlay for drag handling */}
            <div 
                className="absolute inset-0 z-10"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', button.label);
                    e.dataTransfer.setData('assetType', 'button');
                    e.dataTransfer.setData('fullMeta', JSON.stringify(button));
                    e.dataTransfer.setData('label', button.label);
                    
                    const ghost = document.createElement('div');
                    ghost.style.width = `120px`;
                    ghost.style.height = `40px`;
                    ghost.style.backgroundColor = button.color;
                    ghost.style.borderRadius = '8px';
                    ghost.style.display = 'flex';
                    ghost.style.alignItems = 'center';
                    ghost.style.justifyContent = 'center';
                    ghost.style.color = 'white';
                    ghost.style.fontSize = '8px';
                    ghost.style.fontWeight = '800';
                    ghost.style.textTransform = 'uppercase';
                    ghost.style.fontFamily = 'Inter, sans-serif';
                    ghost.style.position = 'fixed';
                    ghost.style.top = '-1000px';
                    ghost.style.left = '-1000px';
                    ghost.style.zIndex = '-9999';
                    ghost.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
                    ghost.innerText = button.label;
                    
                    document.body.appendChild(ghost);
                    e.dataTransfer.setDragImage(ghost, 60, 20);
                    
                    setTimeout(() => {
                        document.body.removeChild(ghost);
                    }, 0);

                    e.dataTransfer.effectAllowed = 'copy';
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onDoubleClickAsset?.(button.label, 'button', button);
                }}
            />

            {isCustom && (
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAsset?.(idx);
                    }}
                    className="absolute top-2 right-2 size-6 bg-red-500 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600 z-20"
                >
                    <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
            )}
        </div>
    );

    return (
        <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
            <div className="p-5 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">Button Assets</h2>
                </div>
                
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <span className="material-symbols-outlined text-[20px]">search</span>
                    </span>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-entry/20 focus:border-entry bg-gray-50/50 transition-all focus:outline-hidden" 
                        placeholder="Search buttons..." 
                        type="text"
                    />
                </div>
            </div>

            {/* Custom Button Modal */}
            <AddButtonModal 
                isOpen={isAddModalOpen} 
                onClose={() => setIsAddModalOpen(false)} 
                onAdd={handleAddCustomButton} 
            />

            <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                {customAssets.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[16px] text-entry">stars</span>
                            <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Your Assets</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {customAssets.map((button, idx) => renderButtonAsset(button, idx, true))}
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Pre-styled Buttons</h3>
                    <div className="grid grid-cols-2 gap-4">
                        {/* Buttons mapping */}
                        {[
                            { label: 'Primary Shine', icon: 'smart_button', color: '#10b981', hoverColor: '#059669', activeColor: '#047857', effect: 'shine' },
                            { label: 'Pulse Glow', icon: 'ads_click', color: '#4f46e5', hoverColor: '#4338ca', activeColor: '#3730a3', effect: 'glow' },
                            { label: 'Jelly Bounce', icon: 'bakery_dining', color: '#ec4899', hoverColor: '#db2777', activeColor: '#be185d', effect: 'jelly' },
                            { label: 'Glass Tilt', icon: '3d_rotation', color: '#1e293b', hoverColor: '#334155', activeColor: '#0f172a', effect: 'tilt' },
                            { label: 'Lift Up', icon: 'arrow_upward', color: '#f97316', hoverColor: '#ea580c', activeColor: '#c2410c', effect: 'lift' },
                            { label: 'Glitch Mode', icon: 'dvr', color: '#dc2626', hoverColor: '#b91c1c', activeColor: '#991b1b', effect: 'glitch' },
                            { label: 'Radial Soft', icon: 'lens', color: '#008080', hoverColor: '#059669', activeColor: '#047857', effect: 'none', bgType: 'radial', color2: '#004040' },
                        ].map((button, idx) => renderButtonAsset(button, idx))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ButtonAssetContainer;
