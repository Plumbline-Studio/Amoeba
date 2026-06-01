/**
 * Simulation step (3D particle-life physics). PURE: no DOM, no WebGL.
 *
 * PLAN §2: force over 27 neighbor cells with r² = dx²+dy²+dz², then
 * integrate `v = (v + f·FORCE_SCALE)·FRICTION; pos += v`, then soft bounds.
 *
 * M0 STUB: physics is intentionally NOT wired yet (M0 is the render + camera +
 * HUD skeleton). `step` is a no-op so the render loop has a stable seam to call
 * and the HUD can already time it via performance.now(). M1 implements it.
 */

import type { SimState } from './state';
import type { SimParams } from './types';
import type { Grid3D } from './grid3d';

/**
 * Advance the simulation by one step. No-op in M0.
 * Returns the number of particles processed (0 in M0) so callers can keep a
 * stable signature for the HUD's CPU-time instrumentation.
 */
export function step(_state: SimState, _grid: Grid3D, _params: SimParams): number {
  // M1: grid.rebuild -> accumulate forces over 27 cells -> integrate ->
  //     boundary.applySoftBox.
  return 0;
}
