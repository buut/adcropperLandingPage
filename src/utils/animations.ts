export interface AnimationProps {
    opacity?: number;
    translateX?: string | number;
    translateY?: string | number;
    scale?: number;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    rotation?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    rotateZ?: number;
    transformZ?: string | number;
    translateZ?: string | number;
    transformOrigin?: string;
    clipPath?: string;
    transform?: string;
    left?: string | number;
    top?: string | number;
    blur?: number;
    brightness?: number;
    contrast?: number;
    grayscale?: number;
    sepia?: number;
    saturate?: number;
}

export interface AnimationInfo {
    action?: 'from' | 'to';
    css?: AnimationProps[];
    raw?: string;
    transformOrigin?: string;
}

import { animations as dataAnimations, animationInfo as dataAnimationInfo } from '../data/animationData';

export const animations = dataAnimations;
export const animationInfo: Record<string, AnimationInfo> = dataAnimationInfo;

/**
 * Helper to interpolate between two animation states
 */
export const interpolate = (start: number, end: number, current: number) => {
    return (current - start) / (end - start);
};

/**
 * Get interpolated value between two values
 */
export const lerp = (v1: number, v2: number, t: number) => {
    return v1 + (v2 - v1) * t;
};

export const applyEasing = (t: number, easing: string = 'linear'): number => {
    if (easing === 'ease-in') return t * t;
    if (easing === 'ease-out') return t * (2 - t);
    if (easing === 'ease-in-out') return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    if (easing === 'smoothstep') return t * t * (3 - 2 * t);
    if (easing === 'elastic') {
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }
    if (easing === 'bounce') {
        const n1 = 7.5625; const d1 = 2.75;
        let t2 = t;
        if (t2 < 1 / d1) return n1 * t2 * t2;
        if (t2 < 2 / d1) return n1 * (t2 -= 1.5 / d1) * t2 + 0.75;
        if (t2 < 2.5 / d1) return n1 * (t2 -= 2.25 / d1) * t2 + 0.9375;
        return n1 * (t2 -= 2.625 / d1) * t2 + 0.984375;
    }
    if (easing === 'back-in') {
        const s = 1.70158;
        return t * t * ((s + 1) * t - s);
    }
    if (easing === 'back-out') {
        const s = 1.70158;
        const t2 = t - 1;
        return t2 * t2 * ((s + 1) * t2 + s) + 1;
    }
    if (easing === 'back-in-out') {
        const s = 1.70158 * 1.525;
        let t2 = t * 2;
        if (t2 < 1) return 0.5 * (t2 * t2 * ((s + 1) * t2 - s));
        t2 -= 2; return 0.5 * (t2 * t2 * ((s + 1) * t2 + s) + 2);
    }
    return t;
};

/**
 * Detects value and unit from a CSS-like string (e.g. "20px" -> {val: 20, unit: "px"})
 */
const parseUnit = (val: string | number | undefined) => {
    if (val === undefined) return { value: 0, unit: '' };
    if (typeof val === 'number') return { value: val, unit: '' };
    const match = val.toString().match(/^(-?[\d\.]+)(.*)$/);
    if (!match) return { value: parseFloat(val.toString()) || 0, unit: '' };
    return { value: parseFloat(match[1]), unit: match[2] };
};

export const parseOrigin = (origin: string | undefined, width: number, height: number) => {
    if (!origin) return { x: width / 2, y: height / 2 };
    const parts = origin.trim().split(/\s+/);

    let ox: number | null = null;
    let oy: number | null = null;

    parts.forEach((part, index) => {
        if (part === 'left') ox = 0;
        else if (part === 'right') ox = width;
        else if (part === 'top') oy = 0;
        else if (part === 'bottom') oy = height;
        else if (part === 'center') {
            // center is tricky because it could be either. We'll handle it later if still null.
        } else if (part.endsWith('%')) {
            const val = (parseFloat(part) / 100);
            if (index === 0) ox = val * width;
            else oy = val * height;
        } else if (part.endsWith('px')) {
            const val = parseFloat(part);
            if (index === 0) ox = val;
            else oy = val;
        }
    });

    // Resolve 'center' or missing values
    if (ox === null && oy === null) {
        // If only one part was provided and it wasn't a keyword (e.g. "20%"), 
        // CSS defaults the second part to "50%".
        if (parts.length === 1) {
            oy = height / 2;
        } else {
            ox = width / 2;
            oy = height / 2;
        }
    }

    if (ox === null) ox = width / 2;
    if (oy === null) oy = height / 2;

    return { x: ox, y: oy };
};

export const project3d = (x: number, y: number, z: number, stageWidth: number, stageHeight: number) => {
    const perspective = 1000;
    const factor = perspective / (perspective - z);
    const cx = stageWidth / 2;
    const cy = stageHeight / 2;
    return {
        x: cx + (x - cx) * factor,
        y: cy + (y - cy) * factor,
        factor
    };
};

const resolveVisualPosition = (
    resX: number, resY: number, resW: number, resH: number,
    baseRotation: number,
    animRotation: number,
    sx: number, sy: number,
    txPx: number, tyPx: number,
    originStr: string | undefined,
    isChildOfAutoLayout: boolean,
    stableOriginStr?: string,
    tz: number = 0,
    stageWidth: number = 0,
    stageHeight: number = 0
) => {
    // 1. Current Segment Origin (Pivot P)
    const origin = parseOrigin(originStr || 'center center', resW, resH);
    const px = (isChildOfAutoLayout ? resX : resX - resW / 2) + origin.x;
    const py = (isChildOfAutoLayout ? resY : resY - resH / 2) + origin.y;

    // Vector from Pivot to Center
    const dx = resW / 2 - origin.x;
    const dy = resH / 2 - origin.y;

    // Stability Compensation
    const sOriginStr = stableOriginStr || 'center center';
    const sOrigin = parseOrigin(sOriginStr, resW, resH);

    const px_s = (isChildOfAutoLayout ? resX : resX - resW / 2) + sOrigin.x;
    const py_s = (isChildOfAutoLayout ? resY : resY - resH / 2) + sOrigin.y;

    const dx_s = resW / 2 - sOrigin.x;
    const dy_s = resH / 2 - sOrigin.y;
    const cosS = Math.cos(baseRotation * (Math.PI / 180));
    const sinS = Math.sin(baseRotation * (Math.PI / 180));
    const vx_s = px_s + (dx_s * cosS - dy_s * sinS);
    const vy_s = py_s + (dx_s * sinS + dy_s * cosS);

    const dx_c = resW / 2 - origin.x;
    const dy_c = resH / 2 - origin.y;
    const vx_c_base = px + (dx_c * cosS - dy_c * sinS);
    const vy_c_base = py + (dx_c * sinS + dy_c * cosS);

    const jumpX = vx_s - vx_c_base;
    const jumpY = vy_s - vy_c_base;

    const totalRad = (baseRotation + animRotation) * (Math.PI / 180);
    const cosB = Math.cos(totalRad);
    const sinB = Math.sin(totalRad);

    const vecX = dx_c * sx;
    const vecY = dy_c * sy;

    const rot_vecX = vecX * cosB - vecY * sinB;
    const rot_vecY = vecX * sinB + vecY * cosB;

    const vx = px + jumpX + txPx + rot_vecX;
    const vy = py + jumpY + tyPx + rot_vecY;

    // Apply Perspective projection
    const perspective = 1000;
    const factor = perspective / (perspective - tz);
    const cx = (stageWidth || 0) / 2;
    const cy = (stageHeight || 0) / 2;
    const rx = vx - cx;
    const ry = vy - cy;

    return {
        x3d: vx,
        y3d: vy,
        z3d: tz,
        visualX: stageWidth ? cx + rx * factor : vx,
        visualY: stageHeight ? cy + ry * factor : vy,
        perspectiveFactor: factor,
        jumpX,
        jumpY
    };
};

/**
 * Get calculated styles for a given point in an animation segment
 */
export const getAnimationStyles = (
    animName: string | undefined,
    progress: number, // 0 to 1
    type: 'entry' | 'main' | 'exit'
): React.CSSProperties => {
    if (!animName || !animationInfo[animName]) return {};

    const info = animationInfo[animName];

    if (info.raw) {
        const originMatch = info.raw.match(/transform-origin\s*:\s*([^;}\s]+(?:\s+[^;}\s]+)*)/);
        const transformOrigin = (originMatch ? originMatch[1].trim() : undefined) || info.transformOrigin;

        // Parse ALL keyframe points
        const keyframePoints: { p: number, values: any }[] = [];
        const frameRegex = /((?:[\d.]+%|from|to)(?:\s*,\s*(?:[\d.]+%|from|to))*)\s*\{([^}]*)\}/g;
        let fMatch;
        while ((fMatch = frameRegex.exec(info.raw)) !== null) {
            const selectors = fMatch[1].split(',').map(s => s.trim());
            const content = fMatch[2];

            const extract = (str: string, regex: RegExp) => {
                const m = str.match(regex);
                if (!m) return null;
                const full = m[1].trim();
                const v = parseFloat(full);
                const u = full.replace(/^-?[\d.]+/, '').trim();
                return { value: isNaN(v) ? 0 : v, unit: u };
            };

            const tMatch = content.match(/transform\s*:\s*([^;}]+)/);
            const tStr = tMatch ? tMatch[1] : '';
            const allStr = content + ' ' + tStr;

            const frameVals = {
                translateX: extract(allStr, /translateX\(([^)]+)\)/) || extract(allStr, /translate(?:3d)?\s*\(\s*([^,)]+)(?:\s*,\s*[^,)]+)?(?:\s*,\s*[^,)]+)?\s*\)/i),
                translateY: extract(allStr, /translateY\(([^)]+)\)/) || extract(allStr, /translate(?:3d)?\s*\(\s*[^,)]+\s*,\s*([^,)]+)(?:\s*,\s*[^,)]+)?\s*\)/i),
                translateZ: extract(allStr, /translateZ\(([^)]+)\)/) || extract(allStr, /translate(?:3d)?\s*\(\s*[^,)]+\s*,\s*[^,)]+\s*,\s*([^,)]+)\s*\)/i),
                scaleX: extract(allStr, /scaleX\(([^)]+)\)/) || extract(allStr, /scale3d\(([^,]+),[^,]+,[^)]+\)/) || extract(allStr, /scale\(([^,)]+)(?:,[^)]+)?\)/),
                scaleY: extract(allStr, /scaleY\(([^)]+)\)/) || extract(allStr, /scale3d\([^,]+,([^,]+),[^)]+\)/) || extract(allStr, /scale\((?:[^,)]+,)?([^)]+)\)/),
                scaleZ: extract(allStr, /scaleZ\(([^)]+)\)/) || extract(allStr, /scale3d\([^,]+,[^,]+,([^)]+)\)/),
                rotation: extract(allStr, /rotate\(([^)]+)\)/) || extract(allStr, /rotateZ\(([^)]+)\)/),
                rotateX: extract(allStr, /rotateX\(([^)]+)\)/),
                rotateY: extract(allStr, /rotateY\(([^)]+)\)/),
                skewX: extract(allStr, /skewX\(([^)]+)\)/) || extract(allStr, /skew\(([^,)]+)(?:,[^)]+)?\)/),
                skewY: extract(allStr, /skewY\(([^)]+)\)/) || extract(allStr, /skew\((?:[^,)]+,)?([^)]+)\)/),
                left: extract(content, /left\s*:\s*([^;}]+)/),
                top: extract(content, /top\s*:\s*([^;}]+)/),
                opacity: extract(content, /opacity\s*:\s*([^;}\s]+)/),
            };

            selectors.forEach(s => {
                const p = s === 'from' ? 0 : (s === 'to' ? 100 : parseFloat(s));
                if (!isNaN(p)) {
                    keyframePoints.push({ p, values: frameVals });
                }
            });
        }

        if (keyframePoints.length === 0) return { rawKeyframes: info.raw, animName, progress, transformOrigin } as any;

        keyframePoints.sort((a, b) => a.p - b.p);
        const pUnits = progress * 100;

        let startFrame = keyframePoints[0];
        let endFrame = keyframePoints[keyframePoints.length - 1];

        if (pUnits <= startFrame.p) {
            endFrame = startFrame;
        } else if (pUnits >= endFrame.p) {
            startFrame = endFrame;
        } else {
            for (let i = 0; i < keyframePoints.length - 1; i++) {
                if (pUnits >= keyframePoints[i].p && pUnits <= keyframePoints[i + 1].p) {
                    startFrame = keyframePoints[i];
                    endFrame = keyframePoints[i + 1];
                    break;
                }
            }
        }

        const segmentRange = endFrame.p - startFrame.p;
        const segmentProgress = segmentRange === 0 ? 0 : (pUnits - startFrame.p) / segmentRange;

        const res: any = { rawKeyframes: info.raw, animName, progress, transformOrigin };
        const lerpVal = (key: string, def: number) => {
            const v1 = startFrame.values[key];
            const v2 = endFrame.values[key];
            if (!v1 && !v2) return null;
            const startVal = v1 ? v1.value : def;
            const endVal = v2 ? v2.value : def;
            const unit1 = v1?.unit || '';
            const unit2 = v2?.unit || '';
            const unit = unit2 || unit1; // Prefer the non-empty unit (e.g. '%' over '')
            return `${startVal + (endVal - startVal) * segmentProgress}${unit}`;
        };

        const tx = lerpVal('translateX', 0);
        const ty = lerpVal('translateY', 0);
        const tz = lerpVal('translateZ', 0);
        const sx = lerpVal('scaleX', 1);
        const sy = lerpVal('scaleY', 1);
        const sz = lerpVal('scaleZ', 1);
        const rot = lerpVal('rotation', 0);
        const rx = lerpVal('rotateX', 0);
        const ry = lerpVal('rotateY', 0);
        const skx = lerpVal('skewX', 0);
        const sky = lerpVal('skewY', 0);
        const l = lerpVal('left', 0);
        const tVal = lerpVal('top', 0);
        const op = lerpVal('opacity', 1);

        if (tx !== null) res._translateX = tx;
        if (ty !== null) res._translateY = ty;
        if (tz !== null) res._translateZ = parseFloat(tz);
        if (sx !== null) res._scaleX = parseFloat(sx);
        if (sy !== null) res._scaleY = parseFloat(sy);
        if (sz !== null) res._scaleZ = parseFloat(sz);
        if (rot !== null) res._rotation = parseFloat(rot);
        if (rx !== null) res._rotationX = parseFloat(rx);
        if (ry !== null) res._rotationY = parseFloat(ry);
        if (skx !== null) res._skewX = parseFloat(skx);
        if (sky !== null) res._skewY = parseFloat(sky);
        if (l !== null) res.x = parseFloat(l);
        if (tVal !== null) res.y = parseFloat(tVal);
        if (op !== null) res.opacity = parseFloat(op);

        return res as any;
    }

    const { action, css } = info;
    if (!css) return {};

    const getRes = (s1: AnimationProps, s2: AnimationProps, t: number) => {
        const lerpProp = (p1: string | number | undefined, p2: string | number | undefined) => {
            const v1 = parseUnit(p1);
            const v2 = parseUnit(p2);
            const val = lerp(v1.value, v2.value, t);
            const unit = v1.unit || v2.unit || '';
            return `${val}${unit}`;
        };

        const tx = lerpProp(s1.translateX, s2.translateX);
        const ty = lerpProp(s1.translateY, s2.translateY);
        const txVal = lerp(parseUnit(s1.translateX || 0).value, parseUnit(s2.translateX || 0).value, t);
        const tyVal = lerp(parseUnit(s1.translateY || 0).value, parseUnit(s2.translateY || 0).value, t);
        const unitX = parseUnit(s1.translateX || s2.translateX).unit || '%';
        const unitY = parseUnit(s1.translateY || s2.translateY).unit || '%';

        const s = lerp(s1.scale ?? 1, s2.scale ?? 1, t);
        const sx = lerp(s1.scaleX ?? s1.scale ?? 1, s2.scaleX ?? s2.scale ?? 1, t);
        const sy = lerp(s1.scaleY ?? s1.scale ?? 1, s2.scaleY ?? s2.scale ?? 1, t);
        const sz = lerp(s1.scaleZ ?? s1.scale ?? 1, s2.scaleZ ?? s2.scale ?? 1, t);
        const tz = lerp(parseUnit(s1.translateZ || 0).value, parseUnit(s2.translateZ || 0).value, t);

        const r1 = s1.rotation ?? s1.rotationZ ?? s1.rotateZ ?? 0;
        const r2 = s2.rotation ?? s2.rotationZ ?? s2.rotateZ ?? 0;
        const r = lerp(r1, r2, t);

        const rx = (s1.rotationX !== undefined || s2.rotationX !== undefined) ? lerp(s1.rotationX || 0, s2.rotationX || 0, t) : 0;
        const ry = (s1.rotationY !== undefined || s2.rotationY !== undefined) ? lerp(s1.rotationY || 0, s2.rotationY || 0, t) : 0;
        const rz = (s1.rotationZ !== undefined || s2.rotationZ !== undefined) ? lerp(s1.rotationZ || 0, s2.rotationZ || 0, t) : 0;

        const x = (s1.left !== undefined || s2.left !== undefined) ? lerp(parseUnit(s1.left || 0).value, parseUnit(s2.left || 0).value, t) : undefined;
        const y = (s1.top !== undefined || s2.top !== undefined) ? lerp(parseUnit(s1.top || 0).value, parseUnit(s2.top || 0).value, t) : undefined;

        const res: any = {
            _scale: s, _scaleX: sx, _scaleY: sy, _scaleZ: sz, _rotation: r, _translateX: tx, _translateY: ty, transformZ: tz,
            _rotationX: rx, _rotationY: ry, _rotationZ: rz,
            x, y
        };
        Object.keys(res).forEach(k => { if (res[k] === undefined) delete res[k]; });

        if (s1.transform || s2.transform) {
            res.transform = t < 0.5 ? s1.transform : s2.transform;
        } else {
            let transform = `translate3d(${txVal}${unitX}, ${tyVal}${unitY}, ${tz}px) rotate(${r}deg) scale3d(${sx}, ${sy}, ${sz})`;
            if (s1.rotationX !== undefined || s2.rotationX !== undefined) transform += ` rotateX(${rx}deg)`;
            if (s1.rotationY !== undefined || s2.rotationY !== undefined) transform += ` rotateY(${ry}deg)`;
            res.transform = transform;
        }

        if (s1.opacity !== undefined || s2.opacity !== undefined) res.opacity = lerp(s1.opacity ?? 1, s2.opacity ?? 1, t);
        if (s1.transformOrigin || s2.transformOrigin) res.transformOrigin = s1.transformOrigin || s2.transformOrigin;
        if (s1.clipPath || s2.clipPath) res.clipPath = t < 0.5 ? s1.clipPath : s2.clipPath;

        return res;
    };

    const base: AnimationProps = { opacity: 1, translateX: "0%", translateY: "0%", scale: 1, rotation: 0 };

    if (action === 'from') {
        if (css.length === 1) return getRes(css[0], base, progress);
        const stepCount = css.length - 1;
        const step = Math.min(stepCount - 1, Math.floor(progress * stepCount));
        const stepProgress = (progress * stepCount) - step;
        return getRes(css[step], css[step + 1], stepProgress);
    } else {
        if (css.length === 1) return getRes(base, css[0], progress);
        const stepCount = css.length - 1;
        const step = Math.min(stepCount - 1, Math.floor(progress * stepCount));
        const stepProgress = (progress * stepCount) - step;
        return getRes(css[step], css[step + 1], stepProgress);
    }
};

/**
 * Interpolates all props for a keyframe at a given time
 */
export const getInterpolatedKeyframeProps = (keyframes: any[], timeInUnits: number, baseLayer: any) => {
    if (!keyframes || keyframes.length === 0) {
        return {
            transformX: 0, transformY: 0, transformZ: 0,
            transformOrigin: baseLayer.transformOrigin || 'center center',
            rotateX: 0, rotateY: 0, rotateZ: 0,
            scaleX: undefined, scaleY: undefined, scaleZ: undefined,
            skewX: 0, skewY: 0,
            opacity: baseLayer.opacity ?? 1,
            easing: 'linear' as const
        };
    }

    const sorted = [...keyframes].sort((a, b) => a.time - b.time);
    let k1 = null;
    for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].time <= timeInUnits) {
            k1 = sorted[i];
            break;
        }
    }
    let k2 = sorted.find(k => k.time > timeInUnits);

    if (k1 && !k2) return { ...k1.props };
    if (!k1 && k2) return { ...k2.props };
    if (k1 && k2) {
        const t = (timeInUnits - k1.time) / (k2.time - k1.time);
        const easing = k1.props.easing || 'linear';
        const et = applyEasing(t, easing);
        const l = (v1: number, v2: number) => v1 + (v2 - v1) * et;
        const res: any = { easing };
        const allKeys = new Set([...Object.keys(k1.props), ...Object.keys(k2.props)]);
        allKeys.forEach(key => {
            if (key === 'easing') return;
            let v1 = k1.props[key];
            let v2 = k2.props[key];
            const isNumeric = [
                'rotation', 'rotateZ', 'rotateX', 'rotateY', 
                'scale', 'scaleX', 'scaleY', 'scaleZ',
                'opacity', 'x', 'y', 'width', 'height', 
                'transformX', 'transformY', 'transformZ', 
                'skewX', 'skewY',
                'blur', 'brightness', 'contrast', 'grayscale', 'sepia', 'saturate', 'hueRotate', 'invert'
            ].includes(key);
            if (isNumeric) {
                const nv1 = v1 === undefined ? undefined : (typeof v1 === 'string' ? parseFloat(v1) : v1);
                const nv2 = v2 === undefined ? undefined : (typeof v2 === 'string' ? parseFloat(v2) : v2);
                if (nv1 !== undefined && nv2 !== undefined) {
                    res[key] = l(nv1, nv2);
                } else {
                    res[key] = nv1 ?? nv2;
                }
            } else {
                res[key] = et < 0.5 ? (v1 ?? v2) : (v2 ?? v1);
            }
        });
        return res;
    }
    return {};
};

/**
 * Comprehensive helper to get all current animated properties for a layer
 */
export const getInterpolatedLayerStyles = (
    layer: any,
    currentTime: number,
    stageDuration: number,
    loopsDone: number = 0,
    stageLoopCount: number = -1,
    stageStopAtSecond?: number,
    stageFeedLoopCount: number = -1,
    isPreviewMode: boolean = false,
    isChildOfAutoLayout: boolean = false,
    stageWidth: number = 0,
    stageHeight: number = 0
) => {
    let effectiveTime = currentTime;
    if (layer.isDynamic) {
        if (stageFeedLoopCount === 0) effectiveTime = 0;
        else if (stageFeedLoopCount !== -1 && loopsDone >= stageFeedLoopCount) effectiveTime = stageDuration;
    } else if (isPreviewMode) {
        const limitLoop = (stageLoopCount === undefined || stageLoopCount === null) ? -1 : stageLoopCount;
        const stopTime = stageStopAtSecond !== undefined ? stageStopAtSecond : stageDuration;
        const isPastFinalLoop = limitLoop !== -1 && loopsDone > limitLoop;
        const isFinalLoop = limitLoop !== -1 && loopsDone === limitLoop;
        if (isPastFinalLoop) effectiveTime = stopTime;
        else if (isFinalLoop && currentTime >= stopTime) effectiveTime = stopTime;
    }

    const timeInUnits = effectiveTime * 100;
    // Segment sınırlarında floating-point hatasını önlemek için yuvarla (main→exit geçişinde yanlış segment'e düşmeyi engeller)
    const t = Math.round(timeInUnits * 1000) / 1000;

    if (layer.animation?.keyframes && layer.animation.keyframes.length > 0) {
        const props = getInterpolatedKeyframeProps(layer.animation.keyframes, timeInUnits, layer);
        const tx = props.x ?? layer.x ?? 0;
        const ty = props.y ?? layer.y ?? 0;
        const tw = props.width ?? layer.width ?? 0;
        const th = props.height ?? layer.height ?? 0;
        const tr = (props.rotateZ || props.rotation) ?? layer.rotation ?? 0;

        const scaleX = (props.scaleX ?? props.scale ?? 1) * (layer.scaleX ?? layer.scale ?? 1);
        const scaleY = (props.scaleY ?? props.scale ?? 1) * (layer.scaleY ?? layer.scale ?? 1);

        const visualStyles = resolveVisualPosition(
            tx, ty, tw, th,
            tr, 0,
            scaleX,
            scaleY,
            (props.transformX ?? layer.transformX ?? 0) * tw / 100,
            (props.transformY ?? layer.transformY ?? 0) * th / 100,
            props.transformOrigin || layer.transformOrigin,
            isChildOfAutoLayout,
            props.transformOrigin || layer.transformOrigin,
            (props.transformZ ?? layer.transformZ ?? 0),
            stageWidth,
            stageHeight
        );

        const { visualX, visualY, jumpX, jumpY, perspectiveFactor, x3d, y3d, z3d } = visualStyles;

        const combinedTransform = [
            isChildOfAutoLayout ? '' : 'translate(-50%, -50%)',
            (jumpX !== 0 || jumpY !== 0) ? `translate3d(${jumpX}px, ${jumpY}px, 0)` : '',
            `translate3d(${props.transformX ?? layer.transformX ?? 0}%, ${props.transformY ?? layer.transformY ?? 0}%, ${props.transformZ ?? layer.transformZ ?? 0}px)`,
            (props._translateX || props._translateY) ? `translate3d(${props._translateX || '0%'}, ${props._translateY || '0%'}, 0)` : '',
            `rotate(${tr}deg)`,
            `rotateX(${props.rotateX ?? layer.rotateX ?? 0}deg)`,
            `rotateY(${props.rotateY ?? layer.rotateY ?? 0}deg)`,
            `rotateZ(${props.rotateZ ?? layer.rotateZ ?? 0}deg)`,
            `scale3d(${scaleX}, ${scaleY}, ${(props.scaleZ ?? layer.scaleZ ?? 1)})`,
            `skew(${props.skewX ?? layer.skewX ?? 0}deg, ${props.skewY ?? layer.skewY ?? 0}deg)`
        ].filter(Boolean).join(' ');

        const filterParts = [];
        if (props.blur !== undefined || layer.blur !== undefined) {
            filterParts.push(`blur(${props.blur ?? layer.blur ?? 0}px)`);
        }
        if (props.brightness !== undefined || layer.brightness !== undefined) {
            filterParts.push(`brightness(${(props.brightness ?? layer.brightness ?? 1) * 100}%)`);
        }
        if (props.contrast !== undefined || layer.contrast !== undefined) {
            filterParts.push(`contrast(${(props.contrast ?? layer.contrast ?? 1) * 100}%)`);
        }
        if (props.grayscale !== undefined || layer.grayscale !== undefined) {
            filterParts.push(`grayscale(${(props.grayscale ?? layer.grayscale ?? 0) * 100}%)`);
        }
        if (props.sepia !== undefined || layer.sepia !== undefined) {
            filterParts.push(`sepia(${(props.sepia ?? layer.sepia ?? 0) * 100}%)`);
        }
        if (props.saturate !== undefined || layer.saturate !== undefined) {
            filterParts.push(`saturate(${(props.saturate ?? layer.saturate ?? 1) * 100}%)`);
        }
        if (props.hueRotate !== undefined) {
            filterParts.push(`hue-rotate(${props.hueRotate}deg)`);
        }
        if (props.invert !== undefined) {
            filterParts.push(`invert(${props.invert * 100}%)`);
        }
        const combinedFilter = filterParts.join(' ');

        return {
            ...props,
            x: tx, y: ty,
            visualX, visualY,
            x3d, y3d, z3d,
            visualWidth: tw * scaleX * perspectiveFactor,
            visualHeight: th * scaleY * perspectiveFactor,
            width: tw, height: th,
            rotation: tr,
            opacity: props.opacity ?? layer.opacity ?? 1,
            transform: combinedTransform,
            filter: combinedFilter,
            transformOrigin: props.transformOrigin || layer.transformOrigin
        };
    }

    if (!layer.animation) {
        const tr = layer.rotation ?? layer.rotateZ ?? layer.rotationZ ?? layer.rotate ?? 0;
        const sx = layer.scaleX ?? layer.scale ?? 1;
        const sy = layer.scaleY ?? layer.scale ?? 1;
        const lWidth = layer.width ?? 0;
        const lHeight = layer.height ?? 0;
        const tx = (layer.transformX ?? 0) * lWidth / 100;
        const ty = (layer.transformY ?? 0) * lHeight / 100;

        const visualStyles = resolveVisualPosition(
            layer.x ?? 0, layer.y ?? 0, lWidth, lHeight,
            tr, 0, sx, sy, tx, ty, layer.transformOrigin,
            isChildOfAutoLayout,
            layer.transformOrigin,
            (layer.transformZ ?? 0),
            stageWidth,
            stageHeight
        );

        const { visualX, visualY, jumpX, jumpY, perspectiveFactor, x3d, y3d, z3d } = visualStyles;

        const combinedTransform = [
            isChildOfAutoLayout ? '' : 'translate(-50%, -50%)',
            (jumpX !== 0 || jumpY !== 0) ? `translate3d(${jumpX}px, ${jumpY}px, 0)` : '',
            `translate3d(${layer.transformX ?? 0}%, ${layer.transformY ?? 0}%, ${layer.transformZ ?? 0}px)`,
            `rotate(${tr}deg)`,
            `rotateX(${layer.rotateX ?? 0}deg)`,
            `rotateY(${layer.rotateY ?? 0}deg)`,
            `rotateZ(${layer.rotateZ ?? 0}deg)`,
            `scale3d(${sx}, ${sy}, ${layer.scaleZ ?? 1})`,
            `skew(${layer.skewX ?? 0}deg, ${layer.skewY ?? 0}deg)`
        ].filter(Boolean).join(' ');

        const filterParts = [];
        if (layer.blur !== undefined) filterParts.push(`blur(${layer.blur}px)`);
        if (layer.brightness !== undefined) filterParts.push(`brightness(${layer.brightness})`);
        if (layer.contrast !== undefined) filterParts.push(`contrast(${layer.contrast})`);
        if (layer.grayscale !== undefined) filterParts.push(`grayscale(${layer.grayscale})`);
        if (layer.sepia !== undefined) filterParts.push(`sepia(${layer.sepia})`);
        if (layer.saturate !== undefined) filterParts.push(`saturate(${layer.saturate})`);
        const combinedFilter = filterParts.join(' ');

        return {
            x: layer.x ?? 0, y: layer.y ?? 0,
            visualX, visualY,
            x3d, y3d, z3d,
            visualWidth: lWidth * sx * perspectiveFactor,
            visualHeight: lHeight * sy * perspectiveFactor,
            width: layer.width, height: layer.height,
            rotation: tr,
            opacity: layer.opacity ?? 1,
            transform: combinedTransform,
            filter: combinedFilter,
            transformOrigin: layer.transformOrigin
        };
    }

    // Fallback for Animation Segments (t = timeInUnits yuvarlanmış, segment sınırı kaymasını önler)
    const animation = layer.animation || {};
    const entry = animation.entry || { start: 0, duration: 0 };
    const main = animation.main || { start: entry.start + entry.duration, duration: 0 };
    const exit = animation.exit || { start: main.start + main.duration, duration: 0 };

    const entryEnd = entry.start + entry.duration;
    const mainEnd = main.start + main.duration;
    const exitEnd = exit.start + exit.duration;

    let activeAnimStyles: any = { skewX: 0, skewY: 0 };
    
    // Hold over helpers for maintaining end-state frames:
    const getEntryEndState = () => (entry.name && entry.duration > 0) ? getAnimationStyles(entry.name, 1, 'entry') : { _scaleX: 1, _scaleY: 1, _rotation: 0 };
    const getMainEndState = () => (main.name && main.duration > 0 && typeof main.repeat !== 'string') ? getAnimationStyles(main.name, 1, 'main') : getEntryEndState();

    if (t < entry.start) {
        if (layer.type !== 'text') {
            activeAnimStyles = { opacity: 0, pointerEvents: 'none' };
        }
    } else if (t < entryEnd) {
        const rawProgress = entry.duration > 0 ? Math.min(1, Math.max(0, (timeInUnits - entry.start) / entry.duration)) : 1;
        activeAnimStyles = getAnimationStyles(entry.name, applyEasing(rawProgress, entry.easing), 'entry');
    } else if (t < main.start) {
        // Gap between Entry and Main: Object holds the exact final frame of Entry
        activeAnimStyles = getEntryEndState();
    } else if (t < mainEnd) {
        // Main: animasyon varsa uygula; yoksa katman dinlenme halinde (scale/rotation açıkça 1/0).
        if (main.name && main.duration > 0) {
            const rel = Math.max(0, timeInUnits - main.start);
            const repeatCount = (typeof main.repeat === 'string' && main.repeat.toLowerCase() === 'infinite') ? Infinity : (Number(main.repeat || 1));
            const cycle = repeatCount === Infinity ? main.duration : main.duration / repeatCount;
            // Stop at exactly 1 on the last loop to avoid jumping back to 0
            const isLastTick = repeatCount !== Infinity && rel >= main.duration - 1;
            const rawProgress = (cycle > 0) ? Math.min(0.9999, isLastTick ? 0.9999 : (rel % cycle) / cycle) : 1;
            activeAnimStyles = getAnimationStyles(main.name, applyEasing(rawProgress, main.easing), 'main');
        } else {
            activeAnimStyles = getEntryEndState();
        }
    } else if (t < exit.start) {
        // Gap between Main and Exit: Object holds the end of Main (if limited) or Entry
        activeAnimStyles = getMainEndState();
    } else if (t <= exitEnd) {
        // Exit phase: Only calculate if time has reached exit.start
        const rawProgress = exit.duration > 0 ? Math.min(1, Math.max(0, (timeInUnits - exit.start) / exit.duration)) : 1;
        activeAnimStyles = getAnimationStyles(exit.name, applyEasing(rawProgress, exit.easing), 'exit');
    } else {
        // Past Exit End: Object should disappear unless it's a text layer.
        if (layer.type !== 'text') {
            activeAnimStyles = { opacity: 0, pointerEvents: 'none' };
        }
    }

    const resX = activeAnimStyles.x ?? layer.x ?? 0;
    const resY = activeAnimStyles.y ?? layer.y ?? 0;
    const resW = activeAnimStyles.width ?? layer.width ?? 0;
    const resH = activeAnimStyles.height ?? layer.height ?? 0;
    const animRotation = activeAnimStyles._rotation || activeAnimStyles.rotation || 0;

    let txPx = (layer.transformX ?? 0) * resW / 100;
    let tyPx = (layer.transformY ?? 0) * resH / 100;
    if (activeAnimStyles._translateX) {
        const u = parseUnit(activeAnimStyles._translateX);
        txPx += u.unit === '%' ? (u.value / 100) * resW : u.value;
    }
    if (activeAnimStyles._translateY) {
        const u = parseUnit(activeAnimStyles._translateY);
        tyPx += u.unit === '%' ? (u.value / 100) * resH : u.value;
    }

    // Combining layer static Z and animation Z
    const animZ = activeAnimStyles._translateZ !== undefined
        ? activeAnimStyles._translateZ
        : (activeAnimStyles.transformZ !== undefined ? parseUnit(activeAnimStyles.transformZ).value : 0);
    const totalZ = (layer.transformZ || 0) + animZ;

    const layerSX = layer.scaleX ?? layer.scale ?? 1;
    const layerSY = layer.scaleY ?? layer.scale ?? 1;
    const animSX = activeAnimStyles._scaleX ?? activeAnimStyles._scale ?? 1;
    const animSY = activeAnimStyles._scaleY ?? activeAnimStyles._scale ?? 1;



    const visualStyles = resolveVisualPosition(
        resX, resY, resW, resH,
        (layer.rotation || 0),
        animRotation,
        animSX * layerSX,
        animSY * layerSY,
        txPx, tyPx,
        activeAnimStyles.transformOrigin || layer.transformOrigin,
        isChildOfAutoLayout,
        activeAnimStyles.transformOrigin || layer.transformOrigin,
        totalZ,
        stageWidth,
        stageHeight
    );

    const { visualX, visualY, jumpX, jumpY, perspectiveFactor, x3d, y3d, z3d } = visualStyles;

    const scaleX = animSX * layerSX;
    const scaleY = animSY * layerSY;
    const finalRotation = (layer.rotation || 0) + animRotation;

    const rotateX = (activeAnimStyles._rotationX ?? 0) + (layer.rotateX ?? 0);
    const rotateY = (activeAnimStyles._rotationY ?? 0) + (layer.rotateY ?? 0);

    const combinedTransform = [
        isChildOfAutoLayout ? '' : 'translate(-50%, -50%)',
        (jumpX !== 0 || jumpY !== 0) ? `translate3d(${jumpX}px, ${jumpY}px, 0)` : '',
        `translate3d(${layer.transformX ?? 0}%, ${layer.transformY ?? 0}%, ${totalZ}px)`,
        (activeAnimStyles._translateX || activeAnimStyles._translateY) ? `translate3d(${activeAnimStyles._translateX || '0%'}, ${activeAnimStyles._translateY || '0%'}, 0)` : '',
        `rotate(${finalRotation}deg)`,
        `rotateX(${rotateX}deg)`,
        `rotateY(${rotateY}deg)`,
        // We use finalRotation for rotate() which covers 2D and Z-axis in standard animations.
        // We only add rotateZ if there's an explicit animated Z rotation.
        (activeAnimStyles._rotationZ) ? `rotateZ(${activeAnimStyles._rotationZ}deg)` : '',
        `scale3d(${scaleX}, ${scaleY}, ${layer.scaleZ ?? 1})`,
        `skew(${layer.skewX ?? 0}deg, ${layer.skewY ?? 0}deg)`
    ].filter(Boolean).join(' ');

    const filterParts = [];
    const b = activeAnimStyles.blur ?? layer.blur;
    const br = activeAnimStyles.brightness ?? layer.brightness;
    const c = activeAnimStyles.contrast ?? layer.contrast;
    const g = activeAnimStyles.grayscale ?? layer.grayscale;
    const se = activeAnimStyles.sepia ?? layer.sepia;
    const sa = activeAnimStyles.saturate ?? layer.saturate;

    if (b !== undefined) filterParts.push(`blur(${b}px)`);
    if (br !== undefined) filterParts.push(`brightness(${br})`);
    if (c !== undefined) filterParts.push(`contrast(${c})`);
    if (g !== undefined) filterParts.push(`grayscale(${g})`);
    if (se !== undefined) filterParts.push(`sepia(${se})`);
    if (sa !== undefined) filterParts.push(`saturate(${sa})`);
    const combinedFilter = filterParts.join(' ');

    return {
        ...activeAnimStyles,
        x: resX, y: resY,
        visualX, visualY,
        x3d, y3d, z3d,
        scaleX,
        scaleY,
        rotateX,
        rotateY,
        visualWidth: resW * scaleX * perspectiveFactor,
        visualHeight: resH * scaleY * perspectiveFactor,
        width: resW, height: resH,
        rotation: finalRotation,
        opacity: activeAnimStyles.opacity ?? layer.opacity ?? 1,
        transform: combinedTransform,
        filter: combinedFilter,
        transformOrigin: activeAnimStyles.transformOrigin || layer.transformOrigin
    };
};

/**
 * Snaps a time value (in centiseconds) to defined targets or intervals
 */
export const snapTime = (time: number, zoom: number, duration: number, targets: number[] = [], thresholdPx: number = 8, snapToGrid: boolean = true) => {
    const threshold = thresholdPx / zoom;
    let bestSnap = time;
    let minDiff = threshold;
    if (snapToGrid) {
        const potentialIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
        const activeIntervals = potentialIntervals.filter(interval => interval * zoom >= 10);
        if (activeIntervals.length === 0) activeIntervals.push(potentialIntervals[0]);
        activeIntervals.forEach(interval => {
            const snapped = Math.round(time / interval) * interval;
            const diff = Math.abs(time - snapped);
            if (diff < minDiff) { minDiff = diff; bestSnap = snapped; }
        });
    }
    targets.forEach(target => {
        const diff = Math.abs(time - target);
        if (diff < minDiff) { minDiff = diff; bestSnap = target; }
    });
    return Math.max(0, Math.min(duration * 100, bestSnap));
};
