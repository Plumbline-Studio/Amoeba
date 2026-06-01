/**
 * Stats overlay (PLAN §6). The demo's HUD and the measurement rig in one:
 * FPS (EMA), frame time, CPU time per step(), particle count, draw calls and
 * buffer-upload bytes. Pure DOM — owns a fixed-position panel it renders into.
 */

export interface FrameStats {
  particleCount: number;
  drawCalls: number;
  uploadBytes: number;
  /** Wall time spent inside engine step() this frame, ms. */
  cpuStepMs: number;
  /** Active FPS cap (0 = uncapped). */
  fpsCap: number;
  /** Battery status line ("unavailable" when the API is restricted). */
  battery: string;
  /** Optional transient status (e.g. benchmark progress). */
  note?: string;
}

export class StatsOverlay {
  private el: HTMLDivElement;

  // Exponential moving averages keep the readout legible instead of jittery.
  private emaFrameMs = 16.7;
  private readonly alpha = 0.1;
  private lastFlush = 0;

  constructor(parent: HTMLElement = document.body) {
    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position: 'fixed',
      top: '8px',
      left: '8px',
      padding: '8px 10px',
      font: '11px/1.45 ui-monospace, Menlo, Consolas, monospace',
      color: '#9feaff',
      background: 'rgba(4, 10, 18, 0.55)',
      border: '1px solid rgba(80, 200, 255, 0.25)',
      borderRadius: '6px',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      zIndex: '10',
      textShadow: '0 0 6px rgba(40,180,255,0.4)',
    } as CSSStyleDeclaration);
    parent.appendChild(this.el);
  }

  /** Feed one frame's timing. Call once per rAF. */
  update(frameMs: number, now: number, stats: FrameStats): void {
    this.emaFrameMs += (frameMs - this.emaFrameMs) * this.alpha;

    // Throttle DOM writes to ~6.7Hz so the text is readable and cheap.
    if (now - this.lastFlush < 150) return;
    this.lastFlush = now;

    const fps = this.emaFrameMs > 0 ? 1000 / this.emaFrameMs : 0;
    const cap = stats.fpsCap > 0 ? ` (cap ${stats.fpsCap})` : '';
    const lines = [
      `FPS        ${fps.toFixed(1)}${cap}`,
      `frame      ${this.emaFrameMs.toFixed(2)} ms`,
      `cpu/step   ${stats.cpuStepMs.toFixed(3)} ms`,
      `particles  ${stats.particleCount.toLocaleString()}`,
      `draw calls ${stats.drawCalls}`,
      `upload     ${formatBytes(stats.uploadBytes)}`,
      stats.battery,
    ];
    if (stats.note) lines.push(stats.note);
    this.el.textContent = lines.join('\n');
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
