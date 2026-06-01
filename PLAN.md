# Option B — 3D Particle Life: Implementation Plan

A standalone, spin-out 3D evolution of the 2D "particle life" background from
the tool-maker-app. Intended homes: a **Windows live wallpaper** (via Lively
Wallpaper / Wallpaper Engine, which host HTML/WebGL directly) and a **mobile
web app / PWA** to play with on a phone.

## 0. Guiding principle

The `engine/` core stays **pure and dependency-free** (no DOM, no WebGL, no
framework) so it ports later to a Web Worker, a GPU compute path, or a native
shell unchanged. Rendering, camera, and HUD are separate layers that depend on
the engine, never the reverse. This is what makes it spin-out-ready by
construction — the same clean seam the original 2D `particle-life/` module has.

## Hardware reality (important)

WebGL renders on the **GPU already built into the target device** — the user's
Windows PC and phone both have one, accessed for free through the browser. This
has nothing to do with renting a cloud GPU (Colab/Cloud), which is for ML
training and is **never needed** for this project.

- Rendering runs on the local GPU; the **physics step runs on the CPU**
  (single-threaded) and is cheap for a few thousand particles.
- Windows PC, even integrated Intel/AMD graphics: tens of thousands of
  particles at 60fps. Discrete GPU: 100k+.
- Phone: 1.5k–4k particles at 30–60fps is comfortable. The real limit is
  **heat and battery, not capability**. Cap FPS to protect battery.
- The M5 GPU-physics stretch also runs on the local GPU — still free; only
  needed for very high particle counts.

## 1. Key architectural change: AoS → SoA

The original engine uses an array of `{x,y,vx,vy,type}` objects. For WebGL we
upload positions to a GPU buffer every frame, so switch to **flat typed
arrays** (structure-of-arrays):

```ts
positions:  Float32Array(n * 3)   // x,y,z interleaved
velocities: Float32Array(n * 3)
types:      Uint8Array(n)
```

Cache-friendly, and already the layout WebGL wants — no per-frame repacking.
This is the one non-trivial rewrite versus a naive port.

## 2. Engine (3D physics, CPU first)

- **Grid** — `grid3d.ts`: spatial hash with `cols×rows×depth` cells sized by
  `R_MAX`; neighbor search over **27 cells** (vs 9 in 2D).
- **Force**: identical `forceFn`, but `r² = dx²+dy²+dz²`; accumulate `fz`
  alongside `fx,fy`.
- **Integration**: unchanged — `v = (v + f·FORCE_SCALE)·FRICTION; pos += v`.
- **Boundaries** — `boundary.ts`: **not** toroidal in z (wrapping pops
  particles front↔back under perspective — ugly). Use a **soft bounded box**:
  a gentle inward force near the walls so the cluster stays in frame. (x/y can
  stay wrapped or also soft — a tuning choice.)
- **Retuning**: the matrix and `FORCE_SCALE / R_MAX / FRICTION / count` were
  tuned for 2D; 3D disperses more, so these need re-tuning. The HUD's live
  controls (§6) double as the tuning rig. **Budget real iteration time here** —
  the biggest soft cost.

## 3. Rendering (WebGL2, instanced)

- **Draw**: one **instanced draw call** — a unit billboard quad, `n` instances,
  per-instance position/type from the buffers. Simpler than `GL_POINTS`, avoids
  point-size clipping quirks, gives soft round sprites via a radial falloff in
  the fragment shader.
- **Blending — the big simplification**: render everything **additively** (the
  original look already leans on `"lighter"`). Additive blending is
  *order-independent*, so we **skip per-frame depth sorting entirely** — a major
  perf win and a headache avoided. Non-glow types get a lower additive weight to
  read as "solid."
- **Depth cues in-shader**: point size attenuates with `focal / -viewZ`;
  fragment shader mixes color toward the background by depth (atmospheric fog).

## 4. Projection & camera (`camera.ts`, `projection.ts`)

- Standard **perspective matrix** (FOV ~50°) × **orbit view matrix**; pass MVP
  as a uniform, project in the vertex shader.
- **Orbit camera**: drag to rotate, wheel/pinch to zoom, slow auto-rotate when
  idle. Turns it from "background" into "interactive toy."

## 5. Interaction (`pointer.ts`) — 2D-touch-into-3D

A pointer is 2D; a force in a volume is 3D. Decision: **project the pointer
onto the camera-facing plane through the cluster centroid**, place the force
point there, apply the existing radial touch force in 3D. Intuitive ("push
where you point"), no ambiguity. Orbit vs push separated by gesture
(e.g. drag-on-empty = orbit, tap/drag-with-modifier = push).

## 6. Instrumentation HUD (`hud/`) — the demo *and* the measurement rig

Baked in from day one so it doubles as the battery-analysis tool:

- **Stats overlay**: FPS (EMA), frame time (ms), JS/CPU time per `step()`
  (`performance.now()` wrap), particle count, draw calls, buffer-upload bytes.
- **Adaptive FPS cap**: fixed-timestep accumulator with a toggle
  (30 / 60 / uncapped). 30fps roughly halves the work — central to the battery
  story.
- **Live controls** (lil-gui): particle count, force params, FOV, blend
  weights — doubles as the §2 tuning tool.
- **Battery**: attempt `navigator.getBattery()` and show level/charging *if
  available*, clearly labeled "unavailable" otherwise (removed in
  Safari/Firefox, restricted in Chrome — **web cannot reliably measure power**).
- **Benchmark mode**: run a fixed config for N seconds, log avg frame
  time / CPU, export CSV — to pair with native power tools for real mWh.

## 7. Battery methodology (README section, not code)

Procedure for the real pros/cons table: fixed wall-clock, fixed brightness,
airplane mode, sweep `{Canvas vs WebGL} × {30/60/uncapped fps} × {count}`,
record mWh + CPU% via native tools (`powermetrics`/Instruments on macOS,
`powercfg /batteryreport` on Windows, Battery Historian on Android). The in-app
HUD gives the CPU-side story immediately; native tools give the watts.

## 8. File layout (standalone Vite + TS project)

```
particle-life-3d/
  index.html
  package.json            # vite, typescript, lil-gui (only)
  tsconfig.json
  README.md               # build/run, spin-out notes, battery methodology
  PLAN.md                 # this document
  src/
    main.ts               # bootstrap, render loop, wiring
    engine/               # PURE — no DOM/WebGL
      types.ts  state.ts  grid3d.ts  step.ts
      matrix.ts  palette.ts  boundary.ts
    render/
      gl.ts  camera.ts  projection.ts
      shaders/particle.vert  particle.frag
    interaction/ pointer.ts
    hud/ stats.ts  panel.ts  battery.ts
```

## 9. Milestones

- **M0 — Scaffold**: Vite+TS+WebGL2, instanced quads drawing N points, orbit
  camera, stats overlay.
- **M1 — Physics**: SoA state, `grid3d`, 3D `step`, soft bounds; first retune.
- **M2 — Look**: depth size/fog, additive palette matching the cyan/teal
  aesthetic.
- **M3 — Interaction**: touch→3D force, orbit/zoom polish.
- **M4 — Instrumentation**: FPS cap, benchmark mode, battery README.
- **M5 — (stretch) GPU physics**: move `step` to WebGL2 **transform feedback**
  (or WebGPU compute) for high counts — the real "perpetual background without
  killing the CPU" lever. CPU version stays as reference/fallback.

## 10. Distribution

- **Windows wallpaper** — Lively Wallpaper (open-source) / Wallpaper Engine host
  the HTML/WebGL build directly. Easiest path; the primary target.
- **Phone web app / PWA** — open in mobile browser, "Add to Home Screen." Runs
  on the phone's GPU. Cap FPS/particle count for battery.
- **Android live wallpaper** — possible but requires a native `WallpaperService`
  surface (later effort).
- **iOS live wallpaper** — not permitted for third-party apps; dead end. In-app
  ambient mode is the closest.

## 11. Open decisions / risks

1. **3D retuning** is the main time sink — the look will need iteration.
2. **Boundary model** (soft box vs partial wrap) affects the look.
3. **WebGL2 vs WebGPU** for the GPU-physics stretch: WebGL2 transform-feedback
   is safest for a desktop/wallpaper host; WebGPU compute is cleaner but
   depends on host support.
