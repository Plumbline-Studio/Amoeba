#version 300 es
// Instanced billboard quad (PLAN §3). One unit quad, N instances; each instance
// reads its world position + type from per-instance attributes. The quad is
// expanded in *view space* so every sprite faces the camera (camera-aligned
// billboard) regardless of orbit angle. Depth drives both size attenuation
// (focal / -viewZ) and an atmospheric fog factor (PLAN §M2).

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
uniform float uFog;         // atmospheric fog strength (0 = off)

// Per-type tables (up to 16 entries).
uniform vec3 uPalette[16];
uniform float uWeights[16];

out vec2 vCorner;   // passed to frag for radial falloff
out vec3 vColor;
out float vWeight;  // per-type additive weight
out float vFog;     // 0 = near (clear) .. 1 = far (fogged)

// Fog ramp in view-space depth units (tuned around the default orbit distance).
const float FOG_NEAR = 1.5;
const float FOG_FAR = 5.5;

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

  int t = int(aType);
  vCorner = aCorner;
  vColor = uPalette[t];
  vWeight = uWeights[t];

  // Atmospheric fog cue: distant particles fade toward the background.
  vFog = clamp((viewZ - FOG_NEAR) / (FOG_FAR - FOG_NEAR), 0.0, 1.0) * uFog;
}
