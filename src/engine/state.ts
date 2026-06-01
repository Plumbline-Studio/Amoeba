/**
 * Simulation state: structure-of-arrays (SoA). PURE: no DOM, no WebGL.
 *
 * `positions` / `velocities` are flat Float32Arrays (x,y,z interleaved) and
 * `types` a Uint8Array — exactly the layout the GPU buffers want (PLAN §1).
 * In M0 nothing integrates these arrays; `seed()` just scatters particles so
 * the renderer has something to draw. M1 adds the grid + step that mutate them.
 */

import type { SimParams } from './types';

export interface SimState {
  count: number;
  typeCount: number;
  /** n*3 floats, x,y,z interleaved. */
  positions: Float32Array;
  /** n*3 floats, vx,vy,vz interleaved. */
  velocities: Float32Array;
  /** n bytes, particle type index. */
  types: Uint8Array;
}

/** Allocate SoA arrays for `count` particles (zero-initialized). */
export function createState(count: number, typeCount: number): SimState {
  return {
    count,
    typeCount,
    positions: new Float32Array(count * 3),
    velocities: new Float32Array(count * 3),
    types: new Uint8Array(count),
  };
}

/**
 * Deterministic-ish seed: scatter particles inside a sphere of radius
 * `params.worldSize`, zero velocity, random type. A tiny seeded RNG keeps
 * reloads visually stable without pulling in a dependency.
 */
export function seed(state: SimState, params: SimParams, seedValue = 1): void {
  const rng = mulberry32(seedValue);
  const r = params.worldSize;
  const { positions, velocities, types, count } = state;

  for (let i = 0; i < count; i++) {
    // Rejection-free point in a ball: direction on the unit sphere * cubed radius.
    const u = rng() * 2 - 1; // cos(theta) in [-1,1]
    const phi = rng() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const radius = r * Math.cbrt(rng());

    positions[i * 3 + 0] = radius * s * Math.cos(phi);
    positions[i * 3 + 1] = radius * s * Math.sin(phi);
    positions[i * 3 + 2] = radius * u;

    velocities[i * 3 + 0] = 0;
    velocities[i * 3 + 1] = 0;
    velocities[i * 3 + 2] = 0;

    types[i] = (rng() * state.typeCount) | 0;
  }
}

/** Small, fast, dependency-free seeded PRNG. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
