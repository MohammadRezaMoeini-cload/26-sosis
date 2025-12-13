// Legacy time-domain zoom scales derived from MusicRecorder (AudioCat).
// Each entry defines how the top ruler should tick and how many pixels per second the
// timeline should render so ticks align to real time.

export type LegacyScale = {
  pxPerSec: number;
  majorTickPx: number;
  majorTickSec: number; // in seconds
  timeUnit: 'S' | 'MS';
  minorTicksPerMajor: number;
};

// Mirror of audioCat.ui.visualization.TimeDomainScaleManager timeScales_ table.
const RAW: Array<{ majorPx: number; majorTime: number; unit: 'S' | 'MS'; minor: number }> = [
  { majorPx: 60, majorTime: 120, unit: 'S', minor: 3 },
  { majorPx: 60, majorTime: 60, unit: 'S', minor: 3 },
  { majorPx: 60, majorTime: 30, unit: 'S', minor: 3 },
  { majorPx: 60, majorTime: 15, unit: 'S', minor: 3 },
  { majorPx: 60, majorTime: 10, unit: 'S', minor: 3 },
  { majorPx: 60, majorTime: 5, unit: 'S', minor: 3 },
  { majorPx: 60, majorTime: 2, unit: 'S', minor: 3 },
  { majorPx: 60, majorTime: 1, unit: 'S', minor: 3 },
  { majorPx: 80, majorTime: 500, unit: 'MS', minor: 7 },
  { majorPx: 80, majorTime: 250, unit: 'MS', minor: 15 },
];

export const LEGACY_SCALES: LegacyScale[] = RAW.map((r) => {
  const unitsPerSecond = r.unit === 'S' ? 1 : 1000;
  const pxPerSec = (r.majorPx / r.majorTime) * unitsPerSecond;
  const majorTickSec = r.unit === 'S' ? r.majorTime : r.majorTime / 1000;
  return {
    pxPerSec,
    majorTickPx: r.majorPx,
    majorTickSec,
    timeUnit: r.unit,
    minorTicksPerMajor: r.minor,
  };
});

// Pick the nearest legacy scale for a desired px/sec value.
export function pickLegacyScale(pxPerSec: number): LegacyScale {
  const first = LEGACY_SCALES[0]!;
  let best: LegacyScale = first;
  let bestDiff = Math.abs(pxPerSec - best.pxPerSec);
  for (let i = 1; i < LEGACY_SCALES.length; i++) {
    const s = LEGACY_SCALES[i]!;
    const d = Math.abs(pxPerSec - s.pxPerSec);
    if (d < bestDiff) { best = s; bestDiff = d; }
  }
  return best;
}

// Optionally quantize an arbitrary pxPerSec to the exact legacy scale value.
export function quantizePxPerSecToLegacy(pxPerSec: number): number {
  return pickLegacyScale(pxPerSec).pxPerSec;
}

// Format a time as H:MM:SS:MSS like the legacy TimeFormatter for MS; or H:MM:SS for seconds.
export function formatLegacyTimeLabel(sec: number, scale: LegacyScale): string {
  const totalMs = Math.max(0, Math.floor(sec * 1000));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  if (scale.timeUnit === 'MS') {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(ms).padStart(3, '0')}`;
  }
  // Seconds mode: H:MM:SS
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
