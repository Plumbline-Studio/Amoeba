/**
 * Perspective projection (PLAN §4). Depends on the pure engine matrix math.
 * Kept tiny and stateless: the render loop rebuilds this each frame from the
 * current canvas aspect + FOV (FOV is a live HUD control later).
 */

import { create, perspective, type Mat4 } from '../engine/matrix';

export interface ProjectionParams {
  /** Vertical field of view in degrees (~50 per PLAN §3). */
  fovYDeg: number;
  near: number;
  far: number;
}

export const DEFAULT_PROJECTION: ProjectionParams = {
  fovYDeg: 50,
  near: 0.01,
  far: 100,
};

export class Projection {
  readonly matrix: Mat4 = create();
  params: ProjectionParams;

  constructor(params: ProjectionParams = DEFAULT_PROJECTION) {
    this.params = { ...params };
  }

  /** Recompute the projection matrix for the given viewport aspect ratio. */
  update(aspect: number): Mat4 {
    const fovY = (this.params.fovYDeg * Math.PI) / 180;
    return perspective(this.matrix, fovY, aspect, this.params.near, this.params.far);
  }
}
