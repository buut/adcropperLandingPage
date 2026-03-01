/**
 * Snap utilities: single place for snap logic with hysteresis to prevent "sticking" and jank.
 * - Capture radius: distance to snap onto a target.
 * - Release radius: distance beyond which we release the lock (larger = less flicker).
 * - Only one "lock" per drag; lock is cleared when cursor moves beyond release distance.
 */

export type SnapTarget = { x?: number; y?: number; label?: string };

const GRID = 10;
const CAPTURE_PX = 8;
const RELEASE_PX = 20; // Reduced slightly to avoid sticking too long
/** Stage-space minimum: snap when within at least this many stage px (1px = çizgi/kenar denk gelince hemen yapış) */
const ALIGN_THRESHOLD_STAGE = 1;

/** Dedupe targets that are very close (1px) */
function dedupeTargets(targets: SnapTarget[]): SnapTarget[] {
  const out: SnapTarget[] = [];
  const seenPoint = new Set<string>();
  const seenLineX = new Set<number>();
  const seenLineY = new Set<number>();
  const key = (x: number, y: number) => `${Math.round(x)}_${Math.round(y)}`;
  const lineKey = (v: number) => Math.round(v);

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    if (t.x !== undefined && t.y !== undefined) {
      const k = key(t.x, t.y);
      if (seenPoint.has(k)) continue;
      seenPoint.add(k);
    } else if (t.x !== undefined) {
      const k = lineKey(t.x);
      if (seenLineX.has(k)) continue;
      seenLineX.add(k);
    } else if (t.y !== undefined) {
      const k = lineKey(t.y);
      if (seenLineY.has(k)) continue;
      seenLineY.add(k);
    }
    out.push(t);
  }
  return out;
}

export function normalizeSnapTargets(targets: SnapTarget[]): SnapTarget[] {
  return dedupeTargets(targets);
}

export interface MoveSnapLock {
  tx: number;
  ty: number;
  px: number;
  py: number;
  label?: string;
}

export interface MoveSnapResult {
  finalX: number;
  finalY: number;
  snapX: number | null;
  snapY: number | null;
  labelX?: string;
  labelY?: string;
  newLock: MoveSnapLock | null;
}

/**
 * Evaluate move snap: given box center (world), size, rotation and optional lock,
 * returns final top-left (x,y), snap guide values and new lock.
 */
export function evaluateMoveSnap(
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  rotationDeg: number,
  targets: SnapTarget[],
  zoom: number,
  lock: MoveSnapLock | null,
  gridSnap: boolean
): MoveSnapResult {
  const capture = Math.max(ALIGN_THRESHOLD_STAGE, CAPTURE_PX / zoom);
  const release = Math.max(ALIGN_THRESHOLD_STAGE * 4, RELEASE_PX / zoom);
  const rad = rotationDeg * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const halfW = width / 2;
  const halfH = height / 2;

  // Local points to check for snapping (relative to top-left)
  const snapLocalPoints = [
    { dx: 0, dy: 0, isCorner: true },
    { dx: width, dy: 0, isCorner: true },
    { dx: 0, dy: height, isCorner: true },
    { dx: width, dy: height, isCorner: true },
    { dx: halfW, dy: halfH, isCorner: false },
    { dx: halfW, dy: 0, isCorner: false },
    { dx: halfW, dy: height, isCorner: false },
    { dx: 0, dy: halfH, isCorner: false },
    { dx: width, dy: halfH, isCorner: false },
  ];

  // Pre-calculate world positions of these points
  const worldPoints = new Array(snapLocalPoints.length);
  for (let i = 0; i < snapLocalPoints.length; i++) {
    const p = snapLocalPoints[i];
    const rx = p.dx - halfW;
    const ry = p.dy - halfH;
    worldPoints[i] = {
      x: centerX + rx * cos - ry * sin,
      y: centerY + rx * sin + ry * cos,
      dx: p.dx,
      dy: p.dy,
      isCorner: p.isCorner
    };
  }

  const snapToPoint = (tx: number, ty: number, px: number, py: number) => {
    const rx = px - halfW;
    const ry = py - halfH;
    const cx = tx - (rx * cos - ry * sin);
    const cy = ty - (rx * sin + ry * cos);
    return { x: cx - halfW, y: cy - halfH };
  };

  let finalX = centerX - halfW;
  let finalY = centerY - halfH;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let labelX: string | undefined;
  let labelY: string | undefined;
  let newLock: MoveSnapLock | null = null;

  if (targets.length === 0) {
    if (gridSnap) {
      finalX = Math.round(finalX / GRID) * GRID;
      finalY = Math.round(finalY / GRID) * GRID;
    }
    return { finalX, finalY, snapX, snapY, labelX, labelY, newLock };
  }

  let pointSnapPIdx = -1;
  let pointSnapTIdx = -1;

  // 1) If locked, check if still within release distance
  if (lock) {
    const pIdx = snapLocalPoints.findIndex(p => p.dx === lock.px && p.dy === lock.py);
    if (pIdx !== -1) {
      const wp = worldPoints[pIdx];
      const dx = wp.x - lock.tx;
      const dy = wp.y - lock.ty;
      if (Math.sqrt(dx * dx + dy * dy) <= release) {
        pointSnapPIdx = pIdx;
        newLock = lock;
        // We still need to find which target it was to get the label, though we have it in lock
      }
    }
  }

  // 2) Find point-snap if not locked or lock found
  if (pointSnapPIdx === -1) {
    let bestDist = capture;
    // Separate corner and non-corner targets implicitly via priority
    for (let i = 0; i < worldPoints.length; i++) {
      const wp = worldPoints[i];
      for (let j = 0; j < targets.length; j++) {
        const t = targets[j];
        if (t.x === undefined || t.y === undefined) continue;
        
        const dx = wp.x - t.x;
        const dy = wp.y - t.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        // Priority to corners: if it's a corner, we are more likely to accept it
        const effectiveCapture = wp.isCorner ? capture : capture * 0.8;
        
        if (d < effectiveCapture && d < bestDist) {
          bestDist = d;
          pointSnapPIdx = i;
          pointSnapTIdx = j;
        }
      }
    }
  } else if (newLock) {
    // If we have a lock, just find that target in case we need its label
    for (let j = 0; j < targets.length; j++) {
      const t = targets[j];
      if (t.x === newLock.tx && t.y === newLock.ty) {
        pointSnapTIdx = j;
        break;
      }
    }
    // If target not found in current list, use lock data
    if (pointSnapTIdx === -1) {
        const snapped = snapToPoint(newLock.tx, newLock.ty, newLock.px, newLock.py);
        finalX = snapped.x; finalY = snapped.y;
        snapX = newLock.tx; snapY = newLock.ty;
        labelX = newLock.label; labelY = newLock.label;
        return { finalX, finalY, snapX, snapY, labelX, labelY, newLock };
    }
  }

  if (pointSnapPIdx !== -1 && pointSnapTIdx !== -1) {
    const wp = worldPoints[pointSnapPIdx];
    const t = targets[pointSnapTIdx];
    const snapped = snapToPoint(t.x!, t.y!, wp.dx, wp.dy);
    finalX = snapped.x;
    finalY = snapped.y;
    snapX = t.x!;
    snapY = t.y!;
    labelX = t.label;
    labelY = t.label;
    newLock = {
      tx: t.x!,
      ty: t.y!,
      px: wp.dx,
      py: wp.dy,
      label: t.label,
    };
  } else {
    // 3) Axis snap
    let bestXDist = capture;
    let bestYDist = capture;
    let bestXT: SnapTarget | null = null;
    let bestYT: SnapTarget | null = null;
    let bestXPIdx = -1;
    let bestYPIdx = -1;

    for (let i = 0; i < worldPoints.length; i++) {
      const wp = worldPoints[i];
      const weight = wp.isCorner ? 1.0 : 0.8;
      
      for (let j = 0; j < targets.length; j++) {
        const t = targets[j];
        if (t.x !== undefined) {
          const dx = Math.abs(wp.x - t.x);
          if (dx < capture * weight && dx < bestXDist) {
            bestXDist = dx;
            bestXT = t;
            bestXPIdx = i;
          }
        }
        if (t.y !== undefined) {
          const dy = Math.abs(wp.y - t.y);
          if (dy < capture * weight && dy < bestYDist) {
            bestYDist = dy;
            bestYT = t;
            bestYPIdx = i;
          }
        }
      }
    }

    if (bestXT) {
      const wp = worldPoints[bestXPIdx];
      const snapped = snapToPoint(bestXT.x!, wp.y, wp.dx, wp.dy);
      finalX = snapped.x;
      snapX = bestXT.x!;
      labelX = bestXT.label;
    }
    if (bestYT) {
      const wp = worldPoints[bestYPIdx];
      const snapped = snapToPoint(wp.x, bestYT.y!, wp.dx, wp.dy);
      finalY = snapped.y;
      snapY = bestYT.y!;
      labelY = bestYT.label;
    }
  }

  if (gridSnap) {
    if (snapX === null) finalX = Math.round(finalX / GRID) * GRID;
    if (snapY === null) finalY = Math.round(finalY / GRID) * GRID;
  }

  return { finalX, finalY, snapX, snapY, labelX, labelY, newLock };
}

export type ResizeSnapLock =
  | { kind: 'point'; x: number; y: number; label?: string }
  | { kind: 'axis'; axis: 'x' | 'y'; value: number; label?: string };

export interface ResizeSnapResult {
  snappedDx: number;
  snappedDy: number;
  snapX: number | null;
  snapY: number | null;
  labelX?: string;
  labelY?: string;
  newLock: ResizeSnapLock | null;
}

export function evaluateResizeSnap(
  handleWorldStartX: number,
  handleWorldStartY: number,
  handleWorldX: number,
  handleWorldY: number,
  targets: SnapTarget[],
  zoom: number,
  lock: ResizeSnapLock | null,
  gridSnap: boolean
): ResizeSnapResult {
  const capture = Math.max(ALIGN_THRESHOLD_STAGE, CAPTURE_PX / zoom);
  const release = Math.max(ALIGN_THRESHOLD_STAGE * 4, RELEASE_PX / zoom);

  let snappedDx = handleWorldX - handleWorldStartX;
  let snappedDy = handleWorldY - handleWorldStartY;
  let snapX: number | null = null;
  let snapY: number | null = null;
  let labelX: string | undefined;
  let labelY: string | undefined;
  let newLock: ResizeSnapLock | null = null;

  if (targets.length === 0) {
    if (gridSnap) {
        const worldX = handleWorldStartX + snappedDx;
        const worldY = handleWorldStartY + snappedDy;
        snappedDx = Math.round(worldX / GRID) * GRID - handleWorldStartX;
        snappedDy = Math.round(worldY / GRID) * GRID - handleWorldStartY;
    }
    return { snappedDx, snappedDy, snapX, snapY, labelX, labelY, newLock };
  }

  // 1) Lock check
  if (lock) {
    if (lock.kind === 'point') {
      const dx = handleWorldX - lock.x;
      const dy = handleWorldY - lock.y;
      if (Math.sqrt(dx * dx + dy * dy) <= release) {
        newLock = lock;
        snappedDx = lock.x - handleWorldStartX;
        snappedDy = lock.y - handleWorldStartY;
        snapX = lock.x; snapY = lock.y;
        labelX = lock.label; labelY = lock.label;
      }
    } else {
      const dist = lock.axis === 'x' ? Math.abs(handleWorldX - lock.value) : Math.abs(handleWorldY - lock.value);
      if (dist <= release) {
        newLock = lock;
        if (lock.axis === 'x') {
          snappedDx = lock.value - handleWorldStartX;
          snapX = lock.value; labelX = lock.label;
        } else {
          snappedDy = lock.value - handleWorldStartY;
          snapY = lock.value; labelY = lock.label;
        }
      }
    }
  }

  // 2) New snap
  if (!newLock) {
    let bestDist = capture;
    let bestPTIdx = -1;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      if (t.x === undefined || t.y === undefined) continue;
      const dx = handleWorldX - t.x;
      const dy = handleWorldY - t.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestDist) {
        bestDist = d;
        bestPTIdx = i;
      }
    }

    if (bestPTIdx !== -1) {
      const t = targets[bestPTIdx];
      newLock = { kind: 'point', x: t.x!, y: t.y!, label: t.label };
      snappedDx = t.x! - handleWorldStartX;
      snappedDy = t.y! - handleWorldStartY;
      snapX = t.x!; snapY = t.y!;
      labelX = t.label; labelY = t.label;
    } else {
      let bestXDist = capture;
      let bestYDist = capture;
      let bestXTIdx = -1;
      let bestYTIdx = -1;

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (t.x !== undefined) {
          const dx = Math.abs(handleWorldX - t.x);
          if (dx < bestXDist) {
            bestXDist = dx;
            bestXTIdx = i;
          }
        }
        if (t.y !== undefined) {
          const dy = Math.abs(handleWorldY - t.y);
          if (dy < bestYDist) {
            bestYDist = dy;
            bestYTIdx = i;
          }
        }
      }

      const useX = bestXTIdx !== -1;
      const useY = bestYTIdx !== -1;

      if (useX && useY) {
        if (bestXDist <= bestYDist) {
          const t = targets[bestXTIdx];
          newLock = { kind: 'axis', axis: 'x', value: t.x!, label: t.label };
          snappedDx = t.x! - handleWorldStartX;
          snapX = t.x!; labelX = t.label;
        } else {
          const t = targets[bestYTIdx];
          newLock = { kind: 'axis', axis: 'y', value: t.y!, label: t.label };
          snappedDy = t.y! - handleWorldStartY;
          snapY = t.y!; labelY = t.label;
        }
      } else if (useX) {
        const t = targets[bestXTIdx];
        newLock = { kind: 'axis', axis: 'x', value: t.x!, label: t.label };
        snappedDx = t.x! - handleWorldStartX;
        snapX = t.x!; labelX = t.label;
      } else if (useY) {
        const t = targets[bestYTIdx];
        newLock = { kind: 'axis', axis: 'y', value: t.y!, label: t.label };
        snappedDy = t.y! - handleWorldStartY;
        snapY = t.y!; labelY = t.label;
      }
    }
  }

  if (gridSnap) {
    if (snapX === null) {
      const rx = handleWorldStartX + snappedDx;
      snappedDx = Math.round(rx / GRID) * GRID - handleWorldStartX;
    }
    if (snapY === null) {
      const ry = handleWorldStartY + snappedDy;
      snappedDy = Math.round(ry / GRID) * GRID - handleWorldStartY;
    }
  }

  return { snappedDx, snappedDy, snapX, snapY, labelX, labelY, newLock };
}
