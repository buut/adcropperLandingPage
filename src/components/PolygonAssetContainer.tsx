import React from 'react';

interface PolygonAssetContainerProps {
    onClose?: () => void;
    onDoubleClickAsset?: (url: string, type: string, meta?: any) => void;
}

const PolygonAssetContainer: React.FC<PolygonAssetContainerProps> = ({ onClose, onDoubleClickAsset }) => {
    const shapes = [
        { 
            name: 'Square', 
            type: 'square', 
            path: 'inset(0%)',
            icon: 'square',
            defaultColor: '#3B82F6'
        },
        { 
            name: 'Circle', 
            type: 'circle', 
            path: 'circle(50% at 50% 50%)',
            icon: 'circle',
            defaultColor: '#EF4444'
        },
        { 
            name: 'Triangle', 
            type: 'triangle', 
            path: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            icon: 'change_history',
            defaultColor: '#10B981'
        },
        { 
            name: 'Pentagon', 
            type: 'pentagon', 
            path: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
            icon: 'pentagon',
            defaultColor: '#F59E0B'
        },
        { 
            name: 'Star', 
            type: 'star', 
            path: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
            icon: 'star',
            defaultColor: '#8B5CF6'
        },
        {
            name: 'Line',
            type: 'line',
            path: 'none',
            icon: 'horizontal_rule',
            defaultColor: '#000000'
        }
    ];

    return (
        <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
            <div className="p-5 border-b border-gray-100 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">Shape Assets</h2>
                    <button 
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>
                
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                        <span className="material-symbols-outlined text-[20px]">search</span>
                    </span>
                    <input 
                        className="w-full pl-10 pr-4 py-2.5 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary bg-gray-50/50 transition-all focus:outline-hidden" 
                        placeholder="Search shapes..." 
                        type="text"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                <div className="mb-6">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Basic Shapes</h3>
                    <div className="grid grid-cols-3 gap-3">
                        {shapes.map((shape, idx) => (
                            <div 
                                key={idx}
                                className="aspect-square bg-white border border-gray-100 rounded-xl overflow-hidden group hover:border-entry hover:shadow-lg transition-all cursor-pointer flex flex-col relative"
                                draggable
                                onDragStart={(e) => {
                                    const meta = {
                                        useHtml: shape.type === 'square' || shape.type === 'circle' || shape.type === 'line',
                                        shapeType: shape.type,
                                        borderRadius: shape.type === 'square' ? 0 : undefined,
                                        clipPath: shape.path,
                                        bgType: 'solid',
                                        label: shape.name,
                                        fills: [
                                            {
                                                id: Math.random().toString(36).substr(2, 9),
                                                type: 'solid',
                                                color: shape.defaultColor,
                                                visible: true,
                                                opacity: 1
                                            }
                                        ]
                                    };
                                    e.dataTransfer.setData('text/plain', shape.name);
                                    e.dataTransfer.setData('assetType', 'shape');
                                    e.dataTransfer.setData('asset-meta', JSON.stringify(meta));
                                    e.dataTransfer.effectAllowed = 'copy';
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    onDoubleClickAsset?.(shape.name, 'shape', {
                                        useHtml: shape.type === 'square' || shape.type === 'circle' || shape.type === 'line',
                                        shapeType: shape.type,
                                        borderRadius: shape.type === 'square' ? 0 : undefined,
                                        clipPath: shape.path,
                                        bgType: 'solid',
                                        label: shape.name,
                                        fills: [
                                            {
                                                id: Math.random().toString(36).substr(2, 9),
                                                type: 'solid',
                                                color: shape.defaultColor,
                                                visible: true,
                                                opacity: 1
                                            }
                                        ]
                                    });
                                }}
                            >
                                <div className="flex-1 flex items-center justify-center p-3 pointer-events-none">
                                    <div 
                                        className="w-10 h-10 transition-transform group-hover:scale-110 duration-300 shadow-sm"
                                        style={{ 
                                            background: shape.defaultColor,
                                            clipPath: (shape.type === 'square' || shape.type === 'circle' || shape.type === 'line') ? 'none' : shape.path,
                                            borderRadius: shape.type === 'circle' ? '50%' : (shape.type === 'square' ? '4px' : '0'),
                                            height: shape.type === 'line' ? '2px' : '40px',
                                        }}
                                    />
                                </div>
                                <div className="px-2 py-1.5 text-[8px] font-black text-gray-500 bg-gray-50 border-t border-gray-100 truncate pointer-events-none uppercase tracking-wider text-center">
                                    {shape.name}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolygonAssetContainer;
