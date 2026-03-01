import React from 'react';
import { UserData } from '../utils/auth';

interface LeftSidebarProps {
    activeTab?: string | null;
    onTabClick?: (tab: string) => void;
    onSettingsClick?: () => void;
    user: UserData | null;
    onLogout: () => void;
    isVoiceConnected?: boolean;
    isMuted?: boolean;
    isDeafened?: boolean;
    onToggleMute?: () => void;
    onToggleDeafen?: () => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ 
    activeTab, onTabClick, onSettingsClick, user, onLogout, isVoiceConnected,
    isMuted, isDeafened, onToggleMute, onToggleDeafen
}) => {
    const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
    const userMenuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex w-[72px] border-r border-[#e5e8eb] bg-white z-[310] shrink-0 flex-col items-center py-4 gap-4 min-h-0 relative">
            <button className="flex flex-col items-center gap-1 group text-gray-500 hover:text-gray-800">
                <div className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors">
                    <span className="material-symbols-outlined text-[24px]">design_services</span>
                </div>
                <span className="text-[9px] font-medium">Templates</span>
            </button>

            <button 
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'ai' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('ai')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'ai' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'ai' ? 'font-semibold' : 'font-medium'}`}>AI Design</span>
                {activeTab === 'ai' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>
          
            <button 
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'media' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('media')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'media' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">image</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'media' ? 'font-semibold' : 'font-medium'}`}>Media</span>
                {activeTab === 'media' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>
            <button 
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'video' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('video')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'video' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">movie</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'video' ? 'font-semibold' : 'font-medium'}`}>Video</span>
                {activeTab === 'video' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>
            <button 
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'text' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('text')}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', '');
                    e.dataTransfer.setData('assetType', 'text');
                    e.dataTransfer.setData('label', '');
                    e.dataTransfer.effectAllowed = 'copy';
                }}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'text' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">title</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'text' ? 'font-semibold' : 'font-medium'}`}>Text</span>
                {activeTab === 'text' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>
            <button 
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'button' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('button')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'button' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">smart_button</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'button' ? 'font-semibold' : 'font-medium'}`}>Button</span>
                {activeTab === 'button' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>
            <button
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'form' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('form')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'form' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">pin</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'form' ? 'font-semibold' : 'font-medium'}`}>Form</span>
                {activeTab === 'form' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>
            <button
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'widget' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('widget')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'widget' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">code</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'widget' ? 'font-semibold' : 'font-medium'}`}>Widget</span>
                {activeTab === 'widget' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>
            <button 
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'shape' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('shape')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'shape' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">category</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'shape' ? 'font-semibold' : 'font-medium'}`}>Shapes</span>
                {activeTab === 'shape' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>

            <button 
                className={`flex flex-col items-center gap-1 group transition-colors relative ${activeTab === 'font' ? 'text-primary' : 'text-gray-500 hover:text-gray-800'}`}
                onClick={() => onTabClick?.('font')}
            >
                <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${activeTab === 'font' ? 'bg-primary/10' : 'hover:bg-gray-100'}`}>
                    <span className="material-symbols-outlined text-[24px]">font_download</span>
                </div>
                <span className={`text-[9px] ${activeTab === 'font' ? 'font-semibold' : 'font-medium'}`}>Fonts</span>
                {activeTab === 'font' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
            </button>

            <div className="relative mt-auto mb-2 group/voice">
                <button 
                    className={`flex flex-col items-center gap-1 transition-colors relative ${activeTab === 'voice' ? 'text-primary' : (isVoiceConnected ? 'text-green-600' : 'text-gray-500 hover:text-gray-800')}`}
                    onClick={() => onTabClick?.('voice')}
                >
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors relative ${activeTab === 'voice' ? 'bg-primary/10' : (isVoiceConnected ? 'bg-green-50' : 'hover:bg-gray-100')}`}>
                        <span className={`material-symbols-outlined text-[24px] ${isVoiceConnected ? 'text-green-500' : ''}`}>headset_mic</span>
                    </div>
                    <span className={`text-[9px] ${activeTab === 'voice' ? 'font-semibold' : (isVoiceConnected ? 'text-green-600 font-bold' : 'font-medium')}`}>Voice</span>
                    {activeTab === 'voice' && <div className="absolute -left-4 w-1 h-8 bg-primary rounded-r-full top-1"></div>}
                </button>

                {isVoiceConnected && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 pointer-events-none group-hover/voice:opacity-100 group-hover/voice:pointer-events-auto transition-all z-50 pl-2">
                        <div className="bg-white border border-gray-100 rounded-lg p-1 shadow-xl flex flex-col gap-1">
                            <button 
                                onClick={(e) => { e.stopPropagation(); onToggleMute?.(); }}
                                className={`size-8 rounded-md flex items-center justify-center transition-all ${isMuted ? 'bg-red-50 text-red-500' : 'hover:bg-gray-100 text-gray-500 hover:text-primary'}`}
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                <span className="material-symbols-outlined text-[18px]">{isMuted ? 'mic_off' : 'mic'}</span>
                            </button>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onToggleDeafen?.(); }}
                                className={`size-8 rounded-md flex items-center justify-center transition-all ${isDeafened ? 'bg-red-50 text-red-500' : 'hover:bg-gray-100 text-gray-500 hover:text-primary'}`}
                                title={isDeafened ? "Undeafen" : "Deafen"}
                            >
                                <span className="material-symbols-outlined text-[18px]">{isDeafened ? 'headset_off' : 'headset'}</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {/* User Profile Button */}
            <div className="relative" ref={userMenuRef}>
                <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={`flex flex-col items-center gap-1 group transition-all ${isUserMenuOpen ? 'text-primary' : 'text-gray-500 hover:text-primary'}`}
                >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isUserMenuOpen ? 'bg-primary/10 ring-2 ring-primary/20 shadow-sm' : 'hover:bg-gray-100'}`}>
                        {user?.picture ? (
                            <img src={user.picture} alt={user.firstName} className="w-7 h-7 rounded-lg object-cover border border-white shadow-sm" />
                        ) : (
                            <span className="material-symbols-outlined text-[24px]">account_circle</span>
                        )}
                    </div>
                </button>

                {/* Popout User Menu */}
                {isUserMenuOpen && user && (
                    <div className="absolute bottom-0 left-[64px] w-56 bg-white border border-gray-100 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.12)] py-1.5 z-50 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="px-4 py-3 border-b border-gray-50 mb-1">
                            <div className="flex items-center gap-3">
                                {user.picture ? (
                                    <img src={user.picture} alt={user.firstName} className="size-8 rounded-full object-cover border border-white shadow-sm" />
                                ) : (
                                    <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined text-[18px]">person</span>
                                    </div>
                                )}
                                <div className="flex flex-col leading-tight overflow-hidden">
                                    <p className="text-[12px] font-black text-gray-800 truncate">{user.firstName} {user.lastName}</p>
                                    <p className="text-[10px] text-primary font-bold uppercase tracking-tighter opacity-70">{user.role}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="px-2">
                             <button 
                                onClick={() => {
                                    setIsUserMenuOpen(false);
                                    onSettingsClick?.();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-gray-700 hover:bg-gray-50 rounded-xl transition-all group/item"
                            >
                                <span className="material-symbols-outlined text-[20px] text-gray-400 group-hover/item:text-primary transition-colors">settings</span>
                                <span className="text-[11px] font-bold uppercase tracking-wider">Settings</span>
                            </button>

                            <div className="h-px bg-gray-50 my-1"></div>

                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onLogout();
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all group/item"
                            >
                                <span className="material-symbols-outlined text-[20px]">logout</span>
                                <span className="text-[11px] font-bold uppercase tracking-wider text-left">Sign Out</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(LeftSidebar);
