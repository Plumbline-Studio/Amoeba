/**
 * Live controls panel (PLAN §6) via lil-gui — also the §2 tuning rig. Exposes
 * particle count, the physics knobs, look controls, the §5 pointer-force
 * settings, and the §6 instrumentation (FPS cap + benchmark), plus reseed /
 * randomize-rules actions so the whole toy can be driven from the UI.
 */

import { GUI } from 'lil-gui';
import type { SimParams } from '../engine/types';

export interface PanelState {
  pointSize: number;
  glow: number;
  fog: number;
  fovYDeg: number;
  /** Palette hue rotation in degrees (0..360). */
  hue: number;
}

export interface PushState {
  mode: boolean;
  radius: number;
  strength: number;
}

export interface PerfState {
  /** 0 = uncapped, otherwise target FPS. */
  fpsCap: number;
}

export interface MotionState {
  /** Scene speed, 0 (frozen) .. 100 (native/fastest). */
  speed: number;
}

export interface GpuState {
  enabled: boolean;
}

export interface PanelCallbacks {
  onCountChange(count: number): void;
  onReseed(): void;
  onRandomizeRules(): void;
  onBenchmark(): void;
  /** Toggle the experimental M5 GPU (transform-feedback) path. */
  onToggleGpu(enabled: boolean): void;
  /** Rebuild + re-upload the palette at the given hue rotation (degrees). */
  onColorChange(hueDeg: number): void;
}

export function createPanel(
  params: SimParams,
  view: PanelState,
  push: PushState,
  perf: PerfState,
  gpu: GpuState,
  motion: MotionState,
  cb: PanelCallbacks,
): GUI {
  const gui = new GUI({ title: 'particle-life-3d' });

  const sim = gui.addFolder('Simulation');
  sim.add(motion, 'speed', 0, 100, 1).name('speed');
  sim
    .add(params, 'count', 500, 30000, 100)
    .name('count')
    .onFinishChange((v: number) => cb.onCountChange(v | 0));
  sim.add({ reseed: () => cb.onReseed() }, 'reseed').name('reseed positions');
  sim.add({ rules: () => cb.onRandomizeRules() }, 'rules').name('new rules');

  // Live tuning surface (PLAN §2). Edited in place on `params`.
  const physics = gui.addFolder('Physics');
  physics.add(params, 'rMax', 0.02, 0.5, 0.01).name('rMax');
  physics.add(params, 'friction', 0.5, 0.98, 0.01).name('friction');
  physics.add(params, 'forceScale', 0.001, 0.08, 0.001).name('forceScale');
  physics.add(params, 'beta', 0.05, 0.6, 0.01).name('beta');

  const look = gui.addFolder('Look');
  look.add(view, 'hue', 0, 360, 1).name('color shift').onChange((v: number) => cb.onColorChange(v));
  look.add(view, 'pointSize', 0.005, 0.08, 0.001).name('sprite size');
  look.add(view, 'glow', 0.2, 3.0, 0.05).name('glow');
  look.add(view, 'fog', 0.0, 1.0, 0.01).name('depth fog');
  look.add(view, 'fovYDeg', 25, 90, 1).name('FOV');

  // PLAN §5 — pointer force. "push mode" lets touch devices push with a plain
  // drag; desktop can also Shift+drag or right-drag at any time.
  const interact = gui.addFolder('Interaction');
  interact.add(push, 'mode').name('push on drag');
  interact.add(push, 'radius', 0.1, 1.0, 0.05).name('push radius');
  interact.add(push, 'strength', -0.06, 0.06, 0.002).name('push strength');

  // PLAN §6 — instrumentation.
  const instr = gui.addFolder('Instrumentation');
  instr.add(perf, 'fpsCap', { uncapped: 0, '60 fps': 60, '30 fps': 30 }).name('FPS cap');
  instr.add({ bench: () => cb.onBenchmark() }, 'bench').name('run benchmark (10s)');

  // PLAN §M5 (stretch) — experimental GPU transform-feedback path. Neighbor-free
  // dynamics; reverts to CPU automatically if the GPU pipeline can't initialize.
  const exp = gui.addFolder('Experimental (M5)');
  exp.add(gpu, 'enabled').name('GPU mode (TF)').onChange((v: boolean) => cb.onToggleGpu(v));
  exp.close();

  return gui;
}
