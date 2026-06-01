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

/**
 * Build a flat RGB table of length `typeCount * 3`. `hueShiftDeg` rotates every
 * color's hue by the same amount (0..360), sweeping the whole scene's theme
 * while preserving the per-type variety and saturation/brightness.
 */
export function buildPalette(typeCount: number, hueShiftDeg = 0): Float32Array {
  const out = new Float32Array(typeCount * 3);
  for (let i = 0; i < typeCount; i++) {
    const c = BASE[i % BASE.length].rgb;
    if (hueShiftDeg === 0) {
      out[i * 3 + 0] = c[0];
      out[i * 3 + 1] = c[1];
      out[i * 3 + 2] = c[2];
    } else {
      const [h, s, v] = rgbToHsv(c[0], c[1], c[2]);
      hsvToRgb(out, i * 3, (h + hueShiftDeg) % 360, s, v);
    }
  }
  return out;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToRgb(out: Float32Array, off: number, h: number, s: number, v: number): void {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  out[off + 0] = r + m;
  out[off + 1] = g + m;
  out[off + 2] = b + m;
}

/** Build a flat per-type additive weight table of length `typeCount`. */
export function buildWeights(typeCount: number): Float32Array {
  const out = new Float32Array(typeCount);
  for (let i = 0; i < typeCount; i++) {
    out[i] = BASE[i % BASE.length].weight;
  }
  return out;
}
