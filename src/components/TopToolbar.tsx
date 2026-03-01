import React from 'react';
import ZoomComboBox from './ZoomComboBox';

interface TopToolbarProps {
    onAddStageClick?: () => void;
    onAddLandingPageClick?: () => void;
    zoom: number;
    onZoomChange: (zoom: number) => void;
    isSnapEnabled: boolean;
    onSnapToggle: () => void;
    onAlign?: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distributeX' | 'distributeY' | 'matchWidth' | 'matchHeight') => void;
    selectedCount: number;
    isSyncEnabled?: boolean;
    onSyncToggle?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onFitAll?: () => void;
}

const TopToolbar: React.FC<TopToolbarProps> = ({ 
    onAddStageClick, 
    onAddLandingPageClick,
    zoom, 
    onZoomChange, 
    isSnapEnabled, 
    onSnapToggle, 
    onAlign, 
    selectedCount, 
    isSyncEnabled = false,
    onSyncToggle,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    onFitAll
}) => {
    return (
        <div className="h-12 bg-white border-b border-[#e5e8eb] flex items-center px-6 shrink-0 z-40 min-w-[1100px]">
            {/* Left Section: Stage & Sync - flex-1 ensures it takes equal space to the right */}
            <div className="flex-1 flex items-center gap-3">
                <button 
                    onClick={onAddStageClick}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-all text-xs font-bold group"
                >
                    <span className="material-symbols-outlined text-[18px] text-gray-400 group-hover:text-primary transition-colors">add_box</span>
                    <span className="hidden min-[1500px]:inline">Add Stage</span>
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button 
                    onClick={onSyncToggle}
                    className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg transition-all text-xs font-bold group ${isSyncEnabled ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100'}`}
                    title={isSyncEnabled ? "Content Sync is ON (Name-based)" : "Content Sync is OFF (Independent Layers)"}
                >
                    <span className={`material-symbols-outlined text-[18px] ${isSyncEnabled ? 'text-primary' : 'text-gray-400'}`}>sync</span>
                    <span className="hidden min-[1500px]:inline">{isSyncEnabled ? 'Sync ON' : 'Sync OFF'}</span>
                </button>
            </div>

            {/* Center Section: Alignment Controls - flex-none ensures it stays centered between the balanced side sections */}
            <div className="flex-none flex items-center justify-center">
                <div className="flex items-center gap-1 bg-gray-50/50 p-1 rounded-xl border border-gray-100/50">
                    <button 
                        disabled={selectedCount === 0}
                        onClick={() => onAlign?.('left')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Align Left"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="6" height="12" x="8" y="6" rx="1" />
                            <path d="M2 2v20" />
                        </svg>
                    </button>
                    <button 
                        disabled={selectedCount === 0}
                        onClick={() => onAlign?.('center')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Align Center"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="12" height="6" x="6" y="9" rx="1" />
                            <path d="M12 2v20" />
                        </svg>
                    </button>
                    <button 
                        disabled={selectedCount === 0}
                        onClick={() => onAlign?.('right')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Align Right"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="6" height="12" x="10" y="6" rx="1" />
                            <path d="M22 2v20" />
                        </svg>
                    </button>
                    <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
                    <button 
                        disabled={selectedCount === 0}
                        onClick={() => onAlign?.('top')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Align Top"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="12" height="6" x="6" y="8" rx="1" />
                            <path d="M2 2h20" />
                        </svg>
                    </button>
                    <button 
                        disabled={selectedCount === 0}
                        onClick={() => onAlign?.('middle')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Align Middle"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="6" height="12" x="9" y="6" rx="1" />
                            <path d="M2 12h20" />
                        </svg>
                    </button>
                    <button 
                        disabled={selectedCount === 0}
                        onClick={() => onAlign?.('bottom')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Align Bottom"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="12" height="6" x="6" y="10" rx="1" />
                            <path d="M2 22h20" />
                        </svg>
                    </button>
                    <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
                    <button 
                        disabled={selectedCount < 3}
                        onClick={() => onAlign?.('distributeX')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Distribute Horizontally"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="4" height="14" x="4" y="5" rx="1" />
                            <rect width="4" height="14" x="16" y="5" rx="1" />
                            <path d="M10 2v20" />
                            <path d="M14 2v20" />
                        </svg>
                    </button>
                    <button 
                        disabled={selectedCount < 3}
                        onClick={() => onAlign?.('distributeY')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Distribute Vertically"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="14" height="4" x="5" y="4" rx="1" />
                            <rect width="14" height="4" x="5" y="16" rx="1" />
                            <path d="M2 10h20" />
                            <path d="M2 14h20" />
                        </svg>
                    </button>
                    <div className="w-px h-3 bg-gray-200 mx-0.5"></div>
                    <button 
                        disabled={selectedCount < 1}
                        onClick={() => onAlign?.('matchWidth')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Match Width"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="12" height="4" x="6" y="6" rx="1" />
                            <rect width="12" height="4" x="6" y="14" rx="1" />
                            <path d="M4 4v16M20 4v16" />
                        </svg>
                    </button>
                    <button 
                        disabled={selectedCount < 1}
                        onClick={() => onAlign?.('matchHeight')}
                        className="p-1.5 hover:bg-white rounded-lg text-gray-500 hover:text-primary transition-all disabled:opacity-30 disabled:hover:bg-transparent hover:shadow-sm" 
                        title="Match Height"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="4" height="12" x="6" y="6" rx="1" />
                            <rect width="4" height="12" x="14" y="6" rx="1" />
                            <path d="M4 4h16M4 20h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Right Section: Snaps, Undo & Zoom - flex-1 ensures it takes equal space to the left */}
            <div className="flex-1 flex items-center gap-4 justify-end">
                <div className="flex items-center gap-1">
                    <button 
                        onClick={onSnapToggle}
                        className={`p-2 rounded transition-all flex items-center justify-center ${isSnapEnabled ? 'text-primary bg-primary/10' : 'text-gray-500 hover:bg-gray-100'}`} 
                        title="Magnetic Snapping"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m6 15-4-4 6.7-6.7c.7-.7 1.9-.7 2.6 0L13.4 6.3c.7.7.7 1.9 0 2.6L6.7 15.6c-.7.7-1.9.7-2.6 0L1.4 13" />
                            <path d="m18 15 4-4-6.7-6.7c-.7-.7-1.9-.7-2.6 0L10.6 6.3c-.7.7-.7 1.9 0 2.6l6.7 9.3c.7.7 1.9.7 2.6 0L22.6 13" />
                            <line x1="7" y1="11" x2="11" y2="15" />
                            <line x1="13" y1="11" x2="17" y2="15" />
                        </svg>
                    </button>
                    <button 
                        onClick={onUndo}
                        disabled={!canUndo}
                        className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-primary transition-all disabled:opacity-20 disabled:cursor-not-allowed" 
                        title="Undo (Ctrl+Z)"
                    >
                        <span className="material-symbols-outlined text-[20px]">undo</span>
                    </button>
                    <button 
                        onClick={onRedo}
                        disabled={!canRedo}
                        className="p-2 hover:bg-gray-100 rounded text-gray-500 hover:text-primary transition-all disabled:opacity-20 disabled:cursor-not-allowed" 
                        title="Redo (Ctrl+Y)"
                    >
                        <span className="material-symbols-outlined text-[20px]">redo</span>
                    </button>
                </div>
                
                <div className="h-4 w-px bg-gray-200 mx-1"></div>

                <div className="flex items-center gap-2">
                    <ZoomComboBox 
                        value={Math.round(zoom * 100)} 
                        onChange={(v) => onZoomChange(v / 100)} 
                    />
                    <button 
                        className="p-1.5 bg-gray-100 rounded text-primary hover:bg-gray-200 transition-all" 
                        title="Rearrange & Fit to screen"
                        onClick={() => onFitAll ? onFitAll() : onZoomChange(1)}
                    >
                        <span className="material-symbols-outlined text-[18px]">fit_screen</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(TopToolbar);
