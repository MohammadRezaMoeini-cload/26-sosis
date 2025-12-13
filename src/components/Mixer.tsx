import React, { useEffect, useRef } from 'react';
import { Track } from '../engine/types';
import TrackStrip from './TrackStrip';

type Props = {
  analyser: AnalyserNode;
  tracks: Track[];
  onGain: (id: string, v: number) => void;
  onPan: (id: string, v: number) => void;
  onMute: (id: string, v: boolean) => void;
  onSolo: (id: string, v: boolean) => void;
  renderTrackExtras?: (id: string) => Float32Array | undefined;
};

function Mixer({ analyser, tracks, onGain, onPan, onMute, onSolo, renderTrackExtras }: Props) {
  const meterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf: number;
    const loop = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / (data.length || 1);
      const pct = Math.min(100, (avg / 255) * 100);
      if (meterRef.current) meterRef.current.style.width = pct.toFixed(1) + '%';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Mixer</h3>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 w-0" ref={meterRef} />
      </div>
      <div>
        {tracks.map(t => (
          <TrackStrip key={t.id} track={t}
            onGain={(v) => onGain(t.id, v)}
            onPan={(v) => onPan(t.id, v)}
            onMute={(v) => onMute(t.id, v)}
            onSolo={(v) => onSolo(t.id, v)}
            wave={renderTrackExtras ? renderTrackExtras(t.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(Mixer, (prev, next) => {
  // Ignore function identity; skip rerender if analyser, tracks, and extras renderer are unchanged
  return prev.analyser === next.analyser && prev.tracks === next.tracks && prev.renderTrackExtras === next.renderTrackExtras;
});
