import React from 'react';
import { useEditorStore } from '../store';
import { Eye, EyeOff, Lock, Unlock, Type, Trash2, GripVertical } from 'lucide-react';

const LayersPanel: React.FC = () => {
  const { texts, selectedId, selectText, updateText, deleteText, reorderText, pushHistory } = useEditorStore();

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(dragIndex) && dragIndex !== dropIndex) {
      reorderText(dragIndex, dropIndex);
    }
  };

  const toggleVisibility = (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    updateText(id, { visible: !current });
    pushHistory();
  };

  const toggleLock = (id: string, current: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    updateText(id, { locked: !current });
    pushHistory();
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 tracking-wide uppercase">Layers</h2>
        <span className="bg-gray-100 text-xs text-gray-500 px-2 py-0.5 rounded-full">{texts.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {texts.length === 0 ? (
          <div className="text-center p-6 bg-gray-50 rounded-lg mt-4 border border-dashed border-gray-200">
            <p className="text-sm text-gray-400">No objects added to banner.</p>
          </div>
        ) : (
          // Reverse order to render top layer (highest index) visually at top of list
          [...texts].reverse().map((t, reversedIndex) => {
            const index = texts.length - 1 - reversedIndex;
            const isSelected = selectedId === t.id;

            return (
              <div 
                key={t.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => selectText(t.id)}
                className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors border group ${isSelected ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-white border-transparent hover:bg-gray-50 text-gray-700'}`}
              >
                <div className="cursor-grab active:cursor-grabbing text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={14} />
                </div>
                
                <div className={`p-1.5 rounded bg-gray-100 ${isSelected ? 'bg-blue-100 text-blue-600' : 'text-gray-500'}`}>
                  <Type size={14} />
                </div>
                
                <div className="flex-1 truncate text-sm select-none">
                  {t.text || "Empty Text"}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => toggleLock(t.id, t.locked, e)}
                    className={`p-1 rounded-sm hover:bg-gray-200 ${t.locked ? 'text-amber-500 opacity-100' : 'text-gray-400'}`}
                  >
                    {t.locked ? <Lock size={14} /> : <Unlock size={14} />}
                  </button>
                  <button 
                    onClick={(e) => toggleVisibility(t.id, t.visible, e)}
                    className={`p-1 rounded-sm hover:bg-gray-200 ${!t.visible ? 'text-gray-400 opacity-100' : 'text-gray-600'}`}
                  >
                    {t.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteText(t.id); }}
                    className="p-1 rounded-sm hover:bg-red-100 text-red-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default LayersPanel;
