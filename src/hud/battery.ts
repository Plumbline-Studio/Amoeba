/**
 * Battery readout (PLAN §6). Attempts `navigator.getBattery()` and reports
 * level/charging IF available, clearly labeled "unavailable" otherwise — the
 * API is removed in Safari/Firefox and restricted in Chrome, so the web cannot
 * reliably measure power. Native tools (README §battery) give the real watts.
 */

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

type WithBattery = Navigator & {
  getBattery?: () => Promise<BatteryManager>;
};

export interface BatteryReadout {
  /** Human-readable status line for the HUD. */
  text(): string;
}

export function createBatteryReadout(): BatteryReadout {
  let battery: BatteryManager | null = null;
  let supported = false;

  const nav = navigator as WithBattery;
  if (typeof nav.getBattery === 'function') {
    nav
      .getBattery()
      .then((b) => {
        battery = b;
        supported = true;
      })
      .catch(() => {
        supported = false;
      });
  }

  return {
    text(): string {
      if (!supported || !battery) return 'battery    unavailable';
      const pct = Math.round(battery.level * 100);
      return `battery    ${pct}% ${battery.charging ? '(charging)' : ''}`.trimEnd();
    },
  };
}
