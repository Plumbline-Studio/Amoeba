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
  /** Velocity damping per step. */
  friction: number;
  /** Force scaling. */
  forceScale: number;
  /** Repulsion-core fraction of rMax for the force curve (0..1). */
  beta: number;
}

// Starting point for the 3D "first retune" (PLAN §2). The force curve is
// bounded ~[-1,1], so with per-frame integration `v=(v+f·forceScale)·friction`
// the steady velocity scales as f·forceScale·friction/(1−friction). These
// values keep that small (stable, non-explosive) and are meant to be swept via
// the HUD — 3D disperses more than 2D, so expect to iterate here.
export const DEFAULT_PARAMS: SimParams = {
  count: 4000,
  typeCount: 5,
  worldSize: 1.0,
  rMax: 0.18,
  friction: 0.85,
  forceScale: 0.012,
  beta: 0.3,
};
