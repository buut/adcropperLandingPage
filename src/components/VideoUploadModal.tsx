import React, { useState, useRef, useEffect } from 'react';
import { cleanFileName } from '../utils/fileUtils';
import VideoControlSettings from './VideoControlSettings';
import { UPLOAD_URL } from '../App';

interface VideoUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (video: any) => void;
    showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
    editData?: any;
    isEdit?: boolean;
}

const VideoUploadModal: React.FC<VideoUploadModalProps> = ({ 
    isOpen, 
    onClose, 
    onAdd, 
    showNotification,
    editData,
    isEdit = false
}) => {
    const [videoUrl, setVideoUrl] = useState('');
    const [posterUrl, setPosterUrl] = useState('');
    const [videoName, setVideoName] = useState('');
    const [uploadType, setUploadType] = useState<'file' | 'link'>('file');
    const [tempVideoFile, setTempVideoFile] = useState<File | null>(null);
    const [tempPosterFile, setTempPosterFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    
    // Control Settings State
    const [controlValues, setControlValues] = useState<any>({
        controls: 'false',
        controlPlay: 'true',
        controlMute: 'true',
        controlVolume: 'true',
        controlTimeline: 'true',
        controlColorPlay: '#ffffff',
        controlColorMute: '#ffffff',
        controlColorTimelineTrack: 'rgba(255,255,255,0.3)',
        controlColorTimelineThumb: '#3B82F6',
        controlColorVolumeTrack: 'rgba(255,255,255,0.3)',
        controlColorVolumeThumb: '#3B82F6',
        controlIconPlay: null,
        controlIconPause: null,
        controlIconMute: null,
        controlIconUnmute: null,
    });

    const videoFileInputRef = useRef<HTMLInputElement>(null);
    const posterFileInputRef = useRef<HTMLInputElement>(null);

    const [previewVideoUrl, setPreviewVideoUrl] = useState<string>('');
    const [previewPosterUrl, setPreviewPosterUrl] = useState<string>('');
    
    // Video Playback State for Preview
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoPlayState, setVideoPlayState] = useState(false);
    const [videoMuted, setVideoMuted] = useState(true);
    const [videoVolume, setVideoVolume] = useState(1);
    const videoPreviewRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (isOpen && isEdit && editData) {
            setVideoUrl(editData.url || '');
            setPosterUrl(editData.poster || '');
            setVideoName(editData.name || '');
            setUploadType('link');
            
            // Map editData meta to controlValues
            const newValues = { ...controlValues };
            Object.keys(controlValues).forEach(key => {
                const val = editData[key];
                if (val !== undefined && val !== null) {
                    newValues[key] = String(val);
                } else if (val === null) {
                    newValues[key] = null;
                }
            });
            setControlValues(newValues);
        } else if (isOpen && !isEdit) {
            resetState();
        }
    }, [isOpen, isEdit, editData]);

    // Sync video preview state from file or URL
    useEffect(() => {
        let url = '';
        if (tempVideoFile) {
            url = URL.createObjectURL(tempVideoFile);
            setPreviewVideoUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewVideoUrl(videoUrl);
        }
    }, [tempVideoFile, videoUrl]);

    // Sync poster preview state from file or URL
    useEffect(() => {
        let url = '';
        if (tempPosterFile) {
            url = URL.createObjectURL(tempPosterFile);
            setPreviewPosterUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewPosterUrl(posterUrl);
        }
    }, [tempPosterFile, posterUrl]);

    // Track actual video element state
    useEffect(() => {
        const v = videoPreviewRef.current;
        if (!v) return;

        const updateState = () => {
            setVideoPlayState(!v.paused);
            setVideoMuted(v.muted);
            setVideoVolume(v.volume);
            setVideoCurrentTime(v.currentTime);
            setVideoDuration(v.duration || 0);
        };

        v.addEventListener('play', updateState);
        v.addEventListener('pause', updateState);
        v.addEventListener('volumechange', updateState);
        v.addEventListener('timeupdate', updateState);
        v.addEventListener('loadedmetadata', updateState);

        return () => {
            v.removeEventListener('play', updateState);
            v.removeEventListener('pause', updateState);
            v.removeEventListener('volumechange', updateState);
            v.removeEventListener('timeupdate', updateState);
            v.removeEventListener('loadedmetadata', updateState);
        };
    }, [previewVideoUrl]);

    if (!isOpen) return null;

    const resetState = () => {
        setVideoUrl('');
        setPosterUrl('');
        setVideoName('');
        setUploadType('file');
        setTempVideoFile(null);
        setTempPosterFile(null);
        setIsUploading(false);
        setVideoPlayState(false);
        setVideoCurrentTime(0);
        setPreviewVideoUrl('');
        setPreviewPosterUrl('');
        setControlValues({
            controls: 'false',
            controlPlay: 'true',
            controlMute: 'true',
            controlVolume: 'true',
            controlTimeline: 'true',
            controlColorPlay: '#ffffff',
            controlColorMute: '#ffffff',
            controlColorTimelineTrack: 'rgba(255,255,255,0.3)',
            controlColorTimelineThumb: '#3B82F6',
            controlColorVolumeTrack: 'rgba(255,255,255,0.3)',
            controlColorVolumeThumb: '#3B82F6',
            controlIconPlay: null,
            controlIconPause: null,
            controlIconMute: null,
            controlIconUnmute: null,
        });
    };

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = videoPreviewRef.current;
        if (!v) return;
        if (v.paused) v.play();
        else v.pause();
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = videoPreviewRef.current;
        if (!v) return;
        v.muted = !v.muted;
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const v = videoPreviewRef.current;
        if (!v) return;
        const val = parseFloat(e.target.value);
        v.volume = val;
        v.muted = val === 0;
    };

    const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const v = videoPreviewRef.current;
        if (!v) return;
        const val = parseFloat(e.target.value);
        v.currentTime = val;
    };

    const handleControlChange = (key: string, value: any) => {
        setControlValues((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleIconUpload = async (file: File, targetField: string) => {
        if (!file) return;
        setIsUploading(true);
        const companyId = '66db07778b5e35892545578c';
        const brandId = '671a1666d786fa251fca95d0';
        const templateId = '670fa914c2f0842143d5932';

        try {
            const formData = new FormData();
            const cleanedName = cleanFileName(file.name);
            const renamedFile = new File([file], cleanedName, { type: file.type });
            formData.append('file', renamedFile);
            formData.append('companyId', companyId);
            formData.append('brandId', brandId);
            formData.append('templateId', templateId);

            const response = await fetch(`${UPLOAD_URL}/upload-asset`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Upload failed');
            const data = await response.json();
            
            if (data.url) {
                handleControlChange(targetField, data.url);
            }
        } catch (error) {
            console.error('Icon upload error:', error);
            showNotification?.('Failed to upload icon', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        
        let finalVideoUrl = videoUrl;
        let finalPosterUrl = posterUrl || 'https://via.placeholder.com/640x360.png?text=No+Poster';
        let finalName = videoName;

        if (uploadType === 'file' && !isEdit) {
            if (!tempVideoFile) return;
            
            setIsUploading(true);
            const companyId = '66db07778b5e35892545578c';
            const brandId = '671a1666d786fa251fca95d0';
            const templateId = '670fa914c2f0842143d5932';

            try {
                const formData = new FormData();
                const cleanedVideoName = cleanFileName(tempVideoFile.name);
                const renamedVideoFile = new File([tempVideoFile], cleanedVideoName, { type: tempVideoFile.type });
                formData.append('video', renamedVideoFile);
                formData.append('companyId', companyId);
                formData.append('brandId', brandId);
                formData.append('templateId', templateId);
                if (tempPosterFile) {
                    const cleanedPosterName = cleanFileName(tempPosterFile.name);
                    const renamedPosterFile = new File([tempPosterFile], cleanedPosterName, { type: tempPosterFile.type });
                    formData.append('poster', renamedPosterFile);
                }

                const response = await fetch(`${UPLOAD_URL}/upload-video-asset`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(`Upload failed: ${response.status} ${response.statusText}. ${errData.error || ''}`);
                }
                
                const data = await response.json();
                finalVideoUrl = data.videoUrl;
                finalPosterUrl = data.posterUrl || finalPosterUrl;
                finalName = finalName || tempVideoFile.name;
            } catch (error) {
                console.error('Error uploading video asset:', error);
                showNotification?.('Failed to upload video asset', 'error');
                setIsUploading(false);
                return;
            } finally {
                setIsUploading(false);
            }
        } else {
            if (!finalVideoUrl && !tempVideoFile) return;
            finalName = finalName || 'Linked Video';
            
            // If we are in link mode or edit mode, and a poster file was selected, upload it separately
            if (tempPosterFile) {
                setIsUploading(true);
                try {
                    const formData = new FormData();
                    const cleanedPosterName = cleanFileName(tempPosterFile.name);
                    const renamedPosterFile = new File([tempPosterFile], cleanedPosterName, { type: tempPosterFile.type });
                    formData.append('file', renamedPosterFile);
                    formData.append('companyId', '66db07778b5e35892545578c');
                    formData.append('brandId', '671a1666d786fa251fca95d0');
                    formData.append('templateId', '670fa914c2f0842143d5932');

                    const response = await fetch(`${UPLOAD_URL}/upload-asset`, {
                        method: 'POST',
                        body: formData
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.url) finalPosterUrl = data.url;
                    }
                } catch (e) {
                    console.error("Poster upload failed:", e);
                } finally {
                    setIsUploading(false);
                }
            }

            // If we are in edit mode and a video file was selected, upload it
            if (isEdit && tempVideoFile) {
                setIsUploading(true);
                try {
                    const formData = new FormData();
                    const cleanedVideoName = cleanFileName(tempVideoFile.name);
                    const renamedVideoFile = new File([tempVideoFile], cleanedVideoName, { type: tempVideoFile.type });
                    formData.append('video', renamedVideoFile);
                    formData.append('companyId', '66db07778b5e35892545578c');
                    formData.append('brandId', '671a1666d786fa251fca95d0');
                    formData.append('templateId', '670fa914c2f0842143d5932');

                    const response = await fetch(`${UPLOAD_URL}/upload-video-asset`, {
                        method: 'POST',
                        body: formData
                    });
                    if (response.ok) {
                        const data = await response.json();
                        finalVideoUrl = data.videoUrl;
                        if (data.posterUrl && !tempPosterFile) finalPosterUrl = data.posterUrl;
                    }
                } catch (e) {
                    console.error("Video upload failed during edit:", e);
                } finally {
                    setIsUploading(false);
                }
            }
        }

        const videoAssetData = {
            url: finalVideoUrl,
            poster: finalPosterUrl,
            name: finalName,
            ...controlValues
        };

        onAdd(videoAssetData);
        resetAndClose();
    };

    const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setTempVideoFile(file);
            if (!videoName) setVideoName(file.name);
        }
    };

    const handlePosterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setTempPosterFile(file);
        }
    };

    const resetAndClose = () => {
        resetState();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
                onClick={resetAndClose}
            ></div>
            
            {/* Modal */}
            <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">{isEdit ? 'Edit Video Asset' : 'Add Video Asset'}</h2>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            type="button"
                            onClick={() => handleSubmit()}
                            disabled={isUploading || (!isEdit && uploadType === 'file' ? !tempVideoFile : !videoUrl && !tempVideoFile)}
                            className="px-6 py-2 bg-primary text-white text-sm font-bold rounded-xl hover:bg-[#0f5757] transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                            {isUploading && <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>}
                            Save Changes
                        </button>
                        <button 
                            type="button"
                            onClick={resetAndClose}
                            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
                
                <form onSubmit={handleSubmit} className="overflow-y-auto p-8 flex flex-col gap-6 scrollbar-hide">
                    {/* Three Column Layout Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Column 1: Live Preview */}
                        <div className="flex flex-col gap-6">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Real-time Player Preview</label>
                            
                            <div className="aspect-video bg-black rounded-3xl overflow-hidden relative shadow-2xl group/preview border border-gray-100 ring-1 ring-black/5 ring-inset">
                                <video 
                                    ref={videoPreviewRef}
                                    src={previewVideoUrl || ''}
                                    poster={previewPosterUrl}
                                    className="w-full h-full object-contain"
                                    muted={videoMuted}
                                    playsInline
                                />
                                
                                {/* Controls Overlay Mirroring LayerPreview */}
                                {controlValues.controls === 'true' && (
                                    <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-3 bg-gradient-to-t from-black/90 to-transparent">
                                        {controlValues.controlTimeline === 'true' && (
                                            <input 
                                                type="range"
                                                min="0"
                                                max={videoDuration || 100}
                                                step="0.1"
                                                value={videoCurrentTime}
                                                onChange={handleTimelineChange}
                                                style={{ 
                                                    accentColor: controlValues.controlColorTimelineThumb || '#3B82F6',
                                                    background: controlValues.controlColorTimelineTrack || 'rgba(255,255,255,0.3)'
                                                }}
                                                className="w-full h-1 rounded-full appearance-none cursor-pointer hover:h-1.5 transition-all"
                                            />
                                        )}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {controlValues.controlPlay === 'true' && (
                                                    <button 
                                                        type="button"
                                                        onClick={togglePlay}
                                                        style={{ color: controlValues.controlColorPlay || '#ffffff' }}
                                                        className="size-9 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all hover:bg-white/20 active:scale-95"
                                                    >
                                                        {videoPlayState ? (
                                                            controlValues.controlIconPause ? <img src={controlValues.controlIconPause} className="size-4" alt="pause" /> : <span className="material-symbols-outlined text-[20px]">pause</span>
                                                        ) : (
                                                            controlValues.controlIconPlay ? <img src={controlValues.controlIconPlay} className="size-4" alt="play" /> : <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                                                        )}
                                                    </button>
                                                )}
                                                {controlValues.controlMute === 'true' && (
                                                    <button 
                                                        type="button"
                                                        onClick={toggleMute}
                                                        style={{ color: controlValues.controlColorMute || '#ffffff' }}
                                                        className="size-9 rounded-xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center transition-all hover:bg-white/20 active:scale-95"
                                                    >
                                                        {videoMuted ? (
                                                            controlValues.controlIconMute ? <img src={controlValues.controlIconMute} className="size-4" alt="mute" /> : <span className="material-symbols-outlined text-[20px]">volume_off</span>
                                                        ) : (
                                                            controlValues.controlIconUnmute ? <img src={controlValues.controlIconUnmute} className="size-4" alt="unmute" /> : <span className="material-symbols-outlined text-[20px]">volume_up</span>
                                                        )}
                                                    </button>
                                                )}
                                                {controlValues.controlVolume === 'true' && (
                                                    <input 
                                                        type="range"
                                                        min="0"
                                                        max="1"
                                                        step="0.05"
                                                        value={videoVolume}
                                                        onChange={handleVolumeChange}
                                                        style={{ 
                                                            accentColor: controlValues.controlColorVolumeThumb || '#3B82F6',
                                                            background: controlValues.controlColorVolumeTrack || 'rgba(255,255,255,0.3)'
                                                        }}
                                                        className="w-20 h-1 rounded-full appearance-none cursor-pointer"
                                                    />
                                                )}
                                            </div>
                                            {controlValues.controlTimeline === 'true' && (
                                                <div className="text-[10px] font-black text-white/90 tabular-nums tracking-widest bg-black/40 px-2 py-1 rounded-md backdrop-blur-sm">
                                                    {Math.floor(videoCurrentTime)}:{(videoCurrentTime % 60).toFixed(0).padStart(2, '0')} / {Math.floor(videoDuration)}:{(videoDuration % 60).toFixed(0).padStart(2, '0')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Hover Play Icon Overlay */}
                                {!videoPlayState && previewVideoUrl && (
                                    <div 
                                        className="absolute inset-0 flex items-center justify-center cursor-pointer group-hover/preview:bg-black/20 transition-all"
                                        onClick={togglePlay}
                                    >
                                        <div className="size-16 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white opacity-60 group-hover/preview:opacity-100 group-hover/preview:scale-110 transition-all shadow-2xl">
                                            <span className="material-symbols-outlined text-4xl">play_arrow</span>
                                        </div>
                                    </div>
                                )}
                                
                                {!previewVideoUrl && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-600 bg-gray-50">
                                        <span className="material-symbols-outlined text-4xl opacity-20">movie</span>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">No Video Selected</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 flex flex-col gap-2">
                                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Preview Tips</h4>
                                <ul className="text-xs text-primary/70 space-y-2 list-none p-0">
                                    <li className="flex gap-2">
                                        <span className="text-primary font-bold">•</span>
                                        Controls visibility is toggled by the first switch on the right.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-primary font-bold">•</span>
                                        Colors and custom icons update instantly in this preview.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Column 2: Source Info */}
                        <div className="flex flex-col gap-6">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Source & Basic Info</label>
                            
                            {!isEdit && (
                                <div className="flex p-1 bg-gray-100 rounded-xl shrink-0">
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${uploadType === 'file' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        onClick={() => setUploadType('file')}
                                        disabled={isUploading}
                                    >
                                        Upload File
                                    </button>
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${uploadType === 'link' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'}`}
                                        onClick={() => setUploadType('link')}
                                        disabled={isUploading}
                                    >
                                        Video Link
                                    </button>
                                </div>
                            )}

                            {!isEdit && uploadType === 'file' ? (
                                <div className="flex flex-col gap-4">
                                    <div 
                                        className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer group ${tempVideoFile ? 'border-primary/50 bg-primary/5' : 'border-gray-200 hover:border-primary hover:bg-primary/5'} ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                                        onClick={() => videoFileInputRef.current?.click()}
                                    >
                                        <input 
                                            type="file" 
                                            ref={videoFileInputRef} 
                                            className="hidden" 
                                            accept="video/*" 
                                            onChange={handleVideoFileChange}
                                        />
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform ${tempVideoFile ? 'bg-primary text-white' : 'bg-primary/10 text-primary group-hover:scale-110 shadow-lg shadow-primary/10'}`}>
                                            <span className="material-symbols-outlined text-[28px]">{isUploading ? 'progress_activity' : (tempVideoFile ? 'check' : 'movie')}</span>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-gray-700">{tempVideoFile ? tempVideoFile.name : 'Choose a Video File'}</p>
                                            {!tempVideoFile && <p className="text-xs text-gray-400 mt-1">MP4, WebM or Ogg supported</p>}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center justify-between">
                                            Video Source (URL)
                                            {isEdit && (
                                                <button 
                                                    type="button"
                                                    onClick={() => videoFileInputRef.current?.click()}
                                                    className="text-[10px] text-primary hover:text-primary/70 font-black uppercase flex items-center gap-1 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">upload</span>
                                                    {tempVideoFile ? 'Change' : 'Upload File'}
                                                </button>
                                            )}
                                        </label>
                                        <div className="flex flex-col gap-3">
                                            <input 
                                                type="url"
                                                value={videoUrl}
                                                onChange={(e) => {
                                                    setVideoUrl(e.target.value);
                                                    if (tempVideoFile) setTempVideoFile(null);
                                                }}
                                                placeholder="https://example.com/video.mp4"
                                                className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:outline-hidden text-sm font-medium"
                                                required={!tempVideoFile}
                                                disabled={isUploading}
                                            />
                                            {isEdit && tempVideoFile && (
                                                <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl">
                                                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                                                    <span className="text-xs font-bold text-primary truncate">Will upload: {tempVideoFile.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-4 p-5 bg-amber-50/20 border border-amber-100 rounded-3xl">
                                <label className="text-[10px] font-black text-amber-700 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">image</span>
                                    Custom Cover (Poster)
                                </label>
                                
                                <div className="flex gap-5 items-start">
                                    <div className="size-24 rounded-2xl bg-white border border-amber-100 overflow-hidden shrink-0 flex items-center justify-center relative group/poster shadow-xl">
                                        {(tempPosterFile || posterUrl) ? (
                                            <img 
                                                src={previewPosterUrl} 
                                                className="w-full h-full object-cover" 
                                                alt="poster preview" 
                                            />
                                        ) : (
                                            <span className="material-symbols-outlined text-amber-200 text-4xl">image</span>
                                        )}
                                        <button 
                                            type="button"
                                            onClick={() => posterFileInputRef.current?.click()}
                                            className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover/poster:opacity-100 transition-all flex items-center justify-center backdrop-blur-[2px]"
                                        >
                                            <span className="material-symbols-outlined text-[24px]">upload</span>
                                        </button>
                                        <input 
                                            type="file" 
                                            ref={posterFileInputRef} 
                                            className="hidden" 
                                            accept="image/*" 
                                            onChange={handlePosterFileChange}
                                        />
                                    </div>

                                    <div className="flex-1 flex flex-col gap-3">
                                        <input 
                                            type="url"
                                            value={posterUrl}
                                            onChange={(e) => {
                                                setPosterUrl(e.target.value);
                                                if (tempPosterFile) setTempPosterFile(null);
                                            }}
                                            placeholder="Poster Image URL..."
                                            className="w-full px-4 py-3 bg-white border border-amber-100 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all focus:outline-hidden text-sm font-medium"
                                            disabled={isUploading}
                                        />
                                        <div className="flex items-center gap-3">
                                            <button 
                                                type="button"
                                                onClick={() => posterFileInputRef.current?.click()}
                                                className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em] hover:text-amber-700 transition-colors flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
                                                {tempPosterFile ? 'Change File' : 'Upload File'}
                                            </button>
                                            {tempPosterFile && (
                                                <span className="text-[10px] text-amber-500 font-bold truncate max-w-[120px]">{tempPosterFile.name}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Asset Display Name</label>
                                <input 
                                    type="text"
                                    value={videoName}
                                    onChange={(e) => setVideoName(e.target.value)}
                                    placeholder="e.g. Hero Background Video"
                                    className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all focus:outline-hidden text-sm font-medium"
                                    disabled={isUploading}
                                />
                            </div>
                        </div>

                        {/* Column 3: Custom Controls */}
                        <div className="flex flex-col gap-6">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Interactivity & Controls</label>
                            
                            <div className="bg-gray-50/30 rounded-3xl p-6 border border-gray-100 shadow-sm">
                                <VideoControlSettings 
                                    values={controlValues}
                                    onChange={handleControlChange}
                                    onImageUpload={handleIconUpload}
                                    isUploading={isUploading}
                                />
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default VideoUploadModal;
