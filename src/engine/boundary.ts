/**
 * Boundary handling. PURE: no DOM, no WebGL.
 *
 * PLAN §2: z is NOT toroidal (wrapping pops particles front<->back under
 * perspective). The chosen model is a soft bounded box — a gentle inward
 * force near the walls that keeps the cluster in frame.
 *
 * M0 STUB: physics is not wired yet, so this is a no-op placeholder that
 * documents the intended interface. M1 fills in `applySoftBox`.
 */

import type { SimState } from './state';
import type { SimParams } from './types';

/**
 * Apply a soft inward force near the box walls (M1+).
 * No-op in M0 — present so the engine file layout (§8) is complete and the
 * step pipeline has a stable seam to call into.
 */
export function applySoftBox(_state: SimState, _params: SimParams): void {
  // M1: for each particle, if |coord| > worldSize - margin, push inward.
}
