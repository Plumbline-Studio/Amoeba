/**
 * Particle palette. PURE: no DOM, no WebGL — just returns RGB floats + weights.
 *
 * Leans into the cyan/teal aesthetic of the original 2D background (PLAN §M2).
 * Each type also carries an additive *weight*: glow types push bright, "solid"
 * types use a lower weight so they read as denser/less bloomy (PLAN §3).
 * Both tables are flat Float32Arrays so the renderer hands them to uniforms
 * unchanged.
 */

interface TypeAppearance {
  rgb: readonly [number, number, number];
  /** Additive weight: ~1+ glows, <1 reads as "solid". */
  weight: number;
}

// Cohesive cyan/teal family with two warmer accents for contrast.
const BASE: ReadonlyArray<TypeAppearance> = [
  { rgb: [0.18, 0.95, 1.0], weight: 1.25 }, // cyan glow
  { rgb: [0.2, 1.0, 0.72], weight: 1.15 }, // teal glow
  { rgb: [0.45, 0.78, 1.0], weight: 0.85 }, // pale blue, solid
  { rgb: [0.95, 0.62, 0.85], weight: 0.7 }, // muted rose, solid accent
  { rgb: [1.0, 0.88, 0.55], weight: 0.95 }, // warm gold accent
  { rgb: [0.35, 0.6, 1.0], weight: 0.8 }, // periwinkle, solid
];

/** Build a flat RGB table of length `typeCount * 3`. */
export function buildPalette(typeCount: number): Float32Array {
  const out = new Float32Array(typeCount * 3);
  for (let i = 0; i < typeCount; i++) {
    const c = BASE[i % BASE.length].rgb;
    out[i * 3 + 0] = c[0];
    out[i * 3 + 1] = c[1];
    out[i * 3 + 2] = c[2];
  }
  return out;
}

/** Build a flat per-type additive weight table of length `typeCount`. */
export function buildWeights(typeCount: number): Float32Array {
  const out = new Float32Array(typeCount);
  for (let i = 0; i < typeCount; i++) {
    out[i] = BASE[i % BASE.length].weight;
  }
  return out;
}
