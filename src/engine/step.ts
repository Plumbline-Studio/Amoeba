/**
 * Simulation step — 3D particle-life physics (PLAN §2). PURE: no DOM, no WebGL.
 *
 * Pipeline: rebuild grid -> accumulate pairwise forces over the 27 neighbor
 * cells (r² = dx²+dy²+dz²) -> integrate (v = (v + f·FORCE_SCALE)·FRICTION;
 * pos += v) -> soft box bounds. Operates entirely on the SoA arrays.
 */

import type { SimState } from './state';
import type { SimParams } from './types';
import type { Grid3D } from './grid3d';
import { force, type AttractionMatrix } from './matrix';
import { applySoftBox } from './boundary';

/**
 * Advance the simulation by one step. Returns particle count processed.
 * Per-frame integration (matching the 2D engine and PLAN §2); the fixed-
 * timestep accumulator for frame-rate independence lands in M4.
 */
export function step(
  state: SimState,
  grid: Grid3D,
  matrix: AttractionMatrix,
  params: SimParams,
): number {
  const { positions, velocities, forces, types, count } = state;
  const { rMax, friction, forceScale, beta, typeCount } = params;
  const rMax2 = rMax * rMax;
  const invRMax = 1 / rMax;

  grid.rebuild(state, params.worldSize, rMax);
  forces.fill(0, 0, count * 3);

  const { cols, rows, depth, cellStart, order } = grid;

  // Force accumulation: for each particle, sweep its 27 surrounding cells.
  for (let i = 0; i < count; i++) {
    const ix = positions[i * 3 + 0];
    const iy = positions[i * 3 + 1];
    const iz = positions[i * 3 + 2];
    const ti = types[i];
    const cx = grid.axis(ix);
    const cy = grid.axis(iy);
    const cz = grid.axis(iz);

    let fx = 0;
    let fy = 0;
    let fz = 0;

    for (let dz = -1; dz <= 1; dz++) {
      const nz = cz + dz;
      if (nz < 0 || nz >= depth) continue;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= rows) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;
          if (nx < 0 || nx >= cols) continue;

          const cell = grid.cellIndex(nx, ny, nz);
          const end = cellStart[cell + 1];
          for (let s = cellStart[cell]; s < end; s++) {
            const j = order[s];
            if (j === i) continue;

            const rx = positions[j * 3 + 0] - ix;
            const ry = positions[j * 3 + 1] - iy;
            const rz = positions[j * 3 + 2] - iz;
            const r2 = rx * rx + ry * ry + rz * rz;
            if (r2 >= rMax2 || r2 === 0) continue;

            const r = Math.sqrt(r2);
            const a = matrix[ti * typeCount + types[j]];
            const f = force(r * invRMax, a, beta) / r; // divide once to normalize
            fx += rx * f;
            fy += ry * f;
            fz += rz * f;
          }
        }
      }
    }

    forces[i * 3 + 0] = fx;
    forces[i * 3 + 1] = fy;
    forces[i * 3 + 2] = fz;
  }

  // Integrate: v = (v + f·FORCE_SCALE)·FRICTION; pos += v.
  for (let k = 0; k < count * 3; k++) {
    const v = (velocities[k] + forces[k] * forceScale) * friction;
    velocities[k] = v;
    positions[k] += v;
  }

  applySoftBox(state, params);
  return count;
}

/**
 * Apply a radial pointer impulse (PLAN §5). Pushes (or, with negative strength,
 * pulls) particles within `radius` of the world-space point `px,py,pz`, with a
 * smooth falloff to the edge. PURE: the interaction layer computes the world
 * point from the 2D pointer; this just mutates velocities.
 */
export function applyPointerForce(
  state: SimState,
  px: number,
  py: number,
  pz: number,
  radius: number,
  strength: number,
): void {
  const { positions, velocities, count } = state;
  const r2max = radius * radius;
  for (let i = 0; i < count; i++) {
    const dx = positions[i * 3 + 0] - px;
    const dy = positions[i * 3 + 1] - py;
    const dz = positions[i * 3 + 2] - pz;
    const r2 = dx * dx + dy * dy + dz * dz;
    if (r2 >= r2max || r2 === 0) continue;
    const r = Math.sqrt(r2);
    // Smooth 1->0 falloff from center to radius.
    const falloff = 1 - r / radius;
    const s = (strength * falloff) / r;
    velocities[i * 3 + 0] += dx * s;
    velocities[i * 3 + 1] += dy * s;
    velocities[i * 3 + 2] += dz * s;
  }
}
