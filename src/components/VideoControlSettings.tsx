import React from 'react';
import ColorPicker from './ColorPicker';

interface VideoControlSettingsProps {
    values: any;
    onChange: (key: string, value: any) => void;
    onImageUpload?: (file: File, targetField: string) => void;
    isUploading?: boolean;
    documentColors?: string[];
}

const VideoControlSettings: React.FC<VideoControlSettingsProps> = ({ 
    values, 
    onChange, 
    onImageUpload, 
    isUploading,
    documentColors = []
}) => {
    return (
        <div className="flex flex-col gap-3 p-3 bg-white border border-gray-100 rounded-xl shadow-xs group/controls transition-all hover:border-primary/20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className={`size-8 rounded-lg flex items-center justify-center transition-all ${values['controls'] === 'true' ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
                        <span className="material-symbols-outlined text-[18px]">settings_input_component</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-gray-700 uppercase tracking-tight">Video Controls</span>
                        <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest">{values['controls'] === 'true' ? 'Enabled' : 'Disabled'}</span>
                    </div>
                </div>
                <button 
                    type="button"
                    onClick={() => {
                        const next = values['controls'] === 'true' ? 'false' : 'true';
                        onChange('controls', next);
                    }}
                    className={`relative w-10 h-5 rounded-full transition-all duration-300 focus:outline-hidden ${values['controls'] === 'true' ? 'bg-primary' : 'bg-gray-200'}`}
                >
                    <div className={`absolute top-1 left-1 size-3 bg-white rounded-full transition-all duration-300 shadow-sm ${values['controls'] === 'true' ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
            </div>

            {values['controls'] === 'true' && (
                <div className="flex flex-col gap-4 pt-4 border-t border-gray-50 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { key: 'controlPlay', label: 'Play Button', icon: 'play_arrow' },
                            { key: 'controlMute', label: 'Mute / Unmute', icon: 'volume_up' },
                            { key: 'controlVolume', label: 'Volume Control', icon: 'tune' },
                            { key: 'controlTimeline', label: 'Timeline', icon: 'linear_scale' },
                        ].map((ctrl) => (
                            <button
                                key={ctrl.key}
                                type="button"
                                onClick={() => {
                                    const current = values[ctrl.key] === 'true';
                                    const next = !current ? 'true' : 'false';
                                    onChange(ctrl.key, next);
                                }}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                    values[ctrl.key] === 'true' 
                                    ? 'bg-primary/[0.03] border-primary/20 text-primary' 
                                    : 'bg-gray-50 border-gray-100 text-gray-400 grayscale hover:grayscale-0'
                                }`}
                            >
                                <div className={`size-5 rounded flex items-center justify-center ${values[ctrl.key] === 'true' ? 'bg-primary/10' : 'bg-white border border-gray-100'}`}>
                                    <span className="material-symbols-outlined text-[14px]">{ctrl.icon}</span>
                                </div>
                                <span className="text-[8px] font-black uppercase tracking-tight">{ctrl.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Color & Icon Customization */}
                    <div className="space-y-4">
                        {/* Play Button settings */}
                        {values['controlPlay'] === 'true' && (
                            <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">play_circle</span>
                                    Play / Pause Style
                                </label>
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-bold text-gray-500 uppercase">Color</span>
                                    <ColorPicker 
                                        value={values['controlColorPlay']} 
                                        onChange={(val) => onChange('controlColorPlay', val)}
                                        variant="minimal"
                                        swatches={documentColors}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {['controlIconPlay', 'controlIconPause'].map((iconKey) => (
                                        <div key={iconKey} className="flex flex-col gap-1.5">
                                            <span className="text-[7px] font-black text-gray-400 uppercase">{iconKey.includes('Play') ? 'Play Icon' : 'Pause Icon'}</span>
                                            <div className="size-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center relative group/icon">
                                                {values[iconKey] ? (
                                                    <img src={values[iconKey]} className="size-6 object-contain" alt="icon" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-gray-200">{iconKey.includes('Play') ? 'play_arrow' : 'pause'}</span>
                                                )}
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    id={`shared-file-${iconKey}`} 
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file && onImageUpload) onImageUpload(file, iconKey);
                                                    }}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => document.getElementById(`shared-file-${iconKey}`)?.click()}
                                                    disabled={isUploading}
                                                    className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/icon:opacity-100 transition-opacity flex items-center justify-center rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isUploading ? (
                                                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px]">upload</span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Mute settings */}
                        {values['controlMute'] === 'true' && (
                            <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">volume_up</span>
                                    Mute / Unmute Style
                                </label>
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-bold text-gray-500 uppercase">Color</span>
                                    <ColorPicker 
                                        value={values['controlColorMute']} 
                                        onChange={(val) => onChange('controlColorMute', val)}
                                        variant="minimal"
                                        swatches={documentColors}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {['controlIconMute', 'controlIconUnmute'].map((iconKey) => (
                                        <div key={iconKey} className="flex flex-col gap-1.5">
                                            <span className="text-[7px] font-black text-gray-400 uppercase">{iconKey.includes('Unmute') ? 'Unmute Icon' : 'Mute Icon'}</span>
                                            <div className="size-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center relative group/icon">
                                                {values[iconKey] ? (
                                                    <img src={values[iconKey]} className="size-6 object-contain" alt="icon" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-gray-200">{iconKey.includes('Unmute') ? 'volume_up' : 'volume_off'}</span>
                                                )}
                                                <input 
                                                    type="file" 
                                                    className="hidden" 
                                                    id={`shared-file-${iconKey}`} 
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file && onImageUpload) onImageUpload(file, iconKey);
                                                    }}
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => document.getElementById(`shared-file-${iconKey}`)?.click()}
                                                    disabled={isUploading}
                                                    className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover/icon:opacity-100 transition-opacity flex items-center justify-center rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isUploading ? (
                                                        <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px]">upload</span>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Timeline settings */}
                        {values['controlTimeline'] === 'true' && (
                            <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">linear_scale</span>
                                    Timeline Style
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[7px] font-bold text-gray-500 uppercase">Track</span>
                                        <ColorPicker 
                                            value={values['controlColorTimelineTrack']} 
                                            onChange={(val) => onChange('controlColorTimelineTrack', val)}
                                            variant="minimal"
                                            swatches={documentColors}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[7px] font-bold text-gray-500 uppercase">Thumb</span>
                                        <ColorPicker 
                                            value={values['controlColorTimelineThumb']} 
                                            onChange={(val) => onChange('controlColorTimelineThumb', val)}
                                            variant="minimal"
                                            swatches={documentColors}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Volume settings */}
                        {values['controlVolume'] === 'true' && (
                            <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100 space-y-3">
                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[14px]">tune</span>
                                    Volume Style
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[7px] font-bold text-gray-500 uppercase">Track</span>
                                        <ColorPicker 
                                            value={values['controlColorVolumeTrack']} 
                                            onChange={(val) => onChange('controlColorVolumeTrack', val)}
                                            variant="minimal"
                                            swatches={documentColors}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="text-[7px] font-bold text-gray-500 uppercase">Thumb</span>
                                        <ColorPicker 
                                            value={values['controlColorVolumeThumb']} 
                                            onChange={(val) => onChange('controlColorVolumeThumb', val)}
                                            variant="minimal"
                                            swatches={documentColors}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VideoControlSettings;
