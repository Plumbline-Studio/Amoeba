/**
 * Pointer/touch input (PLAN §4–5). M0 wires gestures to the orbit camera:
 *   - drag (mouse or one finger)  -> rotate
 *   - wheel / two-finger pinch    -> zoom
 *
 * PLAN §5's "project the pointer onto the camera-facing plane and push the
 * cluster" force lands in M3; the seam is marked below. This file is the only
 * place that touches DOM input, keeping the camera + engine input-agnostic.
 */

import type { OrbitCamera } from '../render/camera';

const ROTATE_SPEED = 0.005; // radians per pixel
const WHEEL_ZOOM = 0.0015; // per wheel delta unit

export interface PointerControls {
  dispose(): void;
}

export function attachPointerControls(
  canvas: HTMLCanvasElement,
  camera: OrbitCamera,
): PointerControls {
  // Active pointers for multi-touch pinch tracking.
  const active = new Map<number, { x: number; y: number }>();
  let lastPinchDist = 0;

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (active.size === 2) lastPinchDist = pinchDistance(active);
  };

  const onPointerMove = (e: PointerEvent) => {
    const prev = active.get(e.pointerId);
    if (!prev) return;

    if (active.size >= 2) {
      // Pinch-zoom: compare the two-finger spread frame to frame.
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const dist = pinchDistance(active);
      if (lastPinchDist > 0 && dist > 0) {
        camera.zoom(lastPinchDist / dist);
      }
      lastPinchDist = dist;
      return;
    }

    // Single pointer: drag-rotate.
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    active.set(e.pointerId, { x: e.clientX, y: e.clientY });
    camera.rotate(dx * ROTATE_SPEED, dy * ROTATE_SPEED);

    // M3 seam: if a "push" modifier/gesture is active, project (e.clientX,
    // e.clientY) onto the camera plane through the centroid and apply force.
  };

  const onPointerUp = (e: PointerEvent) => {
    active.delete(e.pointerId);
    lastPinchDist = active.size === 2 ? pinchDistance(active) : 0;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    camera.zoom(Math.exp(e.deltaY * WHEEL_ZOOM));
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    },
  };
}

function pinchDistance(active: Map<number, { x: number; y: number }>): number {
  const pts = [...active.values()];
  if (pts.length < 2) return 0;
  return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
}
