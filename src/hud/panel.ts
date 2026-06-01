/**
 * Live controls panel (PLAN §6) via lil-gui — also the §2 tuning rig. Exposes
 * particle count, the physics knobs (rMax / friction / forceScale / beta), and
 * look controls (sprite size, glow, FOV), plus reseed / randomize-rules actions
 * so the 3D "first retune" can be driven entirely from the UI.
 */

import { GUI } from 'lil-gui';
import type { SimParams } from '../engine/types';

export interface PanelState {
  pointSize: number;
  glow: number;
  fovYDeg: number;
}

export interface PanelCallbacks {
  /** Rebuild the simulation + GPU buffers at the new particle count. */
  onCountChange(count: number): void;
  /** Re-scatter particles with a fresh random seed. */
  onReseed(): void;
  /** Generate a new random type-attraction matrix. */
  onRandomizeRules(): void;
}

export function createPanel(
  params: SimParams,
  view: PanelState,
  cb: PanelCallbacks,
): GUI {
  const gui = new GUI({ title: 'particle-life-3d' });

  const sim = gui.addFolder('Simulation');
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
  look.add(view, 'pointSize', 0.005, 0.08, 0.001).name('sprite size');
  look.add(view, 'glow', 0.2, 3.0, 0.05).name('glow');
  look.add(view, 'fovYDeg', 25, 90, 1).name('FOV');

  return gui;
}
