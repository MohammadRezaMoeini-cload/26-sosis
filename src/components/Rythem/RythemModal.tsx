import React, { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  // Called with the rendered AudioBuffer and a suggested name
  onCommit: (buffer: AudioBuffer, name: string) => Promise<void> | void;
  // Optional: control host transport from modal
  onHostPlay?: () => void;
  onHostPause?: () => void;
  // Optional default duration for render (seconds)
  defaultDurationSec?: number;
  // Optional: import a recorded mic file into host (legacy path compatible)
  onImportFile?: (file: File) => Promise<void> | void;
};

type StepGrid = boolean[][]; // [row][step]

// Simple synth voices (kick/snare/closed hat/open hat) for preview and render
function createPreviewContext(): AudioContext {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
}

function now(ctx: BaseAudioContext) {
  return (ctx as any).currentTime || 0;
}

function playKick(ctx: AudioContext | OfflineAudioContext, when = 0, dur = 0.18) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, when);
  (osc.frequency as any).exponentialRampToValueAtTime(50, when + dur);
  gain.gain.setValueAtTime(1, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  osc.connect(gain);
  gain.connect((ctx as any).destination || (ctx as any));
  try { (osc as any).start(when); (osc as any).stop(when + dur); } catch { }
}

function makeNoiseBuffer(ctx: BaseAudioContext, lengthSec = 0.2) {
  const sr = ctx.sampleRate; const len = Math.max(1, Math.floor(lengthSec * sr));
  const buf = ctx.createBuffer(1, len, sr); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
  return buf;
}

function playSnare(ctx: AudioContext | OfflineAudioContext, when = 0, dur = 0.16) {
  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf;
  const noiseFilter = (ctx as any).createBiquadFilter ? (ctx as any).createBiquadFilter() : null;
  if (noiseFilter) { noiseFilter.type = 'highpass'; (noiseFilter as any).frequency.setValueAtTime(1500, when); }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.9, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  if (noiseFilter) { noise.connect(noiseFilter); noiseFilter.connect(gain); } else { noise.connect(gain); }
  gain.connect((ctx as any).destination || (ctx as any));
  try { (noise as any).start(when); (noise as any).stop(when + dur); } catch { }
}

function playHat(ctx: AudioContext | OfflineAudioContext, when = 0, open = false) {
  const dur = open ? 0.28 : 0.06;
  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource(); noise.buffer = noiseBuf;
  const band = (ctx as any).createBiquadFilter ? (ctx as any).createBiquadFilter() : null;
  if (band) { band.type = 'highpass'; (band as any).frequency.setValueAtTime(8000, when); }
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
  if (band) { noise.connect(band); band.connect(gain); } else { noise.connect(gain); }
  gain.connect((ctx as any).destination || (ctx as any));
  try { (noise as any).start(when); (noise as any).stop(when + dur); } catch { }
}

function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 32 = 16) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  const writeString = (off: number, str: string) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
  writeString(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); writeString(8, 'WAVE');
  writeString(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * blockAlign, true); dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, bitDepth, true); writeString(36, 'data'); dv.setUint32(40, dataSize, true);
  const channels: Float32Array[] = Array.from({ length: numCh }, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, (channels[ch]![i] || 0)));
      if (bitDepth === 16) { const v = s < 0 ? s * 0x8000 : s * 0x7FFF; dv.setInt16(offset, v, true); offset += 2; }
      else { dv.setInt32(offset, s < 0 ? s * 0x80000000 : s * 0x7FFFFFFF, true); offset += 4; }
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

export default function RythemModal({ open, onClose, onCommit, onHostPlay, onHostPause, defaultDurationSec, onImportFile }: Props) {
  const [bpm, setBpm] = useState(120);
  const [steps, setSteps] = useState(16);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const previewCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const names = ['Kick', 'Snare', 'Closed Hat', 'Open Hat'];
  const [grid, setGrid] = useState<StepGrid>(() => Array.from({ length: 4 }, () => Array.from({ length: 16 }, () => false)));
  const [durationSec, setDurationSec] = useState<number>(() => Math.max(1, Math.floor((defaultDurationSec || 8) * 10) / 10));
  const [hostRunning, setHostRunning] = useState(false);
  // Mic recording
  const recMediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<any>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  useEffect(() => { if (!open) { stopPreview(); setCurrentStep(0); } }, [open]);

  const stepDur = useMemo(() => 60 / Math.max(1, bpm) / 4, [bpm]); // 16th note

  function ensureCtx() { if (!previewCtxRef.current) previewCtxRef.current = createPreviewContext(); return previewCtxRef.current; }

  function stopPreview() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setPlaying(false);
  }

  function togglePlay() {
    if (playing) { stopPreview(); return; }
    const ctx = ensureCtx();
    setPlaying(true);
    const startAt = now(ctx);
    setCurrentStep((s) => s);
    const tick = () => {
      setCurrentStep((prev) => {
        const s = (prev % steps);
        // fire currently active steps
        grid.forEach((row, i) => {
          if (row[s]) {
            const when = now(ctx) + 0.001; // immediate
            if (i === 0) playKick(ctx, when);
            else if (i === 1) playSnare(ctx, when);
            else if (i === 2) playHat(ctx, when, false);
            else playHat(ctx, when, true);
          }
        });
        return (s + 1) % steps;
      });
    };
    tick();
    timerRef.current = window.setInterval(tick, Math.max(10, stepDur * 1000));
  }

  async function renderToBuffer(): Promise<AudioBuffer> {
    const sr = (previewCtxRef.current || createPreviewContext()).sampleRate;
    const total = Math.max(0.25, durationSec || 1);
    const offline = new OfflineAudioContext(2, Math.ceil((total + 0.5) * sr), sr);
    const loopLen = steps * stepDur;
    // Repeat the programmed pattern until total duration
    for (let loopStart = 0; loopStart < total - 1e-6; loopStart += loopLen) {
      for (let s = 0; s < steps; s++) {
        const t = loopStart + s * stepDur;
        if (t > total) break;
        grid.forEach((row, i) => {
          if (!row[s]) return;
          if (i === 0) playKick(offline, t);
          else if (i === 1) playSnare(offline, t);
          else if (i === 2) playHat(offline, t, false);
          else playHat(offline, t, true);
        });
      }
    }
    const rendered = await offline.startRendering();
    return rendered;
  }

  async function handleCommit() {
    try {
      const buf = await renderToBuffer();
      const name = `Rhythm ${bpm}bpm`;
      await onCommit(buf, name);
      onClose();
    } catch (e) { console.error(e); }
  }

  function clearGrid() { setGrid(Array.from({ length: 4 }, () => Array.from({ length: steps }, () => false))); setCurrentStep(0); }
  function randomize() {
    setGrid(Array.from({ length: 4 }, (_, r) => Array.from({ length: steps }, () => Math.random() < (r === 0 ? 0.3 : r === 1 ? 0.25 : 0.2))));
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: open ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', zIndex: 3005,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(920px, 98vw)', background: '#0b1220', color: '#e5e7eb', border: '1px solid #243145', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid #243145' }}>
          <div style={{ fontWeight: 600 }}>Rhythm Sequencer</div>
          <button onClick={onClose} style={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8, padding: '6px 10px' }}>Close</button>
        </div>

        {/* Full-width grid */}
        <div style={{ overflowX: 'auto', padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `110px repeat(${steps}, minmax(18px, 1fr))`, gap: 6, alignItems: 'center', minWidth: '600px' }}>
            {names.map((n, r) => (
              <React.Fragment key={r}>
                <div style={{ textAlign: 'right', paddingRight: 8, opacity: 0.9 }}>{n}</div>
                {Array.from({ length: steps }).map((_, c) => {
                  const active = !!(grid[r] && grid[r][c]);
                  const isPlayhead = playing && c === currentStep;
                  const beat = (c % 4) === 0;
                  return (
                    <button
                      key={c}
                      onClick={() => setGrid((g) => {
                        const next = g.map(row => row.slice());
                        if (next[r] && typeof next[r][c] !== 'undefined') {
                          next[r][c] = !next[r][c];
                        }
                        return next;
                      })}
                      style={{ height: 24, borderRadius: 6, cursor: 'pointer', border: `1px solid ${beat ? '#334155' : '#223048'}`, background: isPlayhead ? (active ? '#22c55e' : '#64748b') : (active ? '#0ea5e9' : '#0f172a') }}
                      title={`${n} – step ${c + 1}`}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Footer controls: compact icons + settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderTop: '1px solid #243145', flexWrap: 'wrap' }}>
          {/* Left: transport + actions (icon-only) */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={togglePlay} title={playing ? 'Stop Pattern' : 'Play Pattern'}
              style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: '#1f2937', border: '1px solid #374151', color: '#9ca3af', borderRadius: 8 }}>
              {playing ? (
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 6h4v12H6zm8 0h4v12h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            {/* Record mic while preview plays */}
            <button
              onClick={async () => {
                if (!recording) {
                  try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    recMediaRef.current = stream;
                    const MR: any = (window as any).MediaRecorder || (globalThis as any).MediaRecorder;
                    const rec = new MR(stream, { mimeType: 'audio/webm' });
                    recChunksRef.current = [];
                    rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) recChunksRef.current.push(e.data); };
                    rec.onstop = async () => {
                      const blob = new Blob(recChunksRef.current, { type: 'audio/webm' });
                      const file = new File([blob], `Rhythm-Recording-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`, { type: 'audio/webm' });
                      try { await onImportFile?.(file); } catch (e) { console.error(e); }
                      recChunksRef.current = [];
                    };
                    recRef.current = rec;
                    rec.start(100);
                    setRecording(true);
                  } catch (e) { console.error(e); }
                } else {
                  try { recRef.current?.stop(); } catch {}
                  try { recMediaRef.current?.getTracks().forEach(t => t.stop()); } catch {}
                  recRef.current = null; recMediaRef.current = null;
                  setRecording(false);
                }
              }}
              title={recording ? 'Stop Recording' : 'Record Mic'}
              style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: recording ? '#7f1d1d' : '#991b1b', border: '1px solid #b91c1c', color: '#fee2e2', borderRadius: 8 }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>
            </button>
            <button onClick={() => { if (!hostRunning) { try { onHostPlay?.(); } catch { } setHostRunning(true); } else { try { onHostPause?.(); } catch { } setHostRunning(false); } }}
              title={hostRunning ? 'Stop Mix' : 'Play Mix'}
              style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: hostRunning ? '#7f1d1d' : '#064e3b', border: `1px solid ${hostRunning ? '#991b1b' : '#065f46'}`, color: '#d1fae5', borderRadius: 8 }}>
              {hostRunning ? (
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 6h4v12H6zm8 0h4v12h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button onClick={clearGrid} title="Clear"
              style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: '#111827', border: '1px solid #374151', color: '#9ca3af', borderRadius: 8 }}>
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 7H5v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7zM8 7V5h8v2h5v2H3V7h5z" /></svg>
            </button>

            <button onClick={async () => { const buf = await renderToBuffer(); const blob = audioBufferToWav(buf, 16); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `rhythm-${bpm}bpm.wav`; document.body.appendChild(a); a.click(); document.body.removeChild(a); }} title="Preview WAV"
              style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', background: '#0ea5e9', border: '1px solid #0284c7', color: '#002130', borderRadius: 8 }}>
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M5 20h14v-2H5v2zM12 2 6.5 7.5l1.4 1.4L11 5.8V14h2V5.8l3.1 3.1 1.4-1.4L12 2z" /></svg>
            </button>
          </div>

          {/* Middle: compact settings */}
          <div style={{ display: 'flex', gap: 10, marginLeft: 4, flex: 1, flexWrap: 'wrap' }}>
            <label title="BPM" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>BPM</span>
              <input type="number" min={40} max={300} value={bpm} onChange={(e) => setBpm(Math.max(40, Math.min(300, parseInt(e.target.value || '120', 10))))}
                style={{ background: '#0f172a', border: '1px solid #1f2a3b', color: '#fff', padding: '4px 6px', borderRadius: 6, width: 70 }} />
            </label>
            <label title="Duration (sec)" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Duration</span>
              <input type="number" min={1} step={0.25} value={durationSec}
                onChange={(e) => setDurationSec(Math.max(1, parseFloat(e.target.value || '1')))}
                style={{ background: '#0f172a', border: '1px solid #1f2a3b', color: '#fff', padding: '4px 6px', borderRadius: 6, width: 90 }} />
            </label>
            <label title="Steps" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, opacity: 0.75 }}>Steps</span>
              <select value={steps} onChange={(e) => { const v = parseInt(e.target.value, 10); setSteps(v); setGrid((prev) => prev.map(r => Array.from({ length: v }, (_, i) => r[i] || false))); setCurrentStep(0); }}
                style={{ background: '#0f172a', border: '1px solid #1f2a3b', color: '#fff', padding: '4px 6px', borderRadius: 6, width: 80 }}>
                {[8, 12, 16, 24, 32].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>

          {/* Right: commit */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: '#1f2937', border: '1px solid #374151', color: '#e5e7eb', borderRadius: 8, padding: '8px 12px' }}>Cancel</button>
            <button onClick={handleCommit} style={{ background: '#22c55e', border: '1px solid #16a34a', color: '#052e16', borderRadius: 8, padding: '8px 12px', fontWeight: 600 }}>Add To Mix</button>
          </div>
        </div>
      </div>
    </div>
  );
}
