import React from 'react';

type Props = {
  open: boolean;
  progress: number; // 0..100
  title?: string;
  subtitle?: string;
};

export default function LoadingOverlay({ open, progress, title = 'Processing…', subtitle }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress || 0)));
  return (
    <div
      className="fixed inset-0 z-[5000] flex items-center justify-center"
      style={{ display: open ? 'flex' : 'none', background: 'rgba(3,6,20,0.55)', backdropFilter: 'blur(2px)' }}
      aria-hidden={!open}
    >
      <div className="w-[min(420px,92vw)] rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="relative w-10 h-10">
            <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
              <circle cx="18" cy="18" r="16" className="text-slate-700" stroke="currentColor" strokeWidth="4" fill="none" />
              <circle
                cx="18" cy="18" r="16"
                strokeLinecap="round"
                className="text-emerald-400 transition-all duration-150"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${(pct/100)*100} ${100}`}
                pathLength={100}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-emerald-300">{pct}%</div>
          </div>
          <div className="min-w-0">
            <div className="text-slate-100 font-semibold leading-tight">{title}</div>
            {subtitle && <div className="text-slate-400 text-sm leading-tight truncate">{subtitle}</div>}
          </div>
        </div>
        <div className="w-full h-3 bg-slate-800/80 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-150" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 text-slate-400 text-xs">Do not close the tab while processing.</div>
      </div>
    </div>
  );
}

