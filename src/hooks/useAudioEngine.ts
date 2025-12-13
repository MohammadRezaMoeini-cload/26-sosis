import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../engine/AudioEngine';
import { Track } from '../engine/types';
import { exportMp3ViaWorker, exportWavViaWorker } from '../export';
import { exportProject as exportProjectUtil, importProject as importProjectUtil } from '../project';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine>();
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<Track[]>(engine.getTracks());
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevTrackCountRef = useRef<number>(engine.getTracks().length);

  useEffect(() => {
    const off1 = engine.on('time', setTime);
    const off2 = engine.on('duration', setDuration);
    const off3 = engine.on('tracks', () => {
      const ts = engine.getTracks();
      setTracks(ts);
      try {
        const count = ts.length;
        if (busy && count > prevTrackCountRef.current) {
          setProgress(100);
          // Allow UI a frame to paint the new track/wave, then close
          requestAnimationFrame(() => setTimeout(() => { setBusy(false); setProgress(0); }, 120));
        }
        prevTrackCountRef.current = count;
      } catch {}
    });
    const id = setInterval(() => setPlaying(engineRef.current!.getCurrentTime() > 0 && !!document.hasFocus() && (engineRef.current as any).playing), 500);
    return () => { off1(); off2(); off3(); clearInterval(id); };
  }, [engine]);

  const api = useMemo(() => ({
    engine,
    time, duration, tracks, playing,
    busy, progress,
    deleteTrack(id: string) {
      // Remove the track entirely
      engine.removeTrack(id);
      setTracks(engine.getTracks());
      setDuration(engine.getDuration());
    },
    async importToNewTrack(file: File) {
      setBusy(true); setProgress(0);
      // Read file with progress
      const buf: ArrayBuffer = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.min(60, Math.round((e.loaded / e.total) * 60))); };
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.readAsArrayBuffer(file);
      });
      try {
        setProgress((p)=> Math.max(p, 70));
        const audioBuf = await engine.getContext().decodeAudioData(buf.slice(0));
        setProgress(90);
        const id = engine.createTrack(file.name.replace(/\.[^/.]+$/, ''));
        engine.addClip(id, audioBuf, 0, 0);
        setTracks(engine.getTracks());
        setDuration(engine.getDuration());
        setProgress(100);
      } finally {
        // Give React/Timeline a chance to render waveforms before hiding
        requestAnimationFrame(() => setTimeout(() => { setBusy(false); setProgress(0); }, 180));
      }
    },
    async play() { await engine.play(); },
    pause() { engine.pause(); },
    seek(t: number) { engine.seek(t); },
    playSelection(trackId: string, clipId: string, startAbs: number, endAbs: number) { (engine as any).playSelectionPreview?.(trackId, clipId, startAbs, endAbs); },
    setMasterGain(v: number) { engine.setMasterGain(v); },
    setTrackGain(id: string, v: number) { engine.setTrackGain(id, v); },
    setTrackPan(id: string, v: number) { engine.setTrackPan(id, v); },
    setTrackMute(id: string, v: boolean) { engine.setTrackMute(id, v); },
    setTrackSolo(id: string, v: boolean) { engine.setTrackSolo(id, v); },
    setTrackPlaybackRate(id: string, rate: number) { (engine as any).setTrackPlaybackRate?.(id, rate); },
    setClipPlaybackRate(trackId: string, clipId: string, rate: number) { (engine as any).setClipPlaybackRate?.(trackId, clipId, rate); },
    setGlobalPlaybackRate(rate: number) { (engine as any).setGlobalPlaybackRate?.(rate); },
    getTrackVolumeEnvelopePoints(id: string) { return (engine as any).getTrackVolumeEnvelopePoints?.(id) || []; },
    setTrackVolumeEnvelopePoints(id: string, pts: Array<{time:number; value:number}>) { (engine as any).setTrackVolumeEnvelopePoints?.(id, pts); },
    moveClip(targetTrackId: string, clipId: string, newBegin: number) {
      // Find original track by clip membership
      const from = engine.getTracks().find(t => t.clips.some(c => c.id === clipId))?.id;
      engine.moveClip(from || targetTrackId, clipId, newBegin, targetTrackId);
    },
    deleteClip(trackId: string, clipId: string) { engine.removeClip(trackId, clipId); },
    duplicateClip(trackId: string, clipId: string) { engine.duplicateClip(trackId, clipId); },
    // Per-clip fades
    setClipFade(trackId: string, clipId: string, fadeInSec: number, fadeOutSec: number) { engine.setClipFade(trackId, clipId, Math.max(0, fadeInSec||0), Math.max(0, fadeOutSec||0)); },
    trimClip(trackId: string, clipId: string, newBegin: number, newEnd: number) { engine.trimClip(trackId, clipId, newBegin, newEnd); },
    splitClip(trackId: string, clipId: string, atTimeAbs: number) { engine.splitClip(trackId, clipId, atTimeAbs); },
    // Fast split without history (for double-click)
    splitClipFast(trackId: string, clipId: string, atTimeAbs: number) { engine.splitClip(trackId, clipId, atTimeAbs); setTracks(engine.getTracks()); setDuration(engine.getDuration()); },
    async exportWav() { return exportWavViaWorker(engine, 16); },
    async exportMp3() { return exportMp3ViaWorker(engine, 192); },
    async exportProject() { const r = await exportProjectUtil(engine); return { blob: r.blob, url: r.url, size: r.size, mime: 'application/json' } as any; },
    async importProject(file: File) {
      setBusy(true); setProgress(10);
      try {
        await importProjectUtil(engine, file);
        setProgress(95);
        setTracks(engine.getTracks());
        setDuration(engine.getDuration());
        setProgress(100);
      } finally {
        requestAnimationFrame(() => setTimeout(() => { setBusy(false); setProgress(0); }, 180));
      }
    },
    async renderToNewTrack() {
      setBusy(true); setProgress(10);
      const buf = await engine.renderOffline();
      setProgress(70);
      const id = engine.createTrack('Rendered Mix');
      engine.addClip(id, buf, 0, 0);
      setTracks(engine.getTracks());
      setDuration(engine.getDuration());
      setProgress(100);
      requestAnimationFrame(() => setTimeout(() => { setBusy(false); setProgress(0); }, 180));
    },
    async addRhythmTrack(opts: { kind: 'click'|'tabla'|'piano'; bpm: number; bars: number; subdivision?: 'quarter'|'eighth'; single?: boolean }) {
      setBusy(true); setProgress(5);
      const sr = engine.getContext().sampleRate;
      const beatSec = 60 / Math.max(1, opts.bpm || 120);
      const step = (opts.subdivision === 'eighth') ? beatSec/2 : beatSec;
      const bars = Math.max(1, opts.bars || 1);
      const totalDur = bars * 4 * beatSec; // 4/4 in this UI
      // Build a single-hit buffer (~120ms) we can reuse for all clips
      const hitLen = Math.floor(sr * 0.12);
      const hit = engine.getContext().createBuffer(1, hitLen, sr);
      const data = hit.getChannelData(0);
      for (let i=0;i<hitLen;i++) {
        const t = i / sr;
        const env = Math.exp(-t * (opts.kind==='piano'?8:(opts.kind==='tabla'?14:28)));
        const s1 = Math.sin(2*Math.PI*(opts.kind==='piano'?440:(opts.kind==='tabla'?240:1200))*t);
        const s2 = (opts.kind==='piano') ? 0.4*Math.sin(2*Math.PI*660*t) : (opts.kind==='tabla'?0.25*Math.sin(2*Math.PI*360*t):0);
        data[i] = (s1 + s2) * env * 0.9;
      }
      setProgress(20);
      const ensureTrack = () => {
        const name = `${opts.kind.toUpperCase()} ${opts.bpm}bpm`;
        const t = engine.getTracks().find(tt => (tt as any).name === name)?.id;
        return t || engine.createTrack(name);
      };
      if (opts.single) {
        const at = engine.getCurrentTime();
        const tid = ensureTrack();
        engine.addClip(tid, hit, at, 0, hit.duration);
        setTracks(engine.getTracks()); setDuration(engine.getDuration());
        setProgress(100);
        requestAnimationFrame(() => setTimeout(() => { setBusy(false); setProgress(0); }, 140));
        return;
      }
      // Pattern: add each hit as a separate movable clip
      const tid = engine.createTrack(`${opts.kind.toUpperCase()} ${opts.bpm}bpm`);
      const stepsTotal = Math.max(1, Math.floor(totalDur / step));
      let i = 0;
      for (let t = 0; t < totalDur - 1e-4; t += step) {
        engine.addClip(tid, hit, t, 0, hit.duration);
        i++; if (i % 2 === 0) setProgress(Math.min(95, Math.round((i / stepsTotal) * 95)));
        // yield to UI occasionally
        if (i % 8 === 0) await new Promise(r => setTimeout(r, 0));
      }
      setTracks(engine.getTracks());
      setDuration(engine.getDuration());
      setProgress(100);
      requestAnimationFrame(() => setTimeout(() => { setBusy(false); setProgress(0); }, 160));
    },
    // history API will be filled by wrapper below
  }), [engine, time, duration, tracks, playing, busy, progress]);

  // Wrap with simple undo/redo using state snapshots
  type Snap = { buffers: AudioBuffer[]; tracks: Array<{ name: string; gain: number; pan?: number; muted: boolean; solo: boolean; clips: Array<{ bufIndex: number; beginTime: number; offsetSec: number; durationSec: number; playbackRate?: number; fadeInSec?: number; fadeOutSec?: number }> }> };
  const pastRef = useRef<Snap[]>([]);
  const futureRef = useRef<Snap[]>([]);
  const limit = 50;

  const snapshot = (): Snap => {
    const ts = engine.getTracks();
    const bufMap = new Map<AudioBuffer, number>();
    const buffers: AudioBuffer[] = [];
    const tracksSnap = ts.map(t => {
      const clips = t.clips.map(c => {
        let idx = bufMap.get(c.buffer)!;
        if (idx === undefined) { idx = buffers.push(c.buffer) - 1; bufMap.set(c.buffer, idx); }
        return { bufIndex: idx, beginTime: c.beginTime, offsetSec: c.offsetSec, durationSec: c.durationSec, playbackRate: (c as any).playbackRate || 1, fadeInSec: c.fadeInSec || 0, fadeOutSec: c.fadeOutSec || 0 };
      });
      return { name: (t as any).name || 'Track', gain: t.gain.gain.value, pan: t.pan?.pan.value ?? 0, muted: t.muted, solo: t.solo, clips };
    });
    return { buffers, tracks: tracksSnap };
  };
  const applySnapshot = (s: Snap) => {
    // clear tracks
    for (const t of engine.getTracks()) engine.removeTrack(t.id);
    // rebuild
    s.tracks.forEach(t => {
      const id = engine.createTrack(t.name);
      engine.setTrackGain(id, t.gain);
      if (typeof t.pan === 'number') engine.setTrackPan(id, t.pan);
      engine.setTrackMute(id, t.muted);
      engine.setTrackSolo(id, t.solo);
      t.clips.forEach(c => {
        const buf = s.buffers[c.bufIndex]; if (!buf) return;
        const cid = engine.addClip(id, buf, c.beginTime, c.offsetSec, c.durationSec);
        engine.setClipFade(id, cid, c.fadeInSec || 0, c.fadeOutSec || 0);
        if (typeof c.playbackRate === 'number') (engine as any).setClipPlaybackRate?.(id, cid, c.playbackRate);
      });
    });
    setTracks(engine.getTracks());
    setDuration(engine.getDuration());
  };
  const record = () => {
    const snap = snapshot();
    const arr = pastRef.current;
    arr.push(snap);
    if (arr.length > limit) arr.shift();
    futureRef.current = [];
  };

  // Wrap mutators to record history
  const withHistory = {
    importToNewTrack: api.importToNewTrack && (async (file: File) => { record(); await api.importToNewTrack(file); }),
    setTrackGain: (id: string, v: number) => { record(); api.setTrackGain(id, v); },
    setTrackPan: (id: string, v: number) => { record(); api.setTrackPan(id, v); },
    setTrackMute: (id: string, v: boolean) => { record(); api.setTrackMute(id, v); },
    setTrackSolo: (id: string, v: boolean) => { record(); api.setTrackSolo(id, v); },
    moveClip: (targetTrackId: string, clipId: string, newBegin: number) => { record(); (api as any).moveClip(targetTrackId, clipId, newBegin); },
    deleteClip: (trackId: string, clipId: string) => { record(); (api as any).deleteClip(trackId, clipId); },
    deleteTrack: (id: string) => { record(); (api as any).deleteTrack(id); },
    duplicateClip: (trackId: string, clipId: string) => { record(); (api as any).duplicateClip(trackId, clipId); },
    setClipFade: (trackId: string, clipId: string, fi: number, fo: number) => {
      // Record previous and apply new fades
      const t = engine.getTracks().find(t => t.id === trackId);
      const c = t?.clips.find(c => c.id === clipId);
      const prevFi = c?.fadeInSec || 0;
      const prevFo = c?.fadeOutSec || 0;
      record();
      (api as any).setClipFade(trackId, clipId, fi, fo);
      // push inverse onto history by leveraging snapshot stack on undo/redo
      // Note: our snapshot stack captures state before/after record(); on undo it returns to prev snapshot.
    },
    trimClip: (trackId: string, clipId: string, nb: number, ne: number) => { record(); (api as any).trimClip(trackId, clipId, nb, ne); },
    splitClip: (trackId: string, clipId: string, at: number) => { record(); (api as any).splitClip(trackId, clipId, at); },
    setClipPlaybackRate: (trackId: string, clipId: string, rate: number) => { record(); (api as any).setClipPlaybackRate?.(trackId, clipId, rate); },
    setTrackVolumeEnvelopePoints: (id: string, pts: Array<{time:number; value:number}>) => { record(); (api as any).setTrackVolumeEnvelopePoints(id, pts); },
  } as any;

  const undo = () => {
    const past = pastRef.current; if (past.length === 0) return;
    const snap = past.pop()!;
    const cur = snapshot();
    futureRef.current.push(cur);
    applySnapshot(snap);
  };
  const redo = () => {
    const fut = futureRef.current; if (fut.length === 0) return;
    const snap = fut.pop()!;
    const cur = snapshot();
    pastRef.current.push(cur);
    applySnapshot(snap);
  };

  return { ...api, ...withHistory, undo, redo, canUndo: () => pastRef.current.length > 0, canRedo: () => futureRef.current.length > 0 } as any;
}
