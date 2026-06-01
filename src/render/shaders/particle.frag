#version 300 es
// Soft round sprite via radial falloff (PLAN §3). Additive blending is set on
// the GL state (order-independent — no depth sort), so here we just emit a
// glowing disc that fades to zero at the quad edge, modulated by the depth fog
// cue from the vertex stage.

precision highp float;

in vec2 vCorner;
in vec3 vColor;
in float vDepthFade;

uniform float uGlow;   // additive intensity multiplier

out vec4 fragColor;

void main() {
  // Distance from quad center, normalized so the unit quad's inscribed circle
  // has radius 1.0 at the edge.
  float d = length(vCorner) * 2.0;

  // Smooth radial falloff: bright core, soft edge, zero outside the disc.
  float alpha = smoothstep(1.0, 0.0, d);
  alpha *= alpha; // tighten the core for a more "particle" look

  vec3 color = vColor * uGlow * vDepthFade;
  fragColor = vec4(color * alpha, alpha);
}
