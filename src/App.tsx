import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { cleanFileName } from './utils/fileUtils';
import Header, { AppMode } from './components/Header'
import LeftSidebar from './components/LeftSidebar'
import TopToolbar from './components/TopToolbar'
import Workspace from './components/Workspace'
import Timeline from './components/Timeline'
import PropertiesBar from './components/PropertiesBar'
import MediaAssetContainer from './components/MediaAssetContainer'
import VideoAssetContainer from './components/VideoAssetContainer'
import WidgetAssetContainer from './components/WidgetAssetContainer'
import ButtonAssetContainer from './components/ButtonAssetContainer'
import TextAssetContainer from './components/TextAssetContainer'
import PolygonAssetContainer from './components/PolygonAssetContainer'
import FontAssetContainer from './components/FontAssetContainer'
import AnimateView from './components/AnimateView'
import AddStageModal from './components/AddStageModal'
import DuplicateStageModal from './components/DuplicateStageModal'
import RenameLayerModal from './components/RenameLayerModal'
import SettingsPopup from './components/SettingsPopup'
import LandingPageModal from './components/LandingPageModal'
import { WorkspaceHandle } from './components/Workspace'
import { generateStressTestData } from './utils/stressTest'
import { convertStagesToStageObject, downloadStageObject, captureStagesAsBase64, uploadImageToServer, reconstructStagesFromStageObject } from './utils/stageExport'
import { getInterpolatedLayerStyles } from './utils/animations'
import Login from './components/Login'
import { getAuth, UserData } from './utils/auth'
import AiCmsContainer from './components/AiCmsContainer'
import { animations } from './data/animationData'
import { collectDescendantScaleUpdates, calculateLayerScaleUpdates } from './utils/groupScaling';
import { createLandingPageStages } from './utils/landingPageHelper';
import VoiceChatContainer from './components/VoiceChatContainer';

export const FONT_LIST_URL = 'https://test-platform.adcropper.com/fonts/list2';
export const UPLOAD_URL = 'https://test-tool-upload.adcropper.com';

const generateShortId = (prefix: string) => {
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${randomStr}`;
};

const getMediaDimensions = (url: string, type: 'image' | 'video'): Promise<{ width: number, height: number }> => {
  return new Promise((resolve, reject) => {
    if (type === 'video') {
      const video = document.createElement('video');
      video.src = url;
      video.onloadedmetadata = () => {
        resolve({ width: video.videoWidth, height: video.videoHeight });
      };
      video.onerror = (e) => reject(e);
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Video load timeout')), 5000);
    } else {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = (e) => reject(e);
      // Timeout after 5 seconds
      setTimeout(() => reject(new Error('Image load timeout')), 5000);
    }
  });
};

export interface Layer {
  id: string;
  name: string;
  type: 'image' | 'widget' | 'group' | 'button' | 'text' | 'shape' | 'video';
  url?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity?: number;
  variant?: string;
  isDynamic?: boolean;
  hidden?: boolean;
  children?: Layer[];
  isMask?: boolean;
  locked?: boolean;
  // Advanced Transform Properties
  transformX?: number;
  transformY?: number;
  transformZ?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  skewX?: number;
  skewY?: number;
  blur?: number;
  brightness?: number;
  contrast?: number;
  grayscale?: number;
  sepia?: number;
  saturate?: number;
  transformOrigin?: string;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'elastic' | 'bounce' | 'back-in' | 'back-out' | 'back-in-out';
  animation?: {
    entry: { start: number; duration: number; name?: string; easing?: string };
    main: { start: number; duration: number; name?: string; repeat?: number; easing?: string };
    exit: { start: number; duration: number; name?: string; easing?: string };
    keyframes?: Array<{
      id: string;
      time: number; // 0 to duration * 100
      props: Partial<Omit<Layer, 'id' | 'type' | 'animation' | 'children'>>;
    }>;
  };
  textAnimation?: {
    entry: { start: number; duration: number; name?: string; easing?: string };
    main: { start: number; duration: number; name?: string; repeat?: number; easing?: string };
    exit: { start: number; duration: number; name?: string; easing?: string };
  };
  // Landing page interaction / playback controls
  animationAutoPlay?: boolean;
  animationLoopCount?: number;
  animationStopAt?: number | null;
  interactionActions?: InteractionAction[];
}

export interface TimelineMarker {
  id: string;
  time: number;
  type: 'image';
  label?: string;
}

export interface StageAction {
  id: string;
  triggerSourceId: string; // 'stage' or layerId
  triggerTargetId: string; // layerId
  actionType: string; // effect name from interactiveEffects
  eventType?: 'click' | 'mouseover' | 'mouseout';
  config?: any;
}

// ── Landing Page types ──────────────────────────────────────────────────────

export type BreakpointName = 'xlarge' | 'large' | 'medium' | 'small' | 'xsmall';

export const BREAKPOINT_PRESETS: Record<BreakpointName, { width: number; height: number; label: string }> = {
  xlarge: { width: 1920, height: 1080, label: 'XL — 1920px  Desktop Wide' },
  large:  { width: 1280, height: 800,  label: 'LG — 1280px  Desktop' },
  medium: { width: 1024, height: 768,  label: 'MD — 1024px  Tablet Landscape' },
  small:  { width: 768,  height: 1024, label: 'SM — 768px   Tablet Portrait' },
  xsmall: { width: 390,  height: 844,  label: 'XS — 390px   Mobile' },
};

export const BREAKPOINT_COLORS: Record<BreakpointName, string> = {
  xlarge: '#7c3aed',
  large:  '#2563eb',
  medium: '#059669',
  small:  '#d97706',
  xsmall: '#dc2626',
};

export const BREAKPOINT_ABBR: Record<BreakpointName, string> = {
  xlarge: 'XL',
  large:  'LG',
  medium: 'MD',
  small:  'SM',
  xsmall: 'XS',
};

export type LandingPageTrigger =
  | 'click' | 'hover' | 'hoverEnd' | 'touchStart' | 'touchEnd'
  | 'scroll-into-view' | 'scroll-out-view';

export type LandingPageActionType =
  | 'scroll-to-section' | 'open-menu' | 'close-menu' | 'toggle-layer'
  | 'navigate-url' | 'play-animation' | 'stop-animation' | 'toggle-animation';

export interface LandingPageAction {
  id: string;
  triggerSourceId: string;
  triggerEvent: LandingPageTrigger;
  actionType: LandingPageActionType;
  targetId: string;
  config?: {
    url?: string;
    openInNewTab?: boolean;
    sectionId?: string;
    animationPhase?: 'entry' | 'main' | 'exit' | 'all';
  };
}

export type AnimationTriggerEvent =
  | 'click' | 'hover' | 'hoverEnd' | 'touchStart' | 'touchEnd'
  | 'focus' | 'blur' | 'scroll-into-view';

export type AnimationTriggerAction =
  | 'play-entry' | 'play-main' | 'play-exit' | 'play-all'
  | 'stop' | 'pause' | 'resume' | 'reset';

export interface InteractionAction {
  id: string;
  event: AnimationTriggerEvent;
  action: AnimationTriggerAction;
  targetLayerId?: string; // if unset, targets the layer itself
}

export interface GuideLine {
  id: string;
  type: 'horizontal' | 'vertical';
  position: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface Stage {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  dynamicHeight?: boolean;
  layers: Layer[];
  duration: number;
  markers?: TimelineMarker[];
  loopCount?: number;
  stopAtSecond?: number;
  backgroundColor?: string;
  backgroundColor2?: string;
  bgType?: 'none' | 'solid' | 'radial' | 'linear';
  feedLoopInfo?: string;
  feedLoopCount?: number;
  guideLines?: GuideLine[];
  dynamicLoop?: {
    loop: number;
    loopElements: string[];
    loopElementsReference: string[];
  };
  globalLoop?: {
    loop: number;
    stopAt: number;
    loopElements: string[];
  };
  actions?: LandingPageAction[];
  sourceStageId?: string;
  overflow?: 'hidden' | 'visible';
  visible?: boolean;
  breakpoint?: BreakpointName;
  autoPlay?: boolean;
  gradientCenterX?: number;
  gradientCenterY?: number;
  gradientAngle?: number;
  gradientLength?: number;
  gradientRadius?: number;
}

export interface FontData {
  _id: string;
  family: string;
  isMain: boolean;
  isGoogleFonts: boolean;
  variants: string[];
  preview: string;
  isBrandFont?: boolean;
}

import { useUndoRedo } from './hooks/useUndoRedo'

const INITIAL_STAGES: Stage[] = [];

const App: React.FC = () => {
  const [activeSidebarTab, setActiveSidebarTab] = useState<string | null>(null);
  const { 
    state: stages, 
    setState: setStages, 
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    pushToHistory 
  } = useUndoRedo<Stage[]>(INITIAL_STAGES);
  const [isAddStageModalOpen, setIsAddStageModalOpen] = useState(false);
  const [isLandingPageModalOpen, setIsLandingPageModalOpen] = useState(false);
  const [duplicateModalConfig, setDuplicateModalConfig] = useState<{ isOpen: boolean, sourceStage: Stage | null }>({ isOpen: false, sourceStage: null });
  const [isSettingsPopupOpen, setIsSettingsPopupOpen] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(INITIAL_STAGES[0]?.id || null);
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
  const [hoveredLayerId, setHoveredLayerId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const workspaceRef = useRef<WorkspaceHandle>(null);
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isVoiceDeafened, setIsVoiceDeafened] = useState(false);

  const handleVoiceConnect = useCallback(() => setIsVoiceConnected(true), []);
  const handleVoiceDisconnect = useCallback(() => {
    setIsVoiceConnected(false);
    setIsVoiceMuted(false);
    setIsVoiceDeafened(false);
  }, []);
  const toggleVoiceMute = useCallback(() => setIsVoiceMuted(prev => !prev), []);
  const toggleVoiceDeafen = useCallback(() => setIsVoiceDeafened(prev => !prev), []);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<{ x: number, y: number } | null>(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const chatTimeoutRefs = useRef<{ [userId: string]: NodeJS.Timeout }>({});


  // Helper to find the path from root to a target layer
  const findPath = (layers: Layer[], targetId: string, currentPath: string[] = []): string[] | null => {
    for (const l of layers) {
      if (l.id === targetId) return [...currentPath, l.id];
      if (l.children) {
        const path = findPath(l.children, targetId, [...currentPath, l.id]);
        if (path) return path;
      }
    }
    return null;
  };

  const handleLayersSelect = (ids: string[] | ((prev: string[]) => string[]), stageId?: string) => {
    console.log('[handleLayersSelect] called. typeof ids:', typeof ids, 'stageId:', stageId);
    setSelectedLayerIds(prev => {
      console.log('[handleLayersSelect] functional update executing. prev:', prev, 'selectedStageId:', selectedStageId);
      const targetStageId = stageId || selectedStageId;
      const currentStage = stages.find(s => s.id === targetStageId);
      
      if (!currentStage) {
        console.log('[handleLayersSelect] no currentStage found, returning prev');
        return prev; // Safety
      }
      
      // If we are shift-selecting across stages, we only support single stage multi-selection.
      // Easiest robust test: Does the first item in our current selection belong to this stage?
      const isCrossStageSelection = prev.length > 0 && !findPath(currentStage.layers, prev[0]);
      console.log('[handleLayersSelect] cross stage selection check:', isCrossStageSelection, 'prev[0] path:', prev.length > 0 ? findPath(currentStage.layers, prev[0]) : null);
      const baseSelection = isCrossStageSelection ? [] : prev;
      
      const next = typeof ids === 'function' ? ids(baseSelection) : ids;
      console.log('[handleLayersSelect] calculated next ids:', next);
      
      if (!activeGroupId) {
        return Array.from(new Set(next));
      }

      const enforceSelectionHierarchy = (id: string): string | null => {
        const path = findPath(currentStage.layers, id);
        if (!path) return id;
        
        const activeIdx = path.indexOf(activeGroupId);
        if (activeIdx !== -1 && activeIdx < path.length - 1) {
          return path[activeIdx + 1];
        } else if (activeIdx !== -1) {
          return id;
        }
        return null;
      };

      const refined = next.map(enforceSelectionHierarchy).filter(Boolean) as string[];
      
      if (next.length > 0 && refined.length === 0) {
        // We clicked outside the active group
        // In a functional update, we can't call setActiveGroupId(null) directly without side effects, 
        // but App-level state management should handle this via the caller or a separate effect.
        // For now, we'll return next directly and let handleLayerClick handle the isolation reset.
        return Array.from(new Set(next));
      }

      return Array.from(new Set(refined));
    });
  };
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [timelineHeight, setTimelineHeight] = useState<number>(() => {
    const saved = localStorage.getItem('timelineHeight');
    return saved ? parseInt(saved, 10) : 300;
  });

  const handleTimelineHeightChange = (newHeight: number) => {
    setTimelineHeight(newHeight);
    localStorage.setItem('timelineHeight', newHeight.toString());
  };

  const [editingLayerIds, setEditingLayerIds] = useState<Record<string, string | null>>({});
  const [isMouseInWorkspace, setIsMouseInWorkspace] = useState(false);
  const [isTextPopupOpen, setIsTextPopupOpen] = useState(false);
  const [isSyncEnabled, setIsSyncEnabled] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  // --- Collaboration Infrastructure (Hoisted for use in handlers) ---
  const socketRef = React.useRef<WebSocket | null>(null);
  const userIdRef = React.useRef<string>('');
  const userNameRef = React.useRef<string>('');
  const isIncomingUpdateRef = React.useRef<boolean>(false);
  const [collaborators, setCollaborators] = useState<Record<string, { name: string, lastSeen: number, lastMessage?: string, x?: number, y?: number }>>({});
  const [followedUserId, setFollowedUserId] = useState<string | null>(null);

  const broadcastAction = useCallback((action: { type: string, [key: string]: any }, silent = false) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const payload = {
        ...action,
        senderId: userIdRef.current,
        senderName: userNameRef.current,
        timestamp: Date.now()
      };
      
      if (!silent) {
        console.log(`%c📤 WS SENDED [${action.type}]`, 'color: #007bff; font-weight: bold; padding: 2px 4px; border-radius: 3px; background: #e7f3ff', payload);
      }
      
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);
  const [fonts, setFonts] = useState<FontData[]>([]);
  const [notification, setNotification] = useState<{ message: string, type: 'error' | 'success' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setNotification({ message, type });
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const [lastUsedTextStyles, setLastUsedTextStyles] = useState<{ 
    fontFamily: string, 
    fontSize: string, 
    fontWeight: string, 
    textColor: string,
    letterSpacing: string,
    textTransform: string,
    textAlign: string,
    verticalAlign: string,
    layoutType: string,
    bgType: string,
    lineHeight: string
  }>(() => {
    try {
      const saved = localStorage.getItem('lastUsedTextStyles');
      const defaults = {
        fontFamily: 'Inter',
        fontSize: '14',
        fontWeight: '400',
        textColor: '#121717',
        letterSpacing: '0',
        textTransform: 'none',
        textAlign: 'left',
        verticalAlign: 'top',
        layoutType: 'none',
        bgType: 'none',
        lineHeight: '1.2'
      };
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch (e) {
      return {
        fontFamily: 'Inter',
        fontSize: '14',
        fontWeight: '400',
        textColor: '#121717',
        letterSpacing: '0',
        textTransform: 'none',
        textAlign: 'left',
        verticalAlign: 'top',
        layoutType: 'none',
        bgType: 'none',
        lineHeight: '1.2'
      };
    }
  });

  useEffect(() => {
    localStorage.setItem('lastUsedTextStyles', JSON.stringify(lastUsedTextStyles));
  }, [lastUsedTextStyles]);

  // Clean up stale chat messages
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setChatMessages(prev => {
        const filtered = prev.filter(m => now - m.timestamp < 5000);
        return filtered.length !== prev.length ? filtered : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);


  const handleAddGuideLine = (stageId: string, guide: Omit<GuideLine, 'id'>) => {
    setStages(prev => prev.map(s => s.id === stageId ? {
      ...s,
      guideLines: [...(s.guideLines || []), { ...guide, id: generateShortId('guide') }]
    } : s));
  };

  const handleUpdateGuideLine = (stageId: string, guideId: string, position: number) => {
    setStages(prev => prev.map(s => s.id === stageId ? {
      ...s,
      guideLines: (s.guideLines || []).map(g => g.id === guideId ? { ...g, position } : g)
    } : s));
  };

  const handleDeleteGuideLine = (stageId: string, guideId: string) => {
    setStages(prev => prev.map(s => s.id === stageId ? {
      ...s,
      guideLines: (s.guideLines || []).filter(g => g.id !== guideId)
    } : s));
  };

  useEffect(() => {
    const fetchFonts = async () => {
      try {
        const auth = getAuth();
        const brandId = '671a1666d786fa251fca95d0';
        
        // Fetch Standard/Global fonts
        const globalResponse = await fetch('/fonts/list?family=');
        const globalData = await globalResponse.json();
        let globalFontsList: FontData[] = [];
        if (Array.isArray(globalData)) {
          globalFontsList = globalData;
        } else if (globalData && Array.isArray(globalData.data)) {
          globalFontsList = globalData.data;
        }

        // Fetch Brand fonts
        let brandFontsList: FontData[] = [];
        try {
          const brandResponse = await fetch(`${FONT_LIST_URL}?brandId=${brandId}&family=`);
          const brandData = await brandResponse.json();
          const items = Array.isArray(brandData) ? brandData : (brandData.data || []);
          brandFontsList = items.map((f: any) => ({ ...f, isBrandFont: true }));
        } catch (err) {
          console.error('Failed to fetch brand fonts:', err);
        }

        // Combine fonts: Brand fonts first
        setFonts([...brandFontsList, ...globalFontsList]);
        
      } catch (error) {
        console.error('Failed to fetch fonts:', error);
      }
    };
    fetchFonts();
  }, []);

  useEffect(() => {
    if (fonts.length > 0) {
      const styleId = 'dynamic-fonts-style';
      let styleEl = document.getElementById(styleId) as HTMLStyleElement;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      let css = '';
      const auth = getAuth();

      fonts.forEach(font => {
        if (font.isBrandFont) {
          // Fetch CSS for Brand Fonts
          const fetchBrandCSS = async () => {
            try {
              const brandIdForCSS = '67595c0a2d20c9bde35c04bf'; 
              const userId = auth?.userId || '67594ec02d20c9bde35c04bc';
              const token = auth?.token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NzU5NGVjMDJkMjBjOWJkZTM1YzA0YmMiLCJpYXQiOjE3NzAzNjg0ODYsImV4cCI6MTc3MDU0MTI4Nn0.OIvnfw5G0Q6-_ca_BmHSMdwhXZC0YMrH5-T0_KlJd4w';
              
              const res = await fetch(`https://fonts.adcropper.com/fonts/css?family=${font.family.replace(/\s+/g, '+')}&brandId=${brandIdForCSS}`, {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'user_id': userId,
                  'Accept': '*/*',
                }
              });
              const text = await res.text();
              const brandStyleId = `font-brand-${font._id}`;
              if (!document.getElementById(brandStyleId)) {
                const brandStyleEl = document.createElement('style');
                brandStyleEl.id = brandStyleId;
                brandStyleEl.innerHTML = text;
                document.head.appendChild(brandStyleEl);
              }
            } catch (e) {
              console.error(`Failed to load CSS for brand font ${font.family}:`, e);
            }
          };
          fetchBrandCSS();
        } else if (font.preview && !font.isGoogleFonts) {
            // For custom global fonts
            css += `
              @font-face {
                font-family: '${font.family}';
                src: url('${font.preview.startsWith('//') ? 'https:' + font.preview : font.preview}');
                font-weight: normal;
                font-style: normal;
              }
            `;
        } else if (font.isGoogleFonts) {
          const linkId = `font-${font._id}`;
          if (!document.getElementById(linkId)) {
            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${font.family.replace(/\s+/g, '+')}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
            document.head.appendChild(link);
          }
        }
      });
      styleEl.innerHTML = css;
    }
  }, [fonts]);

  useEffect(() => {
    const auth = getAuth();
    if (auth) {
      console.log('🔐 Session restored for:', auth.firstName);
      setUser(auth);
    }
  }, []);

  const [mode, setMode] = useState<AppMode>('design');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSize, setSelectedSize] = useState('all');
  const [previewState, setPreviewState] = useState<'default' | 'hover' | 'active'>('default');
  const [exportedImages, setExportedImages] = useState<Record<string, { "1x": string, "2x": string }>>({});
  const [editingKeyframeInfo, setEditingKeyframeInfo] = useState<{
    layerId: string;
    keyframeIds?: string[];
    time?: number;
    initialProps?: any;
    originalKeyframes?: Record<string, any[]>;
    tempKeyframeId?: string;
  } | null>(null);

  useEffect(() => {
    if (editingKeyframeInfo && !selectedLayerIds.includes(editingKeyframeInfo.layerId)) {
      setEditingKeyframeInfo(null);
    }
  }, [selectedLayerIds, editingKeyframeInfo]);

  const [isExporting, setIsExporting] = useState(false);

  const handleUploadAsset = async (file: File | Blob, filename: string = 'upload.png'): Promise<string> => {
    const companyId = '66db07778b5e35892545578c';
    const brandId = '671a1666d786fa251fca95d0';
    const templateId = '670fa914c2f0842143d5932';

    const formData = new FormData();
    // Ensure we have a File object with a name for the server
    const fileToUpload = file instanceof File ? file : new File([file], filename, { type: file.type });
    const cleanedName = cleanFileName(fileToUpload.name);
    const renamedFile = new File([fileToUpload], cleanedName, { type: fileToUpload.type });
    formData.append('file', renamedFile);
    formData.append('companyId', companyId);
    formData.append('brandId', brandId);
    formData.append('templateId', templateId);
    
    console.log(`📤 Uploading to server: ${fileToUpload.name} (${fileToUpload.type}, ${fileToUpload.size} bytes)...`);
    try {
      const response = await fetch(`${UPLOAD_URL}/upload-asset`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(`Upload failed: ${response.status} ${response.statusText}. ${errData.error || ''}`);
      }
      const data = await response.json();
      console.log('✅ Upload success:', data.url);
      return data.url;
    } catch (error) {
      console.error('❌ Error uploading asset:', error);
      // Fallback to local URL if upload fails
      return file instanceof File ? URL.createObjectURL(file) : (file as any).url || '';
    }
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    console.log('🚀 Starting Export All process (Capture + Upload)...');
    try {
      // 1. Capture base64 images
      const base64Images = await captureStagesAsBase64(stages);
      console.log(`📸 Captured ${Object.keys(base64Images).length} elements.`);

      // 2. Upload to server and get URLs
      const uploadedImages: Record<string, { "1x": string, "2x": string }> = {};
      const ids = Object.keys(base64Images);
      
      for (const id of ids) {
        console.log(`📤 Uploading element: ${id}...`);
        const { "1x": b1x, "2x": b2x } = base64Images[id];
        
        const [url1x, url2x] = await Promise.all([
          uploadImageToServer(id, b1x, '1x'),
          uploadImageToServer(id, b2x, '2x')
        ]);
        
        uploadedImages[id] = { "1x": url1x, "2x": url2x };
      }
      
      setExportedImages(uploadedImages);
      console.log('✅ All images uploaded and state updated.');
      
      const stageObj = convertStagesToStageObject(stages, uploadedImages, {
        media: mediaAssets,
        video: videoAssets,
        widget: widgetAssets,
        button: customButtonAssets
      }, {
        companyId: '66db07778b5e35892545578c',
        brandId: '671a1666d786fa251fca95d0',
        templateId: '670fa914c2f0842143d5932',
        campaignId: (window as any).campaignId || null,
        versionId: (window as any).versionId || null,
        marketId: (window as any).marketId || null
      });
      const blob = new Blob([JSON.stringify(stageObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stageObject.json`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('✨ stageObject.json downloaded with cloud paths.');
    } catch (e) {
      console.error('❌ Export error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  // --- Global Data Exposure & Sync ---
  useEffect(() => {
    (window as any).refreshTestData = handleTestDataBind;
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'AD_DATA' || event.data.dynamicText || event.data.feedObjects) {
          console.log('📬 Received new dynamic data via postMessage', event.data);
          (window as any).postMessageData = event.data;
          (window as any).AD_DATA = event.data;
          handleTestDataBind();
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      delete (window as any).refreshTestData;
    };
  }, [stages]);

  const [mediaAssets, setMediaAssets] = useState<string[]>([]);

  const [customButtonAssets, setCustomButtonAssets] = useState<any[]>([]);

  const [widgetAssets, setWidgetAssets] = useState<any[]>([
    { 
        id: 'countdown-timer',
        icon: 'timer', 
        label: 'Countdown Timer', 
        color: 'orange',
        url: '/widgets/countdown-timer/index.html'
    },
    { 
        id: 'social-share',
        icon: 'share', 
        label: 'Social Share', 
        color: 'pink',
        url: '/widgets/social-share/index.html'
    },
    { 
        id: 'newsletter-signup',
        icon: 'mail', 
        label: 'Newsletter', 
        color: 'purple',
        url: '/widgets/newsletter-signup/index.html'
    },
    { 
        id: 'video-player',
        icon: 'play_circle', 
        label: 'Video Player', 
        color: 'red',
        url: '' 
    },
  ]);

  const [videoAssets, setVideoAssets] = useState<any[]>([]);

  const handleDeleteButtonAsset = (index: number) => {
    setCustomButtonAssets(prev => prev.filter((_, i) => i !== index));
    showNotification('Asset deleted.', 'info');
  };

  const filteredStages = stages.filter(s => {
    const matchesName = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSize = selectedSize === 'all' || `${s.width}x${s.height}` === selectedSize;
    return matchesName && matchesSize;
  });

  // --- Animation Playback State ---
  const [playbackStates, setPlaybackStates] = useState<Record<string, { isPlaying: boolean, currentTime: number, loopsDone: number }>>({});
  const [previewPlaybackStates, setPreviewPlaybackStates] = useState<Record<string, { isPlaying: boolean, currentTime: number, loopsDone: number }>>({});
  
  const currentPB = mode === 'preview' ? previewPlaybackStates : playbackStates;
  const setPB = mode === 'preview' ? setPreviewPlaybackStates : setPlaybackStates;

  const requestRef = React.useRef<number>(null);
  const lastTimeRef = React.useRef<number>(null);

  // Use refs to avoid loop restarts when stages update
  const stagesRef = useRef(stages);
  const modeRef = useRef(mode);
  
  useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Cache which stages have dynamic layers to avoid recursive checks every frame
  const dynamicStagesMap = useMemo(() => {
    const hasDynamic = (layers: Layer[]): boolean => {
      return layers.some(l => l.isDynamic || (l.children && hasDynamic(l.children)));
    };
    const map: Record<string, boolean> = {};
    stages.forEach(s => {
      map[s.id] = hasDynamic(s.layers);
    });
    return map;
  }, [stages]);

  const dynamicStagesMapRef = useRef(dynamicStagesMap);
  useEffect(() => {
    dynamicStagesMapRef.current = dynamicStagesMap;
  }, [dynamicStagesMap]);

  const animate = useCallback((time: number) => {
    if (lastTimeRef.current !== null) {
      // Cap deltaTime at 50ms to prevent jumping/teleporting when the browser lags or tab is backgrounded
      const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      const isPreview = modeRef.current === 'preview';
      const currentStages = stagesRef.current;
      const currentDynamicMap = dynamicStagesMapRef.current;
      const setter = isPreview ? setPreviewPlaybackStates : setPlaybackStates;

      setter(prev => {
        let hasChanged = false;
        const next = { ...prev };
        
        currentStages.forEach(stage => {
          const state = next[stage.id] || { isPlaying: false, currentTime: 0, loopsDone: 0 };
          if (!state.isPlaying) return;

          let newTime = state.currentTime + deltaTime;
          let currentLoopsDone = state.loopsDone || 0;
          const durationInSeconds = stage.duration || 3;
          
          const isDynamicMode = currentDynamicMap[stage.id];
          const globalLoopCount = isPreview ? ((stage.loopCount === undefined || stage.loopCount === null) ? -1 : stage.loopCount) : -1;
          const globalStopAtSecond = isPreview ? ((stage.stopAtSecond !== undefined && stage.stopAtSecond > 0) ? Math.min(stage.stopAtSecond, durationInSeconds) : durationInSeconds) : durationInSeconds;
          
          const dynamicLoopCountUI = (isDynamicMode && isPreview) ? ((stage.feedLoopCount === undefined || stage.feedLoopCount === null) ? -1 : stage.feedLoopCount) : 0;
          let dynamicLoopLimit = 0;
          if (dynamicLoopCountUI === -1) {
              dynamicLoopLimit = -1;
          } else if (dynamicLoopCountUI > 0) {
              dynamicLoopLimit = dynamicLoopCountUI - 1;
          }

          // The absolute loop count to use for the STAGE PLAYBACK
          let effectiveLoopCount = globalLoopCount;
          let effectiveStopAtSecond = globalStopAtSecond;

          if (isPreview && isDynamicMode) {
              if (globalLoopCount === -1) {
                  effectiveLoopCount = -1;
                  effectiveStopAtSecond = durationInSeconds;
              } else if (dynamicLoopLimit === -1) {
                  effectiveLoopCount = -1;
                  effectiveStopAtSecond = durationInSeconds;
              } else if (dynamicLoopCountUI > 0) {
                  effectiveLoopCount = dynamicLoopCountUI;
                  effectiveStopAtSecond = durationInSeconds;
              } else if (dynamicLoopCountUI === 0) {
                  effectiveLoopCount = 0;
                  effectiveStopAtSecond = 0;
              }
          }

          // 1. If we are in the last (or past the last) loop, stop at the stop second.
          if (effectiveLoopCount !== -1 && currentLoopsDone >= effectiveLoopCount - 1) {
            if (newTime >= effectiveStopAtSecond) {
              next[stage.id] = { isPlaying: false, currentTime: effectiveStopAtSecond, loopsDone: Math.min(effectiveLoopCount, currentLoopsDone + 1) };
              hasChanged = true;
              return;
            }
          }

          // 2. Otherwise, if we reach the end of a cycle, wrap it around
          if (newTime >= durationInSeconds) {
            if (effectiveLoopCount === -1 || currentLoopsDone < effectiveLoopCount - 1) {
              newTime = Math.max(0, newTime - durationInSeconds);
              currentLoopsDone += 1;
            } else {
                // Should have been caught by (1), but for absolute safety:
                next[stage.id] = { isPlaying: false, currentTime: effectiveStopAtSecond, loopsDone: Math.max(effectiveLoopCount, currentLoopsDone + 1) };
                hasChanged = true;
                return;
            }
          }

          next[stage.id] = { isPlaying: true, currentTime: newTime, loopsDone: currentLoopsDone };
          hasChanged = true;
        });
        return hasChanged ? next : prev;
      });
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  }, [setPreviewPlaybackStates, setPlaybackStates]);

  useEffect(() => {
    lastTimeRef.current = null;
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);




  const togglePlayback = (stageId: string) => {
    setPB(prev => {
      const current = prev[stageId] || { isPlaying: false, currentTime: 0, loopsDone: 0 };
      const stage = stages.find(s => s.id === stageId);
      const isStarting = !current.isPlaying;
      
      let nextLoopsDone = current.loopsDone;
      let nextTime = current.currentTime;
      
      if (isStarting && stage) {
          const duration = stage.duration || 3;
          const isPreview = mode === 'preview';
          const loopCount = isPreview ? ((stage.loopCount === undefined || stage.loopCount === null) ? -1 : stage.loopCount) : -1;
          const stopAtSecond = isPreview ? ((stage.stopAtSecond !== undefined && stage.stopAtSecond > 0) ? Math.min(stage.stopAtSecond, duration) : duration) : duration;
          
          // Restart conditions:
          // 1. We are already at the stop point of the final loop
          const isAtStopPoint = loopCount !== -1 && current.loopsDone === loopCount && current.currentTime >= stopAtSecond - 0.05;
          // 2. We are exactly at the end of a duration
          const isAtDurationEnd = Math.abs(current.currentTime - duration) < 0.05;

          if (isAtStopPoint || isAtDurationEnd) {
              nextTime = 0;
              nextLoopsDone = 0;
          }
      }

    return {
      ...Object.fromEntries(
        Object.entries(prev).map(([id, state]) => [
          id, 
          (isStarting && mode !== 'preview' && id !== stageId) 
            ? { ...state, isPlaying: false } 
            : state
        ])
      ),
      [stageId]: { ...current, isPlaying: isStarting, currentTime: nextTime, loopsDone: nextLoopsDone }
    };
  });
};


  const handleSeek = (stageId: string, time: number) => {
    setPB(prev => {
      const current = prev[stageId] || { isPlaying: false, currentTime: 0, loopsDone: 0 };
      // If manually seeking back to the start, reset the loop counter to allow a fresh play
      const nextLoopsDone = time < 0.1 ? 0 : current.loopsDone;
      
      return {
        ...prev,
        [stageId]: { ...current, currentTime: time, loopsDone: nextLoopsDone }
      };
    });
  };
  // --------------------------------

  const [animationClipboard, setAnimationClipboard] = useState<Layer['animation'] | null>(null);
  const [layerClipboard, setLayerClipboard] = useState<Layer | null>(null);

  const [actionStates, setActionStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Clear all triggered action states when switching modes
    setActionStates({});
  }, [mode]);

  const handleTriggerAction = (actionId: string, isActive: boolean) => {
    console.log(`[App] handleTriggerAction: ${actionId} -> ${isActive}`);
    setActionStates(prev => ({ ...prev, [actionId]: isActive }));
  };

  const handleAddStages = (newStages: { name: string; width: number; height: number; breakpoint?: BreakpointName }[]) => {
    pushToHistory();

    // We pre-calculate everything to avoid issues with functional updates + broadcasting
    let currentMaxX = stages.length > 0 ? Math.max(...stages.map(s => Number(s.x + s.width) || 0)) : 0;
    const addedStages: Stage[] = [];

    newStages.forEach((ns) => {
      const stageId = generateShortId('stage');
      const stage: Stage = {
        ...ns,
        id: stageId,
        x: currentMaxX + 100,
        y: 100,
        layers: [],
        duration: 10,
        loopCount: 1,
        autoPlay: false,
        feedLoopCount: -1,
        actions: [],
        overflow: 'hidden',
        breakpoint: ns.breakpoint,
      };
      addedStages.push(stage);
      currentMaxX += stage.width + 100;
    });

    setStages(prev => [...prev, ...addedStages]);
    
    if (addedStages.length > 0) {
      setSelectedStageId(addedStages[addedStages.length - 1].id);
      setSelectedLayerIds([]);
      
      // Broadcast each one
      addedStages.forEach(stage => {
        broadcastAction({ type: 'STAGE_CREATE', stage });
      });
    }
  };

  const handleAddLandingPage = (selectedSizes: string[]) => {
    pushToHistory();
    const maxX = stages.length > 0 ? Math.max(...stages.map(s => Number(s.x + s.width) || 0)) : 0;
    const newStages = createLandingPageStages(maxX, selectedSizes);
    
    setStages(prev => [...prev, ...newStages]);
    
    if (newStages.length > 0) {
        setSelectedStageId(newStages[0].id);
        setSelectedLayerIds([]);
        
        newStages.forEach(stage => {
            broadcastAction({ type: 'STAGE_CREATE', stage });
        });
    }
  };

  const handleLandingPageAction = (action: LandingPageAction) => {
    if (!action) return;
    switch (action.actionType) {
      case 'navigate-url':
        if (action.config?.url) {
          window.open(action.config.url, action.config.openInNewTab ? '_blank' : '_self');
        }
        break;
      case 'scroll-to-section': {
        const targetStage = stages.find(s => s.id === action.targetId || s.name === action.config?.sectionId);
        if (targetStage) setSelectedStageId(targetStage.id);
        break;
      }
      case 'open-menu':
        handleUpdateLayers([action.targetId], { hidden: false });
        break;
      case 'close-menu':
        handleUpdateLayers([action.targetId], { hidden: true });
        break;
      case 'toggle-layer': {
        const allLayersFlat = (layers: Layer[]): Layer[] =>
          layers.flatMap(l => [l, ...(l.children ? allLayersFlat(l.children) : [])]);
        const found = stages.flatMap(s => allLayersFlat(s.layers)).find(l => l.id === action.targetId);
        if (found) handleUpdateLayers([action.targetId], { hidden: !found.hidden });
        break;
      }
      case 'play-animation':
      case 'stop-animation':
      case 'toggle-animation': {
        const tId = action.targetId;
        const isPlay = action.actionType === 'play-animation';
        const isStop = action.actionType === 'stop-animation';
        setPreviewPlaybackStates(prev => {
          const cur = prev[tId] || { isPlaying: false, currentTime: 0, loopsDone: 0 };
          const next = isPlay ? true : isStop ? false : !cur.isPlaying;
          return { ...prev, [tId]: { ...cur, isPlaying: next } };
        });
        break;
      }
    }
  };

  const handleUpdateStagePosition = (stageId: string, x: number, y: number) => {
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, x, y } : s));
    broadcastAction({ type: 'STAGE_UPDATE', stageId, updates: { x, y } });
  };

  const handleUpdateStageName = (stageId: string, name: string) => {
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, name } : s));
    broadcastAction({ type: 'STAGE_UPDATE', stageId, updates: { name } });
  };

  const handleDuplicateStage = (sourceStageId: string, name: string, targetWidth: number, targetHeight: number) => {
    pushToHistory();
    const sourceStage = stages.find(s => s.id === sourceStageId);
    if (!sourceStage) return;

    const sourceWidth = sourceStage.width;
    const sourceHeight = sourceStage.height;
    const ancestorId = sourceStage.sourceStageId || sourceStage.id;

    // Calculate a common scale to preserve ratio while fitting into new dimensions
    const scaleX = targetWidth / sourceWidth;
    const scaleY = targetHeight / sourceHeight;
    const commonScale = Math.min(scaleX, scaleY);

    const getScaledX = (x: number, isTopLevel: boolean) => {
      if (!isTopLevel) return x * commonScale;
      if (x < sourceWidth * 0.35) return x * commonScale; // Left anchored
      if (x > sourceWidth * 0.65) return targetWidth - (sourceWidth - x) * commonScale; // Right anchored
      return (targetWidth / 2) + (x - sourceWidth / 2) * commonScale; // Center anchored
    };

    const getScaledY = (y: number, isTopLevel: boolean) => {
      if (!isTopLevel) return y * commonScale;
      if (y < sourceHeight * 0.35) return y * commonScale; // Top anchored
      if (y > sourceHeight * 0.65) return targetHeight - (sourceHeight - y) * commonScale; // Bottom anchored
      return (targetHeight / 2) + (y - sourceHeight / 2) * commonScale; // Middle anchored
    };

    const getScaledVariant = (variantStr?: string) => {
      if (!variantStr) return variantStr;
      try {
        const meta = JSON.parse(variantStr);
        if (meta.fontSize) meta.fontSize = (parseFloat(meta.fontSize) * commonScale).toString();
        // Recursively handle nested components if needed, but for now focus on direct fontSize
        return JSON.stringify(meta);
      } catch (e) {
        return variantStr;
      }
    };

    const copyLayersRecursive = (layers: Layer[], isTopLevel = true): Layer[] => {
      return layers.map(layer => {
        const newLayer: Layer = { 
          ...layer, 
          id: generateShortId(layer.type.slice(0, 4)), // Use slice to keep prefix short
          name: layer.name, // Preserve name for syncing
          width: layer.width * commonScale,
          height: layer.height * commonScale,
          x: getScaledX(layer.x, isTopLevel),
          y: getScaledY(layer.y, isTopLevel)
        };

        if (layer.type === 'text' || layer.type === 'button') {
          newLayer.variant = getScaledVariant(layer.variant);
        }

        if (layer.children) {
          newLayer.children = copyLayersRecursive(layer.children, false);
        }

        if (layer.animation?.keyframes) {
          newLayer.animation = {
            ...layer.animation,
            keyframes: layer.animation.keyframes.map(kf => {
              const newProps = { ...kf.props };
              
              // Scale spatial properties in keyframes too
              if (newProps.x !== undefined) newProps.x = getScaledX(newProps.x, isTopLevel);
              if (newProps.y !== undefined) newProps.y = getScaledY(newProps.y, isTopLevel);
              if (newProps.width !== undefined) newProps.width *= commonScale;
              if (newProps.height !== undefined) newProps.height *= commonScale;
              if (newProps.variant !== undefined) newProps.variant = getScaledVariant(newProps.variant);
              
              return {
                ...kf,
                id: `kf_${Math.random().toString(36).substring(2, 11)}`,
                props: newProps
              };
            })
          };
        }

        return newLayer;
      });
    };

    const maxX = stages.length > 0 ? Math.max(...stages.map(s => Number(s.x + s.width) || 0)) : 0;

    // Ensure unique name
    let finalName = name;
    let counter = 1;
    while (stages.some(s => s.name === finalName)) {
      finalName = `${name} - ${counter}`;
      counter++;
    }

    const newStage: Stage = {
      ...sourceStage,
      id: generateShortId('stage'),
      sourceStageId: ancestorId,
      name: finalName,
      x: maxX + 100,
      y: 100,
      width: targetWidth,
      height: targetHeight,
      layers: copyLayersRecursive(sourceStage.layers)
    };

    setStages(prev => [...prev, newStage]);
    setSelectedStageId(newStage.id);
    setSelectedLayerIds([]);
    
    broadcastAction({ type: 'STAGE_CREATE', stage: newStage });
  };

  const handleAddLayer = (stageId: string, layer: Omit<Layer, 'id' | 'zIndex' | 'name'> & { name?: string }, prefix: string = 'layer') => {
    pushToHistory();
    // Automatically add images and videos to media assets kütüphanesi
    if ((layer.type === 'image' || layer.type === 'video' || (layer as any).type === 'media') && layer.url) {
      setMediaAssets(prev => {
        if (layer.url && !prev.includes(layer.url)) {
          return [...prev, layer.url];
        }
        return prev;
      });
    }

    const idPrefix = prefix === 'layer' || prefix === 'image' ? 'media' : (prefix === 'shape' ? 'shape' : prefix);
    const newLayerId = generateShortId(idPrefix);
    
    const targetStage = stages.find(s => s.id === stageId);
    const totalUnitsForDefault = (targetStage?.duration || 3) * 100;
    const animDuration = 70; // 0.7s default
    
    // Position calculation:
    // Entry: Start 0
    // Main: Centered in the timeline
    // Exit: Ends at totalUnitsForDefault
    const mainStart = Math.max(animDuration, Math.round((totalUnitsForDefault - animDuration) / 2));
    const exitStart = Math.max(mainStart + animDuration, totalUnitsForDefault - animDuration);

    console.log('🎬 Animation Timing Debug:', {
        type: layer.type,
        stageDuration: targetStage?.duration,
        totalUnits: totalUnitsForDefault,
        entry: { start: 0, duration: animDuration },
        main: { start: mainStart, duration: animDuration },
        exit: { start: exitStart, duration: animDuration }
    });

    const defaultCreationAnimation = {
      entry: { start: 0, duration: animDuration, name: 'none' },
      main: { start: mainStart, duration: animDuration, name: 'none' },
      exit: { start: exitStart, duration: animDuration, name: 'none' }
    };

    let finalLayer: Layer = { 
      ...layer, 
      id: newLayerId, 
      zIndex: 1, 
      animation: (layer as any).animation || defaultCreationAnimation,
      textAnimation: layer.type === 'text' ? ((layer as any).textAnimation || defaultCreationAnimation) : undefined,
      name: layer.name || newLayerId,
    };

    // If it's a button, ensure it has the correct rich media defaults
    if (layer.type === 'button') {
      let incomingMeta = {};
      try { incomingMeta = JSON.parse(layer.variant || '{}'); } catch {}
      const enrichedMeta = { 
        ...prepareButtonMetadata(incomingMeta, layer.url || ''),
        lockAspectRatio: false
      };
      finalLayer.variant = JSON.stringify(enrichedMeta);
    } else {
      let incomingMeta = {};
      try { incomingMeta = JSON.parse(layer.variant || '{}'); } catch {}
      finalLayer.variant = JSON.stringify({ 
        ...incomingMeta, 
        lockAspectRatio: false 
      });
    }

    if (layer.type === 'group' && !finalLayer.variant) {
      finalLayer.variant = JSON.stringify({ bgType: 'none' });
    }

    // Update last used styles for text and button layers
    if (layer.type === 'text' || layer.type === 'button') {
      try {
        const v = JSON.parse(finalLayer.variant || '{}');
        setLastUsedTextStyles(prev => ({
          ...prev,
          ...(v.fontFamily ? { fontFamily: v.fontFamily } : {}),
          ...(v.fontSize ? { fontSize: v.fontSize } : {}),
          ...(v.fontWeight ? { fontWeight: v.fontWeight } : {}),
          ...(v.textColor ? { textColor: v.textColor } : {}),
          ...(v.textAlign ? { textAlign: v.textAlign } : {}),
          ...(v.verticalAlign ? { verticalAlign: v.verticalAlign } : {}),
          ...(v.letterSpacing ? { letterSpacing: v.letterSpacing } : {}),
          ...(v.textTransform ? { textTransform: v.textTransform } : {}),
          ...(v.layoutType ? { layoutType: v.layoutType } : {}),
          ...(v.bgType ? { bgType: v.bgType } : {}),
        }));
      } catch (e) {}
    }



    if (activeGroupId) {
      const findGroupWorldCoords = (layers: Layer[], targetId: string, px = 0, py = 0, pr = 0, pw = 0, ph = 0): { wx: number, wy: number, wr: number, ww: number, wh: number } | null => {
        for (const l of layers) {
          const rad = pr * (Math.PI / 180);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const relX = l.x - pw/2;
          const relY = l.y - ph/2;
          const wx = px + (relX * cos - relY * sin);
          const wy = py + (relX * sin + relY * cos);
          const wr = pr + l.rotation;
          
          if (l.id === targetId) return { wx, wy, wr, ww: l.width, wh: l.height };
          if (l.children) {
            const result = findGroupWorldCoords(l.children, targetId, wx, wy, wr, l.width, l.height);
            if (result) return result;
          }
        }
        return null;
      };

      const currentStage = stages.find(s => s.id === stageId);
      if (currentStage) {
        const gCoords = findGroupWorldCoords(currentStage.layers, activeGroupId);
        if (gCoords) {
          const dx = layer.x - gCoords.wx;
          const dy = layer.y - gCoords.wy;
          const rad = -gCoords.wr * (Math.PI / 180);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const lx = dx * cos - dy * sin;
          const ly = dx * sin + dy * cos;
          
          finalLayer.x = lx + gCoords.ww / 2;
          finalLayer.y = ly + gCoords.wh / 2;
          finalLayer.rotation = layer.rotation - gCoords.wr;
        }
      }
    }

    const sourceStage = stages.find(s => s.id === stageId);
    const ancestorId = sourceStage?.sourceStageId || stageId;

    setStages(prev => prev.map(stage => {
      const isTargetStage = stage.id === stageId;
      const isRelatedStage = isSyncEnabled && (stage.id === ancestorId || stage.sourceStageId === ancestorId);
      
      if (isTargetStage || isRelatedStage) {
        // Calculate relative positioning if it's a related stage
        // Use the ID we already generated for the primary target
        let layerToInsert = { ...finalLayer };
        // If it's a related stage, we might want a different ID if they aren't synced by ID
        // But usually they SHOULD be synced by ID if isSyncEnabled is true.
        // However, the current logic seems to want different IDs for different stages?
        // Let's keep the existing logic of new IDs for related stages BUT use the correct one for target.
        if (!isTargetStage) {
          layerToInsert.id = generateShortId(idPrefix);
        }
        
        if (!isTargetStage && sourceStage) {
          // Rule-based scaling for related stages
          const sw = sourceStage.width;
          const sh = sourceStage.height;
          const tw = stage.width;
          const th = stage.height;
          const commonScale = Math.min(tw / sw, th / sh);

          const scaleX = (x: number) => {
            if (x < sw * 0.35) return x * commonScale;
            if (x > sw * 0.65) return tw - (sw - x) * commonScale;
            return (tw / 2) + (x - sw / 2) * commonScale;
          };
          const scaleY = (y: number) => {
            if (y < sh * 0.35) return y * commonScale;
            if (y > sh * 0.65) return th - (sh - y) * commonScale;
            return (th / 2) + (y - sh / 2) * commonScale;
          };

          layerToInsert.x = scaleX(finalLayer.x);
          layerToInsert.y = scaleY(finalLayer.y);
          layerToInsert.width = finalLayer.width * commonScale;
          layerToInsert.height = finalLayer.height * commonScale;

          if (layerToInsert.type === 'text' || layerToInsert.type === 'button') {
            try {
              const meta = JSON.parse(layerToInsert.variant || '{}');
              if (meta.fontSize) meta.fontSize = (parseFloat(meta.fontSize) * commonScale).toString();
              layerToInsert.variant = JSON.stringify(meta);
            } catch(e){}
          }
        }

        if (activeGroupId) {
          const updateRecursive = (layers: Layer[]): Layer[] => {
            return layers.map(l => {
              if (l.id === activeGroupId) {
                const maxZIndex = l.children?.length ? Math.max(...l.children.map(c => c.zIndex)) : 0;
                const newChildren = [...(l.children || []), {
                  ...layerToInsert,
                  zIndex: maxZIndex + 1
                }];
                return { 
                  ...l, 
                  children: newChildren.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
                };
              }
              if (l.children) return { ...l, children: updateRecursive(l.children) };
              return l;
            });
          };
          return { ...stage, layers: updateRecursive(stage.layers) };
        } else {
          const maxZIndex = stage.layers.length > 0 ? Math.max(...stage.layers.map(l => l.zIndex)) : 0;
          const newLayers = [...stage.layers, {
            ...layerToInsert,
            zIndex: maxZIndex + 1
          }];
          return { 
            ...stage, 
            layers: newLayers.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
          };
        }
      }
      return stage;
    }));

    broadcastAction({
      type: 'NODE_CREATE',
      stageId,
      groupId: activeGroupId,
      layer: {
        ...finalLayer,
        zIndex: 100 // Default high zIndex for creation
      }
    });

    return newLayerId;
  };
  
  // Helper to get interpolated properties for keyframe creation
  const getInterpolatedProps = (layer: Layer, playbackState: any) => {
    const timeInUnits = Math.round((playbackState?.currentTime || 0) * 100);
    const kfs = layer.animation?.keyframes;
    
    if (!kfs || kfs.length === 0) {
      return {
        x: layer.x, y: layer.y,
        width: layer.width, height: layer.height,
        rotation: layer.rotation, opacity: layer.opacity ?? 1
      };
    }

    const sorted = [...kfs].sort((a, b) => a.time - b.time);
    let k1 = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].time <= timeInUnits) {
        k1 = sorted[i];
        break;
      }
    }
    let k2 = sorted.find((k: any) => k.time > timeInUnits);

    if (!k1 && k2) return { ...layer, ...k2.props };
    if (k1 && !k2) return { ...layer, ...k1.props };
    if (k1 && k2) {
      const t = (timeInUnits - k1.time) / (k2.time - k1.time);
      const lerp = (v1: number, v2: number) => v1 + (v2 - v1) * t;
      
      const res: any = {};
      const allKeys = new Set([...Object.keys(k1.props), ...Object.keys(k2.props)]);
      allKeys.forEach(key => {
          if (key === 'easing') return;
          const v1 = (k1.props as any)[key] ?? (layer as any)[key] ?? 0;
          const v2 = (k2.props as any)[key] ?? (layer as any)[key] ?? 0;
          if (typeof v1 === 'number' && typeof v2 === 'number') {
              res[key] = lerp(v1, v2);
          } else {
              res[key] = t < 0.5 ? v1 : v2;
          }
      });
      return res;
    }
    return layer;
  };


  const getChildSize = (c: Layer): { w: number; h: number } => {
    let w = Number(c?.width) || 0;
    let h = Number(c?.height) || 0;
    if (w <= 0 || h <= 0) {
      try {
        const v = typeof c?.variant === 'string' ? JSON.parse(c.variant || '{}') : (c?.variant || {});
        if (Number.isFinite(v.width)) w = w <= 0 ? Number(v.width) : w;
        if (Number.isFinite(v.height)) h = h <= 0 ? Number(v.height) : h;
      } catch (_) {}
    }
    return { w: Math.max(0, w), h: Math.max(0, h) };
  };

  const computeGroupBoundsFromChildren = (children: Layer[]): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visible = (children || []).filter((c: Layer) => !c.isMask);
    for (const c of visible) {
      const { w, h } = getChildSize(c);
      if (w <= 0 && h <= 0) continue;
      
      const sx = Number(c.scaleX ?? (c as any).scale ?? 1);
      const sy = Number(c.scaleY ?? (c as any).scale ?? 1);

      const childCenterX = (Number(c.x) ?? 0);
      const childCenterY = (Number(c.y) ?? 0);
      
      const rad = (Number(c.rotation) || 0) * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const hw = (w * sx) / 2, hh = (h * sy) / 2;
      const corners = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
      
      for (const p of corners) {
        const rx = childCenterX + (p.x * cos - p.y * sin);
        const ry = childCenterY + (p.x * sin + p.y * cos);
        minX = Math.min(minX, rx);
        minY = Math.min(minY, ry);
        maxX = Math.max(maxX, rx);
        maxY = Math.max(maxY, ry);
      }
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  };

  useEffect(() => {
    let needsUpdate = false;
    const nextStages = stages.map(s => {
      if (s.dynamicHeight) {
        const bounds = computeGroupBoundsFromChildren(s.layers);
        const desiredH = bounds ? Math.max(100, Math.ceil(bounds.maxY + 80)) : s.height;
        if (Math.abs(desiredH - s.height) > 0.5) {
          needsUpdate = true;
          return { ...s, height: desiredH };
        }
      }
      return s;
    });
    if (needsUpdate) {
      setStages(nextStages);
    }
  }, [stages]);

  const handleUpdateLayers = (layerIds: string[], updates: Partial<Layer>, isBatch: boolean = false, targetLayerId?: string) => {
    // Track last used text styles if font properties are updated
    if (updates.variant !== undefined) {
      try {
        const v = JSON.parse(updates.variant);
        const hasTextChange = v.fontFamily || v.fontSize || v.fontWeight || v.textColor || v.textAlign || v.letterSpacing || v.textTransform;
        
        if (hasTextChange) {
          const findLayer = (ls: Layer[]): Layer | null => {
            for (const l of ls) {
              if (layerIds.includes(l.id)) return l;
              if (l.children) {
                const found = findLayer(l.children);
                if (found) return found;
              }
            }
            return null;
          };
          
          let firstLayer: Layer | null = null;
          for (const s of stages) {
            firstLayer = findLayer(s.layers);
            if (firstLayer) break;
          }
          
          if (firstLayer && (firstLayer.type === 'text' || firstLayer.type === 'button')) {
            setLastUsedTextStyles(prev => ({
              ...prev,
              ...(v.fontFamily ? { fontFamily: v.fontFamily } : {}),
              ...(v.fontSize ? { fontSize: v.fontSize } : {}),
              ...(v.fontWeight ? { fontWeight: v.fontWeight } : {}),
              ...(v.textColor ? { textColor: v.textColor } : {}),
              ...(v.textAlign ? { textAlign: v.textAlign } : {}),
              ...(v.letterSpacing ? { letterSpacing: v.letterSpacing } : {}),
              ...(v.textTransform ? { textTransform: v.textTransform } : {}),
              ...(v.verticalAlign ? { verticalAlign: v.verticalAlign } : {}),
              ...(v.layoutType ? { layoutType: v.layoutType } : {}),
              ...(v.bgType ? { bgType: v.bgType } : {}),
            }));
          }
        }
      } catch (e) {}
    }

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (trimmedName) {
        // Find if this name already exists in any stage that contains one of the layerIds
        for (const stage of stages) {
          const findInLayers = (ls: Layer[]): boolean => {
            return ls.some(l => layerIds.includes(l.id) || (l.children && findInLayers(l.children)));
          };
          
          if (findInLayers(stage.layers)) {
            // Check for duplicate in this stage
            const nameExists = (ls: Layer[]): boolean => {
              for (const l of ls) {
                if (!layerIds.includes(l.id) && l.name.trim().toLowerCase() === trimmedName.toLowerCase()) return true;
                if (l.children && nameExists(l.children)) return true;
              }
              return false;
            };

            if (nameExists(stage.layers)) {
              showNotification(`The name "${trimmedName}" is already in use in this stage. Please choose a unique name.`, 'error');
              return;
            }
          }
        }
      }
    }

    if (!isBatch) pushToHistory();
    if (updates.width !== undefined && (Number(updates.width) <= 0 || !Number.isFinite(updates.width))) (updates as any).width = 1;
    if (updates.height !== undefined && (Number(updates.height) <= 0 || !Number.isFinite(updates.height))) (updates as any).height = 1;

    let dx = 0;
    let dy = 0;
    let deltaCalculated = false;

    if (isBatch && targetLayerId && (updates.x !== undefined || updates.y !== undefined)) {
      const findStageAndLayer = (stgs: Stage[]): { stage: Stage, layer: Layer, isParentAuto: boolean } | null => {
        for (const s of stgs) {
          const findRecursive = (ls: Layer[], pAuto = false): { layer: Layer, isParentAuto: boolean } | undefined => {
            for (const l of ls) {
              if (l.id === targetLayerId) return { layer: l, isParentAuto: pAuto };
              if (l.children) {
                let isAuto = false;
                try {
                    const m = JSON.parse(l.variant || '{}');
                    isAuto = l.type === 'group' && m.layoutMode === 'auto';
                } catch(_) {}
                const f = findRecursive(l.children, isAuto);
                if (f) return f;
              }
            }
          };
          const res = findRecursive(s.layers);
          if (res) return { stage: s, ...res };
        }
        return null;
      };

      const result = findStageAndLayer(stages);
      if (result) {
        const { stage, layer: targetLayer, isParentAuto } = result;
        const pb = playbackStates[stage.id] || previewPlaybackStates[stage.id];
        const interp = getInterpolatedLayerStyles(
            targetLayer,
            pb?.currentTime || 0,
            stage.duration || 10,
            pb?.loopsDone || 0,
            (stage as any)?.loopCount,
            (stage as any)?.stopAtSecond,
            (stage as any)?.feedLoopCount,
            mode === 'preview',
            isParentAuto
        );

        dx = updates.x !== undefined ? updates.x - interp.visualX : 0;
        dy = updates.y !== undefined ? updates.y - interp.visualY : 0;
        const dr = updates.rotation !== undefined ? updates.rotation - interp.rotation : 0;
        deltaCalculated = true;
      }
    }

    // --- Dynamic & Content Sync Logic ---
    const isDynamicUpdate = updates.isDynamic !== undefined;
    const isVariantUpdate = updates.variant !== undefined;
    const isUrlUpdate = updates.url !== undefined;
    const isNameUpdate = updates.name !== undefined;
    const isAnimationUpdate = updates.animation !== undefined;
    const isSpatialUpdate = updates.x !== undefined || updates.y !== undefined || updates.width !== undefined || updates.height !== undefined || updates.rotation !== undefined ||
                           updates.transformX !== undefined || updates.transformY !== undefined || updates.transformZ !== undefined ||
                           updates.rotateX !== undefined || updates.rotateY !== undefined || updates.rotateZ !== undefined ||
                           updates.scaleX !== undefined || updates.scaleY !== undefined || updates.scaleZ !== undefined ||
                           updates.skewX !== undefined || updates.skewY !== undefined;
    
    const isInteractionUpdate = updates.interactionActions !== undefined;
    
    // We want to sync if ANY of these properties change AND sync is enabled
    const shouldSyncByName = isSyncEnabled && (isDynamicUpdate || isVariantUpdate || isUrlUpdate || isNameUpdate || isAnimationUpdate || isSpatialUpdate || isInteractionUpdate);
    
    const namesToSyncRaw = new Set<string>();
    const nameRefData: Record<string, { dynamicData?: any[], label?: string, url?: string }> = {};

    // Source info for scaling spatial changes
    let sourceStageInfo: { id: string, width: number, height: number, sourceStageId?: string } | null = null;
    let sourceLayerInterp: any = null;

    if (shouldSyncByName) {
        const findTargets = (ls: Layer[], stage: Stage) => {
            ls.forEach(l => {
                if (layerIds.includes(l.id)) {
                    namesToSyncRaw.add(l.name);
                    if (!sourceStageInfo) {
                        sourceStageInfo = { id: stage.id, width: stage.width, height: stage.height, sourceStageId: stage.sourceStageId };
                        const pb = playbackStates[stage.id] || previewPlaybackStates[stage.id];
                        sourceLayerInterp = getInterpolatedLayerStyles(
                            l,
                            pb?.currentTime || 0,
                            stage.duration || 10,
                            pb?.loopsDone || 0,
                            (stage as any)?.loopCount,
                            (stage as any)?.stopAtSecond,
                            (stage as any)?.feedLoopCount
                        );
                    }
                    try {
                        const meta = JSON.parse(l.variant || '{}');
                        nameRefData[l.name] = { 
                            label: meta.label, 
                            url: l.url,
                            dynamicData: meta.dynamicData
                        };
                    } catch(e){}
                }
                if (l.children) findTargets(l.children, stage);
            });
        };
        stages.forEach(s => findTargets(s.layers, s));
    }

    const newNameStateMap = new Map<string, { x: number, y: number, w: number, h: number, r: number }>();
    if (shouldSyncByName && sourceStageInfo) {
        const sourceStage = stages.find(s => s.id === sourceStageInfo!.id);
        if (sourceStage) {
            const findAndMap = (ls: Layer[], pAuto = false) => {
                ls.forEach(l => {
                    if (layerIds.includes(l.id)) {
                        const pb = playbackStates[sourceStage.id] || previewPlaybackStates[sourceStage.id];
                        const interp = getInterpolatedLayerStyles(
                            l, 
                            pb?.currentTime || 0, 
                            sourceStage.duration || 10, 
                            pb?.loopsDone || 0,
                            (sourceStage as any)?.loopCount,
                            (sourceStage as any)?.stopAtSecond,
                            (sourceStage as any)?.feedLoopCount,
                            mode === 'preview',
                            pAuto
                        );
                        
                        let finalX = interp.visualX;
                        let finalY = interp.visualY;
                        let finalW = interp.width;
                        let finalH = interp.height;
                        let finalR = interp.rotation;

                        const isDirectUpdate = (targetLayerId && l.id === targetLayerId) || (!isBatch);

                        if (isDirectUpdate) {
                            if (updates.x !== undefined) finalX = updates.x;
                            if (updates.y !== undefined) finalY = updates.y;
                            if (updates.width !== undefined) finalW = updates.width;
                            if (updates.height !== undefined) finalH = updates.height;
                            if (updates.rotation !== undefined) finalR = updates.rotation;
                        } else {
                            // Indirect/Batch update
                            if (updates.x !== undefined) finalX += dx;
                            if (updates.y !== undefined) finalY += dy;
                            if (updates.rotation !== undefined) finalR += (updates.rotation - interp.rotation); 
                            if (updates.width !== undefined && sourceLayerInterp && sourceLayerInterp.width > 0) {
                                finalW *= (updates.width / sourceLayerInterp.width);
                            }
                            if (updates.height !== undefined && sourceLayerInterp && sourceLayerInterp.height > 0) {
                                finalH *= (updates.height / sourceLayerInterp.height);
                            }
                        }
                        newNameStateMap.set(l.name, { x: finalX, y: finalY, w: finalW, h: finalH, r: finalR });
                    }
                    if (l.children) {
                        let isAuto = false;
                        try {
                            const m = JSON.parse(l.variant || '{}');
                            isAuto = l.type === 'group' && m.layoutMode === 'auto';
                        } catch(_) {}
                        findAndMap(l.children, isAuto);
                    }
                });
            };
            findAndMap(sourceStage.layers);
        }
    }

    // Map from original targetLayerId to its name, used for cross-stage ID resolution
    const interactionTargetNames = new Map<string, string>();
    if (updates.interactionActions) {
        updates.interactionActions.forEach(ia => {
            if (ia.targetLayerId) {
                const findNameRecursive = (ls: Layer[]): string | undefined => {
                    for (const l of ls) {
                        if (l.id === ia.targetLayerId) return l.name;
                        if (l.children) {
                            const found = findNameRecursive(l.children);
                            if (found) return found;
                        }
                    }
                    return undefined;
                };
                for (const s of stages) {
                    const name = findNameRecursive(s.layers);
                    if (name) {
                        interactionTargetNames.set(ia.targetLayerId, name);
                        break;
                    }
                }
            }
        });
    }

    setStages(prevStages => {
      const namesToSync = new Set<string>();
      if (shouldSyncByName) {
          const findNames = (ls: Layer[]) => {
              ls.forEach(l => {
                  if (layerIds.includes(l.id)) namesToSync.add(l.name);
                  if (l.children) findNames(l.children);
              });
          };
          prevStages.forEach(s => findNames(s.layers));
      }

      const updateRecursive = (layers: Layer[], currentStage: Stage, isTopLevel = true, isParentAuto = false): Layer[] => {
        return layers.map(layer => {
          let updatedLayer = { ...layer };
          
          if (layerIds.includes(layer.id) || (shouldSyncByName && namesToSync.has(layer.name))) {
            const isTargeted = layerIds.includes(layer.id);
            const isCustomMode = !!(layer.animation && 
                                layer.animation.entry.duration === 0 && 
                                layer.animation.main.duration === 0 && 
                                layer.animation.exit.duration === 0);
            
            const pb = playbackStates[currentStage.id] || previewPlaybackStates[currentStage.id];
            const timeInUnits = Math.round((pb?.currentTime || 0) * 100);

            const interp = getInterpolatedLayerStyles(
              layer,
              pb?.currentTime || 0,
              currentStage.duration || 10,
              pb?.loopsDone || 0,
              (currentStage as any)?.loopCount,
              (currentStage as any)?.stopAtSecond,
              (currentStage as any)?.feedLoopCount,
              mode === 'preview',
              isParentAuto
            );

            let changes = { ...updates };
            if (changes.width !== undefined && (Number(changes.width) <= 0 || !Number.isFinite(changes.width))) changes.width = Math.max(1, Number(layer.width) || 0);
            if (changes.height !== undefined && (Number(changes.height) <= 0 || !Number.isFinite(changes.height))) changes.height = Math.max(1, Number(layer.height) || 0);

                if (isSpatialUpdate && sourceStageInfo) {
                    const stateInSource = newNameStateMap.get(layer.name);
                    if (stateInSource) {
                        const sw = sourceStageInfo.width;
                        const sh = sourceStageInfo.height;
                        const tw = currentStage.width;
                        const th = currentStage.height;
                        const commonScale = Math.min(tw / sw, th / sh);

                        const scaleX = (x: number, isTop: boolean) => {
                          if (!isTop) return x * commonScale;
                          if (x < sw * 0.35) return x * commonScale;
                          if (x > sw * 0.65) return tw - (sw - x) * commonScale;
                          return (tw / 2) + (x - sw / 2) * commonScale;
                        };
                        const scaleY = (y: number, isTop: boolean) => {
                          if (!isTop) return y * commonScale;
                          if (y < sh * 0.35) return y * commonScale;
                          if (y > sh * 0.65) return th - (sh - y) * commonScale;
                          return (th / 2) + (y - sh / 2) * commonScale;
                        };

                        changes.x = scaleX(stateInSource.x, isTopLevel);
                        changes.y = scaleY(stateInSource.y, isTopLevel);
                        changes.rotation = stateInSource.r;
                        
                        if (updates.width !== undefined) changes.width = stateInSource.w * commonScale;
                        if (updates.height !== undefined) changes.height = stateInSource.h * commonScale;
                    }
                }

                // Properties that always sync exactly
                if (updates.isDynamic !== undefined) changes.isDynamic = updates.isDynamic;
                if (updates.url !== undefined) changes.url = updates.url;
                if (updates.rotation !== undefined) changes.rotation = updates.rotation;
                if (updates.transformOrigin !== undefined) changes.transformOrigin = updates.transformOrigin;
                
                // Advanced transforms
                if (updates.transformX !== undefined) changes.transformX = updates.transformX;
                if (updates.transformY !== undefined) changes.transformY = updates.transformY;
                if (updates.transformZ !== undefined) changes.transformZ = updates.transformZ;
                if (updates.rotateX !== undefined) changes.rotateX = updates.rotateX;
                if (updates.rotateY !== undefined) changes.rotateY = updates.rotateY;
                if (updates.rotateZ !== undefined) changes.rotateZ = updates.rotateZ;
                if (updates.scaleX !== undefined) changes.scaleX = updates.scaleX;
                if (updates.scaleY !== undefined) changes.scaleY = updates.scaleY;
                if (updates.scaleZ !== undefined) changes.scaleZ = updates.scaleZ;
                if (updates.skewX !== undefined) changes.skewX = updates.skewX;
                if (updates.skewY !== undefined) changes.skewY = updates.skewY;

            if (updates.interactionActions !== undefined) {
                if (isTargeted) {
                    changes.interactionActions = updates.interactionActions;
                } else {
                    // Remap targetLayerId by name for synced layers in other stages
                    changes.interactionActions = updates.interactionActions.map(ia => {
                        if (ia.targetLayerId) {
                            const targetName = interactionTargetNames.get(ia.targetLayerId);
                            if (targetName) {
                                const findInCurrent = (ls: Layer[]): string | undefined => {
                                    for (const l of ls) {
                                        if (l.name === targetName) return l.id;
                                        if (l.children) {
                                            const found = findInCurrent(l.children);
                                            if (found) return found;
                                        }
                                    }
                                    return undefined;
                                };
                                const mappedId = findInCurrent(currentStage.layers);
                                if (mappedId) return { ...ia, targetLayerId: mappedId };
                            }
                        }
                        return ia;
                    });
                }
            }
            // Ensure animation updates are merged rather than replaced
            if (updates.animation !== undefined) {
                if (updates.animation === null) {
                    changes.animation = undefined;
                } else if (layer.animation) {
                    changes.animation = { 
                        ...layer.animation, 
                        ...updates.animation,
                        entry: updates.animation.entry ? { ...layer.animation.entry, ...updates.animation.entry } : layer.animation.entry,
                        main: updates.animation.main ? { ...layer.animation.main, ...updates.animation.main } : layer.animation.main,
                        exit: updates.animation.exit ? { ...layer.animation.exit, ...updates.animation.exit } : layer.animation.exit,
                    };
                } else {
                    changes.animation = updates.animation as any;
                }
            }

            if (updates.textAnimation !== undefined) {
                if (updates.textAnimation === null) {
                    changes.textAnimation = undefined;
                } else if (layer.textAnimation) {
                    changes.textAnimation = { 
                        ...layer.textAnimation, 
                        ...updates.textAnimation,
                        entry: (updates.textAnimation as any).entry ? { ...layer.textAnimation.entry, ...(updates.textAnimation as any).entry } : layer.textAnimation.entry,
                        main: (updates.textAnimation as any).main ? { ...layer.textAnimation.main, ...(updates.textAnimation as any).main } : layer.textAnimation.main,
                        exit: (updates.textAnimation as any).exit ? { ...layer.textAnimation.exit, ...(updates.textAnimation as any).exit } : layer.textAnimation.exit,
                    };
                } else {
                    changes.textAnimation = updates.textAnimation as any;
                }
            }

            // --- SYNC & INJECT LOGIC ---
            if (shouldSyncByName && namesToSync.has(layer.name)) {
                try {
                    const meta = JSON.parse(changes.variant || layer.variant || '{}');
                    if ((changes.isDynamic === true || !isTargeted) && nameRefData[layer.name]) {
                        if (nameRefData[layer.name].dynamicData) {
                            meta.dynamicData = nameRefData[layer.name].dynamicData;
                            meta.isDynamicLoop = true;
                        }
                        if (!isTargeted) {
                            if (nameRefData[layer.name].label !== undefined) meta.label = nameRefData[layer.name].label;
                            if (nameRefData[layer.name].url !== undefined) changes.url = nameRefData[layer.name].url;
                            
                            // Scale font size in variant if it's a synced layer
                            if (meta.fontSize && sourceStageInfo) {
                                const sw = sourceStageInfo.width;
                                const sh = sourceStageInfo.height;
                                const tw = currentStage.width;
                                const th = currentStage.height;
                                const scaleFactor = Math.min(tw / sw, th / sh);
                                meta.fontSize = (parseFloat(meta.fontSize) * scaleFactor).toString();
                            }
                        }
                    }
                    if (layer.isDynamic || changes.isDynamic) {
                        let currentLabel = meta.label;
                        if (updates.variant) {
                            try {
                                const v = JSON.parse(updates.variant);
                                if (v.label !== undefined) currentLabel = v.label;
                            } catch(e){}
                        }
                        const currentUrl = changes.url || updates.url || layer.url;
                        const finalValue = currentLabel || currentUrl;
                        if (finalValue !== undefined && Array.isArray(meta.dynamicData) && meta.dynamicData.length > 0) {
                            const newDynamicData = [...meta.dynamicData];
                            newDynamicData[0] = finalValue;
                            meta.dynamicData = newDynamicData;
                        }
                    }
                    changes.variant = JSON.stringify(meta);
                } catch(e) {}

                // --- Sync Keyframe Props for non-targeted layers ---
                if (!isTargeted && changes.animation?.keyframes && sourceStageInfo) {
                    const sw = sourceStageInfo.width;
                    const sh = sourceStageInfo.height;
                    const tw = currentStage.width;
                    const th = currentStage.height;
                    const commonScale = Math.min(tw / sw, th / sh);
                    const isTop = isTopLevel;

                    const scaleX = (x: number) => {
                      if (!isTop) return x * commonScale;
                      if (x < sw * 0.35) return x * commonScale;
                      if (x > sw * 0.65) return tw - (sw - x) * commonScale;
                      return (tw / 2) + (x - sw / 2) * commonScale;
                    };
                    const scaleY = (y: number) => {
                      if (!isTop) return y * commonScale;
                      if (y < sh * 0.35) return y * commonScale;
                      if (y > sh * 0.65) return th - (sh - y) * commonScale;
                      return (th / 2) + (y - sh / 2) * commonScale;
                    };

                    changes.animation.keyframes = changes.animation.keyframes.map((kf: any) => ({
                        ...kf,
                        props: {
                            ...kf.props,
                            x: kf.props.x !== undefined ? scaleX(kf.props.x) : undefined,
                            y: kf.props.y !== undefined ? scaleY(kf.props.y) : undefined,
                            width: kf.props.width !== undefined ? kf.props.width * commonScale : undefined,
                            height: kf.props.height !== undefined ? kf.props.height * commonScale : undefined,
                        }
                    }));
                }
            }

            if (changes.animation !== undefined) {
                // If animation is explicitly provided (scaling or custom edit), 
                // spatial changes are absolute base values. 
                updatedLayer = { 
                  ...layer, 
                  ...changes
                };
            } else {
                // For non-animation updates, calculate deltas
                const cdx = changes.x !== undefined ? changes.x - interp.visualX : 0;
                const cdy = changes.y !== undefined ? changes.y - interp.visualY : 0;
                const cdw = changes.width !== undefined ? changes.width - interp.width : 0;
                const cdh = changes.height !== undefined ? changes.height - interp.height : 0;
                const cdr = (changes.rotation !== undefined) ? changes.rotation - interp.rotation : 0;
                const newW = Number(layer.width) + cdw;
                const newH = Number(layer.height) + cdh;

                updatedLayer = { 
                  ...layer, 
                  ...changes,
                  x: layer.x + cdx,
                  y: layer.y + cdy,
                  width: (newW <= 0 || !Number.isFinite(newW)) ? Math.max(1, Number(layer.width) || 0) : newW,
                  height: (newH <= 0 || !Number.isFinite(newH)) ? Math.max(1, Number(layer.height) || 0) : newH,
                  rotation: (layer.rotation || 0) + cdr
                };

                // Only run relative-move / auto-key logic if animation was NOT explicitly updated
                if (isCustomMode && layer.animation && (changes as any).animation === undefined) {
                    const kfs = [...(layer.animation.keyframes || [])];
                    const existingIdx = kfs.findIndex(k => Math.abs(k.time - timeInUnits) < 5);
                    
                    if (existingIdx !== -1) {
                        kfs[existingIdx] = { ...kfs[existingIdx], props: { ...kfs[existingIdx].props, ...changes } };
                        updatedLayer.animation = { 
                            entry: layer.animation.entry,
                            main: layer.animation.main,
                            exit: layer.animation.exit,
                            keyframes: kfs.sort((a, b) => a.time - b.time) 
                        };
                    } else if (timeInUnits > 0 && (cdx !== 0 || cdy !== 0 || cdw !== 0 || cdh !== 0 || cdr !== 0)) {
                        updatedLayer.animation = {
                            entry: layer.animation.entry,
                            main: layer.animation.main,
                            exit: layer.animation.exit,
                            keyframes: kfs.map(kf => ({
                                ...kf,
                                props: {
                                    ...kf.props,
                                    x: (kf.props.x !== undefined ? kf.props.x + cdx : undefined),
                                    y: (kf.props.y !== undefined ? kf.props.y + cdy : undefined),
                                    width: (kf.props.width !== undefined ? kf.props.width + cdw : undefined),
                                    height: (kf.props.height !== undefined ? kf.props.height + cdh : undefined),
                                    rotation: (kf.props.rotation !== undefined ? kf.props.rotation + cdr : undefined),
                                }
                            }))
                        };
                    } else if (timeInUnits === 0) {
                        const existing0Idx = kfs.findIndex(k => k.time === 0);
                        const kfProps = { x: updatedLayer.x, y: updatedLayer.y, width: updatedLayer.width, height: updatedLayer.height, rotation: updatedLayer.rotation, opacity: updatedLayer.opacity ?? 1 };
                        if (existing0Idx !== -1) kfs[existing0Idx] = { ...kfs[existing0Idx], props: { ...kfs[existing0Idx].props, ...kfProps } };
                        else kfs.push({ id: `kf_0_${Math.random().toString(36).substring(2, 7)}`, time: 0, props: kfProps });
                        updatedLayer.animation = { 
                            entry: layer.animation.entry,
                            main: layer.animation.main,
                            exit: layer.animation.exit,
                            keyframes: kfs.sort((a, b) => a.time - b.time) 
                        };
                    }
                }

                if (updatedLayer.type === 'group') {
                   if (!Number(updatedLayer.width) || updatedLayer.width <= 0) updatedLayer = { ...updatedLayer, width: Math.max(1, Number(layer.width) || 0) };
                   if (!Number(updatedLayer.height) || updatedLayer.height <= 0) updatedLayer = { ...updatedLayer, height: Math.max(1, Number(layer.height) || 0) };
                }
                if (updatedLayer.type === 'group' && updatedLayer.children && (cdw !== 0 || cdh !== 0)) {
                   // Hug (auto layout) ile grup boyutu güncelleniyorsa sadece grubun size'ı değişsin; iç elemanların boyutuna dokunma
                   let isAutoLayoutHug = false;
                   try {
                     const groupMeta = JSON.parse(updatedLayer.variant || '{}');
                     isAutoLayoutHug = groupMeta.layoutMode === 'auto';
                   } catch (_) {}
                   if (!isAutoLayoutHug) {
                     const rx = interp.width > 0 ? (interp.width + cdw) / interp.width : 1;
                     const ry = interp.height > 0 ? (interp.height + cdh) / interp.height : 1;
                     if (rx !== 1 || ry !== 1) {
                        // 1. Scale children
                        const layerChanges = new Map<string, any>();
                        collectDescendantScaleUpdates(updatedLayer.children, rx, ry, layerChanges, updatedLayer.children);
                        
                        const applyChildrenChanges = (ls: Layer[]): Layer[] => {
                          return ls.map(l => {
                            const changes = layerChanges.get(l.id);
                            let up = changes ? { ...l, ...changes } : l;
                            if (up.children) up.children = applyChildrenChanges(up.children);
                            return up;
                          });
                        };
                        updatedLayer.children = applyChildrenChanges(updatedLayer.children);

                        // 2. Scale the group's own properties (padding, gap, etc.)
                        const { x, y, width, height, ...groupStyleUpdates } = calculateLayerScaleUpdates(updatedLayer, rx, ry);
                        updatedLayer = { ...updatedLayer, ...groupStyleUpdates };
                     }
                   }
                }

            }
          }
          
          if (updatedLayer.children) {
            let isAuto = false;
            try {
              const m = JSON.parse(updatedLayer.variant || '{}');
              isAuto = updatedLayer.type === 'group' && m.layoutMode === 'auto';
            } catch(_) {}
            updatedLayer.children = updateRecursive(updatedLayer.children, currentStage, false, isAuto);
          }

          // Group boundary recalculation from children: skip for auto-layout groups
          if (updatedLayer.type === 'group' && updatedLayer.children && updatedLayer.children.length > 0) {
            const layerIdsSet = new Set(layerIds);
            const hasUpdatedDescendant = (l: Layer): boolean => 
              layerIdsSet.has(l.id) || !!(l.children && l.children.some(hasUpdatedDescendant));

            if (hasUpdatedDescendant(updatedLayer)) {
              let isAutoGroup = false;
              try {
                const m = JSON.parse(updatedLayer.variant || '{}');
                isAutoGroup = m.layoutMode === 'auto';
              } catch(_) {}

              const b = !isAutoGroup ? computeGroupBoundsFromChildren(updatedLayer.children) : null;
              if (b && (b.maxX > b.minX || b.maxY > b.minY)) {
                const oldW = Number(updatedLayer.width) || 0;
                const oldH = Number(updatedLayer.height) || 0;
                const newTightW = Math.max(1, b.maxX - b.minX);
                const newTightH = Math.max(1, b.maxY - b.minY);

                if (isBatch) {
                  // Restricted Resize Mode
                  const needsExpandR = b.maxX > oldW;
                  const needsExpandB = b.maxY > oldH;
                  if (needsExpandR || needsExpandB) {
                    const newW = Math.max(oldW, b.maxX);
                    const newH = Math.max(oldH, b.maxY);
                    const centerShiftX = (newW - oldW) / 2;
                    const centerShiftY = (newH - oldH) / 2;
                    const rad = (Number(updatedLayer.rotation) || 0) * (Math.PI / 180);
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);
                    const gsx = Number(updatedLayer.scaleX ?? 1);
                    const gsy = Number(updatedLayer.scaleY ?? 1);
                    const parentShiftX = (centerShiftX * gsx) * cos - (centerShiftY * gsy) * sin;
                    const parentShiftY = (centerShiftX * gsx) * sin + (centerShiftY * gsy) * cos;
                    updatedLayer = {
                      ...updatedLayer,
                      x: (Number(updatedLayer.x) || 0) + parentShiftX,
                      y: (Number(updatedLayer.y) || 0) + parentShiftY,
                      width: newW,
                      height: newH
                    };
                  }
                } else {
                  // Full Tight Fit
                  const centerShiftX = (b.minX + b.maxX) / 2 - oldW / 2;
                  const centerShiftY = (b.minY + b.maxY) / 2 - oldH / 2;
                  const rad = (Number(updatedLayer.rotation) || 0) * (Math.PI / 180);
                  const cos = Math.cos(rad);
                  const sin = Math.sin(rad);
                  const gsx = Number(updatedLayer.scaleX ?? 1);
                  const gsy = Number(updatedLayer.scaleY ?? 1);
                  const parentShiftX = (centerShiftX * gsx) * cos - (centerShiftY * gsy) * sin;
                  const parentShiftY = (centerShiftX * gsx) * sin + (centerShiftY * gsy) * cos;
                  const updatedChildren = updatedLayer.children.map((c: Layer) => ({
                    ...c,
                    x: (Number(c.x) ?? 0) - b.minX,
                    y: (Number(c.y) ?? 0) - b.minY
                  }));
                  updatedLayer = {
                    ...updatedLayer,
                    x: (Number(updatedLayer.x) || 0) + parentShiftX,
                    y: (Number(updatedLayer.y) || 0) + parentShiftY,
                    width: newTightW,
                    height: newTightH,
                    children: updatedChildren
                  };
                }
              }
            }
          }

          return updatedLayer;
        });
      };


      return prevStages.map(stage => {
        const updatedLayers = updateRecursive(stage.layers, stage, true, false);
        let finalHeight = stage.height;
        if (stage.dynamicHeight) {
          const bounds = computeGroupBoundsFromChildren(updatedLayers);
          if (bounds) {
            // Adjust stage height to fit the content maxY. 
            // We use maxY because stages are usually 0-based at the top.
            finalHeight = Math.max(10, bounds.maxY + 80);
          }
        }
        return {
          ...stage,
          layers: updatedLayers,
          height: finalHeight
        };
      });
    });

    broadcastAction({
      type: 'NODE_UPDATE',
      layerIds,
      updates,
      stageId: isSyncEnabled ? null : selectedStageId
    });
  };

  const handleBatchUpdateLayers = (updates: Array<{ id: string; changes: Partial<Layer>; absoluteLocal?: boolean }>) => {
    const layerIds = updates.map(u => u.id);
    const namesToSync = new Set<string>();
    const newNameStateMap = new Map<string, { x: number, y: number, w: number, h: number, r: number }>();
    let sourceStageInfo: { id: string, width: number, height: number } | null = null;

    // Transform (move/resize/rotate) sadece seçili layer'lara uygulanmalı; sync ile isim eşleşen diğer layer'lar (animasyonsuz alan) güncellenmesin
    const isTransformBatch = updates.length > 0 && updates.every(u => (u as any).absoluteLocal === true);

    if (isSyncEnabled && !isTransformBatch) {
        // Find source stage and names to sync
        for (const stage of stages) {
            const findNames = (ls: Layer[]) => {
                ls.forEach(l => {
                    if (layerIds.includes(l.id)) {
                        namesToSync.add(l.name);
                        if (!sourceStageInfo) {
                            sourceStageInfo = { id: stage.id, width: stage.width, height: stage.height };
                        }
                    }
                    if (l.children) findNames(l.children);
                });
            };
            findNames(stage.layers);
            if (sourceStageInfo) break;
        }

        // Map new states in source stage
        if (sourceStageInfo) {
            const sourceStage = stages.find(s => s.id === sourceStageInfo!.id);
            if (sourceStage) {
                const findAndMap = (ls: Layer[], pAuto = false) => {
                    ls.forEach(l => {
                        const update = updates.find(u => u.id === l.id);
                        if (update) {
                            const pb = playbackStates[sourceStage.id] || previewPlaybackStates[sourceStage.id];
                            const interp = getInterpolatedLayerStyles(
                                l, 
                                pb?.currentTime || 0, 
                                sourceStage.duration || 10, 
                                pb?.loopsDone || 0,
                                (sourceStage as any)?.loopCount,
                                (sourceStage as any)?.stopAtSecond,
                                (sourceStage as any)?.feedLoopCount,
                                mode === 'preview',
                                pAuto
                            );
                            
                            const cdx = update.changes.x !== undefined ? update.changes.x - interp.visualX : 0;
                            const cdy = update.changes.y !== undefined ? update.changes.y - interp.visualY : 0;
                            const cdw = update.changes.width !== undefined ? update.changes.width - interp.width : 0;
                            const cdh = update.changes.height !== undefined ? update.changes.height - interp.height : 0;

                            const cdr = update.changes.rotation !== undefined ? update.changes.rotation - interp.rotation : 0;

                            newNameStateMap.set(l.name, { 
                                x: interp.visualX + cdx, 
                                y: interp.visualY + cdy, 
                                w: interp.width + cdw, 
                                h: interp.height + cdh,
                                r: interp.rotation + cdr
                            });
                        }
                        if (l.children) {
                            let isAuto = false;
                            try {
                                const m = JSON.parse(l.variant || '{}');
                                isAuto = l.type === 'group' && m.layoutMode === 'auto';
                            } catch(_) {}
                            findAndMap(l.children, isAuto);
                        }
                    });
                };
                findAndMap(sourceStage.layers);
            }
        }
    }

    setStages(prevStages => {
      const layerIdsSet = new Set(layerIds);
      const hasUpdatedDescendant = (layer: Layer): boolean =>
        layerIdsSet.has(layer.id) || !!(layer.children && layer.children.some(hasUpdatedDescendant));

      const updateRecursive = (layers: Layer[], currentStage: Stage, isTopLevel = true, isParentAuto = false): Layer[] => {
        return layers.map(layer => {
          const update = updates.find(u => u.id === layer.id);
          const isTargeted = !!update;
          const shouldSyncLayer = isSyncEnabled && namesToSync.has(layer.name);
          
          let updatedLayer = { ...layer };

          if (isTargeted || shouldSyncLayer) {
            const isCustomMode = !!(layer.animation && 
                              layer.animation.entry.duration === 0 && 
                              layer.animation.main.duration === 0 && 
                              layer.animation.exit.duration === 0);

            const pb = playbackStates[currentStage.id] || previewPlaybackStates[currentStage.id];
            const timeInUnits = Math.round((pb?.currentTime || 0) * 100);

            const interp = getInterpolatedLayerStyles(
                layer,
                pb?.currentTime || 0,
                currentStage.duration || 10,
                pb?.loopsDone || 0,
                (currentStage as any)?.loopCount,
                (currentStage as any)?.stopAtSecond,
                (currentStage as any)?.feedLoopCount,
                mode === 'preview',
                isParentAuto
            );

            let currentChanges = update ? { ...update.changes } : {};
            if ((currentChanges as any).width !== undefined && (Number((currentChanges as any).width) <= 0 || !Number.isFinite((currentChanges as any).width))) (currentChanges as any).width = Math.max(1, Number(layer.width) || 0);
            if ((currentChanges as any).height !== undefined && (Number((currentChanges as any).height) <= 0 || !Number.isFinite((currentChanges as any).height))) (currentChanges as any).height = Math.max(1, Number(layer.height) || 0);

            if (shouldSyncLayer && sourceStageInfo) {
                const stateInSource = newNameStateMap.get(layer.name);
                if (stateInSource) {
                    const sw = sourceStageInfo.width;
                    const sh = sourceStageInfo.height;
                    const tw = currentStage.width;
                    const th = currentStage.height;
                    const commonScale = Math.min(tw / sw, th / sh);

                    const scaleX = (x: number, isTopX: boolean) => {
                        if (!isTopX) return x * commonScale;
                        if (x < sw * 0.35) return x * commonScale;
                        if (x > sw * 0.65) return tw - (sw - x) * commonScale;
                        return (tw / 2) + (x - sw / 2) * commonScale;
                    };
                    const scaleY = (y: number, isTopY: boolean) => {
                        if (!isTopY) return y * commonScale;
                        if (y < sh * 0.35) return y * commonScale;
                        if (y > sh * 0.65) return th - (sh - y) * commonScale;
                        return (th / 2) + (y - sh / 2) * commonScale;
                    };

                    currentChanges.x = scaleX(stateInSource.x, isTopLevel);
                    currentChanges.y = scaleY(stateInSource.y, isTopLevel);
                    currentChanges.rotation = stateInSource.r;

                    const anyUpdate = updates[0]?.changes; // All updates in batch usually share spatial property presence
                    if (anyUpdate?.width !== undefined) currentChanges.width = stateInSource.w * commonScale;
                    if (anyUpdate?.height !== undefined) currentChanges.height = stateInSource.h * commonScale;
                }
            }

            let cdx = 0;
            let cdy = 0;
            let cdw = 0;
            let cdh = 0;
            let cdr = 0;

            if (currentChanges.animation !== undefined) {
                // If animation is explicitly provided, treatment is absolute.
                updatedLayer = { 
                    ...layer, 
                    ...currentChanges
                };
            } else if ((update as any)?.absoluteLocal) {
                // Transform system sends final local x,y (parent space). Do not convert via visual delta – use as-is (grup içi atlama önlenir).
                let w = (currentChanges as any).width !== undefined ? (currentChanges as any).width : layer.width;
                let h = (currentChanges as any).height !== undefined ? (currentChanges as any).height : layer.height;
                if (Number(w) <= 0 || !Number.isFinite(w)) w = Math.max(1, Number(layer.width) || 0);
                if (Number(h) <= 0 || !Number.isFinite(h)) h = Math.max(1, Number(layer.height) || 0);
                
                cdx = (currentChanges as any).x !== undefined ? (currentChanges as any).x - layer.x : 0;
                cdy = (currentChanges as any).y !== undefined ? (currentChanges as any).y - layer.y : 0;
                cdw = (currentChanges as any).width !== undefined ? w - layer.width : 0;
                cdh = (currentChanges as any).height !== undefined ? h - layer.height : 0;
                cdr = (currentChanges as any).rotation !== undefined ? (currentChanges as any).rotation - (layer.rotation ?? 0) : 0;

                updatedLayer = {
                    ...layer,
                    ...currentChanges,
                    x: (currentChanges as any).x !== undefined ? (currentChanges as any).x : layer.x,
                    y: (currentChanges as any).y !== undefined ? (currentChanges as any).y : layer.y,
                    width: w,
                    height: h,
                    rotation: (currentChanges as any).rotation !== undefined ? (currentChanges as any).rotation : (layer.rotation ?? 0)
                };
            } else {
                cdx = (currentChanges as any).x !== undefined ? (currentChanges as any).x - interp.visualX : 0;
                cdy = (currentChanges as any).y !== undefined ? (currentChanges as any).y - interp.visualY : 0;
                cdw = (currentChanges as any).width !== undefined ? (currentChanges as any).width - interp.width : 0;
                cdh = (currentChanges as any).height !== undefined ? (currentChanges as any).height - interp.height : 0;
                cdr = (currentChanges as any).rotation !== undefined ? (currentChanges as any).rotation - interp.rotation : 0;
                const newW = Number(layer.width) + cdw;
                const newH = Number(layer.height) + cdh;

                updatedLayer = { 
                    ...layer, 
                    ...currentChanges,
                    x: layer.x + cdx,
                    y: layer.y + cdy,
                    width: (newW <= 0 || !Number.isFinite(newW)) ? Math.max(1, Number(layer.width) || 0) : newW,
                    height: (newH <= 0 || !Number.isFinite(newH)) ? Math.max(1, Number(layer.height) || 0) : newH,
                    rotation: (layer.rotation || 0) + cdr
                };

                // Compensation for origin shift when transformation origin changes (non-batch spatial only)
                if (currentChanges.transformOrigin !== undefined) {
                    const afterInterp = getInterpolatedLayerStyles(
                        { ...layer, ...currentChanges },
                        pb?.currentTime || 0,
                        currentStage.duration || 10,
                        pb?.loopsDone || 0,
                        (currentStage as any)?.loopCount || -1,
                        (currentStage as any)?.stopAtSecond,
                        (currentStage as any)?.feedLoopCount || -1,
                        mode === 'preview',
                        !isTopLevel
                    );
                    
                    const originJumpX = afterInterp.visualX - interp.visualX;
                    const originJumpY = afterInterp.visualY - interp.visualY;
                    
                    updatedLayer.x -= originJumpX;
                    updatedLayer.y -= originJumpY;
                }
            }

            if (isCustomMode && layer.animation && currentChanges.animation === undefined) {
                const kfs = [...(layer.animation.keyframes || [])];
                const existingIdx = kfs.findIndex(k => Math.abs(k.time - timeInUnits) < 5);
                
                if (existingIdx !== -1) {
                    kfs[existingIdx] = { 
                        ...kfs[existingIdx], 
                        props: { 
                            ...kfs[existingIdx].props, 
                            ...currentChanges,
                            x: updatedLayer.x,
                            y: updatedLayer.y,
                            width: updatedLayer.width,
                            height: updatedLayer.height,
                            rotation: updatedLayer.rotation
                        } 
                    };
                        updatedLayer.animation = { 
                            entry: layer.animation.entry,
                            main: layer.animation.main,
                            exit: layer.animation.exit,
                            keyframes: kfs.sort((a, b) => a.time - b.time) 
                        };
                    } else if (timeInUnits > 0 && (cdx !== 0 || cdy !== 0 || cdw !== 0 || cdh !== 0 || cdr !== 0)) {
                        // Relative shift for all keyframes
                        updatedLayer.animation = {
                            entry: layer.animation.entry,
                            main: layer.animation.main,
                            exit: layer.animation.exit,
                            keyframes: kfs.map(kf => ({
                                ...kf,
                                props: {
                                    ...kf.props,
                                    x: (kf.props.x !== undefined ? kf.props.x + cdx : undefined),
                                    y: (kf.props.y !== undefined ? kf.props.y + cdy : undefined),
                                    width: (kf.props.width !== undefined ? kf.props.width + cdw : undefined),
                                    height: (kf.props.height !== undefined ? kf.props.height + cdh : undefined),
                                    rotation: (kf.props.rotation !== undefined ? kf.props.rotation + cdr : undefined),
                                }
                            }))
                        };
                    } else if (timeInUnits === 0) {
                        const existing0Idx = kfs.findIndex(k => k.time === 0);
                        const kfProps = { 
                            x: updatedLayer.x, 
                            y: updatedLayer.y, 
                            width: updatedLayer.width, 
                            height: updatedLayer.height, 
                            rotation: updatedLayer.rotation, 
                            opacity: updatedLayer.opacity ?? 1 
                        };
                        if (existing0Idx !== -1) kfs[existing0Idx] = { ...kfs[existing0Idx], props: { ...kfs[existing0Idx].props, ...kfProps } };
                        else kfs.push({ id: `kf_0_${Math.random().toString(36).substring(2, 7)}`, time: 0, props: kfProps });
                        updatedLayer.animation = { 
                            entry: layer.animation.entry,
                            main: layer.animation.main,
                            exit: layer.animation.exit,
                            keyframes: kfs.sort((a, b) => a.time - b.time) 
                        };
                    }
                }

                if (updatedLayer.type === 'group' && updatedLayer.children && (cdw !== 0 || cdh !== 0)) {
                    let isAutoLayoutHug = false;
                    try {
                      const groupMeta = JSON.parse(updatedLayer.variant || '{}');
                      isAutoLayoutHug = groupMeta.layoutMode === 'auto';
                    } catch (_) {}

                    if (!isAutoLayoutHug) {
                        const rx = interp.width > 0 ? (interp.width + cdw) / interp.width : 1;
                        const ry = interp.height > 0 ? (interp.height + cdh) / interp.height : 1;
                        if (rx !== 1 || ry !== 1) {
                            const layerChanges = new Map<string, any>();
                            collectDescendantScaleUpdates(updatedLayer.children, rx, ry, layerChanges, updatedLayer.children);
                            
                            const applyChildrenChanges = (layers: Layer[]): Layer[] => {
                                return layers.map(l => {
                                    const changes = layerChanges.get(l.id);
                                    let up = changes ? { ...l, ...changes } : l;
                                    if (up.children) up.children = applyChildrenChanges(up.children);
                                    return up;
                                });
                            };
                            updatedLayer.children = applyChildrenChanges(updatedLayer.children);

                            const { x, y, width, height, ...groupStyleUpdates } = calculateLayerScaleUpdates(updatedLayer, rx, ry);
                        updatedLayer = { ...updatedLayer, ...groupStyleUpdates };
                    }
                }
            }

          }

          if (updatedLayer.children) {
            let isAuto = false;
            try {
              const m = JSON.parse(updatedLayer.variant || '{}');
              isAuto = updatedLayer.type === 'group' && m.layoutMode === 'auto';
            } catch(_) {}
            updatedLayer.children = updateRecursive(updatedLayer.children, currentStage, false, isAuto);
          }

          // Group boundary recalculation from children: skip for auto-layout groups as they manage themselves via responsive logic
          // Also skip if THIS specific group is being explicitly transformed by an absolute controller to prevent fighting.
          const isTargetedByAbsoluteTransform = isTargeted && (update as any)?.absoluteLocal;
          if (updatedLayer.type === 'group' && updatedLayer.children && updatedLayer.children.length > 0 && 
              hasUpdatedDescendant(updatedLayer) && !isTargetedByAbsoluteTransform) {
            let isAuto = false;
            try {
              const m = JSON.parse(updatedLayer.variant || '{}');
              isAuto = updatedLayer.type === 'group' && m.layoutMode === 'auto';
            } catch(_) {}

            const b = !isAuto ? computeGroupBoundsFromChildren(updatedLayer.children) : null;
            if (b && b.maxX > b.minX && b.maxY > b.minY) {
              const oldW = Number(updatedLayer.width) || 0;
              const oldH = Number(updatedLayer.height) || 0;
              const newTightW = Math.max(1, b.maxX - b.minX);
              const newTightH = Math.max(1, b.maxY - b.minY);

              if (isTransformBatch && !isTargeted) {
                // Restricted Resize Mode: Only expand Right/Bottom to keep Top-Left stationary.
                // This prevents feedback loops because the origin (Top-Left) never moves.
                const needsExpandR = b.maxX > oldW;
                const needsExpandB = b.maxY > oldH;
                if (needsExpandR || needsExpandB) {
                  const newW = Math.max(oldW, b.maxX);
                  const newH = Math.max(oldH, b.maxY);
                  
                  // Movement of Center to accommodate Right/Bottom growth
                  const centerShiftX = (newW - oldW) / 2;
                  const centerShiftY = (newH - oldH) / 2;

                  const rad = (Number(updatedLayer.rotation) || 0) * (Math.PI / 180);
                  const cos = Math.cos(rad);
                  const sin = Math.sin(rad);
                  // Group's own scale must be accounted for when projecting to parent space
                  const gsx = Number(updatedLayer.scaleX ?? 1);
                  const gsy = Number(updatedLayer.scaleY ?? 1);
                  const parentShiftX = (centerShiftX * gsx) * cos - (centerShiftY * gsy) * sin;
                  const parentShiftY = (centerShiftX * gsx) * sin + (centerShiftY * gsy) * cos;

                  console.log(`[GroupDragSync] ID: ${updatedLayer.id} Name: ${updatedLayer.name}`);
                  console.log(` -> Size: ${oldW.toFixed(1)}x${oldH.toFixed(1)} -> ${newW.toFixed(1)}x${newH.toFixed(1)}`);
                  console.log(` -> CenterMove(World): (${parentShiftX.toFixed(2)}, ${parentShiftY.toFixed(2)})`);

                  updatedLayer = {
                    ...updatedLayer,
                    x: (Number(updatedLayer.x) || 0) + parentShiftX,
                    y: (Number(updatedLayer.y) || 0) + parentShiftY,
                    width: newW,
                    height: newH
                  };
                }
              } else {
                // Full Tight Fit (End of drag or Property bar edit):
                // 1. Calculate how much the center point moves relative to the OLD center.
                const centerShiftX = (b.minX + b.maxX) / 2 - oldW / 2;
                const centerShiftY = (b.minY + b.maxY) / 2 - oldH / 2;

                const rad = (Number(updatedLayer.rotation) || 0) * (Math.PI / 180);
                const cos = Math.cos(rad);
                const sin = Math.sin(rad);
                const gsx = Number(updatedLayer.scaleX ?? 1);
                const gsy = Number(updatedLayer.scaleY ?? 1);
                const parentShiftX = (centerShiftX * gsx) * cos - (centerShiftY * gsy) * sin;
                const parentShiftY = (centerShiftX * gsx) * sin + (centerShiftY * gsy) * cos;

                console.log(`[GroupFinal] ID: ${updatedLayer.id} Name: ${updatedLayer.name}`);
                console.log(` -> BBox: min(${b.minX.toFixed(1)}, ${b.minY.toFixed(1)}) max(${b.maxX.toFixed(1)}, ${b.maxY.toFixed(1)})`);
                console.log(` -> CenterShift(Local): (${centerShiftX.toFixed(2)}, ${centerShiftY.toFixed(2)})`);

                // 2. Map children to the new Top-Left (minX, minY).
                const children = updatedLayer.children;
                const updatedChildren = children ? children.map((c: Layer) => ({
                  ...c,
                  x: (Number(c.x) ?? 0) - b.minX,
                  y: (Number(c.y) ?? 0) - b.minY
                })) : children;

                updatedLayer = {
                  ...updatedLayer,
                  x: (Number(updatedLayer.x) || 0) + parentShiftX,
                  y: (Number(updatedLayer.y) || 0) + parentShiftY,
                  width: newTightW,
                  height: newTightH,
                  children: updatedChildren
                };
              }
            }
          }

          return updatedLayer;
        });
      };

      return prevStages.map(stage => ({
        ...stage,
        layers: updateRecursive(stage.layers, stage, true, false)
      }));
    });

    broadcastAction({
      type: 'BATCH_NODE_UPDATE',
      updates,
      senderName: userNameRef.current
    });
  };

  const handleRenameLayer = (layerId: string, newName: string) => {
    handleUpdateLayers([layerId], { name: newName });
  };


  const handleReorderLayers = (stageId: string, layerIds: string[], parentId?: string) => {
    setStages(prev => prev.map(stage => {
      if (stage.id !== stageId) return stage;
      
      const updateRecursive = (layers: Layer[]): Layer[] => {
        // If no parentId, we are reordering at the top level of the stage
        if (!parentId) {
          const updatedLayers = layers.map(layer => {
            const newIndex = layerIds.indexOf(layer.id);
            if (newIndex === -1) return layer;
            return { ...layer, zIndex: layerIds.length - newIndex };
          });
          // Also physically reorder the array based on zIndex descending (Topmost first)
          return updatedLayers.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
        }

        // If parentId is specified, we need to find that group and reorder its children
        return layers.map(layer => {
          if (layer.id === parentId && layer.children) {
            const updatedChildren = layer.children.map(child => {
              const newIndex = layerIds.indexOf(child.id);
              if (newIndex === -1) return child;
              return { ...child, zIndex: layerIds.length - newIndex };
            });
            // Also physically reorder the children array based on zIndex descending
            return { ...layer, children: updatedChildren.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)) };
          }
          if (layer.children) {
            return { ...layer, children: updateRecursive(layer.children) };
          }
          return layer;
        });
      };

      return { ...stage, layers: updateRecursive(stage.layers) };
    }));
  };

  const handleUpdateStageMarkers = (stageId: string, markers: TimelineMarker[]) => {
    console.log(`[App] handleUpdateStageMarkers for ${stageId}, markers:`, markers.length);
    setStages(prev => {
      const updated = prev.map(stage => 
        stage.id === stageId ? { ...stage, markers } : stage
      );
      if (updated.find(s => s.id === stageId)?.markers) {
        console.log(`[App] State update success for ${stageId}`);
      } else {
        console.error(`[App] FAILED to find stage ${stageId} in state!`, prev.map(s => s.id));
      }
      return updated;
    });
  };

  const handleUpdateLayerAnimation = (layerId: string, updates: Partial<Layer['animation']> | null) => {
    if (updates === null) {
      handleUpdateLayers([layerId], { animation: null as any });
      return;
    }

    // Find the current layer to get its current animation state
    let currentAnim: any = null;
    const findInStages = (stgs: Stage[]): any | null => {
      const findRec = (ls: Layer[]): any | null => {
        for (const l of ls) {
          if (l.id === layerId) return l.animation;
          if (l.children) {
            const f = findRec(l.children);
            if (f) return f;
          }
        }
        return null;
      };
      for (const s of stgs) {
        const f = findRec(s.layers);
        if (f) return f;
      }
      return null;
    };
    
    currentAnim = findInStages(stages) || {};
    
    handleUpdateLayers([layerId], { 
      animation: { 
        ...currentAnim, 
        ...updates 
      } 
    });
  };

  const handleUpdateTextAnimation = (layerId: string, updates: Partial<Layer['textAnimation']> | null) => {
    if (updates === null) {
      handleUpdateLayers([layerId], { textAnimation: null as any });
      return;
    }

    let currentAnim: any = null;
    const findInStages = (stgs: Stage[]): any | null => {
      const findRec = (ls: Layer[]): any | null => {
        for (const l of ls) {
          if (l.id === layerId) return l.textAnimation;
          if (l.children) {
            const f = findRec(l.children);
            if (f) return f;
          }
        }
        return null;
      };
      for (const s of stgs) {
        const f = findRec(s.layers);
        if (f) return f;
      }
      return null;
    };
    
    currentAnim = findInStages(stages) || {};
    
    handleUpdateLayers([layerId], { 
      textAnimation: { 
        ...currentAnim, 
        ...updates 
      } 
    });
  };

  const handleCopyAnimation = (layerId: string) => {
    const findLayer = (layers: Layer[]): Layer | null => {
      for (const l of layers) {
        if (l.id === layerId) return l;
        if (l.children) {
          const found = findLayer(l.children);
          if (found) return found;
        }
      }
      return null;
    };

    let foundLayer: Layer | null = null;
    for (const stage of stages) {
        foundLayer = findLayer(stage.layers);
        if (foundLayer) break;
    }

    if (foundLayer?.animation) {
      const data = JSON.parse(JSON.stringify(foundLayer.animation));
      setAnimationClipboard(data);
      try {
        navigator.clipboard.writeText(JSON.stringify({ type: 'AD_CROPPER_ANIMATION', data }));
      } catch (e) {
        console.error('Clipboard write failed', e);
      }
    }
  };

  const handlePasteAnimation = async (layerId: string) => {
    let targetData = animationClipboard;

    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (parsed.type === 'AD_CROPPER_ANIMATION') {
        targetData = parsed.data;
        setAnimationClipboard(targetData); // Sync local state
      }
    } catch (e) {
      // Use internal state if clipboard and JSON parsing fail
    }

    if (!targetData) return;
    const clipboard = targetData;

    setStages(prev => prev.map(stage => {
      let layerFound = false;

      const updateRecursive = (layers: Layer[]): Layer[] => {
        return layers.map(l => {
          if (l.id === layerId) {
            layerFound = true;
            const pastedAnim = JSON.parse(JSON.stringify(clipboard));
            // Remove x, y, width, height from keyframes and generate NEW IDs to avoid shared selection
            if (pastedAnim.keyframes) {
              pastedAnim.keyframes = pastedAnim.keyframes.map((kf: any) => {
                const { x, y, width, height, ...restProps } = kf.props;
                return { 
                  ...kf, 
                  id: `kf_${Math.random().toString(36).substring(2, 11)}`, 
                  props: restProps 
                };
              });
            }
            return { ...l, animation: pastedAnim };
          }
          if (l.children) {
            const updatedChildren = updateRecursive(l.children);
            if (layerFound) return { ...l, children: updatedChildren };
          }
          return l;
        });
      };

      const newLayers = updateRecursive(stage.layers);
      if (!layerFound) return stage;

      let maxEndTimeSecs = 0;
      if (clipboard.exit) {
        maxEndTimeSecs = (clipboard.exit.start + clipboard.exit.duration) / 100;
      }

      const newDuration = Math.max(stage.duration, Math.ceil(maxEndTimeSecs));

      return { ...stage, duration: newDuration, layers: newLayers };
    }));
  };

  const handleCopyLayer = (layerId: string) => {
    const findLayer = (layers: Layer[]): Layer | null => {
      for (const l of layers) {
        if (l.id === layerId) return l;
        if (l.children) {
          const found = findLayer(l.children);
          if (found) return found;
        }
      }
      return null;
    };

    let foundLayer: Layer | null = null;
    for (const stage of stages) {
        foundLayer = findLayer(stage.layers);
        if (foundLayer) break;
    }

    if (foundLayer) {
      const data = JSON.parse(JSON.stringify(foundLayer));
      setLayerClipboard(data);
      try {
        navigator.clipboard.writeText(JSON.stringify({ type: 'AD_CROPPER_LAYER', data }));
      } catch (e) {
        console.error('Clipboard write failed', e);
      }
    }
  };

  const handlePasteLayer = async (stageId: string, x?: number, y?: number) => {
    let targetData = layerClipboard;

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.type === 'AD_CROPPER_LAYER') {
            targetData = parsed.data;
            setLayerClipboard(targetData); // Sync local state
          }
        } catch (jsonErr) {
          // Not a native layer JSON, but we have text. 
          // Create a new text layer from this external text!
          if (text.trim().length > 0) {
            handleDropOnWorkspace(text, 'text', { label: text.trim() }, x, y, stageId);
            return;
          }
        }
      }
    } catch (e) {
      // Clipboard access denied or other error
    }

    if (!targetData) return;
    const clipboard = targetData;

    setStages(prev => prev.map(stage => {
      if (stage.id !== stageId) return stage;

      const newLayer = JSON.parse(JSON.stringify(clipboard));
      
      const reassignIds = (layer: Layer) => {
        const oldId = layer.id;
        const prefix = oldId.split('_')[0];
        layer.id = generateShortId(prefix);
        layer.name = layer.id;
        if (layer.children) {
          layer.children.forEach(reassignIds);
        }
        if (layer.animation?.keyframes) {
            layer.animation.keyframes.forEach(kf => {
                kf.id = `kf_${Math.random().toString(36).substring(2, 11)}`;
            });
        }
      };
      
      reassignIds(newLayer);

      const oldX = newLayer.x;
      const oldY = newLayer.y;

      if (x !== undefined && y !== undefined) {
        newLayer.x = x;
        newLayer.y = y;
      } else {
        newLayer.x += 30;
        newLayer.y += 30;
      }

      const dx = newLayer.x - oldX;
      const dy = newLayer.y - oldY;

      if ((dx !== 0 || dy !== 0) && newLayer.animation?.keyframes) {
        newLayer.animation.keyframes.forEach((kf: any) => {
          if (kf.props.x !== undefined) kf.props.x += dx;
          if (kf.props.y !== undefined) kf.props.y += dy;
        });
      }

      return {
        ...stage,
        layers: [...stage.layers, newLayer]
      };
    }));
  };

  const handleDuplicateLayers = (stageId: string, layerIds: string[], offset: { x: number, y: number } = { x: 30, y: 30 }, updateSelection: boolean = true): Record<string, string> => {
    pushToHistory();
    const newIds: string[] = [];
    const idMap: Record<string, string> = {};
    
    const nextStages = stages.map(stage => {
      if (stage.id !== stageId) return stage;

      const isDescendantOfSelected = (id: string, selectedIds: string[]): boolean => {
        const path = findPath(stage.layers, id);
        if (!path) return false;
        return path.slice(0, -1).some(ancestorId => selectedIds.includes(ancestorId));
      };
      
      const rootsToDuplicate = layerIds.filter(id => !isDescendantOfSelected(id, layerIds));

      const duplicateRecursive = (layers: Layer[]): Layer[] => {
        const result: Layer[] = [];
        
        let maxZIndex = 0;
        layers.forEach(l => {
          const z = typeof l.zIndex === 'number' ? l.zIndex : 0;
          if (z > maxZIndex) maxZIndex = z;
        });

        let nextZIndex = maxZIndex + 1;

        for (const layer of layers) {
          if (rootsToDuplicate.includes(layer.id)) {
            const originalId = layer.id;
            const clone: Layer = JSON.parse(JSON.stringify(layer));
            const reassignIds = (l: Layer) => {
              const prefix = l.id.split('_')[0];
              const newId = generateShortId(prefix);
              if (l.id === clone.id) {
                newIds.push(newId);
                idMap[originalId] = newId;
              }
              l.id = newId;
              l.name = l.id;
              if (l.children) l.children.forEach(reassignIds);
              if (l.animation?.keyframes) {
                l.animation.keyframes.forEach(kf => {
                  kf.id = `kf_${Math.random().toString(36).substring(2, 11)}`;
                });
              }
            };
            reassignIds(clone);

            clone.zIndex = nextZIndex++;
            clone.x += offset.x;
            clone.y += offset.y;

            if ((offset.x !== 0 || offset.y !== 0) && clone.animation?.keyframes) {
              clone.animation.keyframes.forEach((kf: any) => {
                const dx = offset.x;
                const dy = offset.y;
                if (kf.props.x !== undefined) kf.props.x += dx;
                if (kf.props.y !== undefined) kf.props.y += dy;
              });
            }
            
            if (offset.x === 0 && offset.y === 0) {
              result.push(clone);
              result.push(layer);
            } else {
              result.push(layer);
              result.push(clone);
            }
          } else {
            if (layer.children) {
              result.push({ ...layer, children: duplicateRecursive(layer.children) });
            } else {
              result.push(layer);
            }
          }
        }
        return result;
      };

      return {
        ...stage,
        layers: duplicateRecursive(stage.layers)
      };
    });

    setStages(nextStages);

    if (updateSelection && newIds.length > 0) {
      handleLayersSelect(newIds, stageId);
    }

    return idMap;
  };

  const handleGroupLayers = (stageId: string, layerIds: string[]) => {
    pushToHistory();
    setStages(prev => prev.map(stage => {
      if (stage.id !== stageId) return stage;

      // 1. Find all selected layers recursively with their world-space positions
      let maxSelectedZ = -Infinity;
      const selectedLayersWithWorldCoords: Array<{ layer: Layer, wx: number, wy: number, wr: number }> = [];
      const findAndExtract = (layers: Layer[], px = 0, py = 0, pr = 0, pw = 0, ph = 0, psx = 1, psy = 1): Layer[] => {
        const remaining: Layer[] = [];
        layers.forEach(l => {
          const rad = pr * (Math.PI / 180);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          
          const relX = (l.x - pw/2) * psx;
          const relY = (l.y - ph/2) * psy;
          const wx = px + (relX * cos - relY * sin);
          const wy = py + (relX * sin + relY * cos);
          const wr = pr + l.rotation;

          if (layerIds.includes(l.id)) {
            selectedLayersWithWorldCoords.push({ layer: l, wx, wy, wr });
            if (l.zIndex > maxSelectedZ) maxSelectedZ = l.zIndex;
          } else {
            let processedLayer = l;
              const csx = Number(l.scaleX ?? (l as any).scale ?? 1);
              const csy = Number(l.scaleY ?? (l as any).scale ?? 1);
              processedLayer = { ...l, children: findAndExtract(l.children || [], wx, wy, wr, l.width, l.height, psx * csx, psy * csy) };
            remaining.push(processedLayer);
          }
        });
        return remaining;
      };

      let finalLayers = findAndExtract(stage.layers);
      const selected = selectedLayersWithWorldCoords;

      if (selected.length === 0) return stage;

      // 2. Calculate World Bounds (using corners of all selected layers)
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selected.forEach(({ layer: l, wx, wy, wr }) => {
        const hw = l.width / 2;
        const hh = l.height / 2;
        const rad = wr * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const corners = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
        corners.forEach(c => {
          const cx = wx + (c.x * cos - c.y * sin);
          const cy = wy + (c.x * sin + c.y * cos);
          minX = Math.min(minX, cx);
          minY = Math.min(minY, cy);
          maxX = Math.max(maxX, cx);
          maxY = Math.max(maxY, cy);
        });
      });

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const width = maxX - minX;
      const height = maxY - minY;

      const groupId = generateShortId('group');

      // 3. Prepare variables for local positioning if we are inside an active group
      let localX = centerX;
      let localY = centerY;
      let localRot = 0;
      let targetZIndex = 1;

      if (activeGroupId) {
        // Find the active group's parent/context info
        const findParentInfo = (layers: Layer[], targetId: string, px = 0, py = 0, pr = 0, pw = 0, ph = 0, psx = 1, psy = 1): { wx: number, wy: number, wr: number, ww: number, wh: number, wsx: number, wsy: number } | null => {
          for (const l of layers) {
            const rad = pr * (Math.PI / 180);
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const relX = (l.x - pw/2) * psx;
            const relY = (l.y - ph/2) * psy;
            const wx = px + (relX * cos - relY * sin);
            const wy = py + (relX * sin + relY * cos);
            const wr = pr + l.rotation;
            const csx = Number(l.scaleX ?? (l as any).scale ?? 1);
            const csy = Number(l.scaleY ?? (l as any).scale ?? 1);
            
            if (l.id === targetId) return { wx, wy, wr, ww: l.width, wh: l.height, wsx: psx * csx, wsy: psy * csy };
            if (l.children) {
              const res = findParentInfo(l.children, targetId, wx, wy, wr, l.width, l.height, psx * csx, psy * csy);
              if (res) return res;
            }
          }
          return null;
        };

        const activeGroupInfo = findParentInfo(stage.layers, activeGroupId);
        if (activeGroupInfo) {
          const prad = -activeGroupInfo.wr * (Math.PI / 180);
          const pcos = Math.cos(prad);
          const psin = Math.sin(prad);
          const dx = centerX - activeGroupInfo.wx;
          const dy = centerY - activeGroupInfo.wy;
          
          localX = ((dx * pcos - dy * psin) / activeGroupInfo.wsx) + activeGroupInfo.ww / 2;
          localY = ((dx * psin + dy * pcos) / activeGroupInfo.wsy) + activeGroupInfo.wh / 2;
          localRot = 0 - activeGroupInfo.wr;
        }
      }

      const newGroup: Layer = {
        id: groupId,
        name: groupId,
        type: 'group',
        x: localX,
        y: localY,
        width,
        height,
        rotation: localRot,
        zIndex: 1, // Will be set during injection
        variant: JSON.stringify({ bgType: 'none' }),
        animation: {
          entry: { start: 0, duration: 50, name: 'none' },
          main: { start: Math.max(50, Math.round((stage.duration * 100) / 2) - 25), duration: 50, name: 'none' },
          exit: { start: Math.max(100, (stage.duration * 100) - 50), duration: 50, name: 'none' }
        },
        children: selected
          .sort((a, b) => (a.layer.zIndex || 0) - (b.layer.zIndex || 0))
          .map(({ layer: l, wx, wy, wr }) => {
            const newX = wx - (centerX - width / 2);
            const newY = wy - (centerY - height / 2);
            const dx = newX - l.x;
            const dy = newY - l.y;
            const dr = wr - l.rotation;

            let updatedAnimation = l.animation;
            if (l.animation?.keyframes) {
              updatedAnimation = {
                ...l.animation,
                keyframes: l.animation.keyframes.map(kf => ({
                  ...kf,
                  props: {
                    ...kf.props,
                    x: kf.props.x !== undefined ? kf.props.x + dx : undefined,
                    y: kf.props.y !== undefined ? kf.props.y + dy : undefined,
                    rotation: kf.props.rotation !== undefined ? kf.props.rotation + dr : undefined,
                  }
                }))
              };
            }

            return {
              ...l,
              x: newX,
              y: newY,
              rotation: wr,
              animation: updatedAnimation
            };
          })
      };

      // 4. Inject the group back where it belongs
      const injectRecursive = (layers: Layer[]): Layer[] => {
        const finalZ = maxSelectedZ === -Infinity ? 1 : maxSelectedZ;
        const groupToInject = { ...newGroup, zIndex: finalZ };

        // If we have an active group, we want to inject into it
        if (activeGroupId) {
          return layers.map(l => {
            if (l.id === activeGroupId) {
              return { ...l, children: [...(l.children || []), groupToInject] };
            }
            if (l.children) return { ...l, children: injectRecursive(l.children) };
            return l;
          });
        }

        // Default behavior: find where to insert in the root or current level
        // We'll insert it at the end for now, but with the correct zIndex
        // which will be sorted correctly by the Timeline and Renderers.
        return [...layers, groupToInject];
      };

      // To truly fix the "order in array" issue, we need to know where the highest selected layer was.
      // Let's do a more surgical replacement if they are siblings.
      
      const findAndReplaceInSiblings = (layers: Layer[]): { updated: Layer[], foundSome: boolean } => {
        const selectedIndices: number[] = [];
        layers.forEach((l, idx) => {
          if (layerIds.includes(l.id)) selectedIndices.push(idx);
        });

        if (selectedIndices.length > 0) {
          const lowestIdx = Math.min(...selectedIndices);
          const newLayers = layers.filter(l => !layerIds.includes(l.id));
          // Adjust for removed elements before lowestIdx
          const insertionPoint = lowestIdx - (selectedIndices.filter(i => i < lowestIdx).length);
          const finalZ = maxSelectedZ === -Infinity ? 1 : maxSelectedZ;
          newLayers.splice(insertionPoint, 0, { ...newGroup, zIndex: finalZ });
          return { updated: newLayers, foundSome: true };
        }

        let found = false;
        const updated = layers.map(l => {
          if (l.children && !found) {
            const result = findAndReplaceInSiblings(l.children);
            if (result.foundSome) {
              found = true;
              return { ...l, children: result.updated };
            }
          }
          return l;
        });

        return { updated, foundSome: found };
      };

      const { updated: finalStageLayers, foundSome } = findAndReplaceInSiblings(stage.layers);
      
      setSelectedLayerIds([groupId]);
      return { ...stage, layers: foundSome ? finalStageLayers : injectRecursive(finalLayers) };
    }));
  };

  const handleMoveLayer = (layerId: string, targetParentId: string | null) => {
    setStages(prev => prev.map(stage => {
      // 1. Find the layer and its current world coords
      let foundLayer: Layer | null = null;
      let layerWX = 0, layerWY = 0, layerWR = 0;
      
      const findLayerWorld = (layers: Layer[], px = 0, py = 0, pr = 0, pw = 0, ph = 0): boolean => {
        for (const l of layers) {
          const rad = pr * (Math.PI / 180);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const relX = l.x - pw/2;
          const relY = l.y - ph/2;
          const wx = px + (relX * cos - relY * sin);
          const wy = py + (relX * sin + relY * cos);
          const wr = pr + l.rotation;
          
          if (l.id === layerId) {
            foundLayer = l;
            layerWX = wx;
            layerWY = wy;
            layerWR = wr;
            return true;
          }
          if (l.children && findLayerWorld(l.children, wx, wy, wr, l.width, l.height)) return true;
        }
        return false;
      };

      if (!findLayerWorld(stage.layers)) return stage;

      // Avoid moving a parent into its own child
      const isDescendant = (parent: Layer, id: string): boolean => {
          if (parent.id === id) return true;
          if (parent.children) return parent.children.some(c => isDescendant(c, id));
          return false;
      };
      if (targetParentId && isDescendant(foundLayer!, targetParentId)) return stage;

      // 2. Find target parent world coords
      let targetWX = 0, targetWY = 0, targetWR = 0, targetWW = 0, targetWH = 0;
      if (targetParentId) {
          const findParentWorld = (layers: Layer[], px = 0, py = 0, pr = 0, pw = 0, ph = 0): boolean => {
            for (const l of layers) {
              const rad = pr * (Math.PI / 180);
              const cos = Math.cos(rad);
              const sin = Math.sin(rad);
              const relX = l.x - pw/2;
              const relY = l.y - ph/2;
              const wx = px + (relX * cos - relY * sin);
              const wy = py + (relX * sin + relY * cos);
              const wr = pr + l.rotation;
              
              if (l.id === targetParentId) {
                targetWX = wx;
                targetWY = wy;
                targetWR = wr;
                targetWW = l.width;
                targetWH = l.height;
                return true;
              }
              if (l.children && findParentWorld(l.children, wx, wy, wr, l.width, l.height)) return true;
            }
            return false;
          };
          if (!findParentWorld(stage.layers)) return stage;
      }

      // 3. Project to new parent space
      const prad = -targetWR * (Math.PI / 180);
      const pcos = Math.cos(prad);
      const psin = Math.sin(prad);
      const drx = layerWX - targetWX;
      const dry = layerWY - targetWY;
      const localRelX = drx * pcos - dry * psin;
      const localRelY = drx * psin + dry * pcos;
      
      const newX = localRelX + targetWW / 2;
      const newY = localRelY + targetWH / 2;
      const newRot = layerWR - targetWR;

      const dx = newX - foundLayer!.x;
      const dy = newY - foundLayer!.y;
      const dr = newRot - foundLayer!.rotation;

      const updatedLayer = {
          ...foundLayer!,
          x: newX,
          y: newY,
          rotation: newRot,
          animation: foundLayer!.animation ? {
              ...foundLayer!.animation,
              keyframes: foundLayer!.animation.keyframes?.map(kf => ({
                  ...kf,
                  props: {
                      ...kf.props,
                      x: kf.props.x !== undefined ? kf.props.x + dx : undefined,
                      y: kf.props.y !== undefined ? kf.props.y + dy : undefined,
                      rotation: kf.props.rotation !== undefined ? kf.props.rotation + dr : undefined,
                  }
              }))
          } : foundLayer!.animation
      };

      // 4. Remove from old and add to new
      const removeRecursive = (layers: Layer[]): Layer[] => {
          return layers.filter(l => l.id !== layerId).map(l => ({
              ...l,
              children: l.children ? removeRecursive(l.children) : undefined
          }));
      };

      const addRecursive = (layers: Layer[]): Layer[] => {
          if (!targetParentId) {
              const maxZ = layers.length > 0 ? Math.max(...layers.map(l => l.zIndex)) : 0;
              const newLayers = [...layers, { ...updatedLayer, zIndex: maxZ + 1 }];
              return newLayers.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
          }
          return layers.map(l => {
              if (l.id === targetParentId) {
                  const maxZ = l.children?.length ? Math.max(...l.children.map(c => c.zIndex)) : 0;
                  const newChildren = [...(l.children || []), { ...updatedLayer, zIndex: maxZ + 1 }];
                  return { ...l, children: newChildren.sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0)) };
              }
              if (l.children) return { ...l, children: addRecursive(l.children) };
              return l;
          });
      };

      const stageWithoutLayer = removeRecursive(stage.layers);
      const stageWithLayerMoved = addRecursive(stageWithoutLayer);
      
      setSelectedLayerIds([layerId]);
      return { ...stage, layers: stageWithLayerMoved };
    }));
  };

  const handleAlignLayers = (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'distributeX' | 'distributeY' | 'matchWidth' | 'matchHeight') => {
    pushToHistory();
    if (!selectedStageId || selectedLayerIds.length === 0) return;

    const currentStage = stages.find(s => s.id === selectedStageId);
    if (!currentStage) return;

    const getSelectedWorldLayers = (layers: Layer[], selectedIds: string[]) => {
      const found: Array<{ 
        layer: Layer, 
        worldX: number, 
        worldY: number, 
        worldRotation: number,
        parentWorldX: number,
        parentWorldY: number,
        parentWorldRotation: number,
        parentWidth: number,
        parentHeight: number
      }> = [];

      const traverse = (list: Layer[], px = 0, py = 0, pr = 0, pw = 0, ph = 0) => {
        list.forEach(l => {
          const rad = pr * (Math.PI / 180);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const relX = l.x - pw/2;
          const relY = l.y - ph/2;
          const wx = px + (relX * cos - relY * sin);
          const wy = py + (relX * sin + relY * cos);
          const wr = pr + l.rotation;

          if (selectedIds.includes(l.id)) {
            found.push({ 
              layer: l, 
              worldX: wx, 
              worldY: wy, 
              worldRotation: wr,
              parentWorldX: px,
              parentWorldY: py,
              parentWorldRotation: pr,
              parentWidth: pw,
              parentHeight: ph
            });
          }
          if (l.children) traverse(l.children, wx, wy, wr, l.width, l.height);
        });
      };
      traverse(layers);
      return found;
    };

    const selected = getSelectedWorldLayers(currentStage.layers, selectedLayerIds);
    if (selected.length === 0) return;

    // 1. Calculate AABB for each
    const layerBounds = selected.map(s => {
      const hw = s.layer.width / 2;
      const hh = s.layer.height / 2;
      const rad = s.worldRotation * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const corners = [{x:-hw,y:-hh},{x:hw,y:-hh},{x:hw,y:hh},{x:-hw,y:hh}].map(c => ({
        x: s.worldX + (c.x * cos - c.y * sin),
        y: s.worldY + (c.x * sin + c.y * cos)
      }));
      return {
        id: s.layer.id,
        minX: Math.min(...corners.map(c => c.x)),
        maxX: Math.max(...corners.map(c => c.x)),
        minY: Math.min(...corners.map(c => c.y)),
        maxY: Math.max(...corners.map(c => c.y)),
        centerX: s.worldX,
        centerY: s.worldY,
        width: Math.max(...corners.map(c => c.x)) - Math.min(...corners.map(c => c.x)),
        height: Math.max(...corners.map(c => c.y)) - Math.min(...corners.map(c => c.y)),
        parentWorldRotation: s.parentWorldRotation
      };
    });

    const updates: Array<{ id: string, changes: Partial<Layer> }> = [];

    if (type === 'distributeX' || type === 'distributeY') {
      if (selected.length < 3) return; // Distribute requires at least 3
      
      const isX = type === 'distributeX';
      const sorted = [...layerBounds].sort((a, b) => isX ? a.minX - b.minX : a.minY - b.minY);
      
      const totalSize = isX 
        ? (sorted[sorted.length - 1].maxX - sorted[0].minX)
        : (sorted[sorted.length - 1].maxY - sorted[0].minY);
      
      const combinedItemSize = sorted.reduce((sum, b) => sum + (isX ? b.width : b.height), 0);
      const gap = (totalSize - combinedItemSize) / (sorted.length - 1);

      let currentPos = isX ? sorted[0].minX : sorted[0].minY;
      
      sorted.forEach((b, idx) => {
        if (idx === 0 || idx === sorted.length - 1) {
          currentPos += (isX ? b.width : b.height) + gap;
          return;
        }

        const targetCenter = currentPos + (isX ? b.width : b.height) / 2;
        const dWx = isX ? targetCenter - b.centerX : 0;
        const dWy = !isX ? targetCenter - b.centerY : 0;

        const prad = -b.parentWorldRotation * (Math.PI / 180);
        const pcos = Math.cos(prad);
        const psin = Math.sin(prad);
        const lDx = dWx * pcos - dWy * psin;
        const lDy = dWx * psin + dWy * pcos;

        const layer = selected.find(s => s.layer.id === b.id)?.layer;
        if (layer) {
          updates.push({ id: b.id, changes: { x: layer.x + lDx, y: layer.y + lDy } });
        }
        currentPos += (isX ? b.width : b.height) + gap;
      });
    } else if (type === 'matchWidth' || type === 'matchHeight') {
        const maxWidth = selected.length === 1 ? (selected[0].parentWidth || currentStage.width) : Math.max(...selected.map(s => s.layer.width));
        const maxHeight = selected.length === 1 ? (selected[0].parentHeight || currentStage.height) : Math.max(...selected.map(s => s.layer.height));

        selected.forEach(s => {
            if (type === 'matchWidth') {
                const changes: Partial<Layer> = { width: maxWidth };
                if (selected.length === 1) {
                  // If single selected, center it in the parent
                  changes.x = (s.parentWidth || currentStage.width) / 2;
                }
                updates.push({ id: s.layer.id, changes });
            } else {
                const changes: Partial<Layer> = { height: maxHeight };
                if (selected.length === 1) {
                  // If single selected, center it in the parent
                  changes.y = (s.parentHeight || currentStage.height) / 2;
                }
                updates.push({ id: s.layer.id, changes });
            }
        });
    } else {
      let targetMinX = Math.min(...layerBounds.map(b => b.minX));
      let targetMaxX = Math.max(...layerBounds.map(b => b.maxX));
      let targetMinY = Math.min(...layerBounds.map(b => b.minY));
      let targetMaxY = Math.max(...layerBounds.map(b => b.maxY));

      if (selected.length === 1) {
        const s = selected[0];
        if (s.parentWidth > 0 && s.parentHeight > 0) {
          // Align relative to parent's world AABB
          const phw = s.parentWidth / 2;
          const phh = s.parentHeight / 2;
          const prad = s.parentWorldRotation * (Math.PI / 180);
          const pcos = Math.cos(prad);
          const psin = Math.sin(prad);
          const pCorners = [{x:-phw,y:-phh},{x:phw,y:-phh},{x:phw,y:phh},{x:-phw,y:phh}].map(c => ({
            x: s.parentWorldX + (c.x * pcos - c.y * psin),
            y: s.parentWorldY + (c.x * psin + c.y * pcos)
          }));
          targetMinX = Math.min(...pCorners.map(c => c.x));
          targetMaxX = Math.max(...pCorners.map(c => c.x));
          targetMinY = Math.min(...pCorners.map(c => c.y));
          targetMaxY = Math.max(...pCorners.map(c => c.y));
        } else {
          targetMinX = 0;
          targetMaxX = currentStage.width;
          targetMinY = 0;
          targetMaxY = currentStage.height;
        }
      }

      layerBounds.forEach(b => {
        let dWx = 0, dWy = 0;

        if (type === 'left') dWx = targetMinX - b.minX;
        else if (type === 'center') dWx = (targetMinX + targetMaxX) / 2 - b.centerX;
        else if (type === 'right') dWx = targetMaxX - b.maxX;
        else if (type === 'top') dWy = targetMinY - b.minY;
        else if (type === 'middle') dWy = (targetMinY + targetMaxY) / 2 - b.centerY;
        else if (type === 'bottom') dWy = targetMaxY - b.maxY;

        if (dWx !== 0 || dWy !== 0) {
          const prad = -b.parentWorldRotation * (Math.PI / 180);
          const pcos = Math.cos(prad);
          const psin = Math.sin(prad);
          const lDx = dWx * pcos - dWy * psin;
          const lDy = dWx * psin + dWy * pcos;
          
          const layer = selected.find(s => s.layer.id === b.id)?.layer;
          if (layer) {
            updates.push({ id: b.id, changes: { x: layer.x + lDx, y: layer.y + lDy } });
          }
        }
      });
    }

    if (updates.length > 0) {
      handleBatchUpdateLayers(updates);
    }
  };

  const handleStressTest = () => {
    const currentStage = stages.find(s => s.id === selectedStageId);
    
    if (currentStage) {
      // NEW: If a stage is selected, populate it with ALL entry animations as squares in a grid
      const allEntryAnims = Object.values(animations.start).flat();
      const squareSize = 40;
      const gap = 15;
      const padding = 20;
      const cols = Math.max(1, Math.floor((currentStage.width - padding * 2) / (squareSize + gap)));
      
      const newLayers: Layer[] = allEntryAnims.map((animName, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        
        return {
          id: generateShortId('shape'),
          name: `${animName}`,
          type: 'shape',
          x: padding + col * (squareSize + gap) + squareSize / 2,
          y: padding + row * (squareSize + gap) + squareSize / 2,
          width: squareSize,
          height: squareSize,
          rotation: 0,
          zIndex: idx,
          opacity: 1,
          animation: {
            entry: { name: animName as string, start: 0, duration: 100 }, // 1s duration
            main: { start: 100, duration: 200, name: 'heartbeat' },
            exit: { start: 300, duration: 50, name: 'fade-out' }
          },
          variant: JSON.stringify({
            shapeType: 'square',
            fills: [{ type: 'color', color: '#6366f1', visible: true, opacity: 1 }]
          })
        };
      });

      setStages(prev => prev.map(s => s.id === selectedStageId ? { ...s, layers: newLayers, duration: Math.max(s.duration, 4) } : s));
      setSelectedLayerIds([]);
      setActiveGroupId(null);
    } else {
      // OLD: Default stress test behavior (create many stages)
      const data = generateStressTestData();
      setStages(data);
      setSelectedStageId(data[0].id);
      setSelectedLayerIds([]);
      setActiveGroupId(null);
    }
  };

  const handleTestDataBind = () => {
    const postMessageData = (window as any).postMessageData;
    if (!postMessageData) {
      console.warn('postMessageData not found on window');
      return;
    }

    setStages(prevStages => prevStages.map(stage => {
      const updateLayersRecursive = (layers: Layer[]): Layer[] => {
        return layers.map(layer => {
          let updatedLayer = { ...layer };
          
          // Match by name in dynamicText.texts
          let matchedData: any = null;
          
          // Helper to recursively find texts array and match layer
          const findInDynamicText = (data: any) => {
            if (Array.isArray(data)) {
              data.forEach(item => findInDynamicText(item));
            } else if (data && typeof data === 'object') {
              if (Array.isArray(data.texts)) {
                data.texts.forEach((t: any) => {
                  if (t.name === layer.name) {
                    matchedData = { ...t };
                    // If it's a feed item, try to find values in feedObjects
                    if (t.isFeed === true && t.feedName && Array.isArray(postMessageData.feedObjects)) {
                      const feedObj = postMessageData.feedObjects.find((fo: any) => fo.name === t.feedName);
                      if (feedObj && Array.isArray(feedObj.values)) {
                        matchedData.dynamic = feedObj.values;
                      }
                    }
                  }
                });
              } else if (data.dynamicText) {
                 findInDynamicText(data.dynamicText);
              }
            }
          };

          findInDynamicText(postMessageData.dynamicText);

          if (matchedData) {
            console.log(`Matched layer ${layer.name} with data`, matchedData);
            
            // Get value from dynamic feed if available and required
            let newValue = matchedData.value || '';
            let dynamicData = null;
            
            if (Array.isArray(matchedData.dynamic) && matchedData.dynamic.length > 0) {
              newValue = matchedData.dynamic[0];
              dynamicData = matchedData.dynamic;
            }

            if (newValue) {
              if (layer.type === 'text' || layer.type === 'button') {
                try {
                  const variant = layer.variant ? JSON.parse(layer.variant) : {};
                  variant.label = newValue;
                  if (dynamicData) {
                    variant.dynamicData = dynamicData;
                    variant.isDynamicLoop = true; // Activate dynamic loop if data is provided
                    updatedLayer.isDynamic = true;
                  }
                  updatedLayer.variant = JSON.stringify(variant);
                } catch (e) {
                  console.error('Error updating text/button variant', e);
                }
              } else if (layer.type === 'image' || layer.type === 'video') {
                updatedLayer.url = newValue;
                // For images/videos, we might need a way to store dynamicData too. 
                // Let's use variant for them as well if needed.
                try {
                    const variant = layer.variant ? JSON.parse(layer.variant) : {};
                    if (dynamicData) {
                        variant.dynamicData = dynamicData;
                        variant.isDynamicLoop = true;
                        updatedLayer.isDynamic = true;
                    }
                    updatedLayer.variant = JSON.stringify(variant);
                } catch (e) {}
              }
            }
          }

          if (layer.children && layer.children.length > 0) {
            updatedLayer.children = updateLayersRecursive(layer.children);
          }

          return updatedLayer;
        });
      };

      return {
        ...stage,
        layers: updateLayersRecursive(stage.layers)
      };
    }));
  };

  const handleUngroupLayers = (stageId: string, layerIds: string[], measuredPositions?: Record<string, { x: number, y: number }>) => {
    pushToHistory();
    setStages(prev => prev.map(stage => {
      if (stage.id !== stageId) return stage;

      const layersToInject: Array<{ layers: Layer[], parentId: string | null, siblingId: string }> = [];

      const processRecursive = (layers: Layer[], px = 0, py = 0, pr = 0, pw = 0, ph = 0, psx = 1, psy = 1, parentId: string | null = null): Layer[] => {
        const remaining: Layer[] = [];
        layers.forEach(l => {
          const rad = pr * (Math.PI / 180);
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const relX = (l.x - pw/2) * psx;
          const relY = (l.y - ph/2) * psy;
          
          // Use measured position if available for world coordinate calculation
          const wx = (measuredPositions && measuredPositions[l.id]) 
            ? measuredPositions[l.id].x 
            : px + (relX * cos - relY * sin);
          const wy = (measuredPositions && measuredPositions[l.id]) 
            ? measuredPositions[l.id].y 
            : py + (relX * sin + relY * cos);
          const wr = pr + l.rotation;

          if (layerIds.includes(l.id)) {
            // This layer is being "ungrouped" (either exploded if group, or extracted if child)
            let extractedLayers: Layer[] = [];
            
            if (l.type === 'group' && l.children) {
              // Explode group
              const gsx = Number(l.scaleX ?? (l as any).scale ?? 1);
              const gsy = Number(l.scaleY ?? (l as any).scale ?? 1);

              extractedLayers = l.children.map(child => {
                const crad = l.rotation * (Math.PI / 180);
                const ccos = Math.cos(crad);
                const csin = Math.sin(crad);
                
                // Child's center relative to group's center, multiplied by group's scale
                const crelX = (child.x - l.width/2) * gsx;
                const crelY = (child.y - l.height/2) * gsy;

                // World position of child center
                const cwx = (measuredPositions && measuredPositions[child.id])
                  ? measuredPositions[child.id].x
                  : wx + (crelX * ccos - crelY * csin);
                const cwy = (measuredPositions && measuredPositions[child.id])
                  ? measuredPositions[child.id].y
                  : wy + (crelX * csin + crelY * ccos);
                
                // Inherit scale from group
                const csx = Number(child.scaleX ?? (child as any).scale ?? 1);
                const csy = Number(child.scaleY ?? (child as any).scale ?? 1);
                
                const cwr = wr + child.rotation;

                // Project cwx, cwy back to grandparent space (px, py, pr, pw, ph)
                const prad = -pr * (Math.PI / 180);
                const pcos = Math.cos(prad);
                const psin = Math.sin(prad);
                const drx = cwx - px;
                const dry = cwy - py;
                const localRelX = (drx * pcos - dry * psin) / psx;
                const localRelY = (drx * psin + dry * pcos) / psy;

                const shiftKeyframes = (layer: Layer, dx: number, dy: number, dr: number) => {
                  if (!layer.animation?.keyframes) return layer.animation;
                  return {
                    ...layer.animation,
                    keyframes: layer.animation.keyframes.map(kf => ({
                      ...kf,
                      props: {
                        ...kf.props,
                        x: kf.props.x !== undefined ? kf.props.x + dx : undefined,
                        y: kf.props.y !== undefined ? kf.props.y + dy : undefined,
                        rotation: kf.props.rotation !== undefined ? kf.props.rotation + dr : undefined,
                      }
                    }))
                  };
                };

                const newX = localRelX + pw / 2;
                const newY = localRelY + ph / 2;
                const newRot = cwr - pr;
                
                return {
                  ...child,
                  x: newX,
                  y: newY,
                  scaleX: csx * gsx,
                  scaleY: csy * gsy,
                  rotation: newRot,
                  animation: shiftKeyframes(child, newX - child.x, newY - child.y, newRot - child.rotation),
                  zIndex: l.zIndex + (child.zIndex / 100)
                };
              });
            } else {
              // Extract layer from its parent
              const prad = -pr * (Math.PI / 180);
              const pcos = Math.cos(prad);
              const psin = Math.sin(prad);
              const drx = wx - px;
              const dry = wy - py;
              const localRelX = (drx * pcos - dry * psin) / psx;
              const localRelY = (drx * psin + dry * pcos) / psy;
              
              const newX = localRelX + pw / 2;
              const newY = localRelY + ph / 2;
              const newRot = wr - pr;

              const shiftKeyframes = (layer: Layer, dx: number, dy: number, dr: number) => {
                if (!layer.animation?.keyframes) return layer.animation;
                return {
                  ...layer.animation,
                  keyframes: layer.animation.keyframes.map(kf => ({
                    ...kf,
                    props: {
                      ...kf.props,
                      x: kf.props.x !== undefined ? kf.props.x + dx : undefined,
                      y: kf.props.y !== undefined ? kf.props.y + dy : undefined,
                      rotation: kf.props.rotation !== undefined ? kf.props.rotation + dr : undefined,
                    }
                  }))
                };
              };

              extractedLayers = [{
                ...l,
                x: newX,
                y: newY,
                rotation: newRot,
                animation: shiftKeyframes(l, newX - l.x, newY - l.y, newRot - l.rotation),
                zIndex: l.zIndex + 10 // Basic elevation
              }];
            }

            layersToInject.push({ layers: extractedLayers, parentId, siblingId: l.id });
          } else {
            let processed = l;
              const gsx = Number(l.scaleX ?? (l as any).scale ?? 1);
              const gsy = Number(l.scaleY ?? (l as any).scale ?? 1);
              processed = { ...l, children: processRecursive(l.children || [], wx, wy, wr, l.width, l.height, psx * gsx, psy * gsy, l.id) };
            remaining.push(processed);
          }
        });
        return remaining;
      };

      let finalLayers = processRecursive(stage.layers);

      // Inject extracted layers into their new parents (siblings of their old groups)
      layersToInject.forEach(({ layers: newLayers, parentId, siblingId }) => {
        const inject = (targetLayers: Layer[]): Layer[] => {
          if (parentId === null) {
            // Stage root
            return [...targetLayers, ...newLayers];
          }
          return targetLayers.map(l => {
            if (l.id === parentId) {
              return { ...l, children: [...(l.children || []), ...newLayers] };
            }
            if (l.children) return { ...l, children: inject(l.children) };
            return l;
          });
        };
        finalLayers = inject(finalLayers);
      });

      // Normalize zIndex values to sequential integers and enforce descending order
      const normalizeZIndexes = (layers: Layer[]): Layer[] => {
        const sorted = [...layers].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));
        return sorted.map((l, idx) => ({
          ...l,
          zIndex: sorted.length - idx,
          children: l.children ? normalizeZIndexes(l.children) : l.children
        }));
      };
      
      finalLayers = normalizeZIndexes(finalLayers);

      // Update selection to the extracted layers
      const allExtractedIds = layersToInject.flatMap(lti => lti.layers.map(nl => nl.id));
      if (allExtractedIds.length > 0) {
        setSelectedLayerIds(allExtractedIds);
      }

      return { ...stage, layers: finalLayers };
    }));
  };

  const prepareButtonMetadata = (dropMeta: any, url: string) => {
    return {
      label: dropMeta?.label || url || 'Button',
      color: dropMeta?.color || '#10b981',
      hoverColor: dropMeta?.hoverColor || '#059669',
      activeColor: dropMeta?.activeColor || '#047857',
      fontFamily: dropMeta?.fontFamily || 'Outfit',
      fontWeight: dropMeta?.fontWeight || '800',
      fontSize: dropMeta?.fontSize || '16',
      lineHeight: dropMeta?.lineHeight || '1.2',
      letterSpacing: dropMeta?.letterSpacing || '1.6',
      textTransform: dropMeta?.textTransform || 'uppercase',
      textAlign: dropMeta?.textAlign || 'center',
      verticalAlign: dropMeta?.verticalAlign || 'middle',
      colorCode: dropMeta?.colorCode || dropMeta?.color || '#10b981',
      hoverColorCode: dropMeta?.hoverColorCode || dropMeta?.hoverColor || '#059669',
      activeColorCode: dropMeta?.activeColorCode || dropMeta?.activeColor || '#047857',
      textColor: dropMeta?.textColor || '#ffffff',
      effect: dropMeta?.effect || 'none',
      bgType: dropMeta?.bgType || 'solid',
      colorCode2: dropMeta?.colorCode2 || dropMeta?.color2 || '#004040',
      ...dropMeta // Ensure all other custom properties are preserved
    };
  };

  const handleCreateButtonAsset = useCallback((layerId: string) => {
    let targetLayer: Layer | undefined;
    stages.forEach(s => {
      const find = (layers: Layer[]) => {
        layers.forEach(l => {
          if (l.id === layerId) targetLayer = l;
          if (l.children) find(l.children);
        });
      };
      find(s.layers);
    });

    if (targetLayer && targetLayer.type === 'button') {
      try {
        let meta: any = {};
        if (typeof targetLayer.variant === 'string') {
          meta = JSON.parse(targetLayer.variant || '{}');
        } else if (typeof targetLayer.variant === 'object' && targetLayer.variant !== null) {
          meta = targetLayer.variant;
        }

        const newAsset = {
          ...meta,
          label: meta.label || targetLayer.name || 'Custom Button',
          // Ensure we have normalized properties for the asset library preview
          color: meta.colorCode || meta.color || '#10b981',
          hoverColor: meta.hoverColorCode || meta.hoverColor || '#059669',
          activeColor: meta.activeColorCode || meta.activeColor || '#047857',
          color2: meta.colorCode2 || meta.color2 || '#004040'
        };
        
        setCustomButtonAssets(prev => [newAsset, ...prev]);
        showNotification('Button saved to assets library!', 'success');
      } catch (e) {
        console.error('Error creating button asset:', e);
        showNotification('Could not save button asset.', 'error');
      }
    } else {
      showNotification('Please select a button to save.', 'info');
    }
  }, [stages, setCustomButtonAssets]);

  const handleDropOnWorkspace = async (source: string | File, type: string = 'media', dropMeta?: any, x?: number, y?: number, targetStageId?: string) => {
    let url = '';
    const isFile = source instanceof File || (source && typeof source !== 'string' && (source as any).size !== undefined);

    if (isFile) {
      url = await handleUploadAsset(source as File);
    } else if (typeof source === 'string' && (source.startsWith('blob:') || source.startsWith('data:'))) {
        // If it's a blob/data URL from elsewhere, try to upload it too
        try {
            const response = await fetch(source);
            const blob = await response.blob();
            url = await handleUploadAsset(blob, dropMeta?.label || 'dragged_image.png');
        } catch (e) {
            url = source;
        }
    } else {
      url = source as string;
    }

    if (!url) return;

    const idPrefix = type === 'image' || type === 'media' || !type ? 'media' : type;
    
    // Register asset if it's an image/media and not already there
    if ((type === 'image' || type === 'media' || !type) && url) {
      setMediaAssets(prev => prev.includes(url) ? prev : [...prev, url]);
    }
    
    // Prepare variant for button or text if needed
    let variant = '';
    if (type === 'button') {
      variant = JSON.stringify(prepareButtonMetadata(dropMeta, url));
    } else if (type === 'text') {
      const textMeta = {
        label: dropMeta?.label || '', 
        fontFamily: dropMeta?.fontFamily || lastUsedTextStyles.fontFamily,
        fontWeight: dropMeta?.fontWeight || lastUsedTextStyles.fontWeight,
        fontSize: dropMeta?.fontSize || lastUsedTextStyles.fontSize,
        lineHeight: dropMeta?.lineHeight || lastUsedTextStyles.lineHeight || '1.2',
        letterSpacing: dropMeta?.letterSpacing || lastUsedTextStyles.letterSpacing || '0',
        textTransform: dropMeta?.textTransform || lastUsedTextStyles.textTransform || 'none',
        textAlign: dropMeta?.textAlign || lastUsedTextStyles.textAlign || 'left',
        verticalAlign: dropMeta?.verticalAlign || lastUsedTextStyles.verticalAlign || 'top',
        textColor: dropMeta?.textColor || lastUsedTextStyles.textColor || '#121717',
        bgType: dropMeta?.bgType || lastUsedTextStyles.bgType || 'none',
        colorCode: dropMeta?.colorCode || 'transparent',
        layoutType: dropMeta?.layoutType || lastUsedTextStyles.layoutType || 'none'
      };
      variant = JSON.stringify(textMeta);
      
      // Update last used styles
      setLastUsedTextStyles(prev => ({
        ...prev,
        fontFamily: textMeta.fontFamily,
        fontSize: textMeta.fontSize,
        fontWeight: textMeta.fontWeight,
        textColor: textMeta.textColor,
        textAlign: textMeta.textAlign,
        verticalAlign: textMeta.verticalAlign,
        letterSpacing: textMeta.letterSpacing,
        textTransform: textMeta.textTransform,
        layoutType: textMeta.layoutType,
        bgType: textMeta.bgType
      }));
    } else if (type === 'widget') {
      const widgetMeta = {
        label: dropMeta?.label || url || 'Widget',
        icon: dropMeta?.icon || 'widgets',
        color: dropMeta?.color || 'gray',
        url: dropMeta?.url || '',
        widgetId: dropMeta?.widgetId || '',
        widgetHtml: dropMeta?.widgetHtml || '',
        widgetCss: dropMeta?.widgetCss || '',
        widgetJs: dropMeta?.widgetJs || '',
        properties: dropMeta?.properties || [],
        hasCustomCode: dropMeta?.hasCustomCode || false
      };
      variant = JSON.stringify(widgetMeta);
    } else if (type === 'video') {
      const { label, posterUrl, ...restMeta } = dropMeta || {};
      const videoMeta: any = {
        label: label || 'Video',
        posterUrl: posterUrl || '',
        videoUrl: url
      };
      
      if (restMeta) {
        Object.entries(restMeta).forEach(([k, v]) => {
          if (v === 'true') videoMeta[k] = true;
          else if (v === 'false') videoMeta[k] = false;
          else videoMeta[k] = v;
        });
      }
      
      variant = JSON.stringify(videoMeta);
    } else if (type === 'shape') {
      variant = JSON.stringify(dropMeta || {});
    }

    const effectiveStageId = targetStageId || selectedStageId;
    if (effectiveStageId) {
      const stage = stages.find(s => s.id === effectiveStageId);
      
      let dropWidth = 200;
      let dropHeight = 200;

      if (type === 'button') {
        dropWidth = 160;
        dropHeight = 50;
      } else if (type === 'text') {
        dropWidth = 300;
        dropHeight = 40;
      } else if (type === 'widget') {
        dropWidth = 300;
        dropHeight = 150;
      } else if (type === 'shape') {
        if (dropMeta?.shapeType === 'line') {
          dropWidth = 200;
          dropHeight = 2;
        } else {
          dropWidth = 200;
          dropHeight = 200;
        }
      } else if (type === 'video' || type === 'media' || type === 'image' || !type) {
        try {
          const dims = await getMediaDimensions(url, type === 'video' ? 'video' : 'image');
          dropWidth = dims.width;
          dropHeight = dims.height;
        } catch (e) {
          console.warn('Could not get media dimensions, using defaults', e);
          dropWidth = type === 'video' ? 400 : 200;
          dropHeight = type === 'video' ? 225 : 200;
        }
      }

      const newLayerId = handleAddLayer(effectiveStageId, { 
        type: (type === 'media' || type === 'image' || !type) ? 'image' : type as any, 
        url: type === 'text' ? (dropMeta?.label || '') : url, 
        x: x !== undefined ? x : (stage ? stage.width / 2 : 200), 
        y: y !== undefined ? y : (stage ? stage.height / 2 : 200), 
        width: dropWidth, 
        height: dropHeight, 
        rotation: 0,
        variant: variant
      }, idPrefix);
      setSelectedLayerIds([newLayerId]);
      if (type === 'text') {
        setEditingLayerIds(prev => ({ ...prev, [effectiveStageId]: newLayerId }));
      }
    }
  };
  const toggleSidebarTab = useCallback((tab: string) => {
    setActiveSidebarTab(prev => prev === tab ? null : tab);
  }, [setActiveSidebarTab]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = (target instanceof HTMLInputElement) || 
                      (target instanceof HTMLTextAreaElement) ||
                      (target.isContentEditable);

      if (isInput) return;

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      
      if (isCmdOrCtrl && (e.key === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }

      if (isCmdOrCtrl && e.key === 'c' && selectedLayerIds.length > 0 && isMouseInWorkspace && !isTextPopupOpen) {
        handleCopyLayer(selectedLayerIds[0]);
      }
      
      if (isCmdOrCtrl && e.key === 'v' && selectedStageId) {
        handlePasteLayer(selectedStageId);
      }
      
      if (isCmdOrCtrl && e.key.toLowerCase() === 'd' && selectedStageId && selectedLayerIds.length > 0) {
        e.preventDefault();
        handleDuplicateLayers(selectedStageId, selectedLayerIds);
      }

      // T for Text tool
      if (e.key.toLowerCase() === 't' && !isCmdOrCtrl && isMouseInWorkspace) {
        toggleSidebarTab('text');
      }
      
      // V for Select tool (deactivate current sidebar tab)
      if (e.key.toLowerCase() === 'v' && !isCmdOrCtrl && isMouseInWorkspace) {
        setActiveSidebarTab(null);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedLayerIds, selectedStageId, layerClipboard, stages, isMouseInWorkspace, isTextPopupOpen, undo, redo, toggleSidebarTab, setActiveSidebarTab]); 

   const handleStageSelect = (id: string | null) => {
     if (followedUserId) setFollowedUserId(null);
     if (id !== selectedStageId) {
        setSelectedStageId(id);
        setSelectedLayerIds([]);
        setEditingLayerIds({});
        setActiveGroupId(null);
     }
   };

  const handleLayerClick = (layerId: string, stageId: string, isDoubleClick: boolean, isShift: boolean) => {
    setSelectedStageId(stageId);

    const currentStage = stages.find(s => s.id === stageId);
    if (!currentStage) return;

    const path = findPath(currentStage.layers, layerId);
    if (!path) return;

    // Nested search helper
    const findLayerById = (layers: Layer[], id: string): Layer | undefined => {
      for (const l of layers) {
        if (l.id === id) return l;
        if (l.children) {
          const found = findLayerById(l.children, id);
          if (found) return found;
        }
      }
      return undefined;
    };

    // Check if any layer in the path is locked
    const isAnyLocked = path.some(id => {
      const l = findLayerById(currentStage.layers, id);
      return l?.locked;
    });
    if (isAnyLocked) return;

    // Selection Logic: Single click = top group, Double click = specific element
    let idToSelect = layerId;

    if (isDoubleClick) {
      idToSelect = layerId;
      // When double clicking a specific element, set the active group to its immediate parent
      // so that it can be selected and manipulated directly
      if (path.length > 1) {
        setActiveGroupId(path[path.length - 2]);
      } else {
        setActiveGroupId(null);
      }
    } else {
      // Single Click: Identify if it is inside another active group or not
      if (activeGroupId && path.includes(activeGroupId)) {
         // Stay within active group context, handleLayersSelect will enforce hierarchy
         // Do not reset idToSelect to path[0] so that sibling selection works
      } else {
        // Default single click behavior: 
        // If the top-most group (path[0]) is already selected, we allow 
        // selecting the specific nested layer (drill-down). 
        // Otherwise, we select the top-most group (default behavior).
        if (path.length > 1 && selectedLayerIds.includes(path[0])) {
          idToSelect = layerId;
          // Also set the active group so we stay in this context for subsequent clicks
          setActiveGroupId(path[path.length - 2]); 
        } else if (path.length > 1) {
          idToSelect = path[0];
          setActiveGroupId(null);
        } else {
          setActiveGroupId(null);
        }
      }
    }

    const targetLayer = findLayerById(currentStage.layers, idToSelect);
    
    // Auto-enter group on double click if a group was double-clicked directly
    if (isDoubleClick && targetLayer?.type === 'group') {
      setActiveGroupId(idToSelect);
    } else if (isDoubleClick && targetLayer && (targetLayer.type === 'text' || targetLayer.type === 'button')) {
      setEditingLayerIds(prev => ({ ...prev, [stageId]: targetLayer.id }));
    }

    // Selection Logic: Handle Multi-select (Shift) and Single-select
    if (isShift) {
      handleLayersSelect(prev => {
        if (prev.includes(idToSelect)) {
          return prev.filter(id => id !== idToSelect);
        } else {
          return [...prev, idToSelect];
        }
      }, stageId);
    } else {
      handleLayersSelect([idToSelect], stageId);
    }
  };

  const getBreadcrumbs = (stageId: string | null, activeId: string | null) => {
    if (!stageId || !activeId) return [];
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return [];

    const findPathWithName = (layers: Layer[], targetId: string, currentPath: Array<{ id: string, name: string }> = []): Array<{ id: string, name: string }> | null => {
      for (const l of layers) {
        if (l.id === targetId) return [...currentPath, { id: l.id, name: l.name }];
        if (l.children) {
          const path = findPathWithName(l.children, targetId, [...currentPath, { id: l.id, name: l.name }]);
          if (path) return path;
        }
      }
      return null;
    };

    return findPathWithName(stage.layers, activeId) || [];
  };

  const breadcrumbs = getBreadcrumbs(selectedStageId, activeGroupId);

  const handleNavigateToGroup = (groupId: string | null) => {
    setActiveGroupId(groupId);
    if (groupId) {
      setSelectedLayerIds([groupId]);
    } else {
      setSelectedLayerIds([]);
    }
  };

  const currentDuration = selectedStageId ? stages.find(s => s.id === selectedStageId)?.duration || 10 : 10;

  const handleDurationChange = (stageId: string, newDuration: number) => {
    setStages(prev => prev.map(s => {
      if (s.id !== stageId) return s;
      
      const oldDuration = s.duration;
      if (Math.abs(newDuration - oldDuration) < 0.001) return s;

      const ratio = newDuration / oldDuration;
      
      const rescaleLayers = (layers: Layer[]): Layer[] => {
        return layers.map(l => {
          const newLayer = { ...l };
          
          if (l.animation) {
            newLayer.animation = {
              ...l.animation,
              entry: {
                ...l.animation.entry,
                start: l.animation.entry.start * ratio,
                duration: l.animation.entry.duration * ratio
              },
              main: {
                ...l.animation.main,
                start: l.animation.main.start * ratio,
                duration: l.animation.main.duration * ratio
              },
              exit: {
                ...l.animation.exit,
                start: (l.animation.exit.start || 0) * ratio,
                duration: (l.animation.exit.duration || 0) * ratio
              }
            };

            if (l.animation.keyframes) {
              newLayer.animation.keyframes = l.animation.keyframes.map(kf => ({
                ...kf,
                time: kf.time * ratio
              }));
            }
          }

          if (l.textAnimation) {
            newLayer.textAnimation = {
              ...l.textAnimation,
              entry: {
                ...l.textAnimation.entry,
                start: (l.textAnimation.entry.start || 0) * ratio,
                duration: (l.textAnimation.entry.duration || 0) * ratio
              },
              main: {
                ...l.textAnimation.main,
                start: (l.textAnimation.main.start || 0) * ratio,
                duration: (l.textAnimation.main.duration || 0) * ratio
              },
              exit: {
                ...l.textAnimation.exit,
                start: (l.textAnimation.exit.start || 0) * ratio,
                duration: (l.textAnimation.exit.duration || 0) * ratio
              }
            };
          }

          if (l.children) {
            newLayer.children = rescaleLayers(l.children);
          }
          return newLayer;
        });
      };

      return {
        ...s,
        duration: newDuration,
        layers: rescaleLayers(s.layers)
      };
    }));
  };

  const handleUpdateStage = (stageId: string, updates: Partial<Omit<Stage, 'id' | 'layers'>>) => {
    setStages(prev => prev.map(stage => {
      if (stage.id !== stageId) return stage;

      const newStage = { ...stage, ...updates };

      const oldD = stage.duration;
      const newD = updates.duration || oldD;

      if (Math.abs(newD - oldD) > 0.001) {
        const ratio = newD / oldD;
        const rescaleLayers = (layers: Layer[]): Layer[] => {
          return layers.map(l => {
            const nl = { ...l };
            
            if (l.animation) {
              nl.animation = {
                ...l.animation,
                entry: {
                  ...l.animation.entry,
                  start: l.animation.entry.start * ratio,
                  duration: l.animation.entry.duration * ratio
                },
                main: {
                  ...l.animation.main,
                  start: l.animation.main.start * ratio,
                  duration: l.animation.main.duration * ratio
                },
                exit: {
                  ...l.animation.exit,
                  start: (l.animation.exit.start || 0) * ratio,
                  duration: (l.animation.exit.duration || 0) * ratio
                }
              };

              if (l.animation.keyframes) {
                nl.animation.keyframes = l.animation.keyframes.map(kf => ({
                  ...kf,
                  time: kf.time * ratio
                }));
              }
            }

            if (l.textAnimation) {
              nl.textAnimation = {
                ...l.textAnimation,
                entry: {
                  ...l.textAnimation.entry,
                  start: (l.textAnimation.entry.start || 0) * ratio,
                  duration: (l.textAnimation.entry.duration || 0) * ratio
                },
                main: {
                  ...l.textAnimation.main,
                  start: (l.textAnimation.main.start || 0) * ratio,
                  duration: (l.textAnimation.main.duration || 0) * ratio
                },
                exit: {
                  ...l.textAnimation.exit,
                  start: (l.textAnimation.exit.start || 0) * ratio,
                  duration: (l.textAnimation.exit.duration || 0) * ratio
                }
              };
            }

            if (l.children) nl.children = rescaleLayers(l.children);
            return nl;
          });
        };
        newStage.layers = rescaleLayers(stage.layers);
      }

      if (newStage.dynamicHeight) {
        const bounds = computeGroupBoundsFromChildren(newStage.layers);
        if (bounds) {
          newStage.height = Math.max(100, Math.ceil(bounds.maxY + 80));
        }
      }
      return newStage;
    }));
    broadcastAction({
      type: 'STAGE_UPDATE',
      stageId,
      updates
    });
  };

  const handleBatchUpdateStages = (stageIds: string[], updates: Partial<Omit<Stage, 'id' | 'layers'>>) => {
    setStages(prev => prev.map(stage => {
      if (!stageIds.includes(stage.id)) return stage;
      return { ...stage, ...updates };
    }));
    stageIds.forEach(stageId => {
      broadcastAction({ 
        type: 'STAGE_UPDATE', 
        stageId, 
        updates 
      });
    });
  };

const handleArrangeStages = React.useCallback(() => {
    pushToHistory();
    const spacing = 200; // Increased spacing for design comfort
    let currentX = 0;
    
    // Calculate new stages first so we can broadcast them
    const arrangedStages = stages.map(stage => {
        if (stage.visible === false) return stage;
        const newX = currentX;
        currentX += stage.width + spacing;
        return { 
            ...stage, 
            x: newX, 
            y: 0 
        };
    });

    setStages(arrangedStages);
    
    // Broadcast updates for each changed stage
    arrangedStages.forEach(stage => {
        broadcastAction({ 
            type: 'STAGE_UPDATE', 
            stageId: stage.id, 
            updates: { x: stage.x, y: stage.y } 
        });
    });
}, [pushToHistory, stages, broadcastAction]);

  const handleDeleteSelected = () => {
    pushToHistory();
    if (selectedLayerIds.length > 0) {
      const namesToDelete = new Set<string>();
      if (isSyncEnabled) {
        stages.forEach(s => {
          const findNames = (ls: Layer[]) => {
            ls.forEach(l => {
              if (selectedLayerIds.includes(l.id)) namesToDelete.add(l.name);
              if (l.children) findNames(l.children);
            });
          };
          findNames(s.layers);
        });
      }

      setStages(prev => prev.map(stage => {
        const deleteRecursive = (layers: Layer[]): Layer[] => {
          return layers
            .filter(l => !selectedLayerIds.includes(l.id) && (!isSyncEnabled || !namesToDelete.has(l.name)))
            .map(l => l.children ? { ...l, children: deleteRecursive(l.children) } : l);
        };
        return { ...stage, layers: deleteRecursive(stage.layers) };
      }));
      broadcastAction({
        type: 'NODE_DELETE',
        layerIds: [...selectedLayerIds],
        stageId: isSyncEnabled ? null : selectedStageId
      });
      setSelectedLayerIds([]);
    } else if (selectedStageId) {
      if (window.confirm('Are you sure you want to delete this stage?')) {
        broadcastAction({
          type: 'STAGE_DELETE',
          stageId: selectedStageId
        });
        setStages(prev => prev.filter(s => s.id !== selectedStageId));
        setSelectedStageId(null);
        setSelectedLayerIds([]);
        setActiveGroupId(null);
      }
    }
  };

  React.useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const handleGlobalDrop = async (e: DragEvent) => {
      e.preventDefault();
      // If files are dropped anywhere on the window, add them to our assets
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        for (const file of Array.from(e.dataTransfer.files)) {
          if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            const url = await handleUploadAsset(file);
            setMediaAssets(prev => prev.includes(url) ? prev : [...prev, url]);
          }
        }
      }
    };
    window.addEventListener('dragover', preventDefault);
    window.addEventListener('drop', handleGlobalDrop);
    return () => {
      window.removeEventListener('dragover', preventDefault);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = (target instanceof HTMLInputElement) || 
                      (target instanceof HTMLTextAreaElement) ||
                      (target.isContentEditable);

      if (isInput) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        handleDeleteSelected();
      }

      const isMod = e.ctrlKey || e.metaKey;
      if (isMod && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (selectedStageId && selectedLayerIds.length > 0) {
          handleGroupLayers(selectedStageId, selectedLayerIds);
        }
      }

      if (isMod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (selectedStageId && selectedLayerIds.length > 0) {
          handleUngroupLayers(selectedStageId, selectedLayerIds);
        }
      }

      if (e.key.toLowerCase() === 't' && !isMod) {
        e.preventDefault();
        setActiveSidebarTab('text');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerIds, selectedStageId, stages]);

  // Expose utility functions to window for console access
  React.useEffect(() => {
    (window as any).getStageObject = () => {
        console.log('[window.getStageObject] Generating data. Stages:', stages.length);
        return convertStagesToStageObject(stages, exportedImages, {
            media: mediaAssets,
            video: videoAssets,
            widget: widgetAssets,
            button: customButtonAssets
        }, {
            companyId: '66db07778b5e35892545578c',
            brandId: '670f81b35352be580a1f394c',
            templateId: '670fa914c2f0842143d5932',
            campaignId: (window as any).campaignId || null,
            versionId: (window as any).versionId || null,
            marketId: (window as any).marketId || null
        });
    };
    (window as any).downloadStageObject = () => downloadStageObject(stages);
  }, [stages, exportedImages, mediaAssets, videoAssets, widgetAssets, customButtonAssets]);

  // --- Collaboration WebSocket ---




  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const templateId = urlParams.get('templateId') || (window as any).templateId || '670fa914c2f0842143d5932';
    const versionId = urlParams.get('versionId') || (window as any).versionId;
    
    // User info logic: Prioritize 'user' state from login
    const userId = user?.userId || urlParams.get('userId') || urlParams.get('id') || '65b7b942e36d04c36eb495c1';
    
    let firstName = user?.firstName || '';
    let lastName = user?.lastName || '';
    
    if (!firstName && !lastName) {
        const pName = urlParams.get('name');
        const pSurname = urlParams.get('surname');
        if (pName) {
            firstName = decodeURIComponent(pName);
            lastName = pSurname ? decodeURIComponent(pSurname) : '';
        } else {
            firstName = 'Gokhan';
            lastName = 'Turak';
        }
    }
    
    const userName = `${firstName} ${lastName}`.trim();
    
    console.log('👤 Identity Configured:', { userId, userName, fromUser: !!user });
    
    userIdRef.current = userId;
    userNameRef.current = userName;
    (window as any).userName = userName;
    (window as any).userId = userId;
    (window as any).templateId = templateId;
    (window as any).versionId = versionId;
    (window as any).firstName = firstName;
    (window as any).lastName = lastName;

    if (!templateId && !versionId) {
      console.log('ℹ️ WebSocket: Skipping connection, no templateId/versionId found.');
      return;
    }

    const wsUrl = `wss://test-tool-ws.adcropper.com/ws?${versionId ? `versionId=${versionId}` : `templateId=${templateId}`}&userId=${userId}&firstName=${encodeURIComponent(firstName)}&lastName=${encodeURIComponent(lastName)}`;
    let hasReceivedInitialData = false;

    console.log(`🔌 Attempting WebSocket connection to: ${wsUrl}`);
    
    try {
      console.log(`🔌 Connecting to WebSocket Room: ${versionId ? `Version: ${versionId}` : `Template: ${templateId}`}`);
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log('✅ Collaboration WebSocket Connected');
        
        // Wait for initial sync from server. If nothing comes in 1.5s, we are the source of truth.
        setTimeout(() => {
          if (!hasReceivedInitialData && socket.readyState === WebSocket.OPEN) {
            console.log('📤 No data received from server. Sending local stage object as initial state.');
            if ((window as any).getStageObject) {
              const currentStageObj = (window as any).getStageObject();
              socket.send(JSON.stringify({
                type: 'STATE_SYNC',
                senderId: userId,
                senderName: userName,
                mouse: { x: 0, y: 0 },
                data: currentStageObj
              }));
            }
          }
        }, 1500);
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Debug Logging (excluding noisy types like mouse moves unless they are from others and we specifically want them)
          if (message.type !== 'MOUSE_MOVE' && message.type !== 'HEARTBEAT') {
            console.log(`%c📥 WS RECEIVED [${message.type}] from ${message.senderName || 'Server'}`, 'color: #28a745; font-weight: bold; padding: 2px 4px; border-radius: 3px; background: #e8f5e9', message);
          }
          
          // Helper to resolve display name with Bad Name protection
          const resolveDisplayName = (rawName: string, id: string, currentMap: Record<string, any>) => {
              const existing = currentMap[id];
              let displayName = rawName;
              
              // Check if incoming name is "bad" (empty, same as ID, or generic "user_")
              const isBadName = !displayName || displayName === id || displayName.startsWith('user_');

              if (isBadName) {
                  // If we already have a generated name for this user, keep it.
                  if (existing && existing.name && !existing.name.startsWith('user_')) {
                      displayName = existing.name;
                  } else {
                      // Generate a new consistent random name for this session
                      const animals = ['Fox', 'Rabbit', 'Bear', 'Eagle', 'Wolf', 'Deer', 'Owl', 'Tiger', 'Lion', 'Hawk'];
                      const adjectives = ['Happy', 'Swift', 'Bright', 'Calm', 'Wild', 'Silent', 'Brave', 'Clever', 'Noble', 'Kind'];
                      // Deterministic hash based on ID so it's consistent even if "existing" is missing
                      const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      displayName = `${adjectives[hash % adjectives.length]} ${animals[hash % animals.length]}`;
                  }
              }
              return displayName;
          };

          if (message.senderId && message.senderId !== userIdRef.current) {
                              if (message.type === 'CHAT_MESSAGE') {
                const newMessage: ChatMessage = {
                   id: Math.random().toString(36).substring(2, 9),
                   senderId: message.senderId,
                   senderName: message.senderName,
                   text: message.text,
                   x: message.x,
                   y: message.y,
                   timestamp: Date.now()
                };
                setChatMessages(prev => [...prev, newMessage]);

                
                // Update collaborator lastMessage
                setCollaborators(prev => {
                   if (!message.senderId) return prev;
                   return {
                      ...prev,
                      [message.senderId]: {
                         ...(prev[message.senderId] || { name: message.senderName, lastSeen: Date.now() }),
                         lastMessage: message.text
                      }
                   };
                });
                
                // Debounce: Clear existing timeout for this user if it exists (though we're moving away from auto-timeout)
                if (message.senderId && chatTimeoutRefs.current[message.senderId]) {
                   clearTimeout(chatTimeoutRefs.current[message.senderId]);
                   delete chatTimeoutRefs.current[message.senderId];
                }
             }

             if (message.type === 'CHAT_CLOSED' && message.senderId && message.senderId !== userIdRef.current) {
                setCollaborators(prev => {
                    if (!message.senderId || !prev[message.senderId]) return prev;
                    const next = { ...prev };
                    next[message.senderId] = { ...next[message.senderId] };
                    delete next[message.senderId].lastMessage;
                    return next;
                });
                if (chatTimeoutRefs.current[message.senderId]) {
                    clearTimeout(chatTimeoutRefs.current[message.senderId]);
                    delete chatTimeoutRefs.current[message.senderId];
                }
             }


             setCollaborators(prev => {

                // Double-check self-exclusion to prevent race conditions
                if (message.senderId === userIdRef.current) return prev;

                const displayName = resolveDisplayName(message.senderName, message.senderId, prev);
                const existing = prev[message.senderId] || {};
                
                const update: any = {
                    name: displayName,
                    lastSeen: Date.now()
                };

                // If it's a mouse move, update coordinates
                if (message.type === 'MOUSE_MOVE') {
                    update.x = message.x;
                    update.y = message.y;
                } else {
                    // Preserve existing coordinates if they exist
                    if (existing.x !== undefined) update.x = existing.x;
                    if (existing.y !== undefined) update.y = existing.y;
                }

                return {
                    ...prev,
                    [message.senderId]: {
                        ...existing,
                        ...update
                    }
                };
             });
          }


          // Handle Unified Sync (Both) or Stage-Only Sync
          // IMPORTANT: Ignore our own echoes to prevent race conditions and overwriting local optimistic updates
            if ((message.type === 'STATE_SYNC' || message.type === 'ASSET_SYNC') && (!message.senderId || message.senderId !== userIdRef.current)) {
              hasReceivedInitialData = true;

              console.log(`📥 Received ${message.type} from`, message.senderName);
              
              // 1. Update Assets
              if (message.data && message.data.assets) {
                const { media, video, widget } = message.data.assets;
                
                isIncomingUpdateRef.current = true;
                
                if (media && Array.isArray(media)) {
                  setMediaAssets(prev => {
                    const combined = [...prev, ...media];
                    const unique = Array.from(new Set(combined));
                    return unique.length !== prev.length ? unique : prev;
                  });
                }
                if (video && Array.isArray(video)) {
                  setVideoAssets(prev => {
                    const combined = [...prev, ...video];
                    const unique = combined.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
                    return unique.length !== prev.length ? unique : prev;
                  });
                }
                if (widget && Array.isArray(widget)) {
                  setWidgetAssets(prev => {
                    const combined = [...prev, ...widget];
                    const unique = combined.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
                    return unique.length !== prev.length ? unique : prev;
                  });
                }
              }

              // 2. Update Stages (ONLY for STATE_SYNC)
              if (message.type === 'STATE_SYNC') {
                  const reconstructed = reconstructStagesFromStageObject(message.data);
                  if (reconstructed && reconstructed.length > 0) {
                      console.log('🖼️ Syncing Stages:', reconstructed.length);
                      isIncomingUpdateRef.current = true;
                      setStages(reconstructed);
                  }
              }
            }

            // 3. Handle Granular Actions
            if (message.type === 'NODE_UPDATE' && message.senderId !== userIdRef.current) {
              console.log('🔄 Granular Node Update RECEIVED:', { 
                layerIds: message.layerIds, 
                stageId: message.stageId, 
                updates: message.updates 
              });
              isIncomingUpdateRef.current = true;
              setStages(prev => prev.map(stage => {
                // If the update is for the stage itself
                if (message.layerIds.includes(stage.id)) {
                  return { ...stage, ...message.updates };
                }

                if (message.stageId && stage.id !== message.stageId) return stage;
                
                const updateRecursive = (layers: Layer[]): Layer[] => {
                  return layers.map(l => {
                    if (message.layerIds.includes(l.id)) {
                      // Deep merge key properties to prevent data loss (animation, textAnimation, variant)
                      const mergedAnimation = message.updates.animation ? { ...l.animation, ...message.updates.animation } : l.animation;
                      const mergedTextAnimation = message.updates.textAnimation ? { ...l.textAnimation, ...message.updates.textAnimation } : l.textAnimation;
                      
                      return { ...l, ...message.updates, animation: mergedAnimation, textAnimation: mergedTextAnimation };
                    }
                    if (l.children) {
                      return { ...l, children: updateRecursive(l.children) };
                    }
                    return l;
                  });
                };
                return { ...stage, layers: updateRecursive(stage.layers) };
              }));
              if (message.senderName) {
                showNotification(`${message.senderName} updated elements`, 'info');
              }
            }

            if (message.type === 'BATCH_NODE_UPDATE' && message.senderId !== userIdRef.current) {
              console.log('🔄 BATCH Node Update RECEIVED:', {
                count: message.updates?.length,
                updates: message.updates
              });
              isIncomingUpdateRef.current = true;
              setStages(prev => {
                return prev.map(stage => {
                  let updatedStage = { ...stage };
                  
                  // Support stage-level updates within the batch
                  const stageUpdate = message.updates.find((u: any) => u.id === stage.id);
                  if (stageUpdate) {
                    updatedStage = { ...updatedStage, ...stageUpdate.changes };
                  }

                  const updateRecursive = (layers: Layer[]): Layer[] => {
                    return layers.map(l => {
                      const update = message.updates.find((u: any) => u.id === l.id);
                      if (update) {
                        const mergedAnimation = update.changes.animation ? { ...l.animation, ...update.changes.animation } : l.animation;
                        const mergedTextAnimation = update.changes.textAnimation ? { ...l.textAnimation, ...update.changes.textAnimation } : l.textAnimation;
                        
                        let currentLayer = { ...l, ...update.changes, animation: mergedAnimation, textAnimation: mergedTextAnimation };
                        if (currentLayer.children) {
                          currentLayer.children = updateRecursive(currentLayer.children);
                        }
                        return currentLayer;
                      }
                      
                      if (l.children) {
                        return { ...l, children: updateRecursive(l.children) };
                      }
                      return l;
                    });
                  };
                  return { ...updatedStage, layers: updateRecursive(updatedStage.layers) };
                });
              });
              if (message.senderName) {
                showNotification(`${message.senderName} performed multiple updates`, 'info');
              }
            }

            if (message.type === 'NODE_DELETE' && message.senderId !== userIdRef.current) {
              console.log('🗑️ Granular Node Delete RECEIVED:', message.layerIds);
              isIncomingUpdateRef.current = true;
              setStages(prev => prev.map(stage => {
                const deleteRecursive = (layers: Layer[]): Layer[] => {
                  return layers
                    .filter(l => !message.layerIds.includes(l.id))
                    .map(l => l.children ? { ...l, children: deleteRecursive(l.children) } : l);
                };
                return { ...stage, layers: deleteRecursive(stage.layers) };
              }));
              if (message.senderName) {
                showNotification(`${message.senderName} deleted elements`, 'info');
              }
            }

            if (message.type === 'NODE_CREATE' && message.senderId !== userIdRef.current) {
              console.log('➕ Granular Node Create RECEIVED:', message.layer.id);
              isIncomingUpdateRef.current = true;
              setStages(prev => prev.map(stage => {
                if (stage.id !== message.stageId) return stage;
                
                if (message.groupId) {
                  const addToGroup = (layers: Layer[]): Layer[] => {
                    return layers.map(l => {
                      if (l.id === message.groupId) {
                        return { ...l, children: [...(l.children || []), message.layer] };
                      }
                      if (l.children) return { ...l, children: addToGroup(l.children) };
                      return l;
                    });
                  };
                  return { ...stage, layers: addToGroup(stage.layers) };
                } else {
                  return { ...stage, layers: [...stage.layers, message.layer] };
                }
              }));
              if (message.senderName) {
                showNotification(`${message.senderName} added a new element`, 'info');
              }
            }
            
            if (message.type === 'STAGE_CREATE' && message.senderId !== userIdRef.current) {
              console.log('🖼️ STAGE Create RECEIVED:', message.stage.id);
              isIncomingUpdateRef.current = true;
              setStages(prev => [...prev, message.stage]);
              if (message.senderName) {
                showNotification(`${message.senderName} added a new stage`, 'info');
              }
            }
            
            if (message.type === 'STAGE_UPDATE' && message.senderId !== userIdRef.current) {
              console.log('📺 Granular Stage Update RECEIVED:', message.stageId, message.updates);
              isIncomingUpdateRef.current = true;
              setStages(prev => prev.map(stage => {
                if (stage.id === message.stageId) {
                  return { ...stage, ...message.updates };
                }
                return stage;
              }));
              if (message.senderName) {
                showNotification(`${message.senderName} updated stage settings`, 'info');
              }
            }
            
            if (message.type === 'STAGE_DELETE' && message.senderId !== userIdRef.current) {
              console.log('🗑️ Granular Stage Delete RECEIVED:', message.stageId);
              isIncomingUpdateRef.current = true;
              setStages(prev => prev.filter(s => s.id !== message.stageId));
              if (selectedStageId === message.stageId) {
                setSelectedStageId(null);
                setSelectedLayerIds([]);
              }
              if (message.senderName) {
                showNotification(`${message.senderName} deleted a stage`, 'info');
              }
            }
          } catch (e) {
            console.error('❌ WebSocket Message Error:', e);
          }
        };

        socket.onclose = (e) => {
        console.log('❌ Collaboration WebSocket Disconnected', e.reason);
      };

      socket.onerror = (err) => {
        console.error('❌ WebSocket Error:', err);
      };

      return () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          console.log('🔌 Closing WebSocket connection...');
          socket.close();
        }
      };

    } catch (e) {
      console.error('❌ Failed to create WebSocket:', e);
    }
  }, [user]); // Re-run when user logs in or out

  // Callback from Workspace with CONTENT Coordinates
  const handleContentMouseMove = React.useCallback((x: number, y: number) => {
    lastMousePosRef.current = { x, y };
    broadcastAction({
      type: 'MOUSE_MOVE',
      x: x, 
      y: y
    }, true); // Silent to avoid console spam
  }, [broadcastAction]);

  const handleSendChatMessage = (text: string) => {
    if (text === undefined || text === null) return;
    
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'CHAT_MESSAGE',
        senderId: userIdRef.current,
        senderName: userNameRef.current,
        text: text,
        x: lastMousePosRef.current.x,
        y: lastMousePosRef.current.y
      };
      
      socketRef.current.send(JSON.stringify(payload));
    }
  };


  // Track previous states to determine sync type
  const prevStagesJsonRef = React.useRef<string>('');
  const prevAssetsJsonRef = React.useRef<string>('');

  // Broadcast local changes to other clients (Debounced)
  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      if (isIncomingUpdateRef.current) {
        isIncomingUpdateRef.current = false;
        // Update refs to current state so we don't re-broadcast what we just received
        prevStagesJsonRef.current = JSON.stringify(stages);
        prevAssetsJsonRef.current = JSON.stringify({ media: mediaAssets, video: videoAssets, widget: widgetAssets });
        return;
      }

      const broadcastTimer = setTimeout(() => {
          const payloadInfo = {
            companyId: '66db07778b5e35892545578c',
            brandId: '670f81b35352be580a1f394c',
            templateId: (window as any).templateId || '670fa914c2f0842143d5932',
            campaignId: (window as any).campaignId || null,
            versionId: (window as any).versionId || null,
            marketId: (window as any).marketId || null
          };

          const currentAssets = {
              media: mediaAssets,
              video: videoAssets,
              widget: widgetAssets,
              button: customButtonAssets
          };

          const payloadData = convertStagesToStageObject(stages, exportedImages, currentAssets, payloadInfo);

          // Detect what changed
          const currentStagesJson = JSON.stringify(stages);
          const currentAssetsJson = JSON.stringify(currentAssets);
          
          const stagesChanged = currentStagesJson !== prevStagesJsonRef.current;
          const assetsChanged = currentAssetsJson !== prevAssetsJsonRef.current;
          
          // If nothing changed (e.g. initial render or phantom update), skip
          if (!stagesChanged && !assetsChanged) return;

          // Determine Message Type directly
          const msgType = (assetsChanged && !stagesChanged) ? 'ASSET_SYNC' : 'STATE_SYNC';

          // Skip if it's a STATE_SYNC because we now use granular actions for all stage/node changes
          // We only want to auto-broadcast ASSET_SYNC for library consistency
          if (msgType === 'STATE_SYNC' && stagesChanged) {
            // Update refs even if we don't broadcast, so we don't think they changed next time
            prevStagesJsonRef.current = currentStagesJson;
            if (!assetsChanged) return;
          }

          console.log(`🚀 BROADCASTING [${assetsChanged ? 'ASSET_SYNC' : msgType}]:`, {
              stagesChanged,
              assetsChanged,
              assetsCount: payloadData.assets?.media?.length
          });

          // Update refs
          prevStagesJsonRef.current = currentStagesJson;
          prevAssetsJsonRef.current = currentAssetsJson;

          if (assetsChanged) {
            socketRef.current?.send(JSON.stringify({
                type: 'ASSET_SYNC',
                senderId: userIdRef.current,
                senderName: userNameRef.current,
                data: payloadData
            }));
          }
      }, 500); // Reduced debounce for snappier feeling

      return () => clearTimeout(broadcastTimer);
    }
  }, [stages, mediaAssets, videoAssets, widgetAssets, customButtonAssets, exportedImages]);

  // Periodic heartbeat to keep user info alive and sync names for new joiners
  useEffect(() => {
    const heartbeat = setInterval(() => {
      broadcastAction({ type: 'HEARTBEAT' }, true); // Silent
    }, 5000);
    return () => clearInterval(heartbeat);
  }, [broadcastAction]);

  // Clean up stale collaborators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCollaborators(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          // Remove if stale (>15s) OR if it matches current user (ghost self)
          if ((now - next[id].lastSeen > 15000) || id === userIdRef.current) { 
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);


  useEffect(() => {
    if (mediaAssets.length > 0) {
      console.log('📚 Media Assets Library Updated:', mediaAssets.length, 'items');
    }
  }, [mediaAssets]);

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }


  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f0f2f5]">
      <Header 
        user={user}
        onLogout={() => {
          setUser(null);
          // logout() will be handled in Header or we call it here
          import('./utils/auth').then(m => m.logout());
        }}
        mode={mode} 
        collaborators={collaborators}
        followedUserId={followedUserId}
        onSelectUser={setFollowedUserId}
        setMode={(newMode) => {
          setMode(newMode);
          if (newMode === 'preview') {
            setPreviewPlaybackStates(prev => {
              const reset: Record<string, { isPlaying: boolean, currentTime: number, loopsDone: number }> = {};
              // Only auto-play stages that have autoPlay explicitly set to true or undefined (default true)
              stages.forEach(s => {
                reset[s.id] = { isPlaying: s.autoPlay === undefined || s.autoPlay === true, currentTime: 0, loopsDone: 0 };
              });
              return reset;
            });
          }
          if (newMode === 'animate' || newMode === 'preview') {
            setActiveSidebarTab(null);
          }
          if (newMode === 'design') {
            setSelectedStageId(prev => {
              if (prev && stages.find(s => s.id === prev)) return prev;
              return stages[0]?.id || null;
            });
            setSelectedLayerIds([]);
            setActiveGroupId(null);
            setPlaybackStates({}); // Reset edit-mode playback states
          }
        }} 
        onExportAll={handleExportAll}
        onReportClick={() => setIsSettingsPopupOpen(true)}
        showNotification={showNotification}
        onSave={() => {
            const dcoData = (window as any).getStageObject();
            // Wrap the DCO data with editor state for perfect reloading
            const projectData = {
                ...dcoData,
                _editorState: {
                    stages,
                    mediaAssets,
                    videoAssets,
                    widgetAssets,
                    customButtonAssets
                }
            };
            
            const templateId = dcoData.info?.templateId || 'project';
            const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${templateId}.adc`;
            a.click();
            URL.revokeObjectURL(url);
            console.log('💾 Project state saved as:', `${templateId}.adc`);
        }}
        onLoad={(data) => {
            console.log('📂 Loading project data:', data);
            
            // 1. Recover Assets Early (Try both new _editorState and old assets structure)
            const loadedButtons = data._editorState?.customButtonAssets || data.assets?.button;
            const loadedMedia = data._editorState?.mediaAssets || data.assets?.media;
            const loadedVideo = data._editorState?.videoAssets || data.assets?.video;
            const loadedWidget = data._editorState?.widgetAssets || data.assets?.widget;

            if (loadedButtons) {
                console.log('✨ Found buttons in project:', loadedButtons.length);
                setCustomButtonAssets(loadedButtons);
            }
            if (loadedMedia) setMediaAssets(loadedMedia);
            if (loadedVideo) setVideoAssets(loadedVideo);
            if (loadedWidget) setWidgetAssets(loadedWidget);

            // 2. Recover Stages
            // Priority 1: Direct _editorState (The "perfect" format)
            if (data && data._editorState && data._editorState.stages) {
                console.log('✨ Restoring stages from Perfect Editor State...');
                const { stages: loadedStages } = data._editorState;
                setStages(loadedStages || []);
                if (loadedStages && loadedStages.length > 0) setSelectedStageId(loadedStages[0].id);
                setSelectedLayerIds([]);
                setActiveGroupId(null);
                return;
            }

            // Priority 2: Reconstruct from DCO/Animation format
            const reconstructed = reconstructStagesFromStageObject(data);
            if (reconstructed && reconstructed.length > 0) {
                console.log('🔧 Reconstructed stages from DCO format.');
                setStages(reconstructed);
                setSelectedStageId(reconstructed[0].id);
                setSelectedLayerIds([]);
                setActiveGroupId(null);
                console.log('✨ Project loaded successfully.');
            } else {
                console.error('❌ Could not find valid stage data in file.');
                showNotification('Could not find valid stage data in this file.', 'error');
            }
        }}
      />

      {isExporting && (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full mx-4">
            <div className="relative size-16">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-900">Exporting Assets</h3>
              <p className="text-sm text-gray-500 mt-1">Please wait while we capture and upload high-resolution images to the server...</p>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        {mode === 'design' && (
          <>
            <LeftSidebar 
              activeTab={activeSidebarTab} 
              onTabClick={toggleSidebarTab}
              onSettingsClick={() => setIsSettingsPopupOpen(true)}
              user={user}
              onLogout={() => {
                setUser(null);
                import('./utils/auth').then(m => m.logout());
              }}
              isVoiceConnected={isVoiceConnected}
              isMuted={isVoiceMuted}
              isDeafened={isVoiceDeafened}
              onToggleMute={toggleVoiceMute}
              onToggleDeafen={toggleVoiceDeafen}
            />
            <div style={{ display: activeSidebarTab === 'voice' ? 'contents' : 'none' }}>
              <VoiceChatContainer
                  userId={userIdRef.current}
                  userName={userNameRef.current}
                  firstName={(window as any).firstName || ''}
                  lastName={(window as any).lastName || ''}
                  versionId={(window as any).versionId || ''}
                  roomId={(window as any).templateId || 'room1'}
                  setId={null}
                  collaborators={collaborators}
                  onClose={() => setActiveSidebarTab(null)}
                  isConnected={isVoiceConnected}
                  isMuted={isVoiceMuted}
                  isDeafened={isVoiceDeafened}
                  onConnect={handleVoiceConnect}
                  onDisconnect={handleVoiceDisconnect}
                  onToggleMute={toggleVoiceMute}
                  onToggleDeafen={toggleVoiceDeafen}
              />
            </div>
            {activeSidebarTab === 'ai' && (
              <AiCmsContainer 
                onClose={() => setActiveSidebarTab(null)}
                stages={stages}
                selectedStageId={selectedStageId}
                onAddLayer={(type, data) => {
                  if (!selectedStageId) return;
                  handleAddLayer(selectedStageId, data, type);
                }}
              />
            )}
            {activeSidebarTab === 'video' && (
              <VideoAssetContainer 
                assets={videoAssets} 
                mediaAssets={mediaAssets}
                onAdd={(newVideo) => setVideoAssets(prev => [newVideo, ...prev])} 
                onUpdate={(index, updatedVideo) => {
                  setVideoAssets(prev => {
                    const next = [...prev];
                    next[index] = updatedVideo;
                    return next;
                  });
                }}
                onDoubleClickAsset={handleDropOnWorkspace}
                showNotification={showNotification}
              />
            )}
            {activeSidebarTab === 'media' && (
              <MediaAssetContainer 
                assets={mediaAssets} 
                onUpload={(url) => setMediaAssets(prev => [...prev, url])} 
                onDoubleClickAsset={handleDropOnWorkspace}
              />
            )}
            {activeSidebarTab === 'button' && (
              <ButtonAssetContainer 
                onDoubleClickAsset={handleDropOnWorkspace} 
                customAssets={customButtonAssets} 
                onDeleteAsset={handleDeleteButtonAsset}
              />
            )}

            {activeSidebarTab === 'widget' && (
              <WidgetAssetContainer 
                widgets={widgetAssets} 
                fonts={fonts}
                onAdd={(newWidget) => setWidgetAssets(prev => [...prev, newWidget])} 
                onUpdate={(id, updatedWidget) => setWidgetAssets(prev => prev.map(w => w.id === id ? { ...w, ...updatedWidget } : w))}
                onDoubleClickAsset={handleDropOnWorkspace}
                showNotification={showNotification}
              />
            )}
            {activeSidebarTab === 'shape' && (
              <PolygonAssetContainer 
                onClose={() => setActiveSidebarTab(null)} 
                onDoubleClickAsset={handleDropOnWorkspace}
              />
            )}
            {activeSidebarTab === 'font' && (
              <FontAssetContainer 
                fonts={fonts} 
                onUpload={() => {
                   // Refresh fonts after upload
                   const fetchFonts = async () => {
                      const brandId = '671a1666d786fa251fca95d0';
                      const globalResponse = await fetch('/fonts/list?family=');
                      const globalData = await globalResponse.json();
                      let globalList = Array.isArray(globalData) ? globalData : (globalData.data || []);
                      
                      // Corrected usage of FONT_LIST_URL
                      const brandResponse = await fetch(`${FONT_LIST_URL}?brandId=${brandId}&family=`);
                      const brandData = await brandResponse.json();
                      const brandList = (Array.isArray(brandData) ? brandData : (brandData.data || [])).map((f: any) => ({ ...f, isBrandFont: true }));
                      
                      setFonts([...brandList, ...globalList]);
                   };
                   fetchFonts();
                }}
              />
            )}
          </>
        )}

        <div className="flex-1 flex flex-col relative min-w-0">
          {mode === 'design' && (
            <TopToolbar 
              onAddStageClick={() => setIsAddStageModalOpen(true)} 
              onAddLandingPageClick={() => setIsLandingPageModalOpen(true)}
              zoom={zoom} 
              onZoomChange={setZoom}
              isSnapEnabled={isSnapEnabled}
              onSnapToggle={() => setIsSnapEnabled(!isSnapEnabled)}
              onAlign={handleAlignLayers}
              selectedCount={selectedLayerIds.length}
              isSyncEnabled={isSyncEnabled}
              onSyncToggle={() => setIsSyncEnabled(prev => !prev)}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onFitAll={() => {
                workspaceRef.current?.fitAllStages();
              }}
            />
          )}
          
          {mode !== 'design' ? (
            <AnimateView 
              stages={mode === 'preview' ? filteredStages : stages}
              selectedLayerIds={selectedLayerIds}
              onLayersSelect={handleLayersSelect}
              onUpdateLayerAnimation={handleUpdateLayerAnimation}
              onUpdateStageMarkers={handleUpdateStageMarkers}
              onDurationChange={handleDurationChange}
              onLayerClick={handleLayerClick}
              onAddStage={() => setIsAddStageModalOpen(true)}
              zoom={zoom}
              playbackStates={currentPB}
              onPlayToggle={togglePlayback}
              onSeek={handleSeek}
              onCopyAnimation={handleCopyAnimation}
              onPasteAnimation={handlePasteAnimation}
              isPreviewMode={mode === 'preview'}
              onTriggerAction={handleTriggerAction}
              actionStates={actionStates}
              editingLayerIds={editingLayerIds}
              fonts={fonts}
              isInteractive={mode === 'preview'}
            />
          ) : (
            <>
            <div 
              className="flex-1 relative flex flex-col min-h-0"
              onMouseEnter={() => setIsMouseInWorkspace(true)}
              onMouseLeave={() => setIsMouseInWorkspace(false)}
            >
              <Workspace 
                ref={workspaceRef}
                stages={stages}
                selectedStageId={selectedStageId}
                onAddLayer={(stageId, layer, prefix) => handleAddLayer(stageId, layer as any, prefix)}
                onDropOnWorkspace={handleDropOnWorkspace}
                selectedLayerIds={selectedLayerIds}
                hoveredLayerId={hoveredLayerId}
                onHoverLayer={setHoveredLayerId}
                onLayersSelect={handleLayersSelect}
                onUpdateLayers={handleUpdateLayers}
                onBatchUpdateLayers={handleBatchUpdateLayers}
                onGroup={handleGroupLayers}
                onUngroup={handleUngroupLayers}
                activeGroupId={activeGroupId}
                onActiveGroupChange={handleNavigateToGroup}
                onDuplicateLayers={handleDuplicateLayers}
                breadcrumbs={breadcrumbs}
                isSnapEnabled={isSnapEnabled}
                onLayerClick={handleLayerClick}
                zoom={zoom}
                onZoomChange={setZoom}
                onDelete={handleDeleteSelected}
                onUpdateStagePosition={handleUpdateStagePosition}
                onUpdateStageName={handleUpdateStageName}
                onArrangeStages={handleArrangeStages}
                onAddGuideLine={handleAddGuideLine}
                onUpdateGuideLine={handleUpdateGuideLine}
                onDeleteGuideLine={handleDeleteGuideLine}
                onCreateButtonAsset={handleCreateButtonAsset}
                pushToHistory={pushToHistory}
                onDuplicateStage={(id: string) => {
                    const stage = stages.find(s => s.id === id);
                    if (stage) setDuplicateModalConfig({ isOpen: true, sourceStage: stage });
                }}
                currentTime={selectedStageId ? (currentPB[selectedStageId]?.currentTime || 0) : 0}
                playbackStates={currentPB}
                isPreviewMode={false}
                activeSidebarTab={activeSidebarTab}
                onToolCompleted={() => setActiveSidebarTab(null)}
                editingLayerIds={editingLayerIds}
                onStartEditing={(stageId, layerId) => setEditingLayerIds(prev => ({ ...prev, [stageId]: layerId }))}
                onStopEditing={(sId: string | undefined) => setEditingLayerIds(prev => ({ ...prev, [sId || '']: null }))}
                previewState={previewState}
                actionStates={actionStates}
                onTriggerAction={handleTriggerAction}
                onLandingPageAction={handleLandingPageAction}
                onCopyLayer={handleCopyLayer}
                onPasteLayer={handlePasteLayer}
                hasLayerClipboard={!!layerClipboard}
                followedUserId={followedUserId}
                lastUsedTextStyles={lastUsedTextStyles}
                collaboratorCursors={
                    Object.entries(collaborators)
                    .filter(([id, c]) => id !== userIdRef.current && c.x !== undefined && c.y !== undefined)
                    .reduce((acc, [id, c]) => ({
                        ...acc,
                        [id]: {
                            x: c.x!,
                            y: c.y!,
                            name: c.name,
                            activeMessage: c.lastMessage,
                            color: `hsl(${parseInt(id.replace(/\D/g, '').substring(0, 3) || '0') % 360}, 70%, 50%)`
                        }

                    }), {})
                }
                onContentMouseMove={handleContentMouseMove}
                onStageSelect={(id: string | null) => {
                  if (followedUserId) setFollowedUserId(null); // Break follow on interaction
                  handleStageSelect(id);
                }}
                fonts={fonts}
                chatMessages={chatMessages}
                chatInput={chatInput}
                onCloseChatInput={() => {
                  setChatInput(null);
                  if (socketRef.current?.readyState === WebSocket.OPEN) {
                    socketRef.current.send(JSON.stringify({
                      type: 'CHAT_CLOSED',
                      senderId: userIdRef.current
                    }));
                  }
                }}
                onSendChatMessage={handleSendChatMessage}
                onOpenChatInput={(x, y) => {
                   setChatInput({ x, y });
                   // Also send an empty message to clear any stale messages on others' screens when we start
                   handleSendChatMessage('');
                }}
              />

            </div>

              <Timeline
                 stages={stages}
                 selectedStageId={selectedStageId}
                 onRename={handleRenameLayer}
                 onReorder={handleReorderLayers}
                 onMoveLayer={handleMoveLayer}
                 onHoverLayer={setHoveredLayerId}
                 selectedLayerIds={selectedLayerIds}
                 onLayersSelect={handleLayersSelect}
                 duration={currentDuration}
                 onDurationChange={(val) => handleDurationChange(selectedStageId!, val)}
                 onUpdateLayerAnimation={handleUpdateLayerAnimation}
                 onUpdateTextAnimation={handleUpdateTextAnimation}
                 onUpdateLayer={(id, updates) => handleUpdateLayers([id], updates)}
                 onUpdateStageMarkers={handleUpdateStageMarkers}
                 onCopyAnimation={handleCopyAnimation}
                 onPasteAnimation={handlePasteAnimation}
                 height={timelineHeight}
                 onHeightChange={handleTimelineHeightChange}
                 isResizable={true}
                 onTextPopupOpenChange={setIsTextPopupOpen}
                 currentTime={selectedStageId ? (currentPB[selectedStageId]?.currentTime || 0) : 0}
                 isPlaying={selectedStageId ? (currentPB[selectedStageId]?.isPlaying || false) : false}
                  onPlayToggle={() => selectedStageId && togglePlayback(selectedStageId)}
                  onSeek={(time) => selectedStageId && handleSeek(selectedStageId, time)}
                  activeGroupId={activeGroupId}
                  onActiveGroupChange={setActiveGroupId}
                  onEditKeyframe={(config) => setEditingKeyframeInfo(config)}
               />
            </>
          )}
        </div>

        <PropertiesBar 
          selectedLayerIds={selectedLayerIds}
          stages={stages}
          onUpdateLayers={handleUpdateLayers}
          onUpdateStage={handleUpdateStage}
          onBatchUpdateStages={handleBatchUpdateStages}
          onArrangeStages={handleArrangeStages}
          onStageSelect={handleStageSelect}
          selectedStageId={selectedStageId}
          mode={mode}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedSize={selectedSize}
          onSizeChange={setSelectedSize}
          editingLayerIds={editingLayerIds}
          previewState={previewState}
          onPreviewStateChange={setPreviewState}
          onUpdateLayerAnimation={handleUpdateLayerAnimation}
          fonts={fonts}
          mediaAssets={mediaAssets}
          onUpdateMediaAssets={setMediaAssets}
          editingKeyframeInfo={editingKeyframeInfo}
          onCloseKeyframeEditor={() => setEditingKeyframeInfo(null)}
          onSendMessageClick={() => setChatInput({ x: lastMousePosRef.current.x, y: lastMousePosRef.current.y })}
          currentTime={selectedStageId ? (currentPB[selectedStageId]?.currentTime || 0) : 0}
        />

      </div>

            <AddStageModal 
                isOpen={isAddStageModalOpen} 
                onClose={() => setIsAddStageModalOpen(false)} 
                onAdd={handleAddStages} 
            />

            <LandingPageModal 
                isOpen={isLandingPageModalOpen} 
                onClose={() => setIsLandingPageModalOpen(false)} 
                onAdd={handleAddLandingPage} 
            />

            <DuplicateStageModal
                isOpen={duplicateModalConfig.isOpen}
                onClose={() => setDuplicateModalConfig({ isOpen: false, sourceStage: null })}
                sourceStage={duplicateModalConfig.sourceStage}
                onDuplicate={handleDuplicateStage}
            />

            <SettingsPopup
                isOpen={isSettingsPopupOpen}
                onClose={() => setIsSettingsPopupOpen(false)}
                stages={stages}
            />
      
      {/* Global Modals or Overlays */}
      {notification && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[3000] p-4 bg-white border border-gray-100 rounded-[24px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] flex items-center gap-4 min-w-[320px] animate-in slide-in-from-bottom-5 duration-300">
          <div className={`size-10 rounded-xl flex items-center justify-center ${
            notification.type === 'error' ? 'bg-red-50 text-red-500' : 
            notification.type === 'success' ? 'bg-green-50 text-green-500' : 
            'bg-blue-50 text-blue-500'
          }`}>
            <span className="material-symbols-outlined text-[24px]">
              {notification.type === 'error' ? 'priority_high' : 
               notification.type === 'success' ? 'check_circle' : 'info'}
            </span>
          </div>
          <div className="flex flex-col">
            <h4 className="text-[12px] font-bold text-gray-800 leading-none capitalize">{notification.type}</h4>
            <p className="text-[11px] text-gray-500 font-medium mt-1">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="ml-auto text-gray-300 hover:text-gray-600 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default App
