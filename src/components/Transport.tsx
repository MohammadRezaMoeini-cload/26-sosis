import React, { useMemo, useState } from 'react';
import { fmt } from '../utils/time';

type Props = {
  playing: boolean;
  time: number;
  duration: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (t: number) => void;
  onSplit?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onOpenMetronome?: () => void;
  onRecord?: () => void;
  recording?: boolean;
  // timeline zoom controls in footer
  zoom?: number;
  onZoom?: (z: number) => void;
  // Quick rhythm hit
  onAddRhythmHit?: (opts: { kind: 'click' | 'tabla' | 'piano'; bpm: number }) => void;
};

export default function Transport({ playing, time, duration, onPlay, onPause, onSeek, onSplit, onUndo, onRedo, canUndo, canRedo, onOpenMetronome, onRecord, recording, zoom, onZoom, onAddRhythmHit }: Props) {
  const pct = useMemo(() => duration > 0 ? Math.max(0, Math.min(100, (time / duration) * 100)) : 0, [time, duration]);
  const [rk, setRk] = useState<'click' | 'tabla' | 'piano'>('click');
  const [rbpm, setRbpm] = useState<number>(120);

  // time readout uses shared fmt for consistency with timeline ruler

  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-3">
      {/* Play/Pause */}
      <button className="mm-ico-btn" title={playing ? 'Pause' : 'Play'} onClick={playing ? onPause : onPlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M8 5C6.895 5 6 5.895 6 7L6 17C6 18.105 6.895 19 8 19C9.105 19 10 18.105 10 17L10 7C10 5.895 9.105 5 8 5 z M 16 5C14.895 5 14 5.895 14 7L14 17C14 18.105 14.895 19 16 19C17.105 19 18 18.105 18 17L18 7C18 5.895 17.105 5 16 5 z" fill="#EFEFE7" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
            <path d="M11.396484 4.1113281C9.1042001 4.2020187 7 6.0721788 7 8.5917969L7 39.408203C7 42.767694 10.742758 44.971891 13.681641 43.34375L41.490234 27.935547C44.513674 26.260259 44.513674 21.739741 41.490234 20.064453L13.681641 4.65625C12.94692 4.2492148 12.160579 4.0810979 11.396484 4.1113281 z" fill="#EFEFE7" />
          </svg>
        )}
      </button>

      {/* Record */}
      <button className={`mm-ico-btn ${recording ? 'mm-ico-btn--ok' : ''}`} title={recording ? 'Stop Recording' : 'Record'} onClick={onRecord} aria-label="Record">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <path d="M32 0C24.28125 0 18 6.28125 18 14L18 22L13 22C11.898438 22 11 22.898438 11 24L11 26C11 27.101563 11.898438 28 13 28L14 28L14 30C14 38.550781 19.996094 45.710938 28 47.535156L28 52L25.65625 52C24.320313 52 23.066406 52.519531 22.121094 53.464844L19.585938 56L15 56C13.347656 56 12 57.347656 12 59C12 60.652344 13.347656 62 15 62L44.105469 62C46.105469 63.261719 48.464844 64 51 64C58.167969 64 64 58.167969 64 51C64 43.832031 58.167969 38 51 38C49.929688 38 48.894531 38.144531 47.898438 38.390625C49.230469 35.882813 50 33.03125 50 30L50 28L51 28C52.101563 28 53 27.101563 53 26L53 24C53 22.898438 52.101563 22 51 22L46 22L46 14C46 6.28125 39.71875 0 32 0 Z M 32 2C37.214844 2 41.648438 5.347656 43.300781 10L37 10C36.445313 10 36 10.449219 36 11C36 11.550781 36.445313 12 37 12L43.816406 12C43.929688 12.652344 44 13.316406 44 14L37 14C36.445313 14 36 14.449219 36 15C36 15.550781 36.445313 16 37 16L44 16L44 18L37 18C36.445313 18 36 18.449219 36 19C36 19.550781 36.445313 20 37 20L44 20L44 30C44 36.617188 38.617188 42 32 42C25.382813 42 20 36.617188 20 30L20 20L27 20C27.554688 20 28 19.550781 28 19C28 18.449219 27.554688 18 27 18L20 18L20 16L27 16C27.554688 16 28 15.550781 28 15C28 14.449219 27.554688 14 27 14L20 14C20 13.316406 20.070313 12.652344 20.183594 12L27 12C27.554688 12 28 11.550781 28 11C28 10.449219 27.554688 10 27 10L20.699219 10C22.351563 5.347656 26.785156 2 32 2 Z M 22 23C21.445313 23 21 23.449219 21 24L21 26C21 26.550781 21.445313 27 22 27C22.554688 27 23 26.550781 23 26L23 24C23 23.449219 22.554688 23 22 23 Z M 27 23C26.445313 23 26 23.449219 26 24L26 26C26 26.550781 26.445313 27 27 27C27.554688 27 28 26.550781 28 26L28 24C28 23.449219 27.554688 23 27 23 Z M 32 23C31.445313 23 31 23.449219 31 24L31 26C31 26.550781 31.445313 27 32 27C32.554688 27 33 26.550781 33 26L33 24C33 23.449219 32.554688 23 32 23 Z M 37 23C36.445313 23 36 23.449219 36 24L36 26C36 26.550781 36.445313 27 37 27C37.554688 27 38 26.550781 38 26L38 24C38 23.449219 37.554688 23 37 23 Z M 42 23C41.445313 23 41 23.449219 41 24L41 26C41 26.550781 41.445313 27 42 27C42.554688 27 43 26.550781 43 26L43 24C43 23.449219 42.554688 23 42 23 Z M 13 24L18 24L18 26L13 26 Z M 46 24L51 24L51 26L46 26 Z M 16 28L18 28L18 30C18 37.71875 24.28125 44 32 44C39.71875 44 46 37.71875 46 30L46 28L48 28L48 30C48 33.601563 46.789063 36.914063 44.777344 39.59375C42.972656 40.578125 41.429688 41.980469 40.273438 43.667969C37.855469 45.136719 35.03125 46 32 46C23.179688 46 16 38.820313 16 30 Z M 51 40C57.066406 40 62 44.933594 62 51C62 57.066406 57.066406 62 51 62C44.933594 62 40 57.066406 40 51C40 44.933594 44.933594 40 51 40 Z M 51 44C50.445313 44 50 44.449219 50 45L50 50L45 50C44.445313 50 44 50.449219 44 51C44 51.550781 44.445313 52 45 52L50 52L50 57C50 57.550781 50.445313 58 51 58C51.554688 58 52 57.550781 52 57L52 52L57 52C57.554688 52 58 51.550781 58 51C58 50.449219 57.554688 50 57 50L52 50L52 45C52 44.449219 51.554688 44 51 44 Z M 38.761719 46.65625C38.277344 48.015625 38 49.476563 38 51C38 51.339844 38.023438 51.667969 38.050781 52L36 52L36 47.535156C36.953125 47.316406 37.875 47.019531 38.761719 46.65625 Z M 30 47.882813C30.65625 47.957031 31.324219 48 32 48C32.675781 48 33.34375 47.957031 34 47.882813L34 52L30 52 Z M 25.65625 54L38.34375 54C38.351563 54 38.355469 54 38.363281 54C38.527344 54.6875 38.734375 55.359375 39.003906 56L22.414063 56L23.535156 54.878906C24.101563 54.3125 24.855469 54 25.65625 54 Z M 15 58L40.0625 58C40.523438 58.71875 41.050781 59.386719 41.640625 60L15 60C14.449219 60 14 59.550781 14 59C14 58.449219 14.449219 58 15 58Z" fill="#EFEFE7" />
        </svg>
      </button>

      {/* Time readout */}
      <div className="px-2 py-1 rounded-lg bg-slate-900/70 border border-slate-700 shadow-inner min-w-[140px] text-center">
        <span className="tabular-nums text-sky-400 font-semibold">{fmt(time)}</span>
        <span className="text-slate-500 mx-1">/</span>
        <span className="tabular-nums text-slate-300">{fmt(duration)}</span>
      </div>

      {/* Seek bar */}
      <div className="hidden md:block flex-1 min-w-[140px] h-2 rounded-full bg-slate-700 overflow-hidden cursor-pointer"
        onTouchStart={(e) => {
          const touch = e.touches[0];
          if (!touch) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
          const t = (x / rect.width) * (duration || 0);
          if (Number.isFinite(t)) onSeek(t);
        }}
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          const t = (x / rect.width) * (duration || 0);
          if (Number.isFinite(t)) onSeek(t);
        }}>
        <div className="h-full bg-sky-500 transition-all" style={{ width: pct + '%' }} />
      </div>

      {/* Zoom in footer */}
      {typeof zoom === 'number' && onZoom && (
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-900/70 border border-slate-700 shadow">
          <span className="text-[11px] text-white/60">Zoom</span>
          <input
            className="mm-range w-36"
            type="range"
            min={10}
            max={1200}
            step={1}
            value={zoom}
            onChange={(e) => onZoom(parseInt(e.target.value))}
          />
          <span className="text-[11px] text-white/60 tabular-nums w-12 text-right">{zoom}</span>
        </div>
      )}

      {/* Quick Rhythm hit */}
      {onAddRhythmHit && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/70 border border-slate-700 shadow">
          <select className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-sm"
            value={rk} onChange={(e) => setRk(e.target.value as any)}>
            <option value="click">Click</option>
            <option value="tabla">Tabla</option>
            <option value="piano">Piano</option>
          </select>
          <input className="mm-ico-input" type="number" min={20} max={300} value={rbpm}
            onChange={(e) => setRbpm(parseInt(e.target.value || '120', 10))} />
          <button className="mm-ico-btn" title="Add Hit at Playhead" onClick={() => onAddRhythmHit({ kind: rk, bpm: rbpm })}>
            <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M11 2h2v11h5v2h-5v5h-2v-5H6v-2h5V2z" /></svg>
          </button>
        </div>
      )}

      {/* Tools */}
      {onSplit && (
        <button className="mm-ico-btn" onClick={onSplit} title="Split selected clip at playhead" aria-label="Split">
          <svg xmlns="http://www.w3.org/2000/svg" fill="#ffff" width="20px" height="20px" viewBox="0 0 24 24" className="__web-inspector-hide-shortcut__">
            <path d="M19.2928932,12 L14,12 L14,19.5 C14,19.7761424 13.7761424,20 13.5,20 C13.2238576,20 13,19.7761424 13,19.5 L13,3.5 C13,3.22385763 13.2238576,3 13.5,3 C13.7761424,3 14,3.22385763 14,3.5 L14,11 L19.2928932,11 L16.1464466,7.85355339 C15.9511845,7.65829124 15.9511845,7.34170876 16.1464466,7.14644661 C16.3417088,6.95118446 16.6582912,6.95118446 16.8535534,7.14644661 L20.8535534,11.1464466 C21.0488155,11.3417088 21.0488155,11.6582912 20.8535534,11.8535534 L16.8535534,15.8535534 C16.6582912,16.0488155 16.3417088,16.0488155 16.1464466,15.8535534 C15.9511845,15.6582912 15.9511845,15.3417088 16.1464466,15.1464466 L19.2928932,12 Z M4.70710678,11 L10,11 L10,3.5 C10,3.22385763 10.2238576,3 10.5,3 C10.7761424,3 11,3.22385763 11,3.5 L11,19.5 C11,19.7761424 10.7761424,20 10.5,20 C10.2238576,20 10,19.7761424 10,19.5 L10,12 L4.70710678,12 L7.85355339,15.1464466 C8.04881554,15.3417088 8.04881554,15.6582912 7.85355339,15.8535534 C7.65829124,16.0488155 7.34170876,16.0488155 7.14644661,15.8535534 L3.14644661,11.8535534 C2.95118446,11.6582912 2.95118446,11.3417088 3.14644661,11.1464466 L7.14644661,7.14644661 C7.34170876,6.95118446 7.65829124,6.95118446 7.85355339,7.14644661 C8.04881554,7.34170876 8.04881554,7.65829124 7.85355339,7.85355339 L4.70710678,11 Z" />
          </svg>
        </button>
      )}
      {onUndo && (
        <button className="mm-ico-btn" disabled={!canUndo} onClick={onUndo} title="Undo" aria-label="Undo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M2 7L2 16 11 16z" fill="#EFEFE7" />
            <path d="M20.084,15.972l2.367-0.789C21.062,11.012,17.138,8,12.5,8c-2.97,0-5.644,1.237-7.55,3.221L6.712,13c1.456-1.535,3.505-2.5,5.788-2.5C16.034,10.5,19.025,12.794,20.084,15.972z" fill="#EFEFE7" />
          </svg>
        </button>
      )}
      {onRedo && (
        <button className="mm-ico-btn" disabled={!canRedo} onClick={onRedo} title="Redo" aria-label="Redo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M22 7L18.384766 10.615234C16.542919 8.9979817 14.145666 8 11.5 8C6.862 8 2.9378281 11.012594 1.5488281 15.183594L3.4394531 15.8125C4.5654531 12.4365 7.745 10 11.5 10C13.59204 10 15.49858 10.767056 16.978516 12.021484L13 16L22 16L22 7 z" fill="#EFEFE7" />
          </svg>
        </button>
      )}
      {onOpenMetronome && (
        <button className="mm-ico-btn" onClick={onOpenMetronome} title="Metronome" aria-label="Metronome">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
            <path d="M27 2.003906C26.761719 2.003906 26.527344 2.089844 26.339844 2.257813L20.410156 7.679688C20.242188 7.832031 20.132813 8.035156 20.097656 8.257813L19.820313 10L17.675781 22.847656L19.417969 24.589844L21.847656 10L23 10L23 28.171875L25 30.171875L25 10L29 10L29 12L27 12L27 14L29 14L29 16L27 16L27 18L29 18L29 20L27 20L27 22L29 22L29 24L27 24L27 26L29 26L29 28L27 28L27 30L29 30L29 32L25.414063 32L12.707031 19.292969L12.746094 19.253906C12.894531 19.105469 12.933594 18.871094 12.839844 18.679688L11.3125 15.621094C11.160156 15.3125 10.75 15.25 10.511719 15.488281L9.707031 16.292969L7.707031 14.292969L6.292969 15.707031L8.292969 17.707031L7.492188 18.511719C7.25 18.75 7.3125 19.15625 7.617188 19.3125L10.675781 20.839844C10.871094 20.9375 11.101563 20.898438 11.253906 20.746094L11.292969 20.707031L17.074219 26.484375L14.015625 44.835938C13.964844 45.125 14.046875 45.421875 14.234375 45.644531C14.425781 45.871094 14.707031 46 15 46C15 47.105469 15.894531 48 17 48C18.105469 48 19 47.105469 19 46L35 46C35 47.105469 35.894531 48 37 48C38.105469 48 39 47.105469 39 46C39.292969 46 39.574219 45.871094 39.765625 45.644531C39.953125 45.421875 40.035156 45.125 39.984375 44.835938L39.015625 39L39.585938 39L40.292969 39.707031C40.542969 39.96875 40.917969 40.074219 41.265625 39.980469C41.617188 39.890625 41.890625 39.617188 41.980469 39.265625C42.074219 38.917969 41.96875 38.542969 41.707031 38.292969L40.707031 37.292969C40.519531 37.105469 40.265625 37 40 37L38.679688 37L38.347656 35L40 35C40.359375 35.003906 40.695313 34.816406 40.878906 34.503906C41.058594 34.191406 41.058594 33.808594 40.878906 33.496094C40.695313 33.183594 40.359375 32.996094 40 33L38.015625 33L34.179688 10L34.183594 10L34.128906 9.695313L33.984375 8.835938C33.984375 8.828125 33.980469 8.824219 33.980469 8.816406L33.882813 8.25C33.847656 8.03125 33.734375 7.832031 33.574219 7.679688L27.65625 2.257813C27.472656 2.089844 27.238281 2.003906 27 2.003906 Z M 31 10L32.152344 10L35.820313 32L31 32 Z M 18.8125 28.222656L22.585938 32L18.183594 32Z" fill="#EFEFE7" />
          </svg>
        </button>
      )}
    </div>
  );
}
