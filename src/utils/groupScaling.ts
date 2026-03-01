
/**
 * Internal helper to scale spatial properties of a layer.
 */
const scaleSpatialProp = (val: any, factor: number) => {
    if (val === undefined || val === null || val === '') return val;
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (typeof val === 'string' && val.trim().endsWith('%')) return val; // Don't scale percentages
    return num * factor;
};

/**
 * Calculates updates for a single layer based on scale factors.
 */
export const calculateLayerScaleUpdates = (
    layer: any,
    scaleX: number,
    scaleY: number,
    isIncremental: boolean = false
) => {
    const changes: any = {};
    const sFac = Math.sqrt(Math.abs(scaleX * scaleY));

    // 1. Dimensions and Position
    // If incremental, we multiply existing. If absolute (from iW/iH), we use initialChild reference.
    // However, this utility usually receives an absolute scale factor from the snapshot anchor.
    changes.width = (layer.width || 0) * scaleX;
    changes.height = (layer.height || 0) * scaleY;
    changes.x = (layer.x || 0) * scaleX;
    changes.y = (layer.y || 0) * scaleY;

    // 2. Transform Origin
    if (layer.transformOrigin) {
        const parts = layer.transformOrigin.split(' ');
        if (parts.length >= 2) {
            const ox = parts[0];
            const oy = parts[1];
            let changed = false;
            const newParts = [...parts];
            if (ox.endsWith('px')) { newParts[0] = (parseFloat(ox) * scaleX) + 'px'; changed = true; }
            if (oy.endsWith('px')) { newParts[1] = (parseFloat(oy) * scaleY) + 'px'; changed = true; }
            if (changed) changes.transformOrigin = newParts.join(' ');
        }
    }

    // 3. Keyframes
    if (layer.animation?.keyframes && layer.animation.keyframes.length > 0) {
        changes.animation = {
            ...layer.animation,
            keyframes: layer.animation.keyframes.map((kf: any) => {
                const newProps = { ...kf.props };
                const spatial = ['x', 'y', 'width', 'height', 'fontSize', 'letterSpacing', 'borderWidth', 'borderRadius', 'padding', 'gap', 'transformZ'];

                spatial.forEach(prop => {
                    if (newProps[prop] !== undefined && typeof newProps[prop] === 'number') {
                        const factor = (prop === 'y' || prop === 'height' || prop === 'paddingTop' || prop === 'paddingBottom' || prop === 'paddingVertical') ? scaleY :
                            (prop === 'x' || prop === 'width' || prop === 'paddingLeft' || prop === 'paddingRight' || prop === 'paddingHorizontal') ? scaleX :
                                sFac;
                        newProps[prop] = newProps[prop] * factor;
                    }
                });
                return { ...kf, props: newProps };
            })
        };
    }

    // 4. Variant (Style Metadata)
    try {
        if (layer.variant) {
            const meta = JSON.parse(layer.variant);
            let metaChanged = false;

            const scaleM = (key: string, factor: number) => {
                const prev = meta[key];
                const next = scaleSpatialProp(prev, factor);
                if (next !== prev) {
                    meta[key] = next;
                    metaChanged = true;
                }
            };

            const isVertical = meta.flexDirection === 'column';

            // Padding - Axis-aware scaling to prevent drift
            if (Math.abs(scaleX - scaleY) > 0.0001) {
                if (meta.padding !== undefined) {
                    const p = parseFloat(meta.padding);
                    meta.paddingLeft = (meta.paddingLeft ?? p) * scaleX;
                    meta.paddingRight = (meta.paddingRight ?? p) * scaleX;
                    meta.paddingTop = (meta.paddingTop ?? p) * scaleY;
                    meta.paddingBottom = (meta.paddingBottom ?? p) * scaleY;
                    delete meta.padding;
                    metaChanged = true;
                }
                if (meta.paddingHorizontal !== undefined) {
                    const ph = parseFloat(meta.paddingHorizontal);
                    meta.paddingLeft = (meta.paddingLeft ?? ph) * scaleX;
                    meta.paddingRight = (meta.paddingRight ?? ph) * scaleX;
                    delete meta.paddingHorizontal;
                    metaChanged = true;
                }
                if (meta.paddingVertical !== undefined) {
                    const pv = parseFloat(meta.paddingVertical);
                    meta.paddingTop = (meta.paddingTop ?? pv) * scaleY;
                    meta.paddingBottom = (meta.paddingBottom ?? pv) * scaleY;
                    delete meta.paddingVertical;
                    metaChanged = true;
                }
                scaleM('paddingLeft', scaleX);
                scaleM('paddingRight', scaleX);
                scaleM('paddingTop', scaleY);
                scaleM('paddingBottom', scaleY);
            } else {
                scaleM('padding', scaleX);
                scaleM('paddingLeft', scaleX);
                scaleM('paddingRight', scaleX);
                scaleM('paddingTop', scaleX);
                scaleM('paddingBottom', scaleX);
                scaleM('paddingHorizontal', scaleX);
                scaleM('paddingVertical', scaleX);
            }

            // Gaps
            scaleM('gap', isVertical ? scaleY : scaleX);
            scaleM('rowGap', scaleY);
            scaleM('columnGap', scaleX);

            // Typography & Borders (skip fontSize/letterSpacing for text Auto Height and None so font size stays fixed when scaling)
            const shouldSkipFontSizeScale = (layer.type === 'text' || layer.type === 'button') &&
                (meta.layoutType === 'autoHeight' || meta.layoutType === 'none' || !meta.layoutType);

            if (!shouldSkipFontSizeScale) {
                scaleM('fontSize', sFac);
                scaleM('letterSpacing', sFac);
            }
            scaleM('borderWidth', sFac);
            scaleM('borderTopWidth', sFac);
            scaleM('borderRightWidth', sFac);
            scaleM('borderBottomWidth', sFac);
            scaleM('borderLeftWidth', sFac);
            scaleM('borderRadius', sFac);
            scaleM('borderRadiusTopLeft', sFac);
            scaleM('borderRadiusTopRight', sFac);
            scaleM('borderRadiusBottomRight', sFac);
            scaleM('borderRadiusBottomLeft', sFac);
            scaleM('strokeWidth', sFac);

            if (meta.transformOrigin) {
                const parts = meta.transformOrigin.split(/\s+/);
                const newParts = parts.map((part: string, i: number) => {
                    if (part.endsWith('px')) {
                        const val = parseFloat(part);
                        const factor = (i === 0) ? scaleX : (i === 1 ? scaleY : sFac);
                        metaChanged = true;
                        return (val * factor) + 'px';
                    }
                    return part;
                });
                if (metaChanged) meta.transformOrigin = newParts.join(' ');
            }

            if (metaChanged) {
                changes.variant = JSON.stringify(meta);
            }
        }
    } catch (e) { }

    return changes;
};

/**
 * Recursively collects scale updates for a hierarchy.
 */
export const collectDescendantScaleUpdates = (
    children: any[],
    scaleX: number,
    scaleY: number,
    layerChanges: Map<string, any>,
    initialChildren: any[]
) => {
    children.forEach((child, index) => {
        const initialChild = initialChildren[index];
        if (!initialChild) return;

        const changes = calculateLayerScaleUpdates(initialChild, scaleX, scaleY);
        layerChanges.set(child.id, changes);

        if (child.children && initialChild.children) {
            collectDescendantScaleUpdates(child.children, scaleX, scaleY, layerChanges, initialChild.children);
        }
    });
};

/**
 * High-level helper to scale a layer tree.
 */
export const scaleLayerComprehensively = (layer: any, rx: number, ry: number): any => {
    if (isNaN(rx) || isNaN(ry) || !isFinite(rx) || !isFinite(ry)) return layer;
    if (rx === 1 && ry === 1) return layer;

    const changes = calculateLayerScaleUpdates(layer, rx, ry);
    const updatedLayer = { ...layer, ...changes };

    if (layer.children && layer.children.length > 0) {
        const layerChanges = new Map<string, any>();
        collectDescendantScaleUpdates(layer.children, rx, ry, layerChanges, layer.children);

        const applyChanges = (ls: any[]): any[] => {
            return ls.map(l => {
                const c = layerChanges.get(l.id);
                let up = c ? { ...l, ...c } : l;
                if (up.children) up.children = applyChanges(up.children);
                return up;
            });
        };
        updatedLayer.children = applyChanges(layer.children);
    }

    return updatedLayer;
};
