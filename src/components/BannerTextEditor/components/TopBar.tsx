import React from 'react';
import { useEditorStore } from '../store';
import { Undo2, Redo2, Eye, EyeOff, Download, Plus } from 'lucide-react';
import { exportBanner } from '../utils/exportBanner';

const TopBar: React.FC = () => {
  const { undo, redo, history, historyIndex, addText, previewMode, setPreviewMode, texts, zoom, setZoom } = useEditorStore();

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleExport = () => {
    exportBanner(texts);
  };

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10">
      <div className="flex items-center space-x-6">
        <h1 className="text-lg font-bold text-gray-800 tracking-tight">Bannerflow Editor</h1>
        
        <div className="flex items-center space-x-2 border-l border-gray-200 pl-6">
          <button 
            onClick={undo} 
            disabled={!canUndo}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button 
            onClick={redo} 
            disabled={!canRedo}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {!previewMode && (
          <button
            onClick={() => addText()}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            <span>Add Text</span>
          </button>
        )}

        <div className="h-6 w-px bg-gray-200 mx-2"></div>

        <div className="flex items-center space-x-2 bg-gray-100 px-2 py-1 rounded-md">
          <span className="text-xs font-semibold text-gray-500 w-12 text-center">{Math.round(zoom)}%</span>
          <input 
            type="range" 
            min="50" 
            max="200" 
            value={zoom} 
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-24 accent-blue-600 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${previewMode ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          {previewMode ? <EyeOff size={16} /> : <Eye size={16} />}
          <span>{previewMode ? 'Exit Preview' : 'Preview'}</span>
        </button>

        <button
          onClick={handleExport}
          className="flex items-center space-x-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          <Download size={16} />
          <span>Export</span>
        </button>
      </div>
    </div>
  );
};

export default TopBar;
