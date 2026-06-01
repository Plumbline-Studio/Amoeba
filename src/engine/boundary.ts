/**
 * Boundary handling (PLAN §2). PURE: no DOM, no WebGL.
 *
 * z is NOT toroidal — wrapping pops particles front<->back under perspective.
 * Instead a soft bounded box: a gentle inward acceleration that ramps up in a
 * margin near each wall, keeping the cluster in frame without a hard bounce.
 * Applied uniformly to x/y/z (the simplest, most stable choice for 3D).
 */

import type { SimState } from './state';
import type { SimParams } from './types';

/** Fraction of worldSize over which the inward force ramps in. */
const MARGIN = 0.12;
/** Peak inward acceleration at the wall. */
const STRENGTH = 0.0025;

export function applySoftBox(state: SimState, params: SimParams): void {
  const { positions, velocities, count } = state;
  const w = params.worldSize;
  const margin = w * MARGIN;
  const inner = w - margin;

  for (let i = 0; i < count; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const idx = i * 3 + axis;
      const p = positions[idx];
      if (p > inner) {
        velocities[idx] -= ((p - inner) / margin) * STRENGTH;
      } else if (p < -inner) {
        velocities[idx] += ((-inner - p) / margin) * STRENGTH;
      }
    }
  }
}
