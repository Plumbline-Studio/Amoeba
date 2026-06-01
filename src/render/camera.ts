/**
 * Orbit camera (PLAN §4). Holds spherical orbit state (azimuth, elevation,
 * distance) around a target and produces a right-handed view matrix.
 *
 * Logic only — no DOM here. Gesture wiring lives in interaction/pointer.ts,
 * which calls `rotate` / `zoom`. A slow auto-rotate kicks in when idle so the
 * scene reads as a living "interactive toy," not a frozen background.
 */

import { create, lookAt, type Mat4, type Vec3 } from './mat4';

export interface OrbitConfig {
  distance: number;
  minDistance: number;
  maxDistance: number;
  /** Elevation clamp in radians, just shy of the poles to avoid gimbal flip. */
  minElevation: number;
  maxElevation: number;
  /** Radians/second of idle auto-rotation. */
  autoRotateSpeed: number;
  /** Seconds of no input before auto-rotate resumes. */
  idleDelay: number;
}

export const DEFAULT_ORBIT: OrbitConfig = {
  distance: 3.2,
  minDistance: 0.6,
  maxDistance: 12,
  minElevation: -1.45,
  maxElevation: 1.45,
  autoRotateSpeed: 0.12,
  idleDelay: 2.0,
};

export class OrbitCamera {
  readonly view: Mat4 = create();
  readonly eye: Vec3 = [0, 0, 1];

  target: Vec3 = [0, 0, 0];
  azimuth = 0.6;
  elevation = 0.35;
  distance: number;

  private cfg: OrbitConfig;
  private idleTime = 0;

  constructor(cfg: OrbitConfig = DEFAULT_ORBIT) {
    this.cfg = { ...cfg };
    this.distance = cfg.distance;
    this.recompute();
  }

  /** Drag-rotate. `dx`/`dy` are in radians (pointer layer scales pixels). */
  rotate(dx: number, dy: number): void {
    this.azimuth += dx;
    this.elevation += dy;
    this.elevation = clamp(this.elevation, this.cfg.minElevation, this.cfg.maxElevation);
    this.idleTime = 0;
  }

  /** Wheel/pinch zoom. `factor` > 1 zooms out, < 1 zooms in (multiplicative). */
  zoom(factor: number): void {
    this.distance = clamp(this.distance * factor, this.cfg.minDistance, this.cfg.maxDistance);
    this.idleTime = 0;
  }

  /** Advance idle timer + auto-rotate, then rebuild the view matrix. */
  update(dt: number): Mat4 {
    this.idleTime += dt;
    if (this.idleTime >= this.cfg.idleDelay) {
      this.azimuth += this.cfg.autoRotateSpeed * dt;
    }
    return this.recompute();
  }

  private recompute(): Mat4 {
    const ce = Math.cos(this.elevation);
    this.eye[0] = this.target[0] + this.distance * ce * Math.sin(this.azimuth);
    this.eye[1] = this.target[1] + this.distance * Math.sin(this.elevation);
    this.eye[2] = this.target[2] + this.distance * ce * Math.cos(this.azimuth);
    return lookAt(this.view, this.eye, this.target, UP);
  }
}

const UP: Vec3 = [0, 1, 0];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
