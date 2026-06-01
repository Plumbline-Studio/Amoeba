/**
 * 3D spatial hash grid. PURE: no DOM, no WebGL.
 *
 * PLAN §2: cols×rows×depth cells sized by R_MAX; neighbor search visits the
 * 27 surrounding cells (vs 9 in 2D). Used by the force accumulation in `step`.
 *
 * M0 STUB: physics is not wired yet. This defines the interface and a
 * constructor so M1 can drop in `rebuild` / `forEachNeighbor` without
 * disturbing the file layout (§8).
 */

import type { SimState } from './state';

export interface Grid3D {
  cols: number;
  rows: number;
  depth: number;
  cellSize: number;
  /** Rebuild the grid from current particle positions (M1+). */
  rebuild(state: SimState): void;
}

/**
 * Construct an empty grid sized so each cell is ~`rMax` across and the grid
 * spans the world box [-worldSize, +worldSize] on each axis.
 */
export function createGrid(worldSize: number, rMax: number): Grid3D {
  const cellSize = Math.max(rMax, 1e-4);
  const span = worldSize * 2;
  const n = Math.max(1, Math.ceil(span / cellSize));

  return {
    cols: n,
    rows: n,
    depth: n,
    cellSize,
    rebuild(_state: SimState): void {
      // M1: bucket particle indices into cells by floor(pos / cellSize).
    },
  };
}
