export interface TextElement {
  id: string;
  text: string; // The raw text or HTML content
  isRichText?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  
  // Font Styling
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | string | number;
  fontStyle: 'normal' | 'italic';
  textDecoration: 'none' | 'underline' | 'line-through';
  
  // Paragraph
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number; // in px
  
  // Color & Presentation
  color: string;
  opacity: number; // 0 to 1
  
  // Layer controls
  visible: boolean;
  locked: boolean;
  zIndex?: number;
}

export type HistoryState = {
  texts: TextElement[];
  selectedId: string | null;
};
