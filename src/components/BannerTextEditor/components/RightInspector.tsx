import React from 'react';
import { TextElement } from '../types';
import { useEditorStore } from '../store';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Bold, Italic, Underline, Trash2, Copy } from 'lucide-react';

interface RightInspectorProps {
  textElem: TextElement;
}

const FONTS = [
  'Arial', 'Helvetica', 'Roboto', 'Open Sans', 'Montserrat', 'Playfair Display', 'Times New Roman', 'Courier New'
];

const RightInspector: React.FC<RightInspectorProps> = ({ textElem }) => {
  const { updateText, deleteText, duplicateText, pushHistory, editingId } = useEditorStore();
  const isEditing = editingId === textElem.id;
  
  const [savedRange, setSavedRange] = React.useState<Range | null>(null);

  const syncHTML = () => {
    const node = document.getElementById(`text-node-${textElem.id}`);
    if (node) updateText(textElem.id, { text: node.innerHTML });
  };

  React.useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const activeEl = document.activeElement;
        // Only save selection if we're actively inside a contenteditable!
        if (activeEl?.hasAttribute('contenteditable')) {
          setSavedRange(sel.getRangeAt(0).cloneRange());
        }
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const handleChange = (key: keyof TextElement, value: any) => {
    if (isEditing) {
      // In rich text mode, we apply specific formatting for selection
      if (key === 'fontSize') {
        const sel = window.getSelection();
        let wasRestored = false;
        const activeEl = document.activeElement as HTMLElement;

        if ((!sel || sel.rangeCount === 0 || !document.activeElement?.hasAttribute('contenteditable')) && savedRange) {
          sel?.removeAllRanges();
          sel?.addRange(savedRange);
          wasRestored = true;
        }
        
        applySpanStyle('fontSize', `${value}px`);
        syncHTML();

        if (wasRestored && activeEl) activeEl.focus();
      } else if (key === 'color' || key === 'fontFamily') {
        const activeEl = document.activeElement as HTMLElement;
        const sel = window.getSelection();
        let wasRestored = false;
        
        if ((!sel || sel.rangeCount === 0 || !document.activeElement?.hasAttribute('contenteditable')) && savedRange) {
          sel?.removeAllRanges();
          sel?.addRange(savedRange);
          wasRestored = true;
        }
        
        if (key === 'color') {
          document.execCommand('foreColor', false, value);
        } else {
          document.execCommand('fontName', false, value);
        }
        
        syncHTML();

        if (wasRestored && activeEl) activeEl.focus();
      } else {
        updateText(textElem.id, { [key]: value });
      }
    } else {
      updateText(textElem.id, { [key]: value });
    }
  };

  const applySpanStyle = (styleName: string, styleValue: string) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    
    // Check if what we're selecting is actually inside our target
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style[styleName as any] = styleValue;
    
    try {
      range.surroundContents(span);
    } catch {
       // fallback for complex selections
       document.execCommand('insertHTML', false, `<span style="${styleName.replace(/([A-Z])/g, '-$1').toLowerCase()}:${styleValue}">${range.toString()}</span>`);
    }
  };

  const handleCommit = () => {
    pushHistory();
  };

  return (
    <div className="flex flex-col gap-6 p-4 text-sm">
      {/* Typography Section */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Typography</h3>
        
        {/* Font Family */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-500 text-xs">Font Family</label>
          <select 
            value={textElem.fontFamily}
            onChange={(e) => { handleChange('fontFamily', e.target.value); handleCommit(); }}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Font Size */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-500 text-xs flex justify-between">
            <span>Size</span>
            <span>{textElem.fontSize}px</span>
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="8" max="200" 
              value={textElem.fontSize}
              onChange={(e) => handleChange('fontSize', Number(e.target.value))}
              onMouseUp={handleCommit}
              className="flex-1 accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <input 
              type="number" min="8" max="200"
              value={textElem.fontSize}
              onChange={(e) => { handleChange('fontSize', Number(e.target.value)); handleCommit(); }}
              className="w-16 border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800 text-center"
            />
          </div>
        </div>

        {/* Font Styles (Bold, Italic, Underline) - Direct ExecCommand when editing */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md w-fit">
          <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { 
                if (isEditing) {
                  document.execCommand('bold');
                  syncHTML();
                }
                else handleChange('fontWeight', textElem.fontWeight === 'bold' ? 'normal' : 'bold'); 
                handleCommit(); 
            }}
            className={`p-1.5 rounded-sm transition-colors ${textElem.fontWeight === 'bold' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Bold size={16} />
          </button>
          <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { 
                if (isEditing) {
                  document.execCommand('italic');
                  syncHTML();
                }
                else handleChange('fontStyle', textElem.fontStyle === 'italic' ? 'normal' : 'italic'); 
                handleCommit(); 
            }}
            className={`p-1.5 rounded-sm transition-colors ${textElem.fontStyle === 'italic' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Italic size={16} />
          </button>
          <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { 
                if (isEditing) {
                  document.execCommand('underline');
                  syncHTML();
                }
                else handleChange('textDecoration', textElem.textDecoration === 'underline' ? 'none' : 'underline'); 
                handleCommit(); 
            }}
            className={`p-1.5 rounded-sm transition-colors ${textElem.textDecoration === 'underline' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
          >
            <Underline size={16} />
          </button>
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* Paragraph Section */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Paragraph</h3>
        
        {/* Alignment */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-500 text-xs">Alignment</label>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-md w-full justify-between">
            {[
              { val: 'left', icon: <AlignLeft size={16}/> },
              { val: 'center', icon: <AlignCenter size={16}/> },
              { val: 'right', icon: <AlignRight size={16}/> },
              { val: 'justify', icon: <AlignJustify size={16}/> }
            ].map(a => (
              <button 
                key={a.val}
                onClick={() => { handleChange('textAlign', a.val); handleCommit(); }}
                className={`flex-1 flex justify-center p-1.5 rounded-sm transition-colors ${textElem.textAlign === a.val ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {a.icon}
              </button>
            ))}
          </div>
        </div>

        {/* Line Height & Letter Spacing */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-500 text-xs">Line Height</label>
            <input 
              type="number" step="0.1" min="0.8" max="3"
              value={textElem.lineHeight}
              onChange={(e) => { handleChange('lineHeight', Number(e.target.value)); handleCommit(); }}
              className="w-full border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-gray-500 text-xs">Letter Spacing</label>
            <input 
              type="number" step="1" min="-10" max="50"
              value={textElem.letterSpacing}
              onChange={(e) => { handleChange('letterSpacing', Number(e.target.value)); handleCommit(); }}
              className="w-full border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800"
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* Appearance Section */}
      <section className="space-y-3">
        <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wider">Appearance</h3>
        
        {/* Color Picker with Gradient Support */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-500 text-xs">Color & Filling</label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={textElem.color.includes('gradient') ? '#000000' : textElem.color}
                onChange={(e) => { handleChange('color', e.target.value); }}
                onBlur={handleCommit}
                onMouseDown={(e) => e.preventDefault()}
                className="h-8 w-12 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <input 
                type="text" 
                value={textElem.color}
                onChange={(e) => { handleChange('color', e.target.value); }}
                onBlur={handleCommit}
                className="flex-1 border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800 font-mono text-xs"
                placeholder="#000000 or gradient"
              />
            </div>
            
            {/* Quick Gradient Presets */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50 mt-1">
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { handleChange('color', '#000000'); handleCommit(); }}
                className="text-[10px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
              >
                Solid
              </button>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { handleChange('color', 'linear-gradient(to right, #ff7e5f, #feb47b)'); handleCommit(); }}
                className="text-[10px] px-2 py-1 bg-gradient-to-r from-[#ff7e5f] to-[#feb47b] text-white rounded shadow-sm"
              >
                Linear
              </button>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { handleChange('color', 'radial-gradient(circle, #ff7e5f, #feb47b)'); handleCommit(); }}
                className="text-[10px] px-2 py-1 bg-[radial-gradient(circle,_#ff7e5f,_#feb47b)] text-white rounded shadow-sm"
              >
                Radial
              </button>
              <button 
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { handleChange('color', 'linear-gradient(45deg, #00c6ff, #0072ff)'); handleCommit(); }}
                className="text-[10px] px-2 py-1 bg-gradient-to-br from-[#00c6ff] to-[#0072ff] text-white rounded shadow-sm"
              >
                Blue
              </button>
            </div>
          </div>
        </div>

        {/* Opacity */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-500 text-xs flex justify-between">
            <span>Opacity</span>
            <span>{Math.round(textElem.opacity * 100)}%</span>
          </label>
          <input 
            type="range" min="0" max="1" step="0.01"
            value={textElem.opacity}
            onChange={(e) => handleChange('opacity', Number(e.target.value))}
            onMouseUp={handleCommit}
            className="w-full accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Rotation */}
        <div className="flex flex-col gap-1.5">
          <label className="text-gray-500 text-xs">Rotation (°)</label>
          <div className="flex items-center gap-2">
            <input 
              type="range" min="0" max="360" 
              value={textElem.rotation}
              onChange={(e) => handleChange('rotation', Number(e.target.value))}
              onMouseUp={handleCommit}
              className="flex-1 accent-blue-600 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <input 
              type="number" min="0" max="360"
              value={Math.round(textElem.rotation)}
              onChange={(e) => { handleChange('rotation', Number(e.target.value)); handleCommit(); }}
              className="w-16 border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-800 text-center"
            />
          </div>
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* Actions */}
      <section className="flex gap-2">
        <button 
          onClick={() => duplicateText(textElem.id)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 py-1.5 rounded-md font-medium transition-colors"
        >
          <Copy size={16} />
          Duplicate
        </button>
        <button 
          onClick={() => deleteText(textElem.id)}
          className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 py-1.5 rounded-md font-medium transition-colors"
        >
          <Trash2 size={16} />
          Delete
        </button>
      </section>

    </div>
  );
};

export default RightInspector;
