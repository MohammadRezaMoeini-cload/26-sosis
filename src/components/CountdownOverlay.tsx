import React, { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  seconds?: number; // default 3
  onComplete: () => void;
  message?: string;
  zIndexClass?: string; // optional tailwind z class
};

export default function CountdownOverlay({ open, seconds = 3, onComplete, message = 'Recording starts in', zIndexClass = 'z-[7000]' }: Props) {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (!open) return;
    setCount(seconds);
  }, [open, seconds]);

  useEffect(() => {
    if (!open) return;
    if (count <= 0) { onComplete?.(); return; }
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [open, count, onComplete]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/70`}>
      <div className="relative w-[min(92vw,520px)] rounded-2xl border border-slate-700 bg-slate-900/60 backdrop-blur-xl shadow-2xl p-8 text-center">
        <div className="text-slate-200 text-base mb-3">{message}</div>
        <div className="mx-auto mb-2 w-28 h-28 md:w-36 md:h-36 rounded-full bg-white/5 flex items-center justify-center ring-1 ring-white/10">
          <div className="text-5xl md:text-6xl font-bold text-sky-300 drop-shadow-sm select-none">{count}</div>
        </div>
        <div className="text-slate-400 text-sm">Get ready…</div>
      </div>
    </div>
  );
}

