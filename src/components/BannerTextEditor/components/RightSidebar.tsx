import React from 'react';
import { useEditorStore } from '../store';
import RightInspector from './RightInspector';

const RightSidebar: React.FC = () => {
  const { selectedId, texts } = useEditorStore();
  const selectedText = texts.find((t) => t.id === selectedId);

  return (
    <aside className="ignore-click-outside w-72 bg-white border-l border-gray-200 flex flex-col shrink-0 overflow-y-auto shadow-sm z-10">
      <div className="p-4 border-b border-gray-100">
        <h2 className="text-sm font-bold text-gray-800 tracking-wide uppercase">Properties</h2>
      </div>
      
      {selectedText ? (
        <RightInspector textElem={selectedText} />
      ) : (
        <div className="flex-1 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-gray-400">Select a text element on the canvas to edit its properties.</p>
        </div>
      )}
    </aside>
  );
};

export default RightSidebar;
