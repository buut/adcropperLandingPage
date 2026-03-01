import React from 'react';
import { UserData } from '../utils/auth';
export type AppMode = 'design' | 'animate' | 'preview';

interface HeaderProps {
    user: UserData | null;
    onLogout: () => void;
    mode: AppMode;
    collaborators: Record<string, { name: string, lastSeen: number }>;
    followedUserId?: string | null;
    onSelectUser?: (userId: string | null) => void;
    setMode: (mode: AppMode) => void;
    onExportAll: () => void;
    onSave?: () => void;
    onLoad?: (data: any) => void;
    onReportClick?: () => void;
    showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, mode, collaborators, followedUserId, onSelectUser, setMode, onExportAll, onSave, onLoad, onReportClick, showNotification }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isLogoMenuOpen, setIsLogoMenuOpen] = React.useState(false);
    const logoMenuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (logoMenuRef.current && !logoMenuRef.current.contains(event.target as Node)) {
                setIsLogoMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getUserColor = (id: string) => {
        const colors = ['#FF5733', '#33FF57', '#3357FF', '#F333FF', '#33FFF3', '#F3FF33', '#FF8333'];
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = id.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && onLoad) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const json = JSON.parse(event.target?.result as string);
                    onLoad(json);
                } catch (err) {
                    console.error('Error parsing .adc file:', err);
                    if (showNotification) {
                        showNotification('Invalid .adc file format', 'error');
                    } else {
                        alert('Invalid .adc file format');
                    }
                }
            };
            reader.readAsText(file);
            // Reset input so the same file can be selected again
            e.target.value = '';
        }
    };

    return (
        <header className="h-14 bg-white border-b border-[#e5e8eb] flex items-center justify-between px-4 z-[500] shrink-0 relative shadow-sm">
            <div className="flex items-center gap-4">
                <div className="relative" ref={logoMenuRef}>
                    <button 
                        onClick={() => setIsLogoMenuOpen(!isLogoMenuOpen)}
                        className={`size-9 rounded-xl flex items-center justify-center text-primary transition-all active:scale-95 ${isLogoMenuOpen ? 'bg-primary text-white shadow-lg ring-4 ring-primary/10' : 'bg-primary/10 hover:bg-primary/20'}`}
                    >
                        <span className="material-symbols-outlined text-[24px]">layers</span>
                    </button>

                    {/* Logo Dropdown Menu */}
                    {isLogoMenuOpen && (
                        <div className="absolute top-full mt-2 left-0 w-48 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] py-2 z-[400] animate-in fade-in zoom-in slide-in-from-top-2 duration-200 origin-top-left">
                            
                            <button 
                                onClick={() => {
                                    setIsLogoMenuOpen(false);
                                    fileInputRef.current?.click();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 transition-all group"
                            >
                                <span className="material-symbols-outlined text-[20px] text-gray-400 group-hover:text-primary transition-colors">folder_open</span>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-left flex-1">Open Project</span>
                                <span className="text-[9px] text-gray-300 font-mono">.adc</span>
                            </button>

                            <button 
                                onClick={() => {
                                    setIsLogoMenuOpen(false);
                                    onSave?.();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 transition-all group"
                            >
                                <span className="material-symbols-outlined text-[20px] text-gray-400 group-hover:text-primary transition-colors">save</span>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-left flex-1">Save Project</span>
                                <span className="text-[9px] text-gray-300 font-mono">⌘S</span>
                            </button>

                            <div className="h-px bg-gray-50 my-1"></div>

                            <button 
                                onClick={() => {
                                    setIsLogoMenuOpen(false);
                                    onReportClick?.();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 transition-all group"
                            >
                                <span className="material-symbols-outlined text-[20px] text-gray-400 group-hover:text-primary transition-colors">analytics</span>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-left flex-1">Stage Report</span>
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 group cursor-pointer">
                        <h1 className="text-sm font-bold text-[#121717] tracking-tight">Summer Sale Campaign 2024</h1>
                        <span className="material-symbols-outlined text-[16px] text-gray-300 group-hover:text-primary transition-colors">edit</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">10 Formats</span>
                        <span className="w-1 h-1 bg-gray-200 rounded-full"></span>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Saved 2m ago</span>
                    </div>
                </div>
                <div className="h-6 w-px bg-gray-100 mx-2"></div>


            </div>

            {/* Middle Section - Mode Switcher */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
                <button 
                    onClick={() => setMode('design')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider ${
                        mode === 'design' 
                        ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">edit_square</span>
                    <span className="hidden min-[1500px]:inline">Design</span>
                </button>
                <button 
                    onClick={() => setMode('animate')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider ${
                        mode === 'animate' 
                        ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">movie_edit</span>
                    <span className="hidden min-[1500px]:inline">Animate</span>
                </button>
                <button 
                    onClick={() => setMode('preview')}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider ${
                        mode === 'preview' 
                        ? 'bg-white text-primary shadow-sm ring-1 ring-black/5' 
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                >
                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                    <span className="hidden min-[1500px]:inline">Preview</span>
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="h-6 w-px bg-gray-100 mx-1"></div>
                
                {/* Collaborators */}
                <div className="flex items-center -space-x-2 px-2">
                    {/* Current User (Always first) */}
                    {user && (
                        <div 
                            className="size-8 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-black/5 relative z-30 group cursor-default"
                            title={`${user.firstName} ${user.lastName} (You)`}
                        >
                            {user.picture ? (
                                <img src={user.picture} alt="You" className="size-full rounded-full object-cover" />
                            ) : (
                                <span className="uppercase">{user.firstName[0]}{user.lastName[0]}</span>
                            )}
                            <div className="absolute -bottom-0.5 -right-0.5 size-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                    )}

                    {Object.entries(collaborators).map(([id, info], idx) => {
                        const initials = info.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                        const isFollowed = followedUserId === id;
                        const userColor = getUserColor(id);
                        
                        return (
                            <button
                                key={id}
                                onClick={() => onSelectUser?.(isFollowed ? null : id)}
                                className={`size-8 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-black/5 relative transition-all hover:-translate-y-0.5 hover:z-40 ${isFollowed ? 'ring-2 ring-primary z-40' : 'z-20'}`}
                                style={{ 
                                    zIndex: 10 - idx,
                                    backgroundColor: userColor 
                                }}
                                title={isFollowed ? `Watching ${info.name}` : `Follow ${info.name}`}
                            >
                                <span>{initials}</span>
                                {isFollowed && (
                                    <div className="absolute -top-1 -right-1 size-3.5 bg-primary border-2 border-white rounded-full flex items-center justify-center shadow-sm">
                                        <span className="material-symbols-outlined text-[9px] text-white font-black">visibility</span>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="h-6 w-px bg-gray-100 mx-1"></div>
                <button 
                    onClick={onExportAll}
                    className="h-9 px-5 bg-primary hover:bg-[#0f5757] text-white text-[12px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                    <span className="material-symbols-outlined text-[20px]">download</span>
                    Export All
                </button>
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".adc" 
                className="hidden" 
            />
        </header>
    );
};

export default React.memo(Header);
