import React, { useEffect, useRef } from 'react';

export function fmt(sec: number, withMs = false) {
  const ms = Math.floor(Math.max(0, sec) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mss = ms % 1000;
  const base = (h > 0)
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
  return withMs ? `${base}:${String(mss).padStart(3, '0')}` : base;
}

function SecondCell({ left, width, second, pxPerSec }: { left: number; width: number; second: number; pxPerSec: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    const h = 12;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    // Sub-tick density target
    const target = 12; // px between ticks
    const subdiv = Math.max(2, Math.min(20, Math.round(width / target)));
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.beginPath();
    for (let i = 1; i < subdiv; i++) {
      const x = Math.round((i / subdiv) * width) + 0.5;
      const tall = (i % Math.max(1, Math.floor(subdiv / 2)) === 0);
      const mid = (i % Math.max(1, Math.floor(subdiv / 4)) === 0);
      const top = tall ? 0 : (mid ? 3 : 6);
      ctx.moveTo(x, top);
      ctx.lineTo(x, h);
    }
    ctx.stroke();
  }, [width, pxPerSec]);

  return (
    <div style={{ position: 'absolute', left, top: 0, width, height: 32, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, bottom: 0, width, height: 12 }}>
        <canvas ref={ref} style={{ width, height: 12 }} />
      </div>
      <div style={{ position: 'absolute', left: 4, top: 2, color: '#e5e7eb', fontSize: 11, fontWeight: 600, textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
        {fmt(second)}
      </div>
    </div>
  );
}

type RulerOverlayProps = {
  laneInfoW: number;
  pxPerSec: number;
  scrollX: number;
  time: number;
  duration: number;
  viewportWidth: number; // ruler container clientWidth
};

export default function RulerOverlay({ laneInfoW, pxPerSec, scrollX, time, duration, viewportWidth }: RulerOverlayProps) {
  const startSec = Math.max(0, Math.floor((scrollX - laneInfoW) / pxPerSec));
  const endSec = Math.max(0, Math.ceil((scrollX + viewportWidth - laneInfoW) / pxPerSec));
  const nodes: JSX.Element[] = [];
  for (let s = startSec; s <= endSec; s++) {
    const left = Math.round(laneInfoW + s * pxPerSec - scrollX);
    const width = Math.max(1, Math.round(pxPerSec));
    nodes.push(<SecondCell key={`sec-${s}`} left={left} width={width} second={s} pxPerSec={pxPerSec} />);
  }

  return (
    <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 32, pointerEvents: 'none' }}>
      {nodes}
      {/* Playhead bubble */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: Math.round(laneInfoW - scrollX + Math.max(0, time) * pxPerSec),
          transform: 'translateX(-50%)',
          padding: '1px 6px',
          fontSize: 11,
          lineHeight: '14px',
          color: '#e2e8f0',
          background: 'rgba(2,6,23,0.85)',
          border: '1px solid rgba(148,163,184,0.35)',
          borderRadius: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 12 }}>{fmt(Math.max(0, time), false)}</span>
        <span style={{ fontSize: 10, opacity: 0.85 }}>{`:${String(Math.floor(Math.max(0, time) * 1000) % 1000).padStart(3, '0')}`}</span>
      </div>
    </div>
  );
}

