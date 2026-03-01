import React from 'react';
import { cleanFileName } from '../utils/fileUtils';
import { GoogleGenerativeAI } from "@google/generative-ai";
import ImageEditorModal from './ImageEditorModal';
import { UPLOAD_URL } from '../App';

interface MediaAssetContainerProps {
    onClose?: () => void;
    assets?: string[];
    onUpload?: (url: string) => void;
    onDoubleClickAsset?: (url: string, type: string) => void;
}


import MediaAssetItem from './MediaAssetItem';
import AiImageGenModal from './AiImageGenModal';

const MediaAssetContainer: React.FC<MediaAssetContainerProps> = ({ onClose, assets = [], onUpload, onDoubleClickAsset }) => {
    const [isDraggingOver, setIsDraggingOver] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [isAiModalOpen, setIsAiModalOpen] = React.useState(false);
    const [editingImage, setEditingImage] = React.useState<string | null>(null);
    const [copiedUrl, setCopiedUrl] = React.useState<string | null>(null);
    
    // We can also let uploadFile return the string url.
    // Let's modify uploadFile.

    const uploadFile = async (file: File) => {
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

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(`Upload failed: ${response.status} ${response.statusText}. ${errData.error || ''}`);
            }
            
            const data = await response.json();
            if (data.url && onUpload) {
                onUpload(data.url);
            }
            return data.url;
        } catch (error) {
            console.error("Upload error:", error);
            throw error;
        } finally {
            setIsUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            uploadFile(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            Array.from(e.dataTransfer.files).forEach(file => {
                if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
                    uploadFile(file);
                }
            });
        }
    };

    return (
        <div 
            className={`w-80 h-full bg-white border-r border-[#e5e8eb] shadow-sm flex flex-col overflow-hidden relative transition-colors ${isDraggingOver ? 'bg-entry/5 border-entry' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="p-5 border-b border-gray-100 flex flex-col gap-4 shrink-0">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-gray-800">Media Assets</h2>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsAiModalOpen(true)}
                            className={`h-9 px-3 ${isAiModalOpen ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} text-[12px] font-bold rounded-lg flex items-center gap-2 transition-all`}
                            title="Generate Image with AI"
                        >
                            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleFileChange} 
                        />
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className={`h-9 px-4 bg-entry hover:bg-[#059669] text-white text-[12px] font-bold rounded-lg flex items-center gap-2 transition-all shadow-sm ${isUploading ? 'opacity-70 cursor-wait' : ''}`}
                        >
                            {isUploading ? (
                                <span className="animate-spin material-symbols-outlined text-[18px]">progress_activity</span>
                            ) : (
                                <span className="material-symbols-outlined text-[18px]">upload</span>
                            )}
                            {isUploading ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>
                </div>

            </div>

            <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                <div className="grid grid-cols-3 gap-3">
                    {assets.map((url, idx) => (
                        <MediaAssetItem
                            key={url}
                            url={url}
                            isAiMode={false}
                            isSelected={false}
                            onSelect={() => {}}
                            onDoubleClick={() => onDoubleClickAsset?.(url, 'media')}
                            onEdit={() => setEditingImage(url)}
                            onCopy={() => {
                                navigator.clipboard.writeText(url);
                                setCopiedUrl(url);
                                setTimeout(() => setCopiedUrl(null), 2000);
                            }}
                            copiedUrl={copiedUrl}
                        />
                    ))}
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:text-entry hover:border-entry hover:bg-entry/5 transition-all cursor-pointer group"
                    >
                        <span className="material-symbols-outlined text-[28px] group-hover:scale-110 transition-transform">add_photo_alternate</span>
                        <span className="text-[10px] font-bold mt-2 uppercase tracking-wider">Add New</span>
                    </div>
                </div>
            </div>

            {editingImage && (
                <ImageEditorModal 
                    imageUrl={editingImage}
                    onClose={() => setEditingImage(null)}
                    onSave={(file) => {
                        uploadFile(file);
                        setEditingImage(null);
                    }}
                />
            )}

            {isAiModalOpen && (
                <AiImageGenModal 
                    assets={assets}
                    onClose={() => setIsAiModalOpen(false)}
                    onUpload={uploadFile}
                    onSaveToAsset={uploadFile}
                />
            )}
        </div>
    );
};

export default MediaAssetContainer;
