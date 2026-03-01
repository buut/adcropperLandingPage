import React from 'react';
import { createPortal } from 'react-dom';

import { animations, animationInfo } from '../data/animationData';

interface AnimationPopupProps {
  type: 'entry' | 'main' | 'exit';
  onSelect: (animation: string) => void;
  onClose: () => void;
  onRepeatChange?: (layerId: string, count: number) => void;
  onEasingChange?: (layerId: string, easing: string) => void;
  repeatCount?: number;
  currentEasing?: string;
  layerId?: string;
  style?: React.CSSProperties;
}

const toCssValue = (v: string | number) => typeof v === 'number' ? `${v}px` : v;

const generateKeyframes = (animName: string) => {
  const trimmedName = animName.trim();
  const info = animationInfo[trimmedName];
  if (!info) return '';

  if (info.raw) {
    // Ensure the keyframe name in raw CSS is prefixed with kf-
    return info.raw.replace(new RegExp(`@keyframes ${trimmedName}`, 'g'), `@keyframes kf-${trimmedName}`)
      .replace(new RegExp(`@-webkit-keyframes ${trimmedName}`, 'g'), `@-webkit-keyframes kf-${trimmedName}`);
  }

  const steps = info.css;
  const action = info.action;

  if (!steps) return '';

  let keyframes = '';

  const getProperties = (cssObj: any) => {
    const props: string[] = [];

    if (cssObj.opacity !== undefined) props.push(`opacity: ${cssObj.opacity}`);

    let transform = '';
    const tx = toCssValue(cssObj.translateX || 0);
    const ty = toCssValue(cssObj.translateY || 0);
    // If we have translations, include them
    if (cssObj.translateX !== undefined || cssObj.translateY !== undefined) {
      transform += `translate(${tx}, ${ty}) `;
    }

    const s = cssObj.scale ?? 1;
    const sx = cssObj.scaleX ?? s;
    const sy = cssObj.scaleY ?? s;
    const sz = cssObj.scaleZ ?? 1;
    transform += `scale3d(${sx}, ${sy}, ${sz}) `;

    if (cssObj.rotation !== undefined) transform += `rotate(${cssObj.rotation}deg) `;
    if (cssObj.rotationX !== undefined) transform += `rotateX(${cssObj.rotationX}deg) `;
    if (cssObj.rotationY !== undefined) transform += `rotateY(${cssObj.rotationY}deg) `;
    if (cssObj.rotationZ !== undefined) transform += `rotateZ(${cssObj.rotationZ}deg) `;

    if (cssObj.skewX !== undefined || cssObj.skewY !== undefined) {
      transform += `skew(${cssObj.skewX ?? 0}deg, ${cssObj.skewY ?? 0}deg) `;
    }

    if (cssObj.transform) transform += cssObj.transform;

    if (transform) props.push(`transform: ${transform.trim()}`);
    if (cssObj.transformOrigin) props.push(`transform-origin: ${cssObj.transformOrigin}`);
    if (cssObj.clipPath) props.push(`clip-path: ${cssObj.clipPath}`);

    return props.join('; ') + ';';
  };

  // Helper for starting frame of "to" animations
  const baseFrame = "opacity: 1; transform: translate(0px, 0px) scale3d(1, 1, 1) rotate(0deg) rotateX(0deg) rotateY(0deg) skew(0deg, 0deg);";

  if (action === "from") {
    keyframes = `
      0% { ${getProperties(steps[0])} }
      100% { ${baseFrame} ${steps[0].transformOrigin ? `transform-origin: ${steps[0].transformOrigin};` : ''} }
    `;
  } else if (action === "to") {
    if (steps.length === 1) {
      keyframes = `
        0% { ${baseFrame} ${steps[0].transformOrigin ? `transform-origin: ${steps[0].transformOrigin};` : ''} }
        100% { ${getProperties(steps[0])} }
      `;
    } else {
      const stepPercent = 100 / (steps.length - 1);
      keyframes = steps.map((s: any, i: number) => `
        ${Math.round(i * stepPercent)}% { ${getProperties(s)} }
      `).join('\n');
    }
  }

  return `@keyframes kf-${trimmedName} { ${keyframes} }`;
};

const AnimationPreviewButton = React.memo(({
  anim,
  repeatCount,
  currentEasing,
  previewColor,
  onSelect,
  type
}: {
  anim: string,
  repeatCount: number,
  currentEasing: string,
  previewColor: string,
  onSelect: (val: string) => void,
  type: 'entry' | 'main' | 'exit'
}) => {
  const [key, setKey] = React.useState(0);
  const trimmedAnim = anim.trim();
  const keyframesStyle = React.useMemo(() => generateKeyframes(trimmedAnim), [trimmedAnim]);

  const info = animationInfo[trimmedAnim];
  // Any animation in 'exit' category OR labeled with 'to' action should loop Out-and-In for preview
  const isExit = type === 'exit' || info?.action === 'to';

  const iterations = isExit ? 2 : 1;
  const direction = isExit ? 'alternate' : 'normal';
  // Snappy duration for preview: 0.7s per iteration, adjusted by repeat scale
  const baseDuration = 0.7;

  const easing = ['elastic', 'bounce', 'back-in', 'back-out', 'smoothstep'].includes(currentEasing) ? 'ease-in-out' : currentEasing;

  return (
    <button
      onClick={() => onSelect(trimmedAnim)}
      onMouseEnter={() => setKey(k => k + 1)}
      className="group flex flex-col items-center p-3.5 rounded-2xl border border-gray-100 hover:border-primary/20 hover:bg-primary/[0.04] transition-all relative overflow-hidden active:scale-95 translate-0"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="size-14 bg-gray-50 rounded-xl flex items-center justify-center mb-3.5 group-hover:bg-white shadow-inner group-hover:shadow-md transition-all relative overflow-hidden" style={{ perspective: '500px' }}>
        <style>{keyframesStyle}</style>
        <div
          key={key}
          className="size-6 rounded-md shadow-sm"
          style={{
            backgroundColor: previewColor,
            animationName: `kf-${trimmedAnim}`,
            animationDuration: `${baseDuration}s`,
            animationIterationCount: iterations,
            animationDirection: direction,
            animationTimingFunction: easing,
            animationFillMode: 'forwards'
          }}
        />
      </div>

      <span className="text-[10px] font-bold text-gray-600 group-hover:text-primary transition-colors text-center line-clamp-2 leading-tight uppercase tracking-tighter">
        {trimmedAnim.replace(/-/g, ' ')}
      </span>
    </button>
  );
});

const AnimationPopup: React.FC<AnimationPopupProps> = ({
  type, onSelect, onClose, onRepeatChange, onEasingChange,
  repeatCount = 1, currentEasing = 'ease-in-out', layerId, style
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const easingRef = React.useRef<HTMLDivElement>(null);
  const [adjustedStyle, setAdjustedStyle] = React.useState<React.CSSProperties>(style || {});
  const [isEasingOpen, setIsEasingOpen] = React.useState(false);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (easingRef.current && !easingRef.current.contains(event.target as Node)) {
        setIsEasingOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const easingOptions = [
    { id: 'linear', label: 'None (Linear)', icon: 'horizontal_rule' },
    { id: 'ease-in', label: 'Ease In', icon: 'trending_up' },
    { id: 'ease-out', label: 'Ease Out', icon: 'trending_down' },
    { id: 'ease-in-out', label: 'Ease In Out', icon: 'unfold_more' },
    { id: 'smoothstep', label: 'Smoothstep', icon: 'waves' },
    { id: 'elastic', label: 'Elastic', icon: 'gesture' },
    { id: 'bounce', label: 'Bounce', icon: 'sports_baseball' },
    { id: 'back-in', label: 'Back In', icon: 'keyboard_backspace' },
    { id: 'back-out', label: 'Back Out', icon: 'arrow_forward' },
  ];

  React.useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      const width = rect.width;
      const height = rect.height;

      const initialLeft = typeof style?.left === 'number' ? style.left : (typeof style?.left === 'string' ? parseFloat(style.left) : rect.left);
      const initialTop = typeof style?.top === 'number' ? style.top : (typeof style?.top === 'string' ? parseFloat(style.top) : rect.top);

      let newLeft = initialLeft;
      let newTop = initialTop;

      if (newLeft + width > winW - 20) {
        newLeft = winW - width - 20;
      }
      if (newLeft < 20) newLeft = 20;

      if (newTop + height > winH - 20) {
        newTop = winH - height - 20;
      }
      if (newTop < 20) newTop = 20;

      setAdjustedStyle({
        position: 'fixed',
        left: `${newLeft}px`,
        top: `${newTop}px`,
        opacity: 1
      });
    }
  }, [style]);

  const currentCategory: 'start' | 'middle' | 'end' =
    type === 'entry' ? 'start' :
      type === 'exit' ? 'end' :
        'middle';

  const currentAnimations: any = animations[currentCategory] || {};
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  const typeColor = type === 'entry' ? 'text-entry bg-entry/10' :
    type === 'exit' ? 'text-exit bg-exit/10' :
      'text-middle bg-middle/10';

  const previewColor = type === 'entry' ? '#10b981' :
    type === 'exit' ? '#ef4444' :
      '#3b82f6';

  const categoryIcons: Record<string, string> = {
    "Fade Animations": "blur_on",
    "Scale Animations": "aspect_ratio",
    "Slide Animations": "login",
    "Rotate & Swirl": "sync",
    "Flip & 3D": "3d_rotation",
    "Mask & Wipe": "layers",
    "Attention Seekers": "priority_high",
    "Movement": "open_with",
    "Wobble & Jello": "vibration",
    "Shake & Vibrate": "sensors",
    "vibrate": "vibration",
    "flicker": "bolt",
    "shake": "sensors",
    "jello": "waves",
    "wobble": "motion_sensor_active",
    "bounce": "keyboard_double_arrow_up",
    "pulsate": "favorite",
    "blink": "visibility",
    "Tracking In (Text)": "text_fields",
    "Focus In (Text)": "center_focus_strong",
    "Flicker In (Text)": "bolt",
    "Shadow Pop (Text)": "layers",
    "Tracking Out (Text)": "text_fields",
    "Blur Out (Text)": "blur_off",
    "Flicker Out (Text)": "flash_off",
    "Scale Up": "zoom_in",
    "Scale Down": "zoom_out",
    "Rotate": "sync",
    "Rotate Scale": "3d_rotation",
    "Rotate 90": "rotate_right",
    "Flip": "flip",
    "Flip Scale 2": "cached",
    "Swing": "settings_backup_restore",
    "Slide": "login",
    "Slide Bck": "arrow_back",
    "Slide Fwd": "arrow_forward",
    "Slide Rotate": "rotate_left",
    "Shadow Drop": "layers",
    "Shadow Drop 2": "filter_none",
    "Shadow Pop": "dynamic_feed",
    "Scale In": "zoom_in",
    "Rotate In": "sync",
    "Rotate In 2": "cached",
    "Swirl In": "cyclone",
    "Flip In": "flip",
    "Slit In": "splitscreen",
    "Slide In": "login",
    "Slide In Fwd": "arrow_forward",
    "Bounce In": "keyboard_double_arrow_up",
    "Roll In": "auto_mode",
    "Roll In Blurred": "blur_on",
    "Tilt In": "3d_rotation",
    "Tilt In Fwd": "view_in_ar",
    "Swing In": "settings_backup_restore",
    "Fade In": "blur_on",
    "Puff In": "cloud_download",
    "Flicker In": "bolt",
    "Scale Out": "aspect_ratio",
    "Rotate Out": "sync_disabled",
    "Swirl Out": "Cyclone",
    "Flip Out": "flip",
    "Slit Out": "splitscreen",
    "Slide Out": "logout",
    "Bounce Out": "keyboard_double_arrow_down",
    "Roll Out": "auto_mode",
    "Swing Out": "settings_backup_restore",
    "Fade Out": "blur_off",
    "Puff Out": "cloud_upload",
    "Flicker Out": "flash_off"
  };

  const allCategories = Object.keys(currentAnimations);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[99998]"
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        ref={containerRef}
        className="fixed z-[99999] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-gray-200 w-[650px] max-h-[640px] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        style={{ ...style, ...adjustedStyle, opacity: containerRef.current ? 1 : 0 }}
      >

        <div className="px-6 py-5 border-b border-gray-100 bg-white flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[24px]">auto_awesome</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                  {type.toUpperCase()} Animation
                </span>
                <span className="text-lg font-black text-gray-900 leading-tight">Effect Gallery</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative" ref={easingRef}>
                <button
                  onClick={() => setIsEasingOpen(!isEasingOpen)}
                  className="flex items-center bg-gray-50 border border-gray-100 rounded-xl px-3 py-1.5 shadow-sm hover:border-primary/30 transition-all cursor-pointer min-w-[130px]"
                >
                  <span className="text-[10px] font-black text-gray-500 uppercase mr-2 select-none">Easing</span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-tight truncate">
                      {easingOptions.find(e => e.id === currentEasing)?.label.split(' (')[0] || 'Ease In Out'}
                    </span>
                  </div>
                  <span className={`material-symbols-outlined text-[14px] text-gray-400 ml-1 transition-transform ${isEasingOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>

                {isEasingOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[10000] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 w-[180px]">
                    <div className="px-3 py-2 border-b border-gray-50 bg-gray-50/30">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="material-symbols-outlined text-[14px]">auto_graph</span>
                        Easing Curves
                      </div>
                    </div>
                    <div className="p-1 max-h-[280px] overflow-y-auto custom-scrollbar">
                      {easingOptions.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => {
                            if (layerId && onEasingChange) onEasingChange(layerId, opt.id);
                            setIsEasingOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 transition-all hover:bg-primary/5 group/opt ${currentEasing === opt.id ? 'bg-primary/[0.03]' : ''}`}
                        >
                          <div className={`size-6 rounded-md flex items-center justify-center shrink-0 transition-all ${currentEasing === opt.id ? 'bg-primary text-white' : 'bg-gray-50 text-gray-400 group-hover/opt:bg-white group-hover/opt:text-primary'}`}>
                            <span className="material-symbols-outlined text-[14px]">{opt.icon}</span>
                          </div>
                          <div className="flex flex-col items-start min-w-0">
                            <span className={`text-[9px] font-black uppercase tracking-tight truncate ${currentEasing === opt.id ? 'text-primary' : 'text-gray-700'}`}>{opt.label}</span>
                          </div>
                          {currentEasing === opt.id && <span className="material-symbols-outlined text-primary text-[14px] ml-auto">check</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {type === 'main' && (
                <div className="flex items-center bg-blue-50 border border-blue-100 rounded-xl pl-3 pr-1 py-1 shadow-sm h-9">
                  <span className="text-[10px] font-black text-blue-600 uppercase mr-2 select-none">Loops</span>
                  <div className="flex items-center">
                    <input
                      type="number"
                      min="0"
                      value={repeatCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        if (layerId && onRepeatChange) onRepeatChange(layerId, val);
                      }}
                      className="w-7 text-[10px] font-black text-blue-700 focus:outline-none bg-transparent appearance-none text-center"
                      style={{ border: 'none', padding: '0' }}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex flex-col ml-1">
                      <button
                        onClick={() => { if (layerId && onRepeatChange) onRepeatChange(layerId, repeatCount + 1); }}
                        className="size-3.5 flex items-center justify-center text-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
                        title="Increase"
                      >
                        <span className="material-symbols-outlined text-[16px] leading-none">expand_less</span>
                      </button>
                      <button
                        onClick={() => { if (layerId && onRepeatChange) onRepeatChange(layerId, Math.max(0, repeatCount - 1)); }}
                        className="size-3.5 flex items-center justify-center text-blue-400 hover:text-blue-700 transition-colors cursor-pointer"
                        title="Decrease"
                      >
                        <span className="material-symbols-outlined text-[16px] leading-none">expand_more</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 ${typeColor}`}>
                <span className="material-symbols-outlined text-[14px]">
                  {type === 'entry' ? 'login' : type === 'exit' ? 'logout' : 'sync'}
                </span>
                {type}
              </div>
            </div>
          </div>

          <div className="relative group">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-[20px] group-focus-within:text-primary transition-colors">search</span>
            <input
              type="text"
              placeholder="Search effects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 group-hover:bg-white group-hover:border-gray-200 rounded-2xl py-3 pl-12 pr-4 text-sm focus:ring-4 focus:ring-primary/5 focus:border-primary focus:bg-white outline-none transition-all placeholder:text-gray-400 font-medium"
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-[72px] border-r border-gray-100 bg-gray-50/20 flex flex-col items-center py-6 gap-3 overflow-y-auto scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`group relative size-12 rounded-2xl flex items-center justify-center transition-all ${!selectedCategory ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-white text-gray-400 hover:text-gray-600 hover:scale-105 border border-gray-100'}`}
              title="All Categories"
            >
              <span className="material-symbols-outlined text-[24px]">grid_view</span>
              {!selectedCategory && <div className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
            </button>

            <div className="w-8 h-[1px] bg-gray-100 my-1" />

            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`group relative size-12 rounded-2xl flex items-center justify-center transition-all ${selectedCategory === cat ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-white text-gray-400 hover:text-gray-600 hover:scale-105 border border-gray-100'}`}
                title={cat}
              >
                <span className="material-symbols-outlined text-[24px]">
                  {categoryIcons[cat] || 'bubble_chart'}
                </span>
                {selectedCategory === cat && <div className="absolute -left-[1px] top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
            <div className="space-y-8">
              {(!selectedCategory || searchTerm) && (
                <div>
                  <button
                    onClick={() => onSelect('')}
                    className="group flex items-center gap-5 p-4 w-full rounded-2xl border-2 border-dashed border-gray-100 hover:border-red-200 hover:bg-red-50/50 transition-all text-left"
                  >
                    <div className="size-12 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white shadow-inner group-hover:shadow-md transition-all flex-shrink-0">
                      <span className="material-symbols-outlined text-gray-400 group-hover:text-red-500 text-[28px]">block</span>
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-gray-500 group-hover:text-red-600 transition-colors uppercase tracking-[0.1em] block">
                        Reset Animation
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">Remove applied effect</span>
                    </div>
                  </button>
                </div>
              )}

              {Object.entries(currentAnimations)
                .filter(([groupName]) => !selectedCategory || selectedCategory === groupName)
                .map(([groupName, anims]: [string, any]) => {
                  const filteredAnims = anims.filter((a: string) => a.toLowerCase().includes(searchTerm.toLowerCase()));
                  if (filteredAnims.length === 0) return null;

                  return (
                    <div key={groupName} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[11px] font-black text-gray-900 uppercase tracking-widest">{groupName}</span>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {filteredAnims.map((anim: string) => (
                          <AnimationPreviewButton
                            key={anim}
                            anim={anim}
                            repeatCount={repeatCount}
                            currentEasing={currentEasing}
                            previewColor={previewColor}
                            onSelect={onSelect}
                            type={type}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/30 flex justify-between items-center">
          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
            Built-in GPU Accelerated Presets
          </span>
          <button
            onClick={onClose}
            className="text-[11px] font-black text-gray-500 hover:text-primary transition-all py-2 px-5 rounded-xl hover:bg-primary/5 cursor-pointer flex items-center gap-2"
          >
            Dismiss Gallery
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d1d5db; }
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    </>,
    document.body
  );
};

export default AnimationPopup;
