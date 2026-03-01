import React, { useState, useRef, useEffect } from 'react';
import VideoUploadModal from './VideoUploadModal';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cleanFileName } from '../utils/fileUtils';
import { UPLOAD_URL } from '../App';

// create-video server
const VIDEO_GEN_URL = 'https://test-tool-avg.adcropper.com';

interface VideoAssetContainerProps {
    onClose?: () => void;
    assets: any[];
    mediaAssets?: string[];
    onAdd: (newVideo: any) => void;
    onUpdate?: (index: number, updatedVideo: any) => void;
    onDoubleClickAsset?: (url: string, type: string, meta?: any) => void;
    showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
}

const VideoAssetContainer: React.FC<VideoAssetContainerProps> = ({ 
    onClose, 
    assets,
    mediaAssets = [], 
    onAdd, 
    onUpdate,
    onDoubleClickAsset, 
    showNotification 
}) => {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<{ asset: any, index: number } | null>(null);
    const [isAiMode, setIsAiMode] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
    const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [selectedModel, setSelectedModel] = useState<'runway' | 'veo3'>('runway');
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // Video Configuration States
    const [aspectRatio, setAspectRatio] = useState('1280:720');
    const [isRatioDropdownOpen, setIsRatioDropdownOpen] = useState(false);
    const ratioDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ratioDropdownRef.current && !ratioDropdownRef.current.contains(event.target as Node)) {
                setIsRatioDropdownOpen(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
                setIsModelDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddVideo = (newVideo: any) => {
        onAdd(newVideo);
    };

    const handleUpdateVideo = (updatedVideo: any) => {
        if (editingAsset !== null && onUpdate) {
            onUpdate(editingAsset.index, updatedVideo);
        }
    };

    const generateVideo = async () => {
        if (!prompt.trim() && !referenceImageUrl) return;
        setIsGenerating(true);
        try {
            const endpoint = selectedModel === 'veo3' ? `${VIDEO_GEN_URL}/create-video-veo` : `${VIDEO_GEN_URL}/create-video`;
            console.log(`Local Video Step: Requesting generation from ${endpoint} with prompt: ${prompt} using model: ${selectedModel}`);
            
            const payload: any = {
                duration: selectedModel === 'veo3' ? 8 : 5,
                promptImage: referenceImageUrl || '',
                promptText: prompt.trim(),
            };

            if (selectedModel !== 'veo3') {
                payload.model = 'gen4.5';
            }

            if (selectedModel === 'veo3') {
                payload.aspectRatio = aspectRatio === '1280:720' ? '16:9' : '9:16';
                payload.resolution = '720p';
            } else {
                payload.ratio = aspectRatio;
            }

            // Calling via the proxy defined in vite.config.js
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Local Video Server Error: ${response.status}`);
            }

            const data = await response.json();
            
            console.log("Local Server Response:", data);

            // Safely extract the video URL and poster from the response
            const videoUrl = data.output?.[0] || data.url;
            const finalPoster = data.poster || data.posterUrl || 'https://via.placeholder.com/640x360.png?text=AI+Video+Poster';
            
            if (!videoUrl || data.status === 'FAILED') {
                console.error("Local Server Response Error:", data);
                throw new Error("Video generation failed or returned invalid format.");
            }

            // Create the video asset element directly with the returned links.
            const videoAssetData = {
                url: videoUrl,
                poster: finalPoster,
                name: `AI Video: ${prompt.substring(0, 20)}...`,
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
                controlColorVolumeThumb: '#3B82F6'
            };

            onAdd(videoAssetData);
            setPrompt('');
            setIsAiMode(false);
            showNotification?.("Video generated and added successfully!", "success");

        } catch (error: any) {
            console.error("Local Video Error:", error);
            alert(`Local Video Error: ${error.message || 'Error occurred.'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const generateAiVideo = async () => {
        if (!prompt.trim() && !referenceImageUrl) return;
        setIsGenerating(true);
        try {
            const runwayKey = import.meta.env.VITE_RUNWAY_API_KEY;
            const googleKey = import.meta.env.VITE_GOOGLE_AI_KEY;
            
            if (!runwayKey) throw new Error("Runway API Key is missing in .env");

            console.log(`AI Step: Starting Runway generation. Key prefix: ${runwayKey.substring(0, 8)}...`);

            // 1. Generate Video with Runway (Gen-4.5)
            const endpoint = referenceImageUrl ? '/runway/v1/image_to_video' : '/runway/v1/text_to_video';
            console.log(`AI Step: Initiating Runway Gen-4.5 generation via ${endpoint}...`);
            
            const payload: any = {
                model: 'gen4.5',
                ratio: aspectRatio,
                duration: 5
            };

            if (prompt.trim()) {
                payload.promptText = prompt.trim();
            }

            if (referenceImageUrl) {
                payload.promptImage = referenceImageUrl;
            }

            // Using the local proxy /runway defined in vite.config.js
            const runwayResponse = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${runwayKey}`,
                    'X-Runway-Version': '2024-11-06',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!runwayResponse.ok) {
                const errData = await runwayResponse.json().catch(() => ({}));
                console.error("Runway Raw Error Data:", errData);
                
                // Detailed error extraction for Runway
                let errorMessage = errData.error || errData.message || 'Validation Failed';
                if (errData.issues) {
                    errorMessage += ` - Issues: ${JSON.stringify(errData.issues)}`;
                }
                
                throw new Error(`Runway API Error: ${runwayResponse.status} - ${errorMessage}`);
            }

            const { id: generationId } = await runwayResponse.json();
            console.log(`AI Step: Generation started (ID: ${generationId}). Polling for results...`);

            // 2. Poll Runway Task for completion
            let videoUrl = '';
            const pollInterval = 3000;
            const maxPolls = 100; // Increased wait for Gen-4.5
            
            for (let i = 0; i < maxPolls; i++) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));
                const pollResponse = await fetch(`/runway/v1/tasks/${generationId}`, {
                    headers: {
                        'Authorization': `Bearer ${runwayKey}`,
                        'X-Runway-Version': '2024-11-06'
                    }
                });
                
                if (!pollResponse.ok) {
                    console.warn(`Poll failed with status ${pollResponse.status}, retrying...`);
                    continue;
                }
                
                const pollData = await pollResponse.json();
                const status = pollData.status || pollData.task?.status;
                console.log(`AI Step: Status - ${status}...`);
                
                if (status === 'SUCCEEDED') {
                    videoUrl = pollData.output?.[0] || pollData.task?.output?.[0];
                    break;
                } else if (status === 'FAILED') {
                    throw new Error(`Runway failed: ${pollData.error || pollData.task?.error || 'Unknown generation error'}`);
                }
            }

            if (!videoUrl) throw new Error("Video generation timed out or failed to return URL.");

            // 3. Generate Poster with Gemini 3 Pro (to ensure high quality matching poster)
            console.log("AI Step: Generating high-quality poster image with Gemini...");
            const genAI = new GoogleGenerativeAI(googleKey);
            const imageModel = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });
            const imageResult = await imageModel.generateContent(`A stunning, cinematic high-fidelity poster frame for a video with this description: ${prompt}. Professional lighting, 16:9 aspect ratio.`);
            const imageResponse = await imageResult.response;
            const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

            // 4. Prepare Files for Upload
            console.log("AI Step: Processing media bytes...");
            
            // Fetch video from Runway
            const videoBufferResponse = await fetch(videoUrl);
            const videoBlob = await videoBufferResponse.blob();
            const videoFile = new File([videoBlob], `runway_video_${Date.now()}.mp4`, { type: "video/mp4" });

            // Poster File from Gemini
            let posterFile: File | undefined;
            if (imagePart && imagePart.inlineData) {
                const iData = imagePart.inlineData.data;
                const iBytes = new Uint8Array(atob(iData).split("").map(c => c.charCodeAt(0)));
                const posterBlob = new Blob([iBytes], { type: imagePart.inlineData.mimeType });
                posterFile = new File([posterBlob], `ai_poster_${Date.now()}.jpg`, { type: imagePart.inlineData.mimeType });
            }

            // 5. Upload to Server
            console.log("AI Step: Syncing with CDN...");
            const formData = new FormData();
            formData.append('video', videoFile);
            if (posterFile) formData.append('poster', posterFile);
            formData.append('companyId', '66db07778b5e35892545578c');
            formData.append('brandId', '671a1666d786fa251fca95d0');
            formData.append('templateId', '670fa914c2f0842143d5932');

            const uploadResponse = await fetch(`${UPLOAD_URL}/upload-video-asset`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) throw new Error("Upload to server failed");
            
            const data = await uploadResponse.json();
            
            // 6. Add to Gallery
            const videoAssetData = {
                url: data.videoUrl,
                poster: data.posterUrl || 'https://via.placeholder.com/640x360.png?text=Runway+Poster',
                name: `Runway: ${prompt.substring(0, 20)}...`,
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
                controlColorVolumeThumb: '#3B82F6'
            };

            onAdd(videoAssetData);
            setPrompt('');
            setIsAiMode(false);
            showNotification?.("Runway Video generated and uploaded successfully!", "success");

        } catch (error: any) {
            console.error("Runway Video Error:", error);
            alert(`Video Error: ${error.message || 'Error occurred.'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            <div className="w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative">
                <div className="p-5 border-b border-gray-100 flex flex-col gap-4 shrink-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-gray-800">Video Assets</h2>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsAiMode(!isAiMode)}
                                className={`size-9 rounded-lg flex items-center justify-center transition-all ${isAiMode ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                title="Generate Video with Gemini Veo"
                            >
                                <span className="material-symbols-outlined text-[18px]">auto_videocam</span>
                            </button>
                            <button 
                                onClick={() => setIsUploadModalOpen(true)}
                                className="h-9 px-4 bg-entry hover:bg-[#059669] text-white text-[12px] font-bold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[18px]">upload</span>
                                Upload
                            </button>
                        </div>
                    </div>

                    {isAiMode && (
                        <div className="flex flex-col gap-3 bg-gradient-to-br from-[#f8f9fa] to-white p-4 rounded-xl border border-gray-200 shadow-inner animate-in fade-in slide-in-from-top-2">
                             <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                AI Video Generator
                            </label>

                            {/* Model Selector Combobox */}
                            <div className="relative w-full" ref={modelDropdownRef}>
                                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                    AI Model
                                </label>
                                <button
                                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                                    className="w-full h-9 pl-9 pr-3 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white"
                                >
                                    <span className="truncate">{selectedModel === 'runway' ? 'Runway Gen-3' : 'Google Veo 3'}</span>
                                    <span className={`material-symbols-outlined text-[18px] text-gray-400 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 mt-[8px] text-gray-400 text-[18px]">
                                        {selectedModel === 'runway' ? 'movie_edit' : 'auto_videocam'}
                                    </span>
                                </button>

                                {isModelDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[500] flex flex-col p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {[
                                            { value: 'runway', label: 'Runway Gen-3', icon: 'movie_edit' },
                                            { value: 'veo3', label: 'Google Veo 3', icon: 'auto_videocam' }
                                        ].map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => { setSelectedModel(option.value as any); setIsModelDropdownOpen(false); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center gap-2 ${selectedModel === option.value ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px] opacity-70 group-hover:opacity-100">{option.icon}</span>
                                                <span className="flex-1">{option.label}</span>
                                                {selectedModel === option.value && <span className="material-symbols-outlined text-[14px]">check</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <textarea 
                                className="w-full text-xs p-3 rounded-xl border border-gray-200 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all shadow-sm bg-white font-medium"
                                placeholder="Describe the scene you want to generate (max 10s)..."
                                rows={3}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />

                            {/* Aspect Ratio Selector Combobox */}
                            <div className="relative w-full" ref={ratioDropdownRef}>
                                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">
                                    Format
                                </label>
                                <button
                                    onClick={() => setIsRatioDropdownOpen(!isRatioDropdownOpen)}
                                    className="w-full h-9 pl-9 pr-3 bg-gray-50/50 border border-gray-200 rounded-lg text-xs font-bold text-gray-900 focus:border-primary outline-none flex items-center justify-between cursor-pointer transition-all hover:bg-white"
                                >
                                    <span className="truncate">{aspectRatio === '1280:720' ? 'Landscape (16:9)' : 'Portrait (9:16)'}</span>
                                    <span className={`material-symbols-outlined text-[18px] text-gray-400 transition-transform duration-200 ${isRatioDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 mt-[8px] text-gray-400 text-[18px]">
                                        {aspectRatio === '1280:720' ? 'crop_16_9' : 'crop_9_16'}
                                    </span>
                                </button>

                                {isRatioDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[500] flex flex-col p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        {[
                                            { value: '1280:720', label: 'Landscape (16:9)', icon: 'crop_16_9' },
                                            { value: '720:1280', label: 'Portrait (9:16)', icon: 'crop_9_16' }
                                        ].map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => { setAspectRatio(option.value); setIsRatioDropdownOpen(false); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-primary hover:text-white transition-all group flex items-center gap-2 ${aspectRatio === option.value ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 font-medium'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px] opacity-70 group-hover:opacity-100">{option.icon}</span>
                                                <span className="flex-1">{option.label}</span>
                                                {aspectRatio === option.value && <span className="material-symbols-outlined text-[14px]">check</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {mediaAssets && mediaAssets.length > 0 && (
                                <div className="flex flex-col gap-1.5 mt-1">
                                    <label className="text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                                        <span>Reference Image (Optional)</span>
                                        {referenceImageUrl && (
                                            <button 
                                                onClick={() => setReferenceImageUrl(null)}
                                                className="text-red-500 hover:text-red-600 transition-colors"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </label>
                                    <div className="flex flex-wrap gap-2 py-1">
                                        {mediaAssets.map((url, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setReferenceImageUrl(url)}
                                                className={`relative size-12 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${referenceImageUrl === url ? 'border-primary shadow-md' : 'border-transparent hover:border-gray-300'}`}
                                            >
                                                <img src={url} alt={`Media ${idx}`} className="w-full h-full object-cover" />
                                                {referenceImageUrl === url && (
                                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-white text-[16px]">check_circle</span>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <button 
                                onClick={generateVideo}
                                disabled={!prompt.trim() || isGenerating}
                                className={`h-9 bg-primary hover:bg-black text-white text-[11px] font-black uppercase tracking-widest rounded-lg flex justify-center items-center gap-2 transition-all shadow-lg shadow-primary/20 ${(!prompt.trim() || isGenerating) ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="size-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        CREATING VIDEO...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">movie_edit</span>
                                        CREATE
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                    <div className="grid grid-cols-2 gap-4">
                        {assets.map((asset, idx) => (
                            <div 
                                key={idx} 
                                className="aspect-video bg-white border border-gray-100 rounded-xl overflow-hidden group cursor-pointer hover:border-entry hover:shadow-lg transition-all relative flex flex-col"
                                draggable
                                onDragStart={(e) => {
                                    const assetUrl = asset.url;
                                    const posterUrl = asset.poster;
                                    const label = asset.name;

                                    e.dataTransfer.setData('text/plain', assetUrl);
                                    e.dataTransfer.setData('assetType', 'video');
                                    
                                    // Include all meta data from the asset
                                    const { url, poster, name, ...meta } = asset;
                                    e.dataTransfer.setData('asset-meta', JSON.stringify({
                                        posterUrl: poster,
                                        label: name,
                                        ...meta
                                    }));
                                    
                                    const imgElement = e.currentTarget.querySelector('img');
                                    if (imgElement && imgElement.complete) {
                                        const canvas = document.createElement('canvas');
                                        const width = imgElement.offsetWidth;
                                        const height = imgElement.offsetHeight;
                                        canvas.width = width;
                                        canvas.height = height;
                                        
                                        const ctx = canvas.getContext('2d');
                                        if (ctx) {
                                            ctx.drawImage(imgElement, 0, 0, width, height);
                                            canvas.style.position = 'absolute';
                                            canvas.style.left = '-9999px';
                                            document.body.appendChild(canvas);
                                            e.dataTransfer.setDragImage(canvas, width / 2, height / 2);
                                            setTimeout(() => {
                                                document.body.removeChild(canvas);
                                            }, 0);
                                        }
                                    }
                                    
                                    e.dataTransfer.effectAllowed = 'copy';
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    const { url, poster, name, ...meta } = asset;
                                    onDoubleClickAsset?.(asset.url, 'video', { posterUrl: asset.poster, label: asset.name, ...meta });
                                }}
                            >
                                <div className="flex-1 relative pointer-events-none">
                                    <img 
                                        src={asset.poster} 
                                        alt={asset.name} 
                                        className="w-full h-full object-cover" 
                                        draggable="false"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    
                                    {/* Action Buttons Overlay */}
                                    <div className="absolute top-2 right-2 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all z-10 pointer-events-auto">
                                        {/* Edit Button */}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingAsset({ asset, index: idx });
                                                setIsEditModalOpen(true);
                                            }}
                                            className="size-7 rounded-lg bg-white/90 hover:bg-white text-gray-700 shadow-sm flex items-center justify-center"
                                            title="Edit Asset Settings"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">edit</span>
                                        </button>

                                        {/* Copy URL Button */}
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigator.clipboard.writeText(asset.url);
                                                setCopiedUrl(asset.url);
                                                setTimeout(() => setCopiedUrl(null), 2000);
                                            }}
                                            className={`size-7 rounded-lg shadow-sm flex items-center justify-center transition-all ${copiedUrl === asset.url ? 'bg-entry text-white' : 'bg-white/90 hover:bg-white text-gray-700'}`}
                                            title={copiedUrl === asset.url ? "Copied!" : "Copy URL"}
                                        >
                                            <span className="material-symbols-outlined text-[14px]">
                                                {copiedUrl === asset.url ? 'check_circle' : 'content_copy'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                <div className="px-3 py-2 text-[9px] font-black text-gray-500 bg-gray-50 border-t border-gray-100 truncate pointer-events-none uppercase tracking-wider">
                                    {asset.name}
                                </div>
                            </div>
                        ))}
                        <div 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="aspect-video bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-entry hover:border-entry hover:bg-entry/5 transition-all cursor-pointer group"
                        >
                            <span className="material-symbols-outlined text-[24px] group-hover:scale-110 transition-transform">add_to_drive</span>
                            <span className="text-[9px] font-black mt-2 uppercase tracking-widest">Add Video</span>
                        </div>
                    </div>
                </div>
            </div>

            <VideoUploadModal 
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onAdd={handleAddVideo}
                showNotification={showNotification}
            />

            <VideoUploadModal 
                isOpen={isEditModalOpen}
                onClose={() => {
                    setIsEditModalOpen(false);
                    setEditingAsset(null);
                }}
                onAdd={handleUpdateVideo}
                showNotification={showNotification}
                editData={editingAsset?.asset}
                isEdit={true}
            />
        </>
    );
};

export default VideoAssetContainer;
