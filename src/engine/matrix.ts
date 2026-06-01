/**
 * Type-attraction matrix + force law (PLAN §2). PURE: no DOM, no WebGL.
 *
 * This is "the matrix" §2 keeps referring to — an N×N table of signed
 * attraction weights between particle types (positive = attract, negative =
 * repel), plus the radial `force` profile shared from the 2D engine. The
 * rendering linear-algebra lives separately in `render/mat4.ts`.
 */

/** Flat row-major attraction weights, `typeCount²` entries in [-1, 1]. */
export type AttractionMatrix = Float32Array;

/**
 * Randomized attraction matrix in [-1, 1]. Self-interaction (diagonal) is
 * biased slightly positive so like types tend to clump into cores.
 */
export function createMatrix(typeCount: number, rng: () => number): AttractionMatrix {
  const m = new Float32Array(typeCount * typeCount);
  for (let a = 0; a < typeCount; a++) {
    for (let b = 0; b < typeCount; b++) {
      const v = rng() * 2 - 1;
      m[a * typeCount + b] = a === b ? Math.abs(v) * 0.5 + 0.1 : v;
    }
  }
  return m;
}

export function getWeight(m: AttractionMatrix, typeCount: number, a: number, b: number): number {
  return m[a * typeCount + b];
}

/**
 * Radial force profile (classic particle-life curve). `r` is the normalized
 * distance in [0, 1] (actual distance / rMax); `a` is the attraction weight.
 *
 *   r < beta        : hard inward repulsion (overlap avoidance), independent of a
 *   beta <= r < 1   : tent-shaped attraction/repulsion scaled by a
 *   r >= 1          : no interaction
 */
export function force(r: number, a: number, beta: number): number {
  if (r < beta) {
    return r / beta - 1;
  }
  if (r < 1) {
    return a * (1 - Math.abs(2 * r - 1 - beta) / (1 - beta));
  }
  return 0;
}
