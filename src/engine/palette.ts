/**
 * Particle palette. PURE: no DOM, no WebGL — just returns RGB floats.
 *
 * M0 leans into the cyan/teal aesthetic from the original 2D background
 * (PLAN §M2 will refine this). Colors are normalized [0,1] RGB triples,
 * packed into a flat Float32Array(typeCount * 3) so the renderer can hand
 * the whole table to a shader uniform unchanged.
 */

/** Hand-picked cyan/teal-leaning palette; extra hues wrap for higher counts. */
const BASE_RGB: ReadonlyArray<readonly [number, number, number]> = [
  [0.20, 0.95, 1.00], // cyan
  [0.25, 1.00, 0.78], // teal-green
  [0.55, 0.85, 1.00], // pale blue
  [0.95, 0.70, 1.00], // soft magenta (accent)
  [1.00, 0.92, 0.55], // warm accent
  [0.40, 0.70, 1.00], // periwinkle
];

/** Build a flat RGB table of length `typeCount * 3`. */
export function buildPalette(typeCount: number): Float32Array {
  const out = new Float32Array(typeCount * 3);
  for (let i = 0; i < typeCount; i++) {
    const c = BASE_RGB[i % BASE_RGB.length];
    out[i * 3 + 0] = c[0];
    out[i * 3 + 1] = c[1];
    out[i * 3 + 2] = c[2];
  }
  return out;
}
