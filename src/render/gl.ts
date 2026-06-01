/**
 * WebGL2 particle renderer (PLAN §3): one instanced draw call of a unit
 * billboard quad, additively blended (order-independent, no depth sort).
 *
 * Depends on the engine matrices/palette but the engine never depends on this.
 * Owns all GL state: program, VAO, the static quad, and the per-instance
 * position/type buffers (uploaded from the engine's SoA arrays).
 */

import type { Mat4 } from '../engine/matrix';
import vertSrc from './shaders/particle.vert?raw';
import fragSrc from './shaders/particle.frag?raw';

const MAX_PALETTE = 16;

// Unit quad as two triangles, corners in [-0.5, 0.5].
const QUAD = new Float32Array([
  -0.5, -0.5,
  0.5, -0.5,
  -0.5, 0.5,
  -0.5, 0.5,
  0.5, -0.5,
  0.5, 0.5,
]);

export interface RenderUniforms {
  view: Mat4;
  projection: Mat4;
  /** World-space sprite radius. */
  pointSize: number;
  /** Size attenuation factor (focal / -viewZ). */
  focal: number;
  /** Additive glow intensity. */
  glow: number;
}

export interface DrawStats {
  drawCalls: number;
  /** Bytes uploaded to instance buffers on the last upload(). */
  uploadBytes: number;
  instances: number;
}

export class ParticleRenderer {
  readonly gl: WebGL2RenderingContext;

  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private positionBuffer: WebGLBuffer;
  private typeBuffer: WebGLBuffer;

  private uView: WebGLUniformLocation;
  private uProjection: WebGLUniformLocation;
  private uPointSize: WebGLUniformLocation;
  private uFocal: WebGLUniformLocation;
  private uGlow: WebGLUniformLocation;
  private uPalette: WebGLUniformLocation;

  private capacity = 0;
  private count = 0;
  private typeScratch = new Float32Array(0);

  readonly stats: DrawStats = { drawCalls: 0, uploadBytes: 0, instances: 0 };

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      throw new Error('WebGL2 is not available in this browser.');
    }
    this.gl = gl;

    this.program = linkProgram(gl, vertSrc, fragSrc);
    this.uView = mustGetUniform(gl, this.program, 'uView');
    this.uProjection = mustGetUniform(gl, this.program, 'uProjection');
    this.uPointSize = mustGetUniform(gl, this.program, 'uPointSize');
    this.uFocal = mustGetUniform(gl, this.program, 'uFocal');
    this.uGlow = mustGetUniform(gl, this.program, 'uGlow');
    this.uPalette = mustGetUniform(gl, this.program, 'uPalette[0]');

    this.vao = mustCreate(gl.createVertexArray(), 'VAO');
    this.positionBuffer = mustCreate(gl.createBuffer(), 'position buffer');
    this.typeBuffer = mustCreate(gl.createBuffer(), 'type buffer');

    gl.bindVertexArray(this.vao);

    // Static unit quad -> location 0 (per-vertex).
    const quadBuffer = mustCreate(gl.createBuffer(), 'quad buffer');
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Per-instance position -> location 1, divisor 1.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(1, 1);

    // Per-instance type -> location 2, divisor 1.
    gl.bindBuffer(gl.ARRAY_BUFFER, this.typeBuffer);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0);
    gl.vertexAttribDivisor(2, 1);

    gl.bindVertexArray(null);

    // Additive, order-independent blending. Depth test OFF: additive output is
    // commutative, so sorting is unnecessary (PLAN §3).
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0.02, 0.03, 0.05, 1.0);
  }

  /** Upload the RGB palette table (typeCount * 3 floats). */
  setPalette(rgb: Float32Array): void {
    const n = Math.min(MAX_PALETTE, (rgb.length / 3) | 0);
    const padded = new Float32Array(MAX_PALETTE * 3);
    padded.set(rgb.subarray(0, n * 3));
    this.gl.useProgram(this.program);
    this.gl.uniform3fv(this.uPalette, padded);
  }

  /** Ensure per-instance buffers can hold `capacity` particles. */
  private ensureCapacity(capacity: number): void {
    if (capacity <= this.capacity) return;
    const gl = this.gl;
    this.capacity = capacity;
    this.typeScratch = new Float32Array(capacity);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 3 * 4, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.typeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 4, gl.DYNAMIC_DRAW);
  }

  /**
   * Upload positions (n*3 floats) and types (n bytes). In M0 these are static,
   * but the loop re-uploads positions each frame so M1 physics drops in for
   * free. Types are widened to float to match the shader attribute.
   */
  upload(positions: Float32Array, types: Uint8Array, count: number): void {
    const gl = this.gl;
    this.ensureCapacity(count);
    this.count = count;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions.subarray(0, count * 3));

    for (let i = 0; i < count; i++) this.typeScratch[i] = types[i];
    gl.bindBuffer(gl.ARRAY_BUFFER, this.typeBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.typeScratch.subarray(0, count));

    this.stats.uploadBytes = count * 3 * 4 + count * 4;
  }

  /** Resize the drawing buffer + viewport. Returns aspect ratio. */
  resize(width: number, height: number): number {
    const gl = this.gl;
    if (gl.canvas.width !== width || gl.canvas.height !== height) {
      gl.canvas.width = width;
      gl.canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    return width / Math.max(1, height);
  }

  render(u: RenderUniforms): void {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uView, false, u.view);
    gl.uniformMatrix4fv(this.uProjection, false, u.projection);
    gl.uniform1f(this.uPointSize, u.pointSize);
    gl.uniform1f(this.uFocal, u.focal);
    gl.uniform1f(this.uGlow, u.glow);

    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);

    this.stats.drawCalls = 1;
    this.stats.instances = this.count;
  }
}

function linkProgram(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = mustCreate(gl.createProgram(), 'program');
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed: ${log}`);
  }
  return program;
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = mustCreate(gl.createShader(type), 'shader');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    const kind = type === gl.VERTEX_SHADER ? 'vertex' : 'fragment';
    throw new Error(`${kind} shader compile failed: ${log}`);
  }
  return shader;
}

function mustGetUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const loc = gl.getUniformLocation(program, name);
  if (!loc) throw new Error(`Uniform not found: ${name}`);
  return loc;
}

function mustCreate<T>(value: T | null, what: string): T {
  if (!value) throw new Error(`Failed to create ${what}`);
  return value;
}
