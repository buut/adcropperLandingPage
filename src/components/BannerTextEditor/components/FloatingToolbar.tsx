import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight, Minus, Plus } from 'lucide-react';
import { useEditorStore } from '../store';
import { applyRichTextFormat } from '../../../utils/richText';

const FloatingToolbar: React.FC = () => {
  const { editingId, texts, updateText } = useEditorStore();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  const selectedText = editingId ? texts.find((t) => t.id === editingId) : null;

  // Track position of the editing node
  useEffect(() => {
    if (!editingId) {
      setPos(null);
      return;
    }
    const node = document.getElementById(`text-node-${editingId}`);
    if (!node) return;

    const updatePosition = () => {
      const rect = node.getBoundingClientRect();
      const TOOLBAR_H = 40;
      const GAP = 6;
      setPos({
        top: rect.top - TOOLBAR_H - GAP + window.scrollY,
        left: rect.left + window.scrollX,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [editingId]);

  // Save selection range when user selects text inside the contenteditable
  useEffect(() => {
    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const activeEl = document.activeElement;
        if (activeEl?.hasAttribute('contenteditable')) {
          setSavedRange(sel.getRangeAt(0).cloneRange());
        }
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  if (!editingId || !pos || !selectedText) return null;

  const syncHTML = () => {
    const node = document.getElementById(`text-node-${editingId}`);
    if (node) updateText(editingId, { text: node.innerHTML });
  };

  const restoreAndApply = (command: string, value?: string) => {
    const node = document.getElementById(`text-node-${editingId}`);
    if (!node) return;

    const sel = window.getSelection();
    if ((!sel || sel.rangeCount === 0 || !document.activeElement?.hasAttribute('contenteditable')) && savedRange) {
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    }

    applyRichTextFormat(`text-node-${editingId}`, command, value);
    syncHTML();
  };

  const applyExecCommand = (cmd: string) => {
    const node = document.getElementById(`text-node-${editingId}`);
    if (!node) return;

    const sel = window.getSelection();
    if ((!sel || sel.rangeCount === 0 || !document.activeElement?.hasAttribute('contenteditable')) && savedRange) {
      sel?.removeAllRanges();
      sel?.addRange(savedRange);
    }

    document.execCommand(cmd);
    syncHTML();
    // Restore focus to node
    node.focus();
  };

  const changeFontSize = (delta: number) => {
    const newSize = Math.max(8, Math.min(200, selectedText.fontSize + delta));
    restoreAndApply('fontSize', String(newSize));
    updateText(editingId, { fontSize: newSize });
  };

  const btnBase = 'p-1.5 rounded hover:bg-white/20 text-white transition-colors';
  const divider = <div className="w-px h-5 bg-white/30 mx-0.5" />;

  return (
    <div
      ref={toolbarRef}
      className="ignore-click-outside fixed z-[9999] flex items-center gap-0.5 bg-gray-900 text-white rounded-lg shadow-xl px-2 py-1 text-sm select-none"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Bold */}
      <button
        className={btnBase}
        title="Bold (Ctrl+B)"
        onClick={() => applyExecCommand('bold')}
      >
        <Bold size={14} />
      </button>

      {/* Italic */}
      <button
        className={btnBase}
        title="Italic (Ctrl+I)"
        onClick={() => applyExecCommand('italic')}
      >
        <Italic size={14} />
      </button>

      {/* Underline */}
      <button
        className={btnBase}
        title="Underline (Ctrl+U)"
        onClick={() => applyExecCommand('underline')}
      >
        <Underline size={14} />
      </button>

      {/* Strikethrough */}
      <button
        className={btnBase}
        title="Strikethrough"
        onClick={() => restoreAndApply('strikethrough')}
      >
        <Strikethrough size={14} />
      </button>

      {divider}

      {/* Font Size */}
      <button className={btnBase} title="Decrease font size" onClick={() => changeFontSize(-2)}>
        <Minus size={14} />
      </button>
      <span className="text-xs font-mono w-8 text-center tabular-nums">
        {selectedText.fontSize}
      </span>
      <button className={btnBase} title="Increase font size" onClick={() => changeFontSize(2)}>
        <Plus size={14} />
      </button>

      {divider}

      {/* Alignment */}
      <button
        className={`${btnBase} ${selectedText.textAlign === 'left' ? 'bg-white/20' : ''}`}
        title="Align left"
        onClick={() => updateText(editingId, { textAlign: 'left' })}
      >
        <AlignLeft size={14} />
      </button>
      <button
        className={`${btnBase} ${selectedText.textAlign === 'center' ? 'bg-white/20' : ''}`}
        title="Align center"
        onClick={() => updateText(editingId, { textAlign: 'center' })}
      >
        <AlignCenter size={14} />
      </button>
      <button
        className={`${btnBase} ${selectedText.textAlign === 'right' ? 'bg-white/20' : ''}`}
        title="Align right"
        onClick={() => updateText(editingId, { textAlign: 'right' })}
      >
        <AlignRight size={14} />
      </button>

      {divider}

      {/* Inline Color */}
      <label className="relative cursor-pointer" title="Text color">
        <div
          className="w-5 h-5 rounded border border-white/40"
          style={{ background: selectedText.color.includes('gradient') ? selectedText.color : selectedText.color }}
        />
        <input
          type="color"
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          value={selectedText.color.includes('gradient') ? '#000000' : selectedText.color}
          onChange={(e) => {
            restoreAndApply('foreColor', e.target.value);
            updateText(editingId, { color: e.target.value });
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      </label>
    </div>
  );
};

export default FloatingToolbar;
