import React, { useState } from 'react';
import Skeleton from './Skeleton';

interface MediaAssetItemProps {
  url: string;
  isAiMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onDoubleClick: () => void;
  onEdit: () => void;
  onCopy: () => void;
  copiedUrl: string | null;
}

const MediaAssetItem: React.FC<MediaAssetItemProps> = ({
  url,
  isAiMode,
  isSelected,
  onSelect,
  onDoubleClick,
  onEdit,
  onCopy,
  copiedUrl,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div
      className={`aspect-square bg-white border rounded-xl overflow-hidden group cursor-pointer hover:shadow-lg transition-all relative checkerboard flex flex-col ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-100'
      }`}
      draggable={!isAiMode}
      onDragStart={(e) => {
        if (isAiMode) return;
        e.dataTransfer.setData('text/plain', url);
        e.dataTransfer.setData('assetType', 'media');
        e.dataTransfer.effectAllowed = 'copy';
      }}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isAiMode) {
          onDoubleClick();
        }
      }}
    >
      <div className="flex-1 relative">
        {/* Actual Image (hidden until loaded or if error) */}
        {!hasError && (
          <img
            src={url}
            alt="Media Asset"
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-contain transition-opacity duration-300 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
          />
        )}

        {/* Skeleton Loader */}
        {isLoading && (
          <div className="absolute inset-0 z-10">
            <Skeleton borderRadius="0.75rem" />
          </div>
        )}

        {/* Error State */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400 gap-1 p-2">
            <span className="material-symbols-outlined text-[24px]">broken_image</span>
            <span className="text-[9px] font-bold uppercase tracking-tight text-center">Failed to load</span>
          </div>
        )}

        {/* Overlays and Controls */}
        {!isLoading && (
          <>
            <div
              className={`absolute inset-0 transition-colors pointer-events-none ${
                isSelected ? 'bg-primary/10' : 'bg-black/0 group-hover:bg-black/10'
              }`}
            ></div>

            {isAiMode && (
              <div
                className={`absolute top-2 right-2 p-1 rounded-full transition-all ${
                  isSelected
                    ? 'bg-primary text-white scale-110 shadow-md'
                    : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isSelected ? 'check_circle' : 'add_circle'}
                </span>
              </div>
            )}

            {!isAiMode && !hasError && (
              <div className="absolute top-2 right-2 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-all z-10">
                {/* Edit Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="size-7 rounded-lg bg-white/90 hover:bg-white text-gray-700 shadow-sm flex items-center justify-center transition-all"
                  title="Edit Image"
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                </button>

                {/* Copy URL Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy();
                  }}
                  className={`size-7 rounded-lg shadow-sm flex items-center justify-center transition-all ${
                    copiedUrl === url ? 'bg-entry text-white' : 'bg-white/90 hover:bg-white text-gray-700'
                  }`}
                  title={copiedUrl === url ? 'Copied!' : 'Copy URL'}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {copiedUrl === url ? 'check_circle' : 'content_copy'}
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MediaAssetItem;
