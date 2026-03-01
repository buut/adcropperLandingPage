import { create } from 'zustand';
import { TextElement, HistoryState } from './types';
import { v4 as uuidv4 } from 'uuid';

interface EditorState {
  texts: TextElement[];
  selectedId: string | null;
  editingId: string | null;
  history: HistoryState[];
  historyIndex: number;
  previewMode: boolean;
  zoom: number;

  // Actions
  addText: (props?: Partial<TextElement>) => string;
  updateText: (id: string, updates: Partial<TextElement>) => void;
  deleteText: (id: string) => void;
  duplicateText: (id: string) => void;
  reorderText: (oldIndex: number, newIndex: number) => void;
  selectText: (id: string | null) => void;
  setEditingId: (id: string | null) => void;
  
  // Global Actions
  setPreviewMode: (mode: boolean) => void;
  setZoom: (zoom: number) => void;

  // History Actions
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

const createDefaultText = (): TextElement => ({
  id: uuidv4(),
  text: 'Type here...',
  x: 50,
  y: 50,
  width: 200,
  height: 40,
  rotation: 0,
  fontFamily: 'Arial',
  fontSize: 24,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
  color: '#000000',
  opacity: 1,
  visible: true,
  locked: false,
});

export const useEditorStore = create<EditorState>((set, get) => ({
  texts: [],
  selectedId: null,
  editingId: null,
  history: [{ texts: [], selectedId: null }],
  historyIndex: 0,
  previewMode: false,
  zoom: 100,

  pushHistory: () => {
    const { texts, selectedId, history, historyIndex } = get();
    const newHistoryState = {
      texts: JSON.parse(JSON.stringify(texts)), // deep clone
      selectedId,
    };
    
    // Slice off any future history if we're not at the end, then push new state
    const newHistory = [...history.slice(0, historyIndex + 1), newHistoryState];
    
    // Keep max 50 history steps
    if (newHistory.length > 50) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];
      set({
        texts: JSON.parse(JSON.stringify(prevState.texts)),
        selectedId: prevState.selectedId,
        historyIndex: prevIndex,
      });
    }
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      set({
        texts: JSON.parse(JSON.stringify(nextState.texts)),
        selectedId: nextState.selectedId,
        historyIndex: nextIndex,
      });
    }
  },

  addText: (props) => {
    const newText = { ...createDefaultText(), ...props };
    set((state) => ({
      texts: [...state.texts, newText],
      selectedId: newText.id,
    }));
    get().pushHistory();
    return newText.id;
  },

  updateText: (id, updates) => {
    set((state) => ({
      texts: state.texts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    // Note: To prevent overwhelming history on drag/resize, pushHistory should be called explicitly on dragEnd/resizeEnd in the component, not here.
  },

  deleteText: (id) => {
    set((state) => ({
      texts: state.texts.filter((t) => t.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));
    get().pushHistory();
  },

  duplicateText: (id) => {
    const { texts } = get();
    const source = texts.find((t) => t.id === id);
    if (!source) return;

    const duplicate = {
      ...source,
      id: uuidv4(),
      x: source.x + 20,
      y: source.y + 20,
    };

    // Insert duplicate immediately above the source in the array
    const sourceIndex = texts.findIndex((t) => t.id === id);
    const newTexts = [...texts];
    newTexts.splice(sourceIndex + 1, 0, duplicate);

    set({ texts: newTexts, selectedId: duplicate.id });
    get().pushHistory();
  },

  reorderText: (oldIndex, newIndex) => {
    set((state) => {
      const newTexts = [...state.texts];
      const [movedItem] = newTexts.splice(oldIndex, 1);
      newTexts.splice(newIndex, 0, movedItem);
      return { texts: newTexts };
    });
    get().pushHistory();
  },

  selectText: (id) => {
    const currentSelectedId = get().selectedId;
    if (currentSelectedId !== id) {
      set({ selectedId: id });
    }
  },

  setEditingId: (id) => {
    set({ editingId: id });
  },

  setPreviewMode: (mode) => set({ previewMode: mode }),
  
  setZoom: (zoom) => set({ zoom: Math.max(50, Math.min(200, zoom)) }),
}));
