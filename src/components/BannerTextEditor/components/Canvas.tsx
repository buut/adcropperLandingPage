import React, { useRef } from 'react';
import { useEditorStore } from '../store';
import TextNode from './TextNode';
import Moveable from 'react-moveable';

const Canvas: React.FC = () => {
  const { texts, selectedId, selectText, zoom, previewMode, updateText } = useEditorStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter visible texts if needed
  const visibleTexts = texts.filter(t => t.visible);

  return (
    <div 
      className="relative flex items-center justify-center transition-transform duration-200"
      style={{ transform: `scale(${zoom / 100})` }}
    >
      {/* 300x250 Banner Container */}
      <div 
        ref={containerRef}
        className="w-[300px] h-[250px] bg-white relative overflow-hidden shadow-lg border border-gray-300"
        style={{
          boxShadow: previewMode ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : 'none'
        }}
        onClick={(e) => {
          // Deselect if clicking directly on the canvas background
          if (e.target === containerRef.current) {
            selectText(null);
          }
        }}
      >
        {/* Render Text Elements */}
        {visibleTexts.map((textElem) => (
          <TextNode 
            key={textElem.id} 
            textElem={textElem} 
            containerRef={containerRef}
          />
        ))}

        {/* Global Moveable Control for the Selected Element */}
        {/* In a real implementation using react-moveable, the target is usually passed as a DOM reference. Since we are using Zustand, our TextNode component will actually render it's own Moveable instance or we manage a global one. Managing it inside TextNode is easier for React state sync. */}
      </div>
    </div>
  );
};

export default Canvas;
