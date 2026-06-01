/**
 * Bootstrap + render loop (PLAN §8). Wires the pure engine (SoA state) to the
 * render/camera/HUD layers. Each frame: run the 3D physics step (M1), re-upload
 * positions, draw the instanced billboards, and refresh the HUD.
 */

import { DEFAULT_PARAMS, type SimParams } from './engine/types';
import { createState, seed, centroid, mulberry32, type SimState } from './engine/state';
import { buildPalette, buildWeights } from './engine/palette';
import { createGrid } from './engine/grid3d';
import { createMatrix, type AttractionMatrix } from './engine/matrix';
import { step, applyPointerForce } from './engine/step';

import { ParticleRenderer } from './render/gl';
import { GpuParticles } from './render/gpu';
import { OrbitCamera } from './render/camera';
import { Projection } from './render/projection';
import { create as mat4, multiply, invert, transformPoint, type Vec3 } from './render/mat4';

import { attachPointerControls } from './interaction/pointer';

import { StatsOverlay } from './hud/stats';
import { createPanel, type PanelState } from './hud/panel';
import { createBatteryReadout } from './hud/battery';
import { Benchmark } from './hud/benchmark';

function main(): void {
  const canvas = document.getElementById('scene') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('Missing #scene canvas');

  const params: SimParams = { ...DEFAULT_PARAMS };

  let renderer: ParticleRenderer;
  try {
    renderer = new ParticleRenderer(canvas);
  } catch (err) {
    showFatal(canvas, err);
    return;
  }

  // Engine state (SoA) + spatial grid + type-attraction matrix.
  let state: SimState = buildSim(params);
  const grid = createGrid();
  let matrix: AttractionMatrix = createMatrix(params.typeCount, mulberry32(1337));
  renderer.setPalette(buildPalette(params.typeCount));
  renderer.setWeights(buildWeights(params.typeCount));
  renderer.upload(state.positions, state.types, state.count);

  const camera = new OrbitCamera();
  const projection = new Projection();

  const view: PanelState = {
    pointSize: 0.022,
    glow: 1.1,
    fog: 0.85,
    fovYDeg: projection.params.fovYDeg,
  };

  // §5 pointer-force settings + scratch for the 2D->3D projection.
  const push = { mode: false, radius: 0.4, strength: 0.02 };
  const centroidVec: [number, number, number] = [0, 0, 0];
  const invViewProj = mat4();
  const viewProj = mat4();
  const farPoint: Vec3 = [0, 0, 0];

  // Project a 2D pointer (NDC) onto the camera-facing plane through the cluster
  // centroid, then apply the radial push there (PLAN §5).
  const applyPushAt = (ndcX: number, ndcY: number) => {
    multiply(viewProj, projection.matrix, camera.view);
    if (!invert(invViewProj, viewProj)) return;

    transformPoint(farPoint, invViewProj, ndcX, ndcY, 1);
    const eye = camera.eye;
    let dx = farPoint[0] - eye[0];
    let dy = farPoint[1] - eye[1];
    let dz = farPoint[2] - eye[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    dx /= len; dy /= len; dz /= len;

    // Plane through centroid, normal facing the camera.
    let nx = eye[0] - centroidVec[0];
    let ny = eye[1] - centroidVec[1];
    let nz = eye[2] - centroidVec[2];
    const nlen = Math.hypot(nx, ny, nz) || 1;
    nx /= nlen; ny /= nlen; nz /= nlen;

    const denom = dx * nx + dy * ny + dz * nz;
    if (Math.abs(denom) < 1e-4) return;
    const t =
      ((centroidVec[0] - eye[0]) * nx +
        (centroidVec[1] - eye[1]) * ny +
        (centroidVec[2] - eye[2]) * nz) /
      denom;
    if (t <= 0) return;

    applyPointerForce(
      state,
      eye[0] + dx * t,
      eye[1] + dy * t,
      eye[2] + dz * t,
      push.radius,
      push.strength,
    );
  };

  const perf = { fpsCap: 0 };
  const motion = { speed: 100 };
  const gpu = { enabled: false };
  let gpuParticles: GpuParticles | null = null;
  const benchmark = new Benchmark();
  let benchNote: string | undefined;

  const stats = new StatsOverlay();
  const battery = createBatteryReadout();
  createPanel(params, view, push, perf, gpu, motion, {
    onCountChange(count) {
      params.count = count;
      state = buildSim(params);
      renderer.upload(state.positions, state.types, state.count);
    },
    onReseed() {
      state = buildSim(params, (Math.random() * 1e9) | 0);
      renderer.upload(state.positions, state.types, state.count);
    },
    onRandomizeRules() {
      matrix = createMatrix(params.typeCount, mulberry32((Math.random() * 1e9) | 0));
    },
    onBenchmark() {
      benchNote = 'benchmark: running…';
      benchmark.start(10, state.count, (summary) => {
        benchNote = summary;
      });
    },
    onToggleGpu(enabled) {
      gpu.enabled = false;
      gpuParticles?.dispose();
      gpuParticles = null;
      if (!enabled) {
        benchNote = undefined;
        return;
      }
      // Guarded init: any failure reverts to the CPU path, no crash.
      try {
        gpuParticles = GpuParticles.create(
          renderer.gl,
          state.positions,
          state.velocities,
          state.count,
        );
        gpu.enabled = true;
        benchNote = 'GPU mode (M5, experimental): transform-feedback swirl';
      } catch (err) {
        console.warn('GPU mode unavailable, staying on CPU:', err);
        benchNote = 'GPU mode unavailable — reverted to CPU';
      }
    },
  });

  attachPointerControls(canvas, camera, {
    onPush: applyPushAt,
    isPushMode: () => push.mode,
  });

  // Handle DPR-aware resizing.
  let aspect = 1;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    aspect = renderer.resize(w, h);
  };
  window.addEventListener('resize', resize);
  resize();

  let lastTime = performance.now();
  let cpuStepMs = 0;

  const frame = (now: number) => {
    requestAnimationFrame(frame);

    // FPS cap (PLAN §6): skip work until the target interval has elapsed. rAF
    // already bounds us to the display refresh; this throttles below it (the
    // 30fps battery story). 0 = uncapped.
    if (perf.fpsCap > 0 && now - lastTime < 1000 / perf.fpsCap - 0.5) return;

    const frameMs = now - lastTime;
    const dt = Math.min(frameMs / 1000, 0.05); // clamp huge tab-switch gaps
    lastTime = now;

    // Camera + projection update every frame (shared by both paths).
    camera.update(dt);
    projection.params.fovYDeg = view.fovYDeg;
    projection.update(aspect);
    const focal = 1 / Math.tan((view.fovYDeg * Math.PI) / 360);

    if (gpuParticles && gpu.enabled) {
      // M5 GPU path: transform feedback owns update + draw (no CPU step).
      cpuStepMs = 0;
      const pixelScale =
        renderer.gl.drawingBufferHeight / (2 * Math.tan((view.fovYDeg * Math.PI) / 360));
      gpuParticles.frame({
        view: camera.view,
        projection: projection.matrix,
        pointSize: view.pointSize, // world radius; shader scales by pixelScale/viewZ
        pixelScale,
        glow: view.glow,
        friction: params.friction,
        worldSize: params.worldSize,
      });
    } else {
      // CPU path: 3D physics step, timed for the HUD's CPU readout.
      const t0 = performance.now();
      step(state, grid, matrix, params, motion.speed / 100);
      cpuStepMs = performance.now() - t0;

      // Track the cluster centroid for the pointer-force projection plane.
      centroid(state, centroidVec);

      // Re-upload the freshly stepped positions and draw.
      renderer.upload(state.positions, state.types, state.count);
      renderer.render({
        view: camera.view,
        projection: projection.matrix,
        pointSize: view.pointSize,
        focal,
        glow: view.glow,
        fog: view.fog,
      });
    }

    benchmark.sample(frameMs, cpuStepMs);

    stats.update(frameMs, now, {
      particleCount: state.count,
      drawCalls: renderer.stats.drawCalls,
      uploadBytes: renderer.stats.uploadBytes,
      cpuStepMs,
      fpsCap: perf.fpsCap,
      battery: battery.text(),
      note: benchmark.isRunning ? 'benchmark: running…' : benchNote,
    });
  };

  requestAnimationFrame(frame);
}

function buildSim(params: SimParams, seedValue = 1): SimState {
  const state = createState(params.count, params.typeCount);
  seed(state, params, seedValue);
  return state;
}

function showFatal(canvas: HTMLElement, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const div = document.createElement('div');
  Object.assign(div.style, {
    position: 'fixed',
    inset: '0',
    display: 'grid',
    placeItems: 'center',
    padding: '24px',
    color: '#ff9f9f',
    font: '14px/1.5 ui-monospace, Menlo, Consolas, monospace',
    textAlign: 'center',
  } as CSSStyleDeclaration);
  div.textContent = `Particle Life 3D could not start:\n${msg}`;
  div.style.whiteSpace = 'pre-wrap';
  canvas.replaceWith(div);
}

main();
