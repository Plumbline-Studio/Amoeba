# particle-life-3d

A standalone, spin-out **3D evolution of the 2D "particle life" background**.
Intended homes: a Windows live wallpaper (Lively Wallpaper / Wallpaper Engine,
which host HTML/WebGL directly) and a mobile web app / PWA.

See [`PLAN.md`](./PLAN.md) for the full design and milestone roadmap.

## Status: M0 scaffold + M1 physics + M2 look

- **Vite + TypeScript + WebGL2** standalone app.
- **N particles** drawn as additively-blended **instanced billboard quads**
  (one instanced draw call, order-independent — no depth sort).
- **Orbit camera**: drag to rotate, wheel / pinch to zoom, slow auto-rotate
  when idle.
- **3D particle-life physics** (M1): SoA `step` with a 27-cell spatial hash
  (`grid3d`), a randomized type-attraction matrix, the classic radial force
  curve, and a soft bounded box (no z-wrap). Driven each frame on the CPU.
- **Depth-cued look** (M2): sprite size attenuates with depth, distant
  particles fade toward the background (atmospheric fog), and each type carries
  an additive weight so "glow" types bloom while "solid" types read denser —
  all on a cohesive cyan/teal palette.
- **Stats HUD**: FPS (EMA), frame time, CPU time per `step()`, particle count,
  draw calls, buffer-upload bytes, plus a lil-gui live-controls panel (count,
  the §2 tuning rig rMax/friction/forceScale/beta, sprite size, glow, depth fog,
  FOV, reseed, new rules) and a best-effort battery readout.

The default physics params are a conservative **first retune** starting point —
expect to sweep them via the HUD; 3D disperses more than 2D. A headless smoke
test (`npm run test:smoke`) runs 600 steps and asserts the sim stays finite and
bounded.

## Build & run

Requires Node 18+.

```bash
npm install
npm run dev        # start the Vite dev server
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit only
npm run test:smoke # headless engine stability check (600 steps, asserts bounded)
```

Open the dev server URL it prints (default http://localhost:5173).

## Architecture (spin-out seam)

The `src/engine/` core is **pure**: no DOM, no WebGL, no framework. Rendering,
camera, interaction, and HUD depend on the engine, never the reverse — so the
engine can later move to a Web Worker, a GPU compute path, or a native shell
unchanged.

```
src/
  main.ts            bootstrap, render loop, wiring
  engine/            PURE — no DOM/WebGL
    types.ts state.ts grid3d.ts step.ts
    matrix.ts          # type-attraction matrix + force curve
    palette.ts boundary.ts
  render/
    gl.ts camera.ts projection.ts
    mat4.ts            # render-only 4x4 linear algebra
    shaders/particle.vert particle.frag
  interaction/ pointer.ts
  hud/ stats.ts panel.ts battery.ts
```

State is **structure-of-arrays** (SoA) from day one — flat typed arrays
(`positions`, `velocities`, `types`) that are exactly the layout WebGL wants,
so there is no per-frame repacking when uploading to the GPU.

## Milestones

| Milestone | Scope |
|-----------|-------|
| **M0** | Scaffold: Vite+TS+WebGL2, instanced quads, orbit camera, stats overlay ✓ |
| **M1** | Physics: SoA `step`, `grid3d` (27-cell), soft bounds, first retune *(this PR)* |
| **M2** | Look: depth size/fog, additive cyan/teal palette *(this PR)* |
| M3 | Interaction: touch→3D force, orbit/zoom polish |
| M4 | Instrumentation: FPS cap, benchmark mode, battery README |
| M5 | (stretch) GPU physics via WebGL2 transform feedback / WebGPU compute |

## Battery methodology (for later measurement)

The web cannot reliably measure power (`navigator.getBattery()` is removed in
Safari/Firefox and restricted in Chrome), so the in-app HUD gives the CPU-side
story and **native tools give the watts**. The intended procedure (M4):

- Fixed wall-clock duration, fixed screen brightness, airplane mode.
- Sweep `{Canvas vs WebGL} × {30 / 60 / uncapped fps} × {particle count}`.
- Record mWh + CPU% with native tools:
  - macOS: `powermetrics` / Instruments
  - Windows: `powercfg /batteryreport`
  - Android: Battery Historian
- Pair the HUD's per-frame CPU numbers with the native watt figures.

## Distribution targets

- **Windows wallpaper** (primary): Lively Wallpaper / Wallpaper Engine host the
  HTML/WebGL build directly.
- **Phone web app / PWA**: open in a mobile browser, "Add to Home Screen." Cap
  FPS / particle count for battery.
- Android live wallpaper needs a native `WallpaperService` surface (later).
- iOS third-party live wallpapers are not permitted — in-app ambient mode is
  the closest.
