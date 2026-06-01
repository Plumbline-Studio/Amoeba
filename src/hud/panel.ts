/**
 * Live controls panel (PLAN §6) via lil-gui. Doubles as the §2 tuning rig in
 * later milestones. M0 exposes what the render/camera skeleton can act on:
 * particle count, sprite size, glow, FOV. Force params (friction, forceScale,
 * rMax) appear but are inert until M1 wires physics — surfaced now so the
 * tuning UI is stable.
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

  // Inert in M0 — present so the tuning surface (PLAN §2) is stable for M1.
  const physics = gui.addFolder('Physics (M1+)');
  physics.add(params, 'rMax', 0.02, 0.5, 0.01).name('rMax').disable();
  physics.add(params, 'friction', 0.5, 0.99, 0.01).name('friction').disable();
  physics.add(params, 'forceScale', 0.05, 2.0, 0.05).name('forceScale').disable();

  const look = gui.addFolder('Look');
  look.add(view, 'pointSize', 0.005, 0.08, 0.001).name('sprite size');
  look.add(view, 'glow', 0.2, 3.0, 0.05).name('glow');
  look.add(view, 'fovYDeg', 25, 90, 1).name('FOV');

  return gui;
}
