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

for (let i = 0; i < state.count * 3; i++) {
  const p = state.positions[i];
  const v = state.velocities[i];
  if (!Number.isFinite(p) || !Number.isFinite(v)) {
    console.error(`NON-FINITE at ${i}: pos=${p} vel=${v}`);
    process.exit(1);
  }
  maxCoord = Math.max(maxCoord, Math.abs(p));
  maxSpeed = Math.max(maxSpeed, Math.abs(v));
}

console.log(`steps=${STEPS} count=${params.count}`);
console.log(`maxCoord=${maxCoord.toFixed(3)} maxSpeed/frame=${maxSpeed.toFixed(4)}`);

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
