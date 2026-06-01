/**
 * M5 (stretch) — GPU physics via WebGL2 **transform feedback**.
 *
 * This is a self-contained, EXPERIMENTAL proof-of-concept of the M5 pipeline:
 * the update pass runs entirely on the GPU (ping-ponged position/velocity
 * buffers, rasterizer discard), so positions never round-trip through the CPU.
 * It demonstrates the path to "high particle counts without killing the CPU."
 *
 * Scope/honesty: the GPU dynamics here are **neighbor-free** (a gentle swirl +
 * inward pull + soft bounds) — the full particle-life force needs a spatial
 * grid in textures, which is the remaining stretch. The CPU `step` stays the
 * reference simulation (PLAN §M5: "CPU version stays as reference/fallback").
 *
 * Safety: `create()` validates compile/link/feature support and throws on any
 * problem, so the caller can revert to the CPU path. It owns its own buffers,
 * VAOs, and draw, and never touches the CPU renderer's state.
 */

import type { Mat4 } from './mat4';
import { BACKGROUND } from './gl';

const UPDATE_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aVel;
uniform float uFriction;
uniform float uWorld;
out vec3 vPosOut;
out vec3 vVelOut;
void main() {
  vec3 vel = aVel;
  // Neighbor-free ambient dynamics: swirl about Y + gentle inward pull.
  vec3 swirl = cross(aPos, vec3(0.0, 1.0, 0.0));
  vel += swirl * 0.0006 - aPos * 0.0008;
  vel *= uFriction;
  vec3 pos = aPos + vel;
  // Soft box: nudge back inside [-uWorld, uWorld] near the walls.
  vec3 over = max(abs(pos) - uWorld, 0.0);
  vel -= sign(pos) * over * 0.05;
  pos -= sign(pos) * over * 0.5;
  vPosOut = pos;
  vVelOut = vel;
}`;

const UPDATE_FRAG = `#version 300 es
precision highp float;
out vec4 c;
void main() { c = vec4(0.0); }`;

const RENDER_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPos;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uPointSize;
uniform float uPixelScale;
out float vFade;
void main() {
  vec4 viewPos = uView * vec4(aPos, 1.0);
  float viewZ = max(-viewPos.z, 0.05);
  gl_Position = uProjection * viewPos;
  gl_PointSize = clamp(uPointSize * uPixelScale / viewZ, 1.0, 64.0);
  vFade = clamp(1.0 - (viewZ - 1.5) / 4.0, 0.2, 1.0);
}`;

const RENDER_FRAG = `#version 300 es
precision highp float;
in float vFade;
uniform float uGlow;
out vec4 fragColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a *= a;
  vec3 color = vec3(0.18, 0.95, 1.0) * uGlow * vFade;
  fragColor = vec4(color * a, a);
}`;

export interface GpuRenderUniforms {
  view: Mat4;
  projection: Mat4;
  pointSize: number;
  /** world-radius -> pixels factor: canvasHeight / (2 tan(fovY/2)). */
  pixelScale: number;
  glow: number;
  friction: number;
  worldSize: number;
}

export class GpuParticles {
  private gl: WebGL2RenderingContext;
  private updateProg: WebGLProgram;
  private renderProg: WebGLProgram;

  private posBuf: [WebGLBuffer, WebGLBuffer];
  private velBuf: [WebGLBuffer, WebGLBuffer];
  private updateVao: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private renderVao: [WebGLVertexArrayObject, WebGLVertexArrayObject];
  private tf: WebGLTransformFeedback;

  private count: number;
  private src = 0;

  private uU: Record<string, WebGLUniformLocation>;
  private uR: Record<string, WebGLUniformLocation>;

  private constructor(gl: WebGL2RenderingContext, count: number) {
    this.gl = gl;
    this.count = count;

    this.updateProg = linkTF(gl, UPDATE_VERT, UPDATE_FRAG, ['vPosOut', 'vVelOut']);
    this.renderProg = link(gl, RENDER_VERT, RENDER_FRAG);

    this.uU = uniforms(gl, this.updateProg, ['uFriction', 'uWorld']);
    this.uR = uniforms(gl, this.renderProg, [
      'uView',
      'uProjection',
      'uPointSize',
      'uPixelScale',
      'uGlow',
    ]);

    this.posBuf = [buffer(gl), buffer(gl)];
    this.velBuf = [buffer(gl), buffer(gl)];
    this.updateVao = [vao(gl), vao(gl)];
    this.renderVao = [vao(gl), vao(gl)];
    this.tf = mustCreate(gl.createTransformFeedback(), 'transform feedback');
  }

  /** Build + seed from current CPU state. Throws if WebGL2 TF can't be set up. */
  static create(gl: WebGL2RenderingContext, positions: Float32Array, velocities: Float32Array, count: number): GpuParticles {
    const g = new GpuParticles(gl, count);
    g.seed(positions, velocities, count);
    return g;
  }

  private seed(positions: Float32Array, velocities: Float32Array, count: number): void {
    const gl = this.gl;
    this.count = count;
    const pos = positions.subarray(0, count * 3);
    const vel = velocities.subarray(0, count * 3);

    for (let i = 0; i < 2; i++) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf[i]);
      gl.bufferData(gl.ARRAY_BUFFER, i === 0 ? pos : new Float32Array(count * 3), gl.DYNAMIC_COPY);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuf[i]);
      gl.bufferData(gl.ARRAY_BUFFER, i === 0 ? vel : new Float32Array(count * 3), gl.DYNAMIC_COPY);

      // Update VAO: aPos(0), aVel(1).
      gl.bindVertexArray(this.updateVao[i]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf[i]);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.velBuf[i]);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

      // Render VAO: aPos(0) only.
      gl.bindVertexArray(this.renderVao[i]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuf[i]);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    }
    gl.bindVertexArray(null);
    this.src = 0;
  }

  /** One GPU update (transform feedback) + additive point draw. */
  frame(u: GpuRenderUniforms): void {
    const gl = this.gl;
    const dst = this.src ^ 1;

    // --- Update pass: read src, write dst, no rasterization. ---
    gl.useProgram(this.updateProg);
    gl.uniform1f(this.uU.uFriction, u.friction);
    gl.uniform1f(this.uU.uWorld, u.worldSize);

    gl.bindVertexArray(this.updateVao[this.src]);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tf);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.posBuf[dst]);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, this.velBuf[dst]);

    gl.enable(gl.RASTERIZER_DISCARD);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.endTransformFeedback();
    gl.disable(gl.RASTERIZER_DISCARD);

    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 1, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);

    // --- Render pass: draw additive points from the freshly written dst. ---
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.renderProg);
    gl.uniformMatrix4fv(this.uR.uView, false, u.view);
    gl.uniformMatrix4fv(this.uR.uProjection, false, u.projection);
    gl.uniform1f(this.uR.uPointSize, u.pointSize);
    gl.uniform1f(this.uR.uPixelScale, u.pixelScale);
    gl.uniform1f(this.uR.uGlow, u.glow);

    gl.bindVertexArray(this.renderVao[dst]);
    gl.drawArrays(gl.POINTS, 0, this.count);
    gl.bindVertexArray(null);

    this.src = dst;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.updateProg);
    gl.deleteProgram(this.renderProg);
    gl.deleteTransformFeedback(this.tf);
    for (let i = 0; i < 2; i++) {
      gl.deleteBuffer(this.posBuf[i]);
      gl.deleteBuffer(this.velBuf[i]);
      gl.deleteVertexArray(this.updateVao[i]);
      gl.deleteVertexArray(this.renderVao[i]);
    }
  }

  static background(): readonly [number, number, number] {
    return BACKGROUND;
  }
}

// --- small WebGL helpers (throw on failure so create() can be guarded) ---

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = mustCreate(gl.createProgram(), 'program');
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`GPU program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function linkTF(gl: WebGL2RenderingContext, vs: string, fs: string, varyings: string[]): WebGLProgram {
  const p = mustCreate(gl.createProgram(), 'TF program');
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.transformFeedbackVaryings(p, varyings, gl.SEPARATE_ATTRIBS);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`GPU TF program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = mustCreate(gl.createShader(type), 'shader');
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`GPU shader compile failed: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
}

function uniforms(
  gl: WebGL2RenderingContext,
  prog: WebGLProgram,
  names: string[],
): Record<string, WebGLUniformLocation> {
  const out: Record<string, WebGLUniformLocation> = {};
  for (const n of names) {
    const loc = gl.getUniformLocation(prog, n);
    if (!loc) throw new Error(`GPU uniform not found: ${n}`);
    out[n] = loc;
  }
  return out;
}

function buffer(gl: WebGL2RenderingContext): WebGLBuffer {
  return mustCreate(gl.createBuffer(), 'buffer');
}

function vao(gl: WebGL2RenderingContext): WebGLVertexArrayObject {
  return mustCreate(gl.createVertexArray(), 'vao');
}

function mustCreate<T>(value: T | null, what: string): T {
  if (!value) throw new Error(`GPU: failed to create ${what}`);
  return value;
}
