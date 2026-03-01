
/**
 * Figma-style transform system: single snapshot at pointer down, all deltas applied in world space.
 * - Anchor is fixed at mousedown; no mixing with live state during drag.
 * - Move: world delta → convert to each layer's parent local space.
 * - Rotate: rotate each layer's world position around selection center; convert to local.
 * - Resize: scale each layer's world offset from selection center; convert to local.
 */

export interface TransformLayerSnapshot {
    layerId: string;
    parentId: string | null;
    /** World position (center) at snapshot time */
    worldX: number;
    worldY: number;
    worldRotation: number;
    /** Local position and size at snapshot time (from cloned layer) */
    localX: number;
    localY: number;
    localWidth: number;
    localHeight: number;
    localRotation: number;
    localScaleX: number;
    localScaleY: number;
    /** Parent world at snapshot (for world→local) */
    parentWorldX: number;
    parentWorldY: number;
    parentWorldRotation: number;
    parentWidth: number;
    parentHeight: number;
    /** Scale from parent chain so we can unproject correctly */
    parentScaleX: number;
    parentScaleY: number;
    isRootSelection: boolean;
    isParentAuto: boolean;
    parentPadding?: { left: number; top: number };
    /** Clone of layer for scale updates (keyframes, variant, etc.) */
    layer: any;
}

export interface TransformBoundsSnapshot {
    /** Selection center in world (3d) */
    centerX: number;
    centerY: number;
    /** Top-left in world (for move delta from controller) */
    left: number;
    top: number;
    width: number;
    height: number;
    rotation: number;
    perspectiveFactor: number;
}

export interface TransformSnapshot {
    bounds: TransformBoundsSnapshot;
    layers: TransformLayerSnapshot[];
}

/**
 * Build a transform snapshot from current selection (Figma: anchor at pointer down).
 * Use cloned layers so we never read live state during drag.
 */
export function createTransformSnapshot(
    selectionBounds: { x: number; y: number; width: number; height: number; rotation?: number; x3d?: number; y3d?: number; perspectiveFactor?: number },
    selectedWorldLayers: Array<{
        layer: any;
        worldX: number;
        worldY: number;
        worldRotation: number;
        parentWorldX: number;
        parentWorldY: number;
        parentWorldRotation: number;
        parentWidth: number;
        parentHeight: number;
        worldScaleX: number;
        worldScaleY: number;
        parentId: string | null;
        isRootSelection: boolean;
        isParentAuto: boolean;
        parentPadding?: { left: number; top: number };
    }>,
    clonedLayers: any[]
): TransformSnapshot {
    const findInTree = (layers: any[], id: string): any | null => {
        for (const l of layers) {
            if (l.id === id) return l;
            if (l.children) {
                const found = findInTree(l.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    const centerX = selectionBounds.x3d ?? selectionBounds.x;
    const centerY = selectionBounds.y3d ?? selectionBounds.y;
    const left = selectionBounds.x - selectionBounds.width / 2;
    const top = selectionBounds.y - selectionBounds.height / 2;
    const rotation = selectionBounds.rotation ?? 0;
    const perspectiveFactor = selectionBounds.perspectiveFactor ?? 1;

    const layers: TransformLayerSnapshot[] = selectedWorldLayers.map((s) => {
        const layer = findInTree(clonedLayers, s.layer.id) || s.layer;
        const lx = layer.scaleX ?? layer.scale ?? 1;
        const ly = layer.scaleY ?? layer.scale ?? 1;
        const parentScaleX = Math.abs(lx) > 1e-6 ? s.worldScaleX / lx : 1;
        const parentScaleY = Math.abs(ly) > 1e-6 ? s.worldScaleY / ly : 1;
        return {
            layerId: layer.id,
            parentId: s.parentId,
            worldX: s.worldX,
            worldY: s.worldY,
            worldRotation: s.worldRotation,
            localX: layer.x ?? 0,
            localY: layer.y ?? 0,
            localWidth: layer.width ?? 0,
            localHeight: layer.height ?? 0,
            localRotation: layer.rotation ?? 0,
            localScaleX: lx,
            localScaleY: ly,
            parentWorldX: s.parentWorldX,
            parentWorldY: s.parentWorldY,
            parentWorldRotation: s.parentWorldRotation,
            parentWidth: s.parentWidth,
            parentHeight: s.parentHeight,
            parentScaleX,
            parentScaleY: parentScaleY,
            isRootSelection: s.isRootSelection,
            isParentAuto: s.isParentAuto,
            parentPadding: s.parentPadding,
            layer,
        };
    });

    return {
        bounds: {
            centerX,
            centerY,
            left,
            top,
            width: selectionBounds.width,
            height: selectionBounds.height,
            rotation,
            perspectiveFactor,
        },
        layers,
    };
}

/** World delta to parent-local delta (rotate by -parentRotation, then divide by parent scale). */
function worldDeltaToLocal(
    worldDx: number,
    worldDy: number,
    parentWorldRotation: number,
    parentScaleX: number,
    parentScaleY: number
): { localDx: number; localDy: number } {
    const rad = -parentWorldRotation * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const localDx = (worldDx * cos - worldDy * sin) / parentScaleX;
    const localDy = (worldDx * sin + worldDy * cos) / parentScaleY;
    return { localDx, localDy };
}

/** World position to parent-local position (relative to parent center). */
function worldToLocal(
    worldX: number,
    worldY: number,
    worldRot: number,
    parentWorldX: number,
    parentWorldY: number,
    parentWorldRotation: number,
    parentWidth: number,
    parentHeight: number,
    parentScaleX: number,
    parentScaleY: number,
    isParentAuto: boolean,
    parentPadding = { left: 0, top: 0 },
    childWidth = 0,
    childHeight = 0
): { localX: number; localY: number; localRotation: number } {
    const prad = -parentWorldRotation * (Math.PI / 180);
    const pcos = Math.cos(prad);
    const psin = Math.sin(prad);
    const drx = worldX - parentWorldX;
    const dry = worldY - parentWorldY;
    const localRelX = drx * pcos - dry * psin;
    const localRelY = drx * psin + dry * pcos;

    // Center relative to parent top-left
    let localX = (localRelX + parentWidth / 2) / parentScaleX;
    let localY = (localRelY + parentHeight / 2) / parentScaleY;

    if (isParentAuto) {
        // For auto-layout, stored X/Y is Top-Left relative to padding start
        localX = localX - (childWidth / 2) - (parentPadding.left || 0);
        localY = localY - (childHeight / 2) - (parentPadding.top || 0);
    }

    const localRotation = worldRot - parentWorldRotation;
    return { localX, localY, localRotation };
}

/**
 * Apply move: world delta from controller (top-left space). Updates only root-selection layers (group children move with parent).
 */
export function applyTransformMove(
    snapshot: TransformSnapshot,
    worldTopLeftX: number,
    worldTopLeftY: number
): Map<string, any> {
    const b = snapshot.bounds;
    const worldDx = (worldTopLeftX - b.left) / b.perspectiveFactor;
    const worldDy = (worldTopLeftY - b.top) / b.perspectiveFactor;
    const changes = new Map<string, any>();

    snapshot.layers.forEach((s) => {
        if (!s.isRootSelection) return;
        const { localDx, localDy } = worldDeltaToLocal(
            worldDx,
            worldDy,
            s.parentWorldRotation,
            s.parentScaleX,
            s.parentScaleY
        );
        changes.set(s.layerId, {
            x: s.localX + localDx,
            y: s.localY + localDy,
            rotation: s.worldRotation - s.parentWorldRotation,
        });
    });
    return changes;
}

/**
 * Apply rotate: delta angle in degrees around selection center. All selected roots get new world position and rotation.
 */
export function applyTransformRotate(
    snapshot: TransformSnapshot,
    deltaAngleDeg: number
): Map<string, any> {
    if (Math.abs(deltaAngleDeg) < 1e-6) return new Map();
    const b = snapshot.bounds;
    const rad = deltaAngleDeg * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const changes = new Map<string, any>();

    snapshot.layers.forEach((s) => {
        if (!s.isRootSelection) return;
        const lx = s.worldX - b.centerX;
        const ly = s.worldY - b.centerY;
        const newWorldX = b.centerX + (lx * cos - ly * sin);
        const newWorldY = b.centerY + (lx * sin + ly * cos);
        const newWorldRot = s.worldRotation + deltaAngleDeg;
        const { localX, localY, localRotation } = worldToLocal(
            newWorldX,
            newWorldY,
            newWorldRot,
            s.parentWorldX,
            s.parentWorldY,
            s.parentWorldRotation,
            s.parentWidth,
            s.parentHeight,
            s.parentScaleX,
            s.parentScaleY,
            s.isParentAuto,
            s.parentPadding,
            s.localWidth,
            s.localHeight
        );
        changes.set(s.layerId, { x: localX, y: localY, rotation: localRotation });
    });
    return changes;
}

/**
 * Resolve root selection id for a layer (walk parentId until isRootSelection).
 */
function getRootIdForLayer(layerId: string, snapshot: TransformSnapshot): string | null {
    const layer = snapshot.layers.find((l) => l.layerId === layerId);
    if (!layer) return null;
    if (layer.isRootSelection) return layerId;
    if (!layer.parentId) return null;
    return getRootIdForLayer(layer.parentId, snapshot);
}

/**
 * Apply resize: scale with anchor from controller. Controller sends new top-left (x,y) and size (width,height);
 * the opposite corner stays fixed. We compute new center from that and scale all layers toward it.
 * Auto-layout group with hug width/height: grup içindeki nesnelerin o eksendeki boyutu değiştirilmez (scale 1).
 */
export function applyTransformResize(
    snapshot: TransformSnapshot,
    scaleX: number,
    scaleY: number,
    worldTopLeftX: number,
    worldTopLeftY: number,
    calculateLayerScaleUpdates: (layer: any, scaleX: number, scaleY: number) => any
): Map<string, any> {
    const b = snapshot.bounds;
    const newW = b.width * scaleX;
    const newH = b.height * scaleY;
    const rotRad = b.rotation * (Math.PI / 180);
    const rcos = Math.cos(rotRad);
    const rsin = Math.sin(rotRad);
    const newCenterX = worldTopLeftX + (newW / 2) * rcos - (newH / 2) * rsin;
    const newCenterY = worldTopLeftY + (newW / 2) * rsin + (newH / 2) * rcos;
    const centerDx = newCenterX - b.centerX;
    const centerDy = newCenterY - b.centerY;
    const cos = Math.cos(-b.rotation * (Math.PI / 180));
    const sin = Math.sin(-b.rotation * (Math.PI / 180));
    const invCos = rcos;
    const invSin = rsin;
    const changes = new Map<string, any>();

    // Auto-layout group: sadece grup boyutu değişsin, içerideki nesneler scale'den etkilenmesin (hem hug hem fixed)
    const isAutoLayoutRootId = new Set<string>();
    snapshot.layers.forEach((s) => {
        if (!s.isRootSelection || s.layer.type !== 'group') return;
        let meta: { layoutMode?: string } = {};
        try {
            meta = typeof s.layer.variant === 'string' ? JSON.parse(s.layer.variant) : (s.layer.variant || {});
        } catch (_) {}
        if (meta.layoutMode === 'auto') isAutoLayoutRootId.add(s.layerId);
    });

    const getEffectiveScale = (s: TransformLayerSnapshot): { scaleX: number; scaleY: number } => {
        if (s.isRootSelection) return { scaleX, scaleY };
        const rootId = getRootIdForLayer(s.layerId, snapshot);
        if (!rootId || !isAutoLayoutRootId.has(rootId)) return { scaleX, scaleY };
        // Auto layout grubu: içeridekiler sabit, sadece grup kutusunun boyutu değişir
        return { scaleX: 1, scaleY: 1 };
    };

    const parentNewSize = new Map<string, { w: number; h: number }>();
    const newWorldByLayer = new Map<string, { worldX: number; worldY: number }>();

    snapshot.layers.forEach((s) => {
        const eff = getEffectiveScale(s);
        if (s.parentId) {
            const parent = snapshot.layers.find((l) => l.layerId === s.parentId);
            if (parent && !parentNewSize.has(s.parentId)) {
                const pEff = getEffectiveScale(parent);
                parentNewSize.set(s.parentId, {
                    w: parent.localWidth * pEff.scaleX,
                    h: parent.localHeight * pEff.scaleY,
                });
            }
        }
        const relX = s.worldX - b.centerX;
        const relY = s.worldY - b.centerY;
        const lx = relX * cos - relY * sin;
        const ly = relX * sin + relY * cos;
        const nlx = lx * eff.scaleX;
        const nly = ly * eff.scaleY;
        const newWorldX = b.centerX + centerDx + (nlx * invCos - nly * invSin);
        const newWorldY = b.centerY + centerDy + (nlx * invSin + nly * invCos);
        newWorldByLayer.set(s.layerId, { worldX: newWorldX, worldY: newWorldY });
    });

    snapshot.layers.forEach((s) => {
        const eff = getEffectiveScale(s);
        const nw = newWorldByLayer.get(s.layerId)!;
        const newWorldX = nw.worldX;
        const newWorldY = nw.worldY;
        const newWorldRot = s.worldRotation;

        let newParentWidth = s.parentWidth;
        let newParentHeight = s.parentHeight;
        const parentSize = s.parentId ? parentNewSize.get(s.parentId) : null;
        if (parentSize) {
            newParentWidth = parentSize.w;
            newParentHeight = parentSize.h;
        }

        const parentWorld = s.parentId ? newWorldByLayer.get(s.parentId) : null;
        const refParentX = parentWorld ? parentWorld.worldX : s.parentWorldX;
        const refParentY = parentWorld ? parentWorld.worldY : s.parentWorldY;

        const { localX, localY, localRotation } = worldToLocal(
            newWorldX,
            newWorldY,
            newWorldRot,
            refParentX,
            refParentY,
            s.parentWorldRotation,
            newParentWidth,
            newParentHeight,
            s.parentScaleX,
            s.parentScaleY,
            s.isParentAuto,
            s.parentPadding,
            s.localWidth * eff.scaleX,
            s.localHeight * eff.scaleY
        );

        const scaleUpdates = calculateLayerScaleUpdates(s.layer, eff.scaleX, eff.scaleY);
        const c: any = { ...scaleUpdates, x: localX, y: localY, rotation: localRotation };
        c.width = (s.localWidth || 0) * eff.scaleX;
        c.height = (s.localHeight || 0) * eff.scaleY;
        changes.set(s.layerId, c);
    });

    // Do NOT overwrite group width/height with children bbox during resize.
    // That would shift the group's origin and cause a second "move" on top of the scale.
    // Group keeps scaled size (from above); children already have correct world positions.
    return changes;
}

/**
 * Apply move + rotate together (Figma: drag rotated box = translate + rotate around center).
 */
export function applyTransformMoveAndRotate(
    snapshot: TransformSnapshot,
    worldTopLeftX: number,
    worldTopLeftY: number,
    deltaAngleDeg: number
): Map<string, any> {
    const b = snapshot.bounds;
    const worldDx = (worldTopLeftX - b.left) / b.perspectiveFactor;
    const worldDy = (worldTopLeftY - b.top) / b.perspectiveFactor;
    const rad = deltaAngleDeg * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const changes = new Map<string, any>();

    snapshot.layers.forEach((s) => {
        if (!s.isRootSelection) return;
        const lx = s.worldX - b.centerX;
        const ly = s.worldY - b.centerY;
        const newWorldX = b.centerX + (lx * cos - ly * sin) + worldDx;
        const newWorldY = b.centerY + (lx * sin + ly * cos) + worldDy;
        const newWorldRot = s.worldRotation + deltaAngleDeg;
        const { localX, localY, localRotation } = worldToLocal(
            newWorldX,
            newWorldY,
            newWorldRot,
            s.parentWorldX,
            s.parentWorldY,
            s.parentWorldRotation,
            s.parentWidth,
            s.parentHeight,
            s.parentScaleX,
            s.parentScaleY,
            s.isParentAuto,
            s.parentPadding,
            s.localWidth,
            s.localHeight
        );
        changes.set(s.layerId, { x: localX, y: localY, rotation: localRotation });
    });
    return changes;
}

const EPS = 1e-6;

/** Resize handle: which corner/edge was dragged. Opposite corner/edge stays fixed. */
const RESIZE_ANCHORS = ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r'] as const;

function worldTopLeftFromAnchor(
    b: TransformBoundsSnapshot,
    newW: number,
    newH: number,
    anchor: string
): { worldLeft: number; worldTop: number } {
    const rotRad = b.rotation * (Math.PI / 180);
    const rcos = Math.cos(rotRad);
    const rsin = Math.sin(rotRad);
    const cx = b.centerX;
    const cy = b.centerY;
    const w2 = b.width / 2;
    const h2 = b.height / 2;
    switch (anchor) {
        case 'br': {
            const fixedTLx = cx - w2 * rcos + h2 * rsin;
            const fixedTLy = cy - w2 * rsin - h2 * rcos;
            return { worldLeft: fixedTLx, worldTop: fixedTLy };
        }
        case 'tl': {
            const fixedBRx = cx + w2 * rcos - h2 * rsin;
            const fixedBRy = cy + w2 * rsin + h2 * rcos;
            return {
                worldLeft: fixedBRx - newW * rcos + newH * rsin,
                worldTop: fixedBRy - newW * rsin - newH * rcos
            };
        }
        case 'tr': {
            const fixedBLx = cx - w2 * rcos - h2 * rsin;
            const fixedBLy = cy - w2 * rsin + h2 * rcos;
            return {
                worldLeft: fixedBLx + newH * rsin,
                worldTop: fixedBLy - newH * rcos
            };
        }
        case 'bl': {
            const fixedTRx = cx + w2 * rcos + h2 * rsin;
            const fixedTRy = cy + w2 * rsin - h2 * rcos;
            return {
                worldLeft: fixedTRx - newW * rcos,
                worldTop: fixedTRy - newW * rsin
            };
        }
        case 't': {
            const fixX = cx - h2 * rsin;
            const fixY = cy + h2 * rcos;
            return {
                worldLeft: fixX - (newW / 2) * rcos + newH * rsin,
                worldTop: fixY - (newW / 2) * rsin - newH * rcos
            };
        }
        case 'b': {
            const fixX = cx + h2 * rsin;
            const fixY = cy - h2 * rcos;
            return {
                worldLeft: fixX - (newW / 2) * rcos,
                worldTop: fixY - (newW / 2) * rsin
            };
        }
        case 'l': {
            const fixX = cx + w2 * rcos;
            const fixY = cy + w2 * rsin;
            return {
                worldLeft: fixX - newW * rcos + (newH / 2) * rsin,
                worldTop: fixY - newW * rsin - (newH / 2) * rcos
            };
        }
        case 'r': {
            const fixX = cx - w2 * rcos;
            const fixY = cy - w2 * rsin;
            return {
                worldLeft: fixX + (newH / 2) * rsin,
                worldTop: fixY - (newH / 2) * rcos
            };
        }
        default:
            return { worldLeft: b.left, worldTop: b.top };
    }
}

/**
 * Compute layer updates from controller update (Figma-style: single snapshot, apply one of move/rotate/resize).
 * When delta is effectively zero we return hasChange: false so we never write to layers (avoids drift).
 * If updates.resizeAnchor is set (tl|tr|bl|br|t|b|l|r), new top-left is derived from snapshot so the opposite corner/edge stays fixed.
 */
export function applyTransformUpdate(
    snapshot: TransformSnapshot,
    updates: { x?: number; y?: number; width?: number; height?: number; rotation?: number; resizeAnchor?: string },
    calculateLayerScaleUpdates: (layer: any, scaleX: number, scaleY: number) => any
): { changes: Map<string, any>; hasChange: boolean } {
    const b = snapshot.bounds;
    const hasResize = updates.width !== undefined || updates.height !== undefined;
    if (hasResize) {
        const iW = Math.max(0.01, b.width);
        const iH = Math.max(0.01, b.height);
        let scaleX = (updates.width ?? b.width) / iW;
        let scaleY = (updates.height ?? b.height) / iH;
        const newW = b.width * scaleX;
        const newH = b.height * scaleY;
        if (Math.abs(scaleX - 1) < EPS && Math.abs(scaleY - 1) < EPS) {
            const wLeft = updates.x ?? b.left;
            const wTop = updates.y ?? b.top;
            const noMove = Math.abs((wLeft - b.left) / b.perspectiveFactor) < EPS && Math.abs((wTop - b.top) / b.perspectiveFactor) < EPS;
            if (noMove) return { changes: new Map(), hasChange: false };
        }
        const anchor = updates.resizeAnchor && RESIZE_ANCHORS.includes(updates.resizeAnchor as any) ? updates.resizeAnchor : null;
        const { worldLeft, worldTop } = anchor
            ? worldTopLeftFromAnchor(b, newW, newH, anchor)
            : { worldLeft: updates.x !== undefined ? updates.x : b.left, worldTop: updates.y !== undefined ? updates.y : b.top };
        const changes = applyTransformResize(snapshot, scaleX, scaleY, worldLeft, worldTop, calculateLayerScaleUpdates);
        return { changes, hasChange: changes.size > 0 };
    }

    const worldLeft = updates.x ?? b.left;
    const worldTop = updates.y ?? b.top;
    const worldDx = (worldLeft - b.left) / b.perspectiveFactor;
    const worldDy = (worldTop - b.top) / b.perspectiveFactor;
    const hasMove = updates.x !== undefined || updates.y !== undefined;
    const hasRotate = updates.rotation !== undefined;
    const deltaRot = hasRotate ? (updates.rotation ?? b.rotation) - b.rotation : 0;
    const moveZero = Math.abs(worldDx) < EPS && Math.abs(worldDy) < EPS;
    const rotateZero = Math.abs(deltaRot) < EPS;

    if (hasRotate && hasMove) {
        if (moveZero && rotateZero) return { changes: new Map(), hasChange: false };
        const changes = applyTransformMoveAndRotate(snapshot, worldLeft, worldTop, deltaRot);
        return { changes, hasChange: changes.size > 0 };
    }
    if (hasRotate) {
        if (rotateZero) return { changes: new Map(), hasChange: false };
        const changes = applyTransformRotate(snapshot, deltaRot);
        return { changes, hasChange: changes.size > 0 };
    }
    if (hasMove) {
        if (moveZero) return { changes: new Map(), hasChange: false };
        const changes = applyTransformMove(snapshot, worldLeft, worldTop);
        return { changes, hasChange: changes.size > 0 };
    }
    return { changes: new Map(), hasChange: false };
}
