import React, { useRef, useState, useEffect } from 'react';
import { TextElement } from '../types';
import { useEditorStore } from '../store';
import Moveable from 'react-moveable';

interface TextNodeProps {
  textElem: TextElement;
  containerRef: React.RefObject<HTMLDivElement>;
}

const TextNode: React.FC<TextNodeProps> = ({ textElem, containerRef }) => {
  const { selectedId, selectText, updateText, previewMode, pushHistory, setEditingId } = useEditorStore();
  const targetRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const isSelected = selectedId === textElem.id && !previewMode;

  // Handle outside click when editing
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isIgnore = target.closest('.ignore-click-outside');
      
      if (targetRef.current && !targetRef.current.contains(target) && !isIgnore) {
        setIsEditing(false);
        setEditingId(null);
        if (targetRef.current) {
          updateText(textElem.id, { text: targetRef.current.innerHTML });
          pushHistory(); // push state after edit
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, textElem.id, updateText, pushHistory]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (textElem.locked || previewMode) return;
    setIsEditing(true);
    setEditingId(textElem.id);
    selectText(textElem.id);
    
    // Auto focus
    setTimeout(() => {
      if (targetRef.current) {
        targetRef.current.focus();
        // Move cursor to end
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(targetRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  };

  const handlePointerDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewMode) return;
    selectText(textElem.id);
  };

  return (
    <>
      <div
        id={`text-node-${textElem.id}`}
        ref={targetRef}
        onClick={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        contentEditable={isEditing}
        suppressContentEditableWarning
        className={`absolute origin-center break-words whitespace-pre-wrap outline-none ${isSelected && !isEditing ? 'cursor-move' : ''} ${isEditing ? 'cursor-text ring-2 ring-blue-500 rounded-sm bg-white/50' : ''} ${textElem.locked ? 'pointer-events-none' : ''}`}
        style={{
          transform: `translate(${textElem.x}px, ${textElem.y}px) rotate(${textElem.rotation}deg)`,
          width: textElem.width !== 'auto' as any ? `${textElem.width}px` : 'auto',
          height: textElem.height !== 'auto' as any ? `${textElem.height}px` : 'auto',
          fontFamily: textElem.fontFamily,
          fontSize: `${textElem.fontSize}px`,
          fontWeight: textElem.fontWeight,
          fontStyle: textElem.fontStyle,
          textDecoration: textElem.textDecoration,
          textAlign: textElem.textAlign,
          lineHeight: textElem.lineHeight,
          letterSpacing: `${textElem.letterSpacing}px`,
          color: textElem.color && textElem.color.includes('gradient') ? 'transparent' : textElem.color,
          backgroundImage: textElem.color && textElem.color.includes('gradient') ? textElem.color : 'none',
          WebkitBackgroundClip: textElem.color && textElem.color.includes('gradient') ? 'text' : 'unset',
          backgroundClip: textElem.color && textElem.color.includes('gradient') ? 'text' : 'unset',
          opacity: textElem.opacity,
          zIndex: textElem.zIndex !== undefined ? textElem.zIndex : 1,
        }}
        dangerouslySetInnerHTML={{ __html: textElem.text }}
      />

      {isSelected && !isEditing && targetRef.current && containerRef.current && (
        <Moveable
          target={targetRef.current}
          container={containerRef.current}
          origin={false}
          
          /* Dragging */
          draggable={true}
          throttleDrag={1}
          onDrag={({ target, transform, left, top }: any) => {
            target.style.transform = transform;
          }}
          onDragEnd={({ target, isDrag }: any) => {
            if (isDrag) {
              // Extract translation from style.transform (e.g. "translate(50px, 100px) rotate(45deg)")
              const transformStr = (target as HTMLElement).style.transform;
              const translateMatch = transformStr.match(/translate\(([^,]+)px,([^)]+)px\)/);
              if (translateMatch) {
                const newX = parseFloat(translateMatch[1]);
                const newY = parseFloat(translateMatch[2]);
                updateText(textElem.id, { x: newX, y: newY });
                pushHistory();
              }
            }
          }}

          /* Resizing */
          resizable={true}
          throttleResize={1}
          renderDirections={['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']}
          onResize={({ target, width, height, drag }: any) => {
             target.style.width = `${width}px`;
             target.style.height = `${height}px`;
             target.style.transform = drag.transform;
          }}
          onResizeEnd={({ target, isDrag }: any) => {
            if (isDrag) {
              const width = parseFloat((target as HTMLElement).style.width || "0");
              const height = parseFloat((target as HTMLElement).style.height || "0");
              
              const transformStr = (target as HTMLElement).style.transform;
              const translateMatch = transformStr.match(/translate\(([^,]+)px,([^)]+)px\)/);
              
              if (width && height && translateMatch) {
                 const newX = parseFloat(translateMatch[1]);
                 const newY = parseFloat(translateMatch[2]);
                 updateText(textElem.id, { width, height, x: newX, y: newY });
                 pushHistory();
              }
            }
          }}

          /* Rotating */
          rotatable={true}
          throttleRotate={1}
          rotationPosition={"top"}
          onRotate={({ target, transform }: any) => {
            target.style.transform = transform;
          }}
          onRotateEnd={({ target, isDrag }: any) => {
             if (isDrag) {
               const transformStr = (target as HTMLElement).style.transform;
               const rotateMatch = transformStr.match(/rotate\(([^)]+)deg\)/);
               if (rotateMatch) {
                 const newRotation = parseFloat(rotateMatch[1]);
                 updateText(textElem.id, { rotation: newRotation });
                 pushHistory();
               }
             }
          }}
        />
      )}
    </>
  );
};

export default TextNode;
