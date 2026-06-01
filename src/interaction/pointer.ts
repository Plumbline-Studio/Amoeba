/**
 * Pointer/touch input (PLAN §4–5). Wires gestures to the orbit camera and to
 * the §5 "push where you point" force:
 *   - drag (mouse / one finger)         -> rotate
 *   - wheel / two-finger pinch          -> zoom
 *   - Shift+drag, right-drag, or with
 *     push-mode enabled                 -> push force (onPush in NDC)
 *
 * The 2D->3D projection itself lives in the wiring layer (it needs camera +
 * projection matrices); this file only decides *intent* and emits NDC coords,
 * keeping the camera + engine input-agnostic.
 */

import type { OrbitCamera } from '../render/camera';

const ROTATE_SPEED = 0.005; // radians per pixel
const WHEEL_ZOOM = 0.0015; // per wheel delta unit

export interface PointerOptions {
  /** Force gesture: pointer position in normalized device coords (x,y in [-1,1]). */
  onPush(ndcX: number, ndcY: number): void;
  /** When true, a plain drag pushes instead of orbits (e.g. a mobile toggle). */
  isPushMode(): boolean;
}

export interface PointerControls {
  dispose(): void;
}

export function attachPointerControls(
  canvas: HTMLCanvasElement,
  camera: OrbitCamera,
  opts: PointerOptions,
): PointerControls {
  const active = new Map<number, { x: number; y: number }>();
  let lastPinchDist = 0;

  const toNdc = (clientX: number, clientY: number): [number, number] => {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return [x, y];
  };

  const isPush = (e: PointerEvent): boolean =>
    opts.isPushMode() || e.shiftKey || (e.buttons & 2) !== 0 || e.button === 2;

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (active.size === 2) lastPinchDist = pinchDistance(active);
    if (active.size === 1 && isPush(e)) {
      const [nx, ny] = toNdc(e.clientX, e.clientY);
      opts.onPush(nx, ny);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const prev = active.get(e.pointerId);
    if (!prev) return;

    if (active.size >= 2) {
      // Pinch-zoom.
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dist = pinchDistance(active);
      if (lastPinchDist > 0 && dist > 0) camera.zoom(lastPinchDist / dist);
      lastPinchDist = dist;
      return;
    }

    active.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (isPush(e)) {
      const [nx, ny] = toNdc(e.clientX, e.clientY);
      opts.onPush(nx, ny);
      return; // pushing suppresses orbit
    }

    // Drag-rotate.
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    camera.rotate(dx * ROTATE_SPEED, dy * ROTATE_SPEED);
  };

  const onPointerUp = (e: PointerEvent) => {
    active.delete(e.pointerId);
    lastPinchDist = active.size === 2 ? pinchDistance(active) : 0;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    camera.zoom(Math.exp(e.deltaY * WHEEL_ZOOM));
  };

  // Right-drag should push, not open the context menu.
  const onContextMenu = (e: Event) => e.preventDefault();

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
    },
  };
}

function pinchDistance(active: Map<number, { x: number; y: number }>): number {
  const pts = [...active.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}
