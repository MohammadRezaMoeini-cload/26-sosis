import React from 'react';
import { Track } from '../engine/types';
import TrackWave from './TrackWave';

type Props = {
  track: Track;
  onGain: (v: number) => void;
  onPan: (v: number) => void;
  onMute: (v: boolean) => void;
  onSolo: (v: boolean) => void;
  // optional static waveform
  wave?: Float32Array;
  onOpenFx?: () => void;
};

function TrackStrip({ track, onGain, onPan, onMute, onSolo, wave, onOpenFx }: Props) {
  const gainVal = track.gain.gain.value;
  const panVal = track.pan?.pan.value ?? 0;
  const toDb = (g: number) => {
    if (g <= 0) return -60;
    const db = 20 * Math.log10(g);
    return Math.max(-60, Math.min(12, db));
  };
  const dbVal = toDb(gainVal);

  return (
    <div className="rounded-lg border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-800 p-3 shadow-inner">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="px-2 py-1 rounded-md bg-gradient-to-b from-slate-800 to-slate-700 text-white font-semibold shadow">
          {track.name}
        </div>
        <button onClick={onOpenFx} className="text-xs px-2 py-0.5 rounded bg-slate-700 text-white shadow hover:bg-slate-600">FX</button>
      </div>

      {/* Optional mini wave */}
      {wave && (
        <div className="mt-1 mb-2"><TrackWave data={wave} /></div>
      )}

      {/* Gain */}
      <div className="text-[11px] text-slate-300 flex items-baseline gap-2">
        <span className="w-8 text-right">-60</span>
        <span> dB Gain: <span className="text-amber-300 tabular-nums">{dbVal.toFixed(1)}</span></span>
        <span className="ml-auto w-6 text-left">12</span>
      </div>
      <input
        className="mm-range w-full my-1"
        type="range" min={0} max={2} step={0.01} value={gainVal}
        onChange={(e) => onGain(parseFloat(e.target.value))}
      />

      {/* Pan */}
      <div className="text-[11px] text-slate-300 flex items-baseline gap-2 mt-2">
        <span className="w-4 text-right">L</span>
        <span> Pan: <span className="text-sky-300 tabular-nums">{panVal.toFixed(2)}</span></span>
        <span className="ml-auto w-4 text-left">R</span>
      </div>
      <input
        className="mm-range w-full my-1"
        type="range" min={-1} max={1} step={0.01} value={panVal}
        onChange={(e) => onPan(parseFloat(e.target.value))}
      />

      {/* Buttons */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <button
          className={`px-3 py-1.5 rounded bg-white text-slate-900 border border-slate-300 shadow ${track.muted ? 'ring-2 ring-emerald-400' : ''}`}
          onClick={() => onMute(!track.muted)}
        >
          Mute
        </button>
        <button
          className={`px-3 py-1.5 rounded bg-white text-slate-900 border border-slate-300 shadow ${track.solo ? 'ring-2 ring-emerald-400' : ''}`}
          onClick={() => onSolo(!track.solo)}
        >
          Solo
        </button>
      </div>

      {/* Decorative meter stripes */}
      <div className="mt-2 grid gap-1">
        <div className="h-[3px] bg-slate-600 rounded" />
        <div className="h-[3px] bg-slate-500 rounded" />
        <div className="h-[3px] bg-slate-400 rounded" />
      </div>
    </div>
  );
}

export default React.memo(TrackStrip, (prev, next) => {
  // Compare only values actually rendered
  const pg = prev.track.gain.gain.value;
  const ng = next.track.gain.gain.value;
  const pp = prev.track.pan?.pan.value ?? 0;
  const np = next.track.pan?.pan.value ?? 0;
  return (
    prev.track.id === next.track.id &&
    prev.track.name === next.track.name &&
    prev.track.muted === next.track.muted &&
    prev.track.solo === next.track.solo &&
    pg === ng &&
    pp === np &&
    prev.wave === next.wave
  );
});
