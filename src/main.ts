/**
 * Bootstrap + render loop (PLAN §8). Wires the pure engine (SoA state) to the
 * render/camera/HUD layers. Each frame: run the 3D physics step (M1), re-upload
 * positions, draw the instanced billboards, and refresh the HUD.
 */

import { DEFAULT_PARAMS, type SimParams } from './engine/types';
import { createState, seed, mulberry32, type SimState } from './engine/state';
import { buildPalette, buildWeights } from './engine/palette';
import { createGrid } from './engine/grid3d';
import { createMatrix, type AttractionMatrix } from './engine/matrix';
import { step } from './engine/step';

import { ParticleRenderer } from './render/gl';
import { OrbitCamera } from './render/camera';
import { Projection } from './render/projection';

import { attachPointerControls } from './interaction/pointer';

import { StatsOverlay } from './hud/stats';
import { createPanel, type PanelState } from './hud/panel';
import { createBatteryReadout } from './hud/battery';

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

  const stats = new StatsOverlay();
  const battery = createBatteryReadout();
  createPanel(params, view, {
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
  });

  attachPointerControls(canvas, camera);

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
    const frameMs = now - lastTime;
    const dt = Math.min(frameMs / 1000, 0.05); // clamp huge tab-switch gaps
    lastTime = now;

    // 3D physics step, timed for the HUD's CPU readout.
    const t0 = performance.now();
    step(state, grid, matrix, params);
    cpuStepMs = performance.now() - t0;

    // Camera + projection.
    camera.update(dt);
    projection.params.fovYDeg = view.fovYDeg;
    projection.update(aspect);

    // Re-upload the freshly stepped positions to the GPU.
    renderer.upload(state.positions, state.types, state.count);

    const focal = 1 / Math.tan((view.fovYDeg * Math.PI) / 360);
    renderer.render({
      view: camera.view,
      projection: projection.matrix,
      pointSize: view.pointSize,
      focal,
      glow: view.glow,
      fog: view.fog,
    });

    stats.update(frameMs, now, {
      particleCount: state.count,
      drawCalls: renderer.stats.drawCalls,
      uploadBytes: renderer.stats.uploadBytes,
      cpuStepMs,
    });
    // Battery line is probed lazily; touch it so the readout stays warm.
    void battery.text();

    requestAnimationFrame(frame);
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
