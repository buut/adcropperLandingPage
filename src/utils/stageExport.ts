import { Stage, Layer } from '../App';

export interface NodeElementSummary {
  id: string;
  htmlId: string;
  type: string;
  name: string;
  isFake: boolean;
}

export interface NodeElementDetail extends NodeElementSummary {
  elements: NodeElementSummary[];
  css: Record<string, string | number>;
  [key: string]: any;
}

export interface NodeFrame {
  frameId: string;
  name: string;
  width: number;
  height: number;
  css: Record<string, string | number>;
  fonts: string;
  x?: number;
  y?: number;
}

const mapType = (type: string) => {
  switch (type) {
    case 'image': return 'RECTANGLE';
    case 'group': return 'GROUP';
    case 'text': return 'TEXT';
    case 'button': return 'RECTANGLE';
    case 'widget': return 'RECTANGLE';
    default: return type.toUpperCase();
  }
};

const sanitizeId = (id: string) => id.replace(/:/g, '_').replace(/-/g, '_');
const sanitizeHtmlId = (id: string) => `id${sanitizeId(id)}`;

const flattenLayers = (layers: Layer[], nodeMap: Record<string, any>) => {
  return layers.map(layer => {
    const summary: NodeElementSummary = {
      id: layer.id,
      htmlId: sanitizeHtmlId(layer.id),
      type: mapType(layer.type),
      name: layer.name,
      isFake: false
    };

    const css: Record<string, string | number> = {
      width: `${layer.width}px`,
      height: `${layer.height}px`,
      position: 'absolute',
      opacity: 1,
      left: `${layer.x - layer.width / 2}px`,
      top: `${layer.y - layer.height / 2}px`,
      transform: `rotate(${layer.rotation}deg)`,
      transformOrigin: 'left top',
      zIndex: layer.zIndex,
    };

    const detail: NodeElementDetail = {
      ...summary,
      elements: layer.children ? flattenLayers(layer.children, nodeMap) : [],
      css,
      x: layer.x,
      y: layer.y,
      easing: layer.easing,
      opacity: layer.opacity ?? 1,
      transformX: layer.transformX,
      transformY: layer.transformY,
      transformZ: layer.transformZ,
      rotateX: layer.rotateX,
      rotateY: layer.rotateY,
      rotateZ: layer.rotateZ,
      scaleX: layer.scaleX,
      scaleY: layer.scaleY,
      scaleZ: layer.scaleZ,
      skewX: layer.skewX,
      skewY: layer.skewY,
    };

    if (layer.type === 'image' && layer.url) {
      detail.bgimages = {
        "1x": {
          "name": `${sanitizeId(layer.id)}_1x`,
          "data": layer.url,
          "size": { width: layer.width, height: layer.height }
        }
      };
      detail.css["background-image"] = `url(${layer.url})`;
      detail.css["background-size"] = "cover";
    }

    if (layer.variant) {
      try {
        detail.meta = JSON.parse(layer.variant);
        if (layer.type === 'button') {
          detail.css["background-color"] = detail.meta.color || '#007aff';
        }
      } catch (e) {
        detail.meta = {};
      }
    }

    nodeMap[layer.id] = detail;
    return summary;
  });
};

const getLoopElements = (layers: Layer[], filterDynamic: boolean): { htmlIds: string[], originalIds: string[] } => {
  let htmlIds: string[] = [];
  let originalIds: string[] = [];
  
  layers.forEach(l => {
    // Check if the layer itself or any of its children (if it's a group) are considered for this filter
    // For simplicity, we categorize by the specific layer's isDynamic property
    const layerIsDynamic = !!l.isDynamic;
    if (layerIsDynamic === filterDynamic) {
       htmlIds.push(sanitizeHtmlId(l.id));
       originalIds.push(l.id);
    }
    if (l.children) {
      const nested = getLoopElements(l.children, filterDynamic);
      htmlIds = [...htmlIds, ...nested.htmlIds];
      originalIds = [...originalIds, ...nested.originalIds];
    }
  });
  
  return { htmlIds, originalIds };
};

const buildAnimationBlock = (stage: Stage) => {
  const pictures: Record<string, any> = {};
  if (!stage.markers || stage.markers.length === 0) {
    pictures.frameImage0 = { position: 0, width: 0, time: 0, html: {} };
  } else {
    stage.markers.forEach((marker, index) => {
      pictures[`frameImage${index}`] = {
        position: index,
        width: 0,
        time: marker.time,
        html: {}
      };
    });
  }
  const anim: Record<string, any> = {
    duration: stage.duration,
    pictures,
  };

  const dynamic = getLoopElements(stage.layers, true);
  const global = getLoopElements(stage.layers, false);

  anim.dynamicLoop = {
    loop: stage.feedLoopCount ?? -1,
    loopElements: dynamic.htmlIds,
    loopElementsReference: dynamic.originalIds
  };

  anim.globalLoop = {
    loop: stage.loopCount ?? -1,
    stopAt: stage.stopAtSecond ?? stage.duration,
    loopElements: global.htmlIds
  };

  anim.actions = stage.actions || [];

  const processLayer = (layers: Layer[]) => {
    layers.forEach(layer => {
      if (layer.animation) {
        anim[layer.id] = {
          enter: {
            animation: layer.animation.entry?.name || "none",
            start: (layer.animation.entry?.start ?? 0) / 100,
            duration: (layer.animation.entry?.duration ?? 0) / 100
          },
          middle: {
            loop: layer.animation.main?.repeat ?? 1,
            animation: layer.animation.main?.name || "none",
            start: (layer.animation.main?.start ?? 0) / 100,
            duration: (layer.animation.main?.duration ?? 0) / 100
          },
          end: {
            animation: layer.animation.exit?.name || "none",
            start: (layer.animation.exit?.start ?? 0) / 100,
            duration: (layer.animation.exit?.duration ?? 0) / 100
          },
          keyframes: layer.animation.keyframes?.map(kf => {
            const { x, y, height, ...rest } = kf.props as any;
            return {
              time: kf.time / 100,
              props: rest
            };
          })
        };
      }
      if (layer.children) processLayer(layer.children);
    });
  };

  processLayer(stage.layers);

  return anim;
};

export const convertStagesToStageObject = (stages: Stage[], images?: Record<string, { "1x": string, "2x": string }>, assets?: any, info?: any): any => {
  const results = stages.map(stage => {
    const nodeMap: Record<string, any> = {};
    const rootElements = flattenLayers(stage.layers, nodeMap);

    const frame: NodeFrame = {
      frameId: stage.id,
      name: stage.name,
      width: stage.width,
      height: stage.height,
      css: {
        width: `${stage.width}px`,
        height: `${stage.height}px`,
        maxWidth: `${stage.width}px`,
        maxHeight: `${stage.height}px`,
        position: 'absolute',
        display: 'block',
        padding: '0px',
        background: stage.backgroundColor || '#ffffff',
      },
      fonts: '', 
      x: stage.x,
      y: stage.y
    };

    nodeMap.frame = frame;
    nodeMap[stage.id] = {
      elements: rootElements,
      css: frame.css
    };

    const stageObj: any = { 
      node: nodeMap,
      animation: buildAnimationBlock(stage)
    };

    if (images) {
      const stageImages: Record<string, { "1x": string, "2x": string }> = {};
      const collectIds = (layers: Layer[]) => {
        layers.forEach(l => {
          if (images[l.id]) {
            const imgData = images[l.id];
            stageImages[l.id] = imgData;
            
            if (nodeMap[l.id]) {
              const node = nodeMap[l.id];
              node.url = imgData["1x"];
              node.url2x = imgData["2x"];
              if (node.css && node.css["background-image"]) {
                node.css["background-image"] = `url(${imgData["1x"]})`;
              }
              const getNum = (val: any) => typeof val === 'string' ? parseFloat(val) : val;
              const currentSize = { width: getNum(node.css.width), height: getNum(node.css.height) };
              if (node.bgimages && node.bgimages["1x"]) {
                node.bgimages["1x"].data = imgData["1x"];
                node.bgimages["1x"].size = currentSize;
                if (imgData["2x"]) {
                  node.bgimages["2x"] = { name: `${sanitizeId(l.id)}_2x`, data: imgData["2x"], size: currentSize };
                }
              } else {
                node.bgimages = {
                  "1x": { name: `${sanitizeId(l.id)}_1x`, data: imgData["1x"], size: currentSize },
                  "2x": { name: `${sanitizeId(l.id)}_2x`, data: imgData["2x"], size: currentSize }
                };
              }
            }
          }
          if (l.children) collectIds(l.children);
        });
      };
      collectIds(stage.layers);
      stageObj.images = stageImages;
    }

    return stageObj;
  });

  // Root structure
  let root: any;
  if (results.length === 1) {
    root = results[0];
  } else {
    root = { stages: results };
  }

  // Always include info, assets and images at top level
  root.info = info || {};
  root.assets = assets || { media: [], video: [], widget: [], button: [] };
  if (images) {
    root.images = images;
  }

  return root;
};

export const downloadStageObject = (stages: Stage[]) => {
  const data = convertStagesToStageObject(stages);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stageObject_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

import html2canvas from 'html2canvas';


// --- Dynamic Patching Helper ---
let originalGetContext: any = null;
const applyCanvasPatch = () => {
    if (originalGetContext) return; // Already patched
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (contextId: any, options?: any) {
        if (contextId === '2d') {
            return originalGetContext.call(this, contextId, { ...options, willReadFrequently: true });
        }
        return originalGetContext.call(this, contextId, options) as any;
    };
};

const removeCanvasPatch = () => {
    if (originalGetContext) {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        originalGetContext = null;
    }
};

export const captureStagesAsBase64 = async (stages: Stage[], scale: number = 1): Promise<Record<string, { "1x": string, "2x": string }>> => {
  // Apply patch to ensure stability during heavy export process
  // This prevents "Multiple readback operations" crashes in Chrome
  applyCanvasPatch();

  const imageMap: Record<string, { "1x": string, "2x": string }> = {};
  const mediaLayerIds: string[] = [];
  const layerDimensions: Record<string, { width: number, height: number }> = {};

  try {
    const traverse = (layers: Layer[], stageId: string) => {
        layers.forEach(l => {
        const hasBg = (l as any).backgroundColor || l.url; 
        if (l.type === 'image' || l.type === 'video' || (l as any).type === 'media' || hasBg) {
            mediaLayerIds.push(`${stageId}||${l.id}`); // Stay stage-aware for capture
            layerDimensions[`${stageId}||${l.id}`] = { width: l.width, height: l.height };
        }
        if (l.children) traverse(l.children, stageId);
        });
    };

    stages.forEach(stage => {
        layerDimensions[stage.id] = { width: stage.width, height: stage.height };
        traverse(stage.layers, stage.id);
    });

    const uniquePairs = Array.from(new Set(mediaLayerIds));
    console.log(`🔍 Export Plan: ${uniquePairs.length} unique elements to capture.`);

    // --- Helper: Convert all images in clone to Base64 to bypass CORS/Cache/Blob issues ---
    const bakeImagesToBase64 = async (element: HTMLElement) => {
        const images = Array.from(element.querySelectorAll('img')) as HTMLImageElement[];
        const bgElements = Array.from(element.querySelectorAll('*')).concat([element]) as HTMLElement[];

        const toBase64 = async (url: string): Promise<string | null> => {
            if (!url || url.startsWith('data:')) return url;
            try {
                const res = await fetch(url);
                const blob = await res.blob();
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn('Failed to bake image to base64:', url, e);
                return null;
            }
        };

        // Bake <img> tags
        for (const img of images) {
            const b64 = await toBase64(img.src);
            if (b64) img.src = b64;
        }

        // Bake backgrounds
        for (const el of bgElements) {
            const style = window.getComputedStyle(el);
            const bg = style.backgroundImage;
            const match = bg.match(/url\("?(.+?)"?\)/);
            if (match && match[1]) {
                const b64 = await toBase64(match[1]);
                if (b64) el.style.backgroundImage = `url("${b64}")`;
            }
        }
    };

    // Higher delay to ensure all DOM updates/resizes/re-renders are committed
    await new Promise(r => setTimeout(r, 600));

    // --- Helper: Bake Canvas into Images in the Clone ---
    // This is much more robust for html2canvas than trying to sync two canvas contexts
    const bakeCanvasContent = (source: HTMLElement, target: HTMLElement) => {
        const sourceCanvases = source.querySelectorAll('canvas');
        const targetCanvases = target.querySelectorAll('canvas');
        
        sourceCanvases.forEach((src, i) => {
            const dst = targetCanvases[i];
            if (dst && src.width > 0 && src.height > 0) {
                try {
                    const dataUrl = src.toDataURL('image/png');
                    const img = document.createElement('img');
                    img.src = dataUrl;
                    img.style.cssText = dst.style.cssText; // Keep layout
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.display = 'block';
                    dst.parentNode?.replaceChild(img, dst);
                } catch (e) {
                    console.warn('Canvas baking failed (possibly tainted):', e);
                }
            }
        });
    };

    // --- Helper: Add cache-busters to images in the clone ---
    const bustImageCache = (element: HTMLElement) => {
        const bust = `?t=${Date.now()}`;
        const images = element.querySelectorAll('img');
        images.forEach(img => {
            if (img.src && !img.src.startsWith('data:') && !img.src.includes('?t=')) {
                img.src = img.src.includes('?') ? `${img.src}&t=${Date.now()}` : `${img.src}${bust}`;
            }
        });
    };

    // --- Helper: Canvas to Base64 via Blob (More stable for readbacks) ---
    const canvasToBase64 = (canvas: HTMLCanvasElement): Promise<string> => {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob!);
            }, 'image/png');
        });
    };

    for (const pair of uniquePairs) {
        const [stageId, layerId] = pair.split('||');
        // Find the element within its specific stage to avoid duplicate ID issues
        const stageEl = document.getElementById(stageId);
        const originalElement = stageEl ? stageEl.querySelector(`[id="${layerId}"]`) as HTMLElement : document.getElementById(layerId);
        
        if (!originalElement) {
            console.warn(`Element ${layerId} not found in stage ${stageId}`);
            continue;
        }

        let sandbox: HTMLDivElement | null = null;

        try {
            const { width, height } = layerDimensions[pair] || { width: originalElement.offsetWidth, height: originalElement.offsetHeight };

            if (width <= 0 || height <= 0) {
                console.warn(`⚠️ Skipping ${layerId} due to invalid dimensions: ${width}x${height}`);
                continue;
            }

            console.log(`📸 [Capture Stage:${stageId}] ${layerId}: ${width}x${height}...`);

            // Sandbox setup
            sandbox = document.createElement('div');
            sandbox.style.position = 'fixed';
            sandbox.style.top = '0px';
            sandbox.style.left = '-25000px'; 
            sandbox.style.width = `${Math.ceil(width)}px`;
            sandbox.style.height = `${Math.ceil(height)}px`;
            sandbox.style.visibility = 'visible';
            sandbox.style.opacity = '1'; 
            sandbox.style.zIndex = '-9999';
            sandbox.style.overflow = 'hidden';

            // Fresh Clone
            const clone = originalElement.cloneNode(true) as HTMLElement;
            clone.id = `${layerId}_capture_${Date.now()}`; 
            
            // 1. Initial Sync from Inline Styles (Preserves logical 'cover', 'contain')
            clone.style.cssText = originalElement.style.cssText;
            
            // 2. Comprehensive Computed Style Sync (Only for non-inline props like shadows/filters)
            const sourceStyle = window.getComputedStyle(originalElement);
            const propsToSync = [
                'backgroundColor', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
                'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
                'borderTopStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderRightStyle',
                'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
                'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
                'filter', 'opacity', 'boxShadow', 'mixBlendMode', 'clipPath', 'maskImage', 'maskSize',
                'backgroundAttachment', 'backgroundOrigin', 'backgroundClip'
            ];
            
            propsToSync.forEach(p => {
                const val = sourceStyle.getPropertyValue(p);
                if (val && !clone.style.getPropertyValue(p)) {
                    (clone.style as any)[p] = val;
                }
            });

            // 3. Layout Normalization (Ensure 1:1 Capture)
            const imageFit = originalElement.getAttribute('data-image-fit') || 'unknown';
            clone.style.boxSizing = 'border-box';
            clone.style.width = `${Math.ceil(width)}px`;
            clone.style.height = `${Math.ceil(height)}px`;
            clone.style.transform = 'none'; 
            clone.style.margin = '0';
            clone.style.position = 'relative';
            clone.style.top = '0';
            clone.style.left = '0';
            clone.style.visibility = 'visible';

            // 4. Force Logical Background Styles (Fixes "Enlarging" issues)
            console.log(`[Export] Baking Layer: ${layerId} | Fit: ${imageFit}`);
            if (imageFit === 'tile') {
                clone.style.backgroundRepeat = 'repeat';
                clone.style.backgroundSize = 'auto';
            } else if (imageFit === 'cover' || imageFit === 'contain') {
                clone.style.backgroundSize = imageFit;
                clone.style.backgroundRepeat = 'no-repeat';
            } else if (imageFit === 'stretch') {
                clone.style.backgroundSize = '100% 100%';
                clone.style.backgroundRepeat = 'no-repeat';
            }

            // 5. Bust Image Caches (Both <img> and CSS background-image)
            const bustUrl = (url: string) => {
                if (!url || url.startsWith('data:') || url.startsWith('blob:') || url.includes('?t=')) return url;
                const separator = url.includes('?') ? '&' : '?';
                return `${url}${separator}t=${Date.now()}`;
            };

            const bg = sourceStyle.backgroundImage;
            if (bg && bg.includes('url(')) {
                clone.style.backgroundImage = bg.replace(/url\("?(.+?)"?\)/g, (m, u) => `url("${bustUrl(u)}")`);
            }

            sandbox.appendChild(clone);
            document.body.appendChild(sandbox);
            
            // CRITICAL: Bake everything to Base64 to ensure it's captured correctly
            await bakeImagesToBase64(clone);
            bakeCanvasContent(originalElement, clone);

            // Additional settling time after baking
            await new Promise(r => setTimeout(r, 600));

            console.log('🚀 Starting html2canvas render...');
            const canvas2x = await html2canvas(clone, {
                width: Math.ceil(width),
                height: Math.ceil(height),
                scale: 2,
                backgroundColor: null,
                useCORS: true,
                allowTaint: false,
                imageTimeout: 20000,
                logging: true, // Enabled for deeper check
                onclone: (doc, el) => {
                    (el as HTMLElement).style.visibility = 'visible';
                }
            });

            // Capture strings via stable blob method
            const b2x = await canvasToBase64(canvas2x);

            // Manual 1x downscale
            const canvas1x = document.createElement('canvas');
            canvas1x.width = Math.ceil(width);
            canvas1x.height = Math.ceil(height);
            const ctx1x = canvas1x.getContext('2d', { willReadFrequently: true });
            if (ctx1x) {
                ctx1x.drawImage(canvas2x, 0, 0, canvas2x.width, canvas2x.height, 0, 0, canvas1x.width, canvas1x.height);
            }
            const b1x = await canvasToBase64(canvas1x);

            // Cleanup
            canvas1x.width = 0;
            canvas2x.width = 0;

            if (b2x.length < 2000) {
                console.error(`🔴 Capture ${layerId} failed validation (len: ${b2x.length})`);
            } else {
                console.log(`✅ Captured ${layerId} | 1x: ${Math.round(b1x.length/1024)}KB, 2x: ${Math.round(b2x.length/1024)}KB`);
                // Using just layerId as requested, though stage-specific capture happened above
                imageMap[layerId] = { "1x": b1x, "2x": b2x };
            }

        } catch (e) {
            console.error(`❌ Capture Error for ${layerId}:`, e);
        } finally {
            if (sandbox && sandbox.parentNode) {
                sandbox.parentNode.removeChild(sandbox);
            }
        }
        
        await new Promise(r => setTimeout(r, 150));
    }
  } finally {
    // Restore original GPU-accelerated context after export is done
    removeCanvasPatch();
    console.log('🏁 Export finished, restored GPU canvas context.');
  }
  
  return imageMap;
};

async function base64ToBlob(base64: string): Promise<Blob> {
  const response = await fetch(base64);
  return await response.blob();
}

export const uploadImageToServer = async (id: string, base64: string, scale: '1x' | '2x'): Promise<string> => {
  const blob = await base64ToBlob(base64);
  const cloudPath = `/newtool/images/${sanitizeId(id)}_${scale}.png`;
  const uploadUrl = `http://127.0.0.1:3002/upload?path=${encodeURIComponent(cloudPath)}`;

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: blob,
      headers: {
        'Content-Type': 'image/png'
      }
    });

    if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
    }

    // Parse JSON response and get 'url' property
    try {
      const data = await response.json();
      return data.url || cloudPath; // Fallback to cloudPath if url property is missing
    } catch (parseError) {
      // If server doesn't return JSON, try to get text
      const text = await response.text();
      return text || cloudPath;
    }
  } catch (e) {
    console.error(`Upload error for ${id} ${scale}:`, e);
    return base64; // Fallback to base64 if upload fails
  }
};
export const reconstructStagesFromStageObject = (obj: any): Stage[] => {
  if (!obj) return [];
  
  // Handle BOTH { stages: [...] } and single stage object
  const stageData = Array.isArray(obj.stages) ? obj.stages : (obj.node ? [obj] : []);
  
  return stageData.map((s: any) => {
    const nodeMap = s.node || {};
    const animationMap = s.animation || {};
    const frame = nodeMap.frame || {};
    const stageId = frame.frameId;
    const stageContainer = nodeMap[stageId] || { elements: [] };
    
    // Recovery function for layers
    const buildLayers = (elements: any[]): Layer[] => {
      return elements.map(el => {
        const detail = nodeMap[el.id];
        if (!detail) return null as any;
        
        const css = detail.css || {};
        const width = parseFloat(String(css.width || 0));
        const height = parseFloat(String(css.height || 0));
        const left = parseFloat(String(css.left || 0));
        const top = parseFloat(String(css.top || 0));
        
        // Convert left/top (top-left) to x/y (center)
        const x = left + width / 2;
        const y = top + height / 2;
        
        // Rotation parsing
        let rotation = 0;
        if (css.transform && typeof css.transform === 'string') {
          const match = css.transform.match(/rotate\((.+?)deg\)/);
          if (match) rotation = parseFloat(match[1]);
        }

        // Infer type
        let type: Layer['type'] = 'shape';
        const dcoType = detail.type;
        if (dcoType === 'TEXT') type = 'text';
        else if (dcoType === 'VIDEO') type = 'video';
        else if (dcoType === 'GROUP') type = 'group';
        else if (dcoType === 'RECTANGLE') {
          if (detail.bgimages) type = 'image';
          else if (detail.meta?.widgetId) type = 'widget';
          else if (detail.id.startsWith('button_')) type = 'button';
          else if (detail.id.startsWith('media_')) type = 'image';
          else if (detail.id.startsWith('image_')) type = 'image';
          else type = 'shape';
        }

        const layer: Layer = {
          id: detail.id,
          name: detail.name || detail.id,
          type,
          x,
          y,
          width,
          height,
          rotation,
          zIndex: parseInt(String(css.zIndex || 0)),
          opacity: detail.opacity ?? 1,
          variant: detail.meta ? JSON.stringify(detail.meta) : undefined,
          url: detail.url || (detail.bgimages?.["1x"]?.data),
          easing: detail.easing,
          transformX: detail.transformX,
          transformY: detail.transformY,
          transformZ: detail.transformZ,
          rotateX: detail.rotateX,
          rotateY: detail.rotateY,
          rotateZ: detail.rotateZ,
          scaleX: detail.scaleX,
          scaleY: detail.scaleY,
          scaleZ: detail.scaleZ,
          skewX: detail.skewX,
          skewY: detail.skewY,
          children: detail.elements ? buildLayers(detail.elements) : undefined
        };

        // Animation recovery
        const animData = animationMap[detail.id];
        if (animData) {
          layer.animation = {
            entry: { 
              start: Math.round((animData.enter?.start || 0) * 100), 
              duration: Math.round((animData.enter?.duration || 0) * 100),
              name: animData.enter?.animation
            },
            main: { 
              start: Math.round((animData.middle?.start || 0) * 100), 
              duration: Math.round((animData.middle?.duration || 0) * 100),
              name: animData.middle?.animation,
              repeat: animData.middle?.loop
            },
            exit: { 
              start: Math.round((animData.end?.start || 0) * 100), 
              duration: Math.round((animData.end?.duration || 0) * 100),
              name: animData.end?.animation
            },
            keyframes: animData.keyframes?.map((kf: any, idx: number) => ({
              id: `kf_${detail.id}_${idx}`,
              time: Math.round(kf.time * 100),
              props: kf.props
            }))
          };
        }

        return layer;
      }).filter(l => !!l);
    };

    const stage: Stage = {
      id: frame.frameId || `stage_${Math.random().toString(36).substring(7)}`,
      name: frame.name || 'Imported Stage',
      x: frame.x ?? 0,
      y: frame.y ?? 0,
      width: frame.width || 800,
      height: frame.height || 600,
      layers: buildLayers(stageContainer.elements || []),
      duration: animationMap.duration || 5,
      backgroundColor: frame.css?.background || '#ffffff',
      loopCount: animationMap.globalLoop?.loop,
      stopAtSecond: animationMap.globalLoop?.stopAt,
      actions: animationMap.actions || []
    };

    return stage;
  });
};
