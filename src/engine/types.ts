/**
 * Shared engine types. PURE: no DOM, no WebGL.
 *
 * The engine is structure-of-arrays (SoA) from day one (PLAN §1): flat typed
 * arrays that double as the exact layout WebGL wants, so there's no per-frame
 * repacking when uploading to the GPU.
 */

/** Tunable simulation parameters. Physics is not wired in M0; these exist so
 *  the HUD/live-controls and later milestones have a stable shape to target. */
export interface SimParams {
  /** Number of particles. */
  count: number;
  /** Number of distinct particle types/colors. */
  typeCount: number;
  /** Half-extent of the cubic world box (world spans [-worldSize, +worldSize]). */
  worldSize: number;
  /** Max interaction radius (M1+: sizes the spatial grid cells). */
  rMax: number;
  /** Velocity damping per step (M1+). */
  friction: number;
  /** Force scaling (M1+). */
  forceScale: number;
}

export const DEFAULT_PARAMS: SimParams = {
  count: 4000,
  typeCount: 5,
  worldSize: 1.0,
  rMax: 0.18,
  friction: 0.86,
  forceScale: 0.6,
};
