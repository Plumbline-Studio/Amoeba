/**
 * Benchmark mode (PLAN §6). Runs the current config for a fixed duration,
 * collecting per-frame timing, then logs a summary and exports a CSV — to pair
 * with native power tools for the real mWh story (README §battery methodology).
 *
 * It only records what it's fed (`sample` each worked frame); it doesn't touch
 * the sim or renderer, so it stays a passive measurement probe.
 */

interface Sample {
  t: number; // ms since benchmark start
  frameMs: number;
  cpuStepMs: number;
}

export class Benchmark {
  private running = false;
  private startTime = 0;
  private durationMs = 0;
  private samples: Sample[] = [];
  private particleCount = 0;
  private onDone?: (summary: string) => void;

  get isRunning(): boolean {
    return this.running;
  }

  /** Begin a run of `seconds`, tagging samples with the current particle count. */
  start(seconds: number, particleCount: number, onDone?: (summary: string) => void): void {
    if (this.running) return;
    this.running = true;
    this.startTime = performance.now();
    this.durationMs = seconds * 1000;
    this.samples = [];
    this.particleCount = particleCount;
    this.onDone = onDone;
  }

  /** Feed one worked frame. Auto-finishes (and exports) when the window elapses. */
  sample(frameMs: number, cpuStepMs: number): void {
    if (!this.running) return;
    const t = performance.now() - this.startTime;
    this.samples.push({ t, frameMs, cpuStepMs });
    if (t >= this.durationMs) this.finish();
  }

  private finish(): void {
    this.running = false;
    const n = this.samples.length;
    if (n === 0) return;

    let sumFrame = 0;
    let sumCpu = 0;
    let maxFrame = 0;
    for (const s of this.samples) {
      sumFrame += s.frameMs;
      sumCpu += s.cpuStepMs;
      if (s.frameMs > maxFrame) maxFrame = s.frameMs;
    }
    const avgFrame = sumFrame / n;
    const avgCpu = sumCpu / n;
    const avgFps = avgFrame > 0 ? 1000 / avgFrame : 0;

    const summary =
      `benchmark: ${n} frames over ${(this.durationMs / 1000).toFixed(0)}s | ` +
      `count=${this.particleCount} | avg ${avgFrame.toFixed(2)}ms (${avgFps.toFixed(1)} fps) | ` +
      `avg cpu/step ${avgCpu.toFixed(3)}ms | worst frame ${maxFrame.toFixed(2)}ms`;
    // eslint-disable-next-line no-console
    console.log(summary);

    this.exportCsv();
    this.onDone?.(summary);
  }

  private exportCsv(): void {
    const header = 'frame,t_ms,frame_ms,cpu_step_ms,particle_count\n';
    const rows = this.samples
      .map((s, i) => `${i},${s.t.toFixed(2)},${s.frameMs.toFixed(3)},${s.cpuStepMs.toFixed(4)},${this.particleCount}`)
      .join('\n');
    const blob = new Blob([header + rows + '\n'], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `particle-life-3d-bench-${this.particleCount}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
