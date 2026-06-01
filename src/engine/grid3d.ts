/**
 * 3D spatial hash grid (PLAN §2). PURE: no DOM, no WebGL.
 *
 * cols×rows×depth cells sized by `rMax`, spanning the world box
 * [-worldSize, +worldSize] on each axis. `rebuild` counting-sorts the particle
 * indices into cells (cache-friendly), exposing `cellStart` + `order` so the
 * force pass can sweep the 27 neighbor cells without per-particle allocation.
 */

import type { SimState } from './state';

export class Grid3D {
  cols = 1;
  rows = 1;
  depth = 1;
  cellSize = 1;
  worldSize = 1;

  /** Prefix-sum offsets, length nCells + 1. order[cellStart[c]..cellStart[c+1]) live in cell c. */
  cellStart = new Int32Array(2);
  /** Particle indices sorted by cell, length = count. */
  order = new Int32Array(0);

  private counts = new Int32Array(1);

  /** Rebuild from current positions, resizing internal arrays if dims/count changed. */
  rebuild(state: SimState, worldSize: number, rMax: number): void {
    const cellSize = Math.max(rMax, 1e-4);
    const span = worldSize * 2;
    const n = Math.max(1, Math.ceil(span / cellSize));

    this.cellSize = cellSize;
    this.worldSize = worldSize;
    this.cols = this.rows = this.depth = n;

    const nCells = n * n * n;
    if (this.counts.length !== nCells) {
      this.counts = new Int32Array(nCells);
      this.cellStart = new Int32Array(nCells + 1);
    } else {
      this.counts.fill(0);
    }

    const { positions, count } = state;
    if (this.order.length !== count) this.order = new Int32Array(count);

    // Pass 1: count particles per cell.
    for (let i = 0; i < count; i++) {
      this.counts[this.cellIndexFor(positions, i)]++;
    }

    // Prefix sum -> cellStart.
    let acc = 0;
    for (let c = 0; c < nCells; c++) {
      this.cellStart[c] = acc;
      acc += this.counts[c];
    }
    this.cellStart[nCells] = acc;

    // Pass 2: scatter indices into order (reuse counts as a moving cursor).
    const cursor = this.counts;
    for (let c = 0; c < nCells; c++) cursor[c] = this.cellStart[c];
    for (let i = 0; i < count; i++) {
      const c = this.cellIndexFor(positions, i);
      this.order[cursor[c]++] = i;
    }
  }

  /** Clamp a world coordinate to a cell axis index. */
  axis(coord: number): number {
    const c = ((coord + this.worldSize) / this.cellSize) | 0;
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  cellIndex(cx: number, cy: number, cz: number): number {
    return (cz * this.rows + cy) * this.cols + cx;
  }

  private cellIndexFor(positions: Float32Array, i: number): number {
    const cx = this.axis(positions[i * 3 + 0]);
    const cy = this.axis(positions[i * 3 + 1]);
    const cz = this.axis(positions[i * 3 + 2]);
    return this.cellIndex(cx, cy, cz);
  }
}

export function createGrid(): Grid3D {
  return new Grid3D();
}
