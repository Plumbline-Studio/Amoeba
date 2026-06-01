#version 300 es
// Instanced billboard quad (PLAN §3). One unit quad, N instances; each instance
// reads its world position + type from per-instance attributes. The quad is
// expanded in *view space* so every sprite faces the camera (camera-aligned
// billboard) regardless of orbit angle. Depth attenuates size: focal / -viewZ.

precision highp float;

// Per-vertex: unit quad corner in [-0.5, 0.5].
layout(location = 0) in vec2 aCorner;

// Per-instance: world position (xyz) and type index.
layout(location = 1) in vec3 aPosition;
layout(location = 2) in float aType;

uniform mat4 uView;
uniform mat4 uProjection;
uniform float uPointSize;   // world-space sprite radius
uniform float uFocal;       // size attenuation factor

// Palette uniform: up to 16 RGB entries.
uniform vec3 uPalette[16];

out vec2 vCorner;   // passed to frag for radial falloff
out vec3 vColor;
out float vDepthFade;

void main() {
  // Particle center in view space.
  vec4 viewCenter = uView * vec4(aPosition, 1.0);

  // Size grows for near particles, shrinks for far ones.
  float viewZ = -viewCenter.z;
  float size = uPointSize * (uFocal / max(viewZ, 0.05));

  // Expand the quad in view space so it always faces the camera.
  vec4 viewPos = viewCenter;
  viewPos.xy += aCorner * size;

  gl_Position = uProjection * viewPos;

  vCorner = aCorner;
  vColor = uPalette[int(aType)];

  // Atmospheric fog cue: fade distant particles toward the background.
  vDepthFade = clamp(1.0 - (viewZ - 1.0) * 0.16, 0.15, 1.0);
}
