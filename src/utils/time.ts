// Shared time formatting utilities

// Format 0:00[:mmm]
export function fmt(sec: number, withMs = false): string {
  if (!Number.isFinite(sec)) sec = 0;
  const ms = Math.floor(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mss = ms % 1000;
  const base = (h > 0)
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
  return withMs ? `${base}:${String(mss).padStart(3, '0')}` : base;
}

