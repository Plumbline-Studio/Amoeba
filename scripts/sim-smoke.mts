// Headless smoke test for the pure engine: run N steps and assert the
// simulation stays finite and bounded (no NaN/explosion). Not a unit test
// framework — just a fast stability gate runnable in node via esbuild.
import { DEFAULT_PARAMS } from '../src/engine/types';
import { createState, seed, mulberry32 } from '../src/engine/state';
import { createGrid } from '../src/engine/grid3d';
import { createMatrix } from '../src/engine/matrix';
import { step } from '../src/engine/step';

const params = { ...DEFAULT_PARAMS, count: 3000 };
const state = createState(params.count, params.typeCount);
seed(state, params, 1);
const grid = createGrid();
const matrix = createMatrix(params.typeCount, mulberry32(1337));

const STEPS = 600;
let maxSpeed = 0;
let maxCoord = 0;
for (let s = 0; s < STEPS; s++) {
  step(state, grid, matrix, params);
}

let sumSpeed = 0;
for (let i = 0; i < state.count; i++) {
  for (let a = 0; a < 3; a++) {
    const p = state.positions[i * 3 + a];
    const v = state.velocities[i * 3 + a];
    if (!Number.isFinite(p) || !Number.isFinite(v)) {
      console.error(`NON-FINITE at ${i}: pos=${p} vel=${v}`);
      process.exit(1);
    }
    maxCoord = Math.max(maxCoord, Math.abs(p));
    maxSpeed = Math.max(maxSpeed, Math.abs(v));
  }
  sumSpeed += Math.hypot(
    state.velocities[i * 3 + 0],
    state.velocities[i * 3 + 1],
    state.velocities[i * 3 + 2],
  );
}
const meanSpeed = sumSpeed / state.count;

console.log(`steps=${STEPS} count=${params.count}`);
console.log(
  `maxCoord=${maxCoord.toFixed(3)} maxSpeed/frame=${maxSpeed.toFixed(4)} meanSpeed/frame=${meanSpeed.toFixed(5)}`,
);

// "Always moving": the cluster should still have non-trivial residual motion,
// not collapse to a frozen blob. (Camera auto-rotate also guarantees visible
// motion, but we want the sim itself alive.)
if (meanSpeed < 1e-4) {
  console.error('WARN: simulation nearly frozen (meanSpeed very low)');
}

// Soft box should keep things within a few worldSizes; per-frame speed small.
if (maxCoord > params.worldSize * 4) {
  console.error('FAIL: particles escaped the soft box (maxCoord too large)');
  process.exit(1);
}
if (maxSpeed > 0.5) {
  console.error('FAIL: per-frame speed too high (likely unstable)');
  process.exit(1);
}
console.log('OK: simulation stable and bounded');
