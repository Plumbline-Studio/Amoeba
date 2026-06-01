#version 300 es
// Soft round sprite via radial falloff (PLAN §3). Additive blending is set on
// the GL state (order-independent — no depth sort), so here we emit a glowing
// disc that fades to zero at the quad edge. Per-type weight separates "glow"
// from "solid" types; depth fog mixes distant particles toward the background
// so the cluster reads with volume (PLAN §M2).

precision highp float;

in vec2 vCorner;
in vec3 vColor;
in float vWeight;
in float vFog;

uniform float uGlow;          // global additive intensity multiplier
uniform vec3 uBackground;     // scene background, fog target

out vec4 fragColor;

void main() {
  // Distance from quad center, normalized so the inscribed circle edges at 1.0.
  float d = length(vCorner) * 2.0;

  // Smooth radial falloff: bright core, soft edge, zero outside the disc.
  float alpha = smoothstep(1.0, 0.0, d);
  alpha *= alpha; // tighten the core for a more "particle" look

  vec3 color = vColor * (uGlow * vWeight);

  // Atmospheric fade: pull distant particles toward the (dark) background so
  // their additive contribution drops off with depth.
  color = mix(color, uBackground, vFog);

  fragColor = vec4(color * alpha, alpha);
}
