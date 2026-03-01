import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { UPLOAD_URL } from '../App';
import { cleanFileName } from '../utils/fileUtils';

interface AiImageGenModalProps {
    onClose: () => void;
    assets: string[];
    onUpload: (file: File) => Promise<void>; 
    onSaveToAsset: (file: File) => void;
}

interface HistoryItem {
    id: string;
    prompt: string;
    inputImages: string[];
    resultBlobUrl: string;
    file: File;
}

const AiImageGenModal: React.FC<AiImageGenModalProps> = ({ onClose, assets, onUpload, onSaveToAsset }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [selectedImageUrls, setSelectedImageUrls] = useState<string[]>([]);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    
    // Pickers
    const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [history, isGenerating]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await onUpload(file);
            // Ideally onUpload would return the URL, or we can just assume it gets added to assets
            // But for simplicity, if we upload, we don't have the URL instantly unless onUpload yields it.
            // Let's modify onUpload in MediaAssetContainer to return the URL? 
            // Better yet, just wait for it.
        }
    };

    const generateAiImage = async () => {
        if (!prompt.trim() && selectedImageUrls.length === 0) return;
        setIsGenerating(true);
        try {
            const apiKey = import.meta.env.VITE_GOOGLE_AI_KEY;
            const genAI = new GoogleGenerativeAI(apiKey);
            
            const model = genAI.getGenerativeModel(
                { model: "gemini-3-pro-image-preview" },
                { timeout: 300000 }
            );

            const parts: any[] = [];
            
            if (selectedImageUrls.length > 0) {
                const imagePromises = selectedImageUrls.map(async (url) => {
                    let blob: Blob;
                    try {
                        const directResponse = await fetch(url, { mode: 'cors' }).catch(() => null);
                        if (directResponse && directResponse.ok) {
                            blob = await directResponse.blob();
                        } else {
                            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
                            const proxyResponse = await fetch(proxyUrl);
                            if (!proxyResponse.ok) throw new Error("Proxy failed");
                            blob = await proxyResponse.blob();
                        }

                        return await new Promise<any>((resolve, reject) => {
                            const img = new Image();
                            img.crossOrigin = "anonymous";
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                let width = img.width;
                                let height = img.height;
                                const MAX_SIZE = 768;
                                if (width > height) {
                                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                                } else {
                                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                                }
                                canvas.width = width; canvas.height = height;
                                const ctx = canvas.getContext('2d');
                                ctx?.drawImage(img, 0, 0, width, height);
                                resolve({
                                    inlineData: {
                                        data: canvas.toDataURL('image/jpeg', 0.6).split(',')[1],
                                        mimeType: "image/jpeg"
                                    }
                                });
                            };
                            img.onerror = () => reject(new Error(`Failed to load image`));
                            img.src = URL.createObjectURL(blob);
                        });
                    } catch (err) {
                        return null;
                    }
                });

                const results = await Promise.all(imagePromises);
                results.filter(r => r !== null).forEach(r => parts.push(r));
            }

            const userPrompt = prompt.trim() || "Create a professional design element based on these references.";
            parts.push({ text: userPrompt });

            const result = await model.generateContent(parts);
            const response = await result.response;
            const candidate = response.candidates?.[0];
            const imagePart = candidate?.content?.parts?.find((p: any) => p.inlineData);
            
            if (!imagePart || !imagePart.inlineData) {
                throw new Error("AI produced no image data.");
            }

            const { data, mimeType } = imagePart.inlineData;
            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
            const file = new File([blob], `ai_mix_${Date.now()}.jpg`, { type: mimeType });
            const blobUrl = URL.createObjectURL(blob);
            
            setHistory(prev => [...prev, {
                id: Date.now().toString(),
                prompt: userPrompt,
                inputImages: [...selectedImageUrls],
                resultBlobUrl: blobUrl,
                file: file
            }]);
            
            setSelectedImageUrls([]);
            // Do not clear prompt so user can iterate

        } catch (error: any) {
            console.error(error);
            alert(`AI Error: ${error.message || 'Error occurred.'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white w-[900px] h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
                {/* Loader Overlay */}
                {isGenerating && (
                    <div className="absolute inset-0 z-[10000] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[48px] text-primary animate-spin mb-4">progress_activity</span>
                        <h3 className="text-xl font-bold text-gray-800">Generating AI Image</h3>
                        <p className="text-gray-500 mt-2">Please wait while the AI works its magic...</p>
                    </div>
                )}

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary">auto_awesome</span>
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">AI Image Studio</h2>
                            <p className="text-xs text-gray-500">Iterate and create images with AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Main Content Area - History */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {history.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <span className="material-symbols-outlined text-[64px] mb-4 opacity-20">image</span>
                            <p className="text-base font-medium">No history yet.</p>
                            <p className="text-sm">Start generating images below!</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {history.map((item, idx) => (
                                <div key={item.id} className="flex gap-6 max-w-[800px] mx-auto w-full group">
                                    {/* Inputs step */}
                                    <div className="flex-1 flex flex-col items-end gap-2 text-right">
                                        <div className="bg-white p-4 rounded-2xl rounded-tr-none shadow-sm border border-gray-100 min-w[250px]">
                                            <p className="text-sm text-gray-700 italic">"{item.prompt}"</p>
                                            {item.inputImages.length > 0 && (
                                                <div className="flex justify-end gap-2 mt-3">
                                                    {item.inputImages.map((url, i) => (
                                                        <img key={i} src={url} className="w-12 h-12 object-cover rounded-lg border border-gray-200" alt="input" />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Connector */}
                                    <div className="w-8 flex flex-col items-center">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mt-2 group-hover:bg-primary group-hover:text-white transition-colors text-primary shadow-sm">
                                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                        </div>
                                        <div className="flex-1 w-px bg-gradient-to-b from-primary/20 to-transparent mt-2"></div>
                                    </div>

                                    {/* Result */}
                                    <div className="flex-1">
                                        <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-100 inline-block">
                                            <img src={item.resultBlobUrl} className="max-w-[300px] max-h-[300px] rounded-xl object-contain" alt="Result" />
                                            <div className="flex items-center gap-2 mt-3 p-1">
                                                <button 
                                                    onClick={() => onSaveToAsset(item.file)}
                                                    className="flex-1 bg-primary text-white text-xs font-bold py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">save</span>
                                                    Save to Asset
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (!selectedImageUrls.includes(item.resultBlobUrl)) {
                                                            setSelectedImageUrls(prev => [...prev, item.resultBlobUrl]);
                                                        }
                                                    }}
                                                    className="px-3 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
                                                    title="Use this generated image as a reference for your next prompt"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">add_to_photos</span>
                                                    Add to Prompt
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Asset Picker Overlay (Inline Dialog) */}
                {isAssetPickerOpen && (
                    <div className="absolute inset-x-0 bottom-[140px] px-6 z-20">
                        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 max-h-[300px] flex flex-col animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-gray-800 text-sm">Select Reference Image</h4>
                                <button onClick={() => setIsAssetPickerOpen(false)} className="text-gray-400 hover:text-gray-800">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0">
                                {assets.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">No assets available.</p>
                                ) : (
                                    <div className="grid grid-cols-6 gap-2">
                                        {assets.map((assetUrl, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => {
                                                    if (!selectedImageUrls.includes(assetUrl)) {
                                                        setSelectedImageUrls(prev => [...prev, assetUrl]);
                                                    }
                                                    setIsAssetPickerOpen(false);
                                                }}
                                                className="aspect-square rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:border-primary group relative"
                                            >
                                                <img src={assetUrl} className="w-full h-full object-cover" alt="asset" />
                                                <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom CMS Input Area */}
                <div className="bg-white border-t border-gray-200 p-6 z-30">
                    <div className="flex flex-col gap-3">
                        {/* Selected Images Chips */}
                        {selectedImageUrls.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {selectedImageUrls.map((url, i) => (
                                    <div key={i} className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-primary">
                                        <img src={url} className="w-full h-full object-cover" alt="Selected" />
                                        <button 
                                            onClick={() => setSelectedImageUrls(prev => prev.filter(u => u !== url))}
                                            className="absolute top-1 right-1 w-5 h-5 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white backdrop-blur-sm"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex items-end gap-3">
                            <div className="flex-1 relative">
                                <textarea 
                                    className="w-full text-sm p-4 pr-[120px] rounded-xl border border-gray-300 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all shadow-sm bg-gray-50 hover:bg-white"
                                    placeholder="Describe the image you want to generate..."
                                    rows={3}
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            generateAiImage();
                                        }
                                    }}
                                />
                                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                                    <button 
                                        onClick={() => setIsAssetPickerOpen(!isAssetPickerOpen)}
                                        className="h-8 px-3 rounded-lg text-xs font-bold bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center gap-1 shadow-sm"
                                        title="Select from Media Assets"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">photo_library</span>
                                        Assets
                                    </button>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handleFileUpload} 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-8 w-8 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center justify-center shadow-sm"
                                        title="Upload New Image"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">upload_file</span>
                                    </button>
                                </div>
                            </div>
                            
                            <button 
                                onClick={generateAiImage}
                                disabled={(!prompt.trim() && selectedImageUrls.length === 0)}
                                className={`h-14 px-6 bg-primary text-white font-bold rounded-xl flex items-center gap-2 shadow-md transition-transform active:scale-95 ${(!prompt.trim() && selectedImageUrls.length === 0) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-primary/90 hover:-translate-y-1'}`}
                            >
                                <span className="material-symbols-outlined">auto_awesome</span>
                                Generate
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiImageGenModal;
