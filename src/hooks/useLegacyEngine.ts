import { useEffect, useMemo, useRef, useState } from 'react';
import { Track } from '../engine/types';

type Legacy = any; // window.app.EngineFacade

function hasLegacy(): boolean {
  return typeof (window as any).app !== 'undefined' && typeof (window as any).app.EngineFacade === 'function';
}

export function useLegacyEngine() {
  const legacyRef = useRef<Legacy | null>(null);
  if (hasLegacy() && !legacyRef.current) {
    legacyRef.current = new (window as any).app.EngineFacade();
  }
  const engine = legacyRef.current;

  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const prevSigRef = useRef<string>("");
  const prevTrackCountRef = useRef<number>(0);
  // Locally hidden tracks (fallback when facade lacks removeTrack)
  const hiddenTrackIdsRef = useRef<Set<string>>(new Set());
  // Local multi-solo tracking
  const soloIdsRef = useRef<Set<string>>(new Set());
  const savedMutesRef = useRef<Map<number, boolean> | null>(null);
  // Local per-track playback rate cache (legacy UI width and control)
  // (speed preview/cache removed)

  // Poll legacy engine for time and track snapshots
  useEffect(() => {
    if (!engine) return;
    const id = setInterval(() => {
      try {
        const t = engine.getTime();
        setTime(t);
        setDuration(engine.getDuration());
        const snapAll = engine.getTracksSnapshot() as any[];
        // Filter out locally hidden tracks so UI removes their lanes
        const snap = snapAll.filter((s: any) => !hiddenTrackIdsRef.current.has(String(s.id)));
        // For each track, enrich with section snapshots for clip layout
        const sectionData: Record<number, any[]> = {};
        for (const s of snap) {
          try { sectionData[s.id] = engine.getTrackSectionsSnapshot(s.id); } catch { sectionData[s.id] = []; }
        }
        // Build a compact signature to avoid unnecessary React updates
        const sig = snap.map((s: any) => [
          s.id, s.name, s.gain, s.pan, +!!s.muted, +!!s.solo, s.sections,
          (sectionData[s.id]||[]).map((sec:any)=>`${sec.id}:${sec.beginTime}:${sec.duration}`).join(',')
        ].join('|')).join('||');
        if (sig !== prevSigRef.current) {
          prevSigRef.current = sig;
          const mapped: Track[] = snap.map(s => ({
            id: String(s.id),
            name: s.name,
            gain: { gain: { value: s.gain } } as any, // shape adapter for UI
            pan: { pan: { value: Math.max(-1, Math.min(1, typeof s.pan === 'number' ? (s.pan / 45) : 0)) } } as any,
            muted: !!s.muted,
            solo: !!s.solo || soloIdsRef.current.has(String(s.id)),
            playbackRate: 1,
            clips: (sectionData[s.id] || []).map(sec => ({
              id: String(sec.id),
              // No buffer in legacy path; Timeline will fetch waveforms via facade.
              buffer: undefined as any,
              beginTime: sec.beginTime,
              offsetSec: 0,
              durationSec: sec.duration,
            })),
            activeSources: new Set(),
          }));
          setTracks(mapped);
          try {
            const count = mapped.length;
            if (busy && count > prevTrackCountRef.current) {
              setProgress(100);
              setTimeout(()=> { setBusy(false); setProgress(0); }, 200);
            }
            prevTrackCountRef.current = count;
          } catch {}
        }
      } catch {}
    }, 120);
    return () => clearInterval(id);
  }, [engine, busy]);

  // Coalesced snapshot refresh helper (avoids repeated heavy snapshots while dragging)
  const refreshPendRef = useRef<boolean>(false);
  const refreshIdRef = useRef<number | null>(null);
  const scheduleRefresh = () => {
    if (refreshPendRef.current) return;
    refreshPendRef.current = true;
    const run = () => {
      refreshPendRef.current = false;
      doRefresh();
    };
    try {
      if (refreshIdRef.current != null) cancelAnimationFrame(refreshIdRef.current as any);
    } catch {}
    try { refreshIdRef.current = requestAnimationFrame(run) as any; }
    catch { setTimeout(run, 0); }
  };

  const doRefresh = () => {
    if (!engine) return;
    try {
      const snapAll = (engine as any).getTracksSnapshot?.() as any[];
      const snap = (snapAll || []).filter((s: any) => !hiddenTrackIdsRef.current.has(String(s.id)));
      const sectionData: Record<number, any[]> = {};
      for (const s of snap) {
        try { sectionData[s.id] = (engine as any).getTrackSectionsSnapshot?.(s.id) || []; } catch { sectionData[s.id] = []; }
      }
      const sig = snap.map((s: any) => [
        s.id, s.name, s.gain, s.pan, +!!s.muted, +!!s.solo, s.sections,
        (sectionData[s.id]||[]).map((sec:any)=>`${sec.id}:${sec.beginTime}:${sec.duration}`).join(',')
      ].join('|')).join('||');
      prevSigRef.current = sig + '|' + Date.now();
      const mapped: Track[] = snap.map(s => ({
        id: String(s.id),
        name: s.name,
        gain: { gain: { value: s.gain } } as any,
        pan: { pan: { value: Math.max(-1, Math.min(1, typeof s.pan === 'number' ? (s.pan / 45) : 0)) } } as any,
        muted: !!s.muted,
        solo: !!s.solo || soloIdsRef.current.has(String(s.id)),
        playbackRate: 1,
        clips: (sectionData[s.id] || []).map(sec => ({ id: String(sec.id), buffer: undefined as any, beginTime: sec.beginTime, offsetSec: 0, durationSec: sec.duration })),
        activeSources: new Set(),
      }));
      setTracks(mapped);
      setDuration((engine as any).getDuration?.() || 0);
    } catch {}
  };

  // Apply multi-solo mute logic so only selected solo tracks are audible.
  const applySoloMuteState = () => {
    if (!engine) return;
    try {
      const snap: any[] = (engine as any).getTracksSnapshot?.() || [];
      const active = soloIdsRef.current;
      if (active.size > 0) {
        if (!savedMutesRef.current) {
          const m = new Map<number, boolean>();
          for (const t of snap) m.set(Number(t.id), !!t.muted);
          savedMutesRef.current = m;
        }
        for (const t of snap) {
          const on = active.has(String(t.id));
          try { (engine as any).setTrackMute?.(Number(t.id), !on); } catch {}
          // Ensure engine's own solo gating does not override multi-solo: turn off engine-level solo
          try { (engine as any).setTrackSolo?.(Number(t.id), false); } catch {}
        }
      } else {
        const saved = savedMutesRef.current;
        for (const t of snap) {
          const idn = Number(t.id);
          const restore = saved?.has(idn) ? !!saved.get(idn) : false;
          try { (engine as any).setTrackMute?.(idn, restore); } catch {}
          try { (engine as any).setTrackSolo?.(idn, false); } catch {}
        }
        savedMutesRef.current = null;
      }
    } catch {}
    scheduleRefresh();
  };

  const api = useMemo(() => ({
    engine,
    legacy: true,
    time, duration, tracks, playing,
    busy, progress,
    getSoloIds(): string[] { return Array.from(soloIdsRef.current.values()); },
    clearSolo() { try { soloIdsRef.current.clear(); applySoloMuteState(); } catch {} },
    /** Resume audio context if needed (noop for legacy facades without explicit resume) */
    resumeAudio() { /* best-effort noop for legacy engine */ try { (engine as any).resume?.(); } catch {} },
    /** Stop transport */
    stop() { if (!engine) return; try { (engine as any).pause?.(); } catch {} setPlaying(false); },
    /** Create a new empty track and return its id */
    async createTrack(opts?: { kind?: string; name?: string }) {
      if (!engine) throw new Error('Legacy engine not loaded');
      let id: number | string | undefined;
      try { id = (engine as any).addTrack?.(opts?.name || 'Track'); } catch {}
      // Fallback: if addTrack not available, try master API variants
      if (id == null) { throw new Error('Legacy engine addTrack not available'); }
      // Nudge UI
      scheduleRefresh();
      return String(id);
    },
    /** Return current Track[] snapshot as seen by React */
    getTracks(): Track[] { return tracks; },
    deleteTrack(id: string) {
      // Best-effort removal with correct API fallbacks (ID → index)
      const tid = Number(id);
      let removed = false;
      try {
        const ok = (engine as any).removeTrackById?.(tid);
        if (ok === true) removed = true;
      } catch {}
      if (!removed) {
        // Some facades expose only removeTrack(index). Map ID to index via snapshot.
        try {
          const snap: any[] = (engine as any).getTracksSnapshot?.() || [];
          const idx = snap.findIndex((t: any) => Number(t?.id) === tid);
          if (idx >= 0 && typeof (engine as any).removeTrack === 'function') {
            (engine as any).removeTrack(idx);
            removed = true;
          }
        } catch {}
      }
      if (!removed) {
        // Last-resort: hide locally so UI removes lane
        try { engine.setTrackMute(tid, true); } catch {}
        try { engine.setTrackGain(tid, 0); } catch {}
        hiddenTrackIdsRef.current.add(String(id));
      } else {
        // Ensure no stale hidden flag if previously applied
        hiddenTrackIdsRef.current.delete(String(id));
      }
      // Remove from solo set if present and re-apply solo state
      try { if (soloIdsRef.current.delete(String(id))) { /* re-apply current solo */ }
        applySoloMuteState();
      } catch {}
      // Force signature change so poller re-emits tracks state immediately
      prevSigRef.current = "__force__" + Date.now();
    },
    async importToNewTrack(file: File) {
      if (!engine) throw new Error('Legacy engine not loaded');
      setBusy(true); setProgress(0);
      const buf: ArrayBuffer = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.min(70, Math.round((e.loaded / e.total) * 70))); };
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.readAsArrayBuffer(file);
      });
      setProgress((p)=> Math.max(p, 80));
      await engine.addTrackFromArrayBuffer(buf, file.name, 0);
      setProgress(100);
      setTimeout(()=> { setBusy(false); setProgress(0); }, 300);
    },
    async importToTrack(trackId: string, file: File, atSec: number = 0) {
      if (!engine) throw new Error('Legacy engine not loaded');
      const tid = Number(trackId);
      setBusy(true); setProgress(0);
      const buf: ArrayBuffer = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(fr.error);
        fr.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.min(70, Math.round((e.loaded / e.total) * 70))); };
        fr.onload = () => resolve(fr.result as ArrayBuffer);
        fr.readAsArrayBuffer(file);
      });
      setProgress((p)=> Math.max(p, 80));
      try {
        // Decode to the legacy "chest" and add as a section to the specified track
        const chest = await (engine as any).decodeArrayBuffer(buf, 'audio');
        (engine as any).addSectionFromChest(tid, chest, Math.max(0, atSec || 0), file.name);
      } finally {
        setProgress(100);
        setTimeout(()=> { setBusy(false); setProgress(0); }, 300);
      }
    },
    async play() { if (!engine) return; setPlaying(true); engine.play(); },
    pause() { if (!engine) return; setPlaying(false); try { engine.pause(); } catch {} },
    seek(t: number) {
      if (!engine) return;
      // Preserve transport state: if we were playing, resume after seek
      const wasPlaying = playing === true;
      try { if (wasPlaying && (engine as any).pause) (engine as any).pause(); } catch {}
      try { engine.seek(t); } catch {}
      try { if (wasPlaying && engine.play) engine.play(); } catch {}
      if (!wasPlaying) setPlaying(false);
      setTime(isFinite(t) ? t : 0);
    },
    setMasterGain(v: number) { if (!engine) return; engine.setMasterGain(v); },
    setTrackGain(id: string, v: number) { if (!engine) return; engine.setTrackGain(Number(id), v); scheduleRefresh(); },
    setTrackPan(id: string, v: number) { if (!engine) return; try { engine.setTrackPan(Number(id), Math.max(-45, Math.min(45, (v || 0) * 45))); } catch {} scheduleRefresh(); },
    setTrackMute(id: string, v: boolean) { if (!engine) return; engine.setTrackMute(Number(id), v); scheduleRefresh(); },
    setTrackSolo(id: string, v: boolean) {
      if (!engine) return;
      const tid = String(id);
      if (v) soloIdsRef.current.add(tid); else soloIdsRef.current.delete(tid);
      applySoloMuteState();
    },
    // Fast split without history (for UI double-click)
    splitClipFast(trackId: string, clipId: string, atTimeAbs: number) { if (!engine) return; try { (engine as any).pause?.(); } catch {} (engine as any).splitSectionAt?.(Number(clipId), atTimeAbs); scheduleRefresh(); },

    // Region preview for selection: best-effort on legacy facade by soloing track and auto-pausing at end
    playSelection(trackId: string, clipId: string, startAbs: number, endAbs: number) {
      if (!engine) return;
      const a = Math.max(0, Math.min(startAbs, endAbs));
      const b = Math.max(0, Math.max(startAbs, endAbs));
      if (!(b > a)) return;
      // Snapshot current solo state per track
      let snap: Array<{ id: number; solo: boolean; muted: boolean }> = [];
      try { snap = ((engine as any).getTracksSnapshot?.() || []).map((t: any) => ({ id: Number(t.id), solo: !!t.solo, muted: !!t.muted })); } catch {}
      const restore = () => {
        try { for (const s of snap) { (engine as any).setTrackSolo?.(s.id, s.solo); (engine as any).setTrackMute?.(s.id, s.muted); } } catch {}
      };
      try {
        // Solo only the requested track
        for (const s of snap) { (engine as any).setTrackSolo?.(s.id, Number(trackId) === Number(s.id)); }
      } catch {}
      try { (engine as any).pause?.(); } catch {}
      try { engine.seek(a); } catch {}
      try { engine.play(); } catch {}
      // Schedule stop and restore
      try {
        const ms = Math.max(0, Math.ceil((b - a) * 1000) + 20);
        setTimeout(() => { try { engine.pause(); } catch {}; restore(); }, ms);
      } catch {}
    },
    // Volume envelope getters/setters (track-level)
    getTrackVolumeEnvelopePoints(id: string) { if (!engine) return []; try { return (engine as any).getTrackVolumeEnvelopePoints?.(Number(id)) || []; } catch { return []; } },
    setTrackVolumeEnvelopePoints(id: string, pts: Array<{time:number; value:number}>) { if (!engine) return; try { (engine as any).setTrackVolumeEnvelopePoints?.(Number(id), pts); } catch {} },
    // Track/clip playback rate (best-effort on legacy)
    // (speed control functions removed per request)
    moveClip(targetTrackId: string, clipId: string, newBegin: number) { if (!engine) return; try { (engine as any).pause?.(); } catch {} engine.moveSection(Number(clipId), Number(targetTrackId), newBegin); scheduleRefresh(); },
    trimClip(trackId: string, clipId: string, newBegin: number, newEnd: number) { if (!engine) return; try { (engine as any).pause?.(); } catch {} engine.trimSection(Number(clipId), newBegin, newEnd); scheduleRefresh(); },
    // Per-clip fades via legacy facade
    setClipFade(trackId: string, clipId: string, fadeInSec: number, fadeOutSec: number) { if (!engine) return; try { (engine as any).setSectionFade?.(Number(clipId), fadeInSec, fadeOutSec); } catch {} scheduleRefresh(); },
    splitClip(trackId: string, clipId: string, atTimeAbs: number) { if (!engine) return; try { (engine as any).pause?.(); } catch {} engine.splitSectionAt(Number(clipId), atTimeAbs); scheduleRefresh(); },
    deleteClip(trackId: string, clipId: string) { if (!engine) return; try { (engine as any).pause?.(); } catch {} (engine as any).removeSectionById?.(Number(clipId)); scheduleRefresh(); },
    duplicateClip(trackId: string, clipId: string) { if (!engine) return; try { (engine as any).pause?.(); } catch {} (engine as any).duplicateSectionById?.(Number(clipId)); scheduleRefresh(); },

    listEffects(): Array<{id:number; key:string; name:string}> { if (!engine) return []; return engine.listEffects(); },
    listTrackEffectsDetailed(trackId: string): Array<{index:number; id:number; name:string; fields:any[]}> { if (!engine) return []; try { return engine.listTrackEffectsDetailed(Number(trackId)); } catch { return []; } },
    addTrackEffect(id: string, effectId: number) { if (!engine) return; engine.addTrackEffect(Number(id), effectId); },
    addMasterEffect(effectId: number) { if (!engine) return; engine.addMasterEffect(effectId); },
    setTrackEffectField(trackId: string, index: number, field: string, value: number | boolean) { if (!engine) return; (engine as any).setTrackEffectField(Number(trackId), index, field, value as any); },
    removeTrackEffect(trackId: string, key: number) { 
      if (!engine) return;
      const wasPlaying = playing === true;
      const tid = Number(trackId);
      // Resolve the provided key (could be id, engine index, or array position) to a concrete index/id
      let before: Array<{ index:number; id:number; name:string; fields:any[] }> = [];
      try { before = (engine as any).listTrackEffectsDetailed?.(tid) || []; } catch {}
      const arrIdx = before.findIndex((e: any) => e && (e.id === key || e.index === key));
      const match = arrIdx >= 0 ? before[arrIdx] : undefined;
      const engineIdx = (match && Number.isFinite(match.index)) ? (match.index as number) : (Number.isFinite(key) ? (key as number) : -1);
      const effId = match?.id;
      const tryRemoveIdx = (i: number) => {
        try { (engine as any).removeTrackEffectAt?.(tid, i); } catch {}
        try { (engine as any).removeTrackEffect?.(tid, i); } catch {}
      };
      // Try in order of most likely correctness
      if (Number.isFinite(engineIdx) && engineIdx >= 0) tryRemoveIdx(engineIdx);
      // If that didn't change anything, try alternatives
      let after: any[] = [];
      try { after = (engine as any).listTrackEffectsDetailed?.(tid) || []; } catch {}
      if (!after || after.length === before.length) {
        if (arrIdx >= 0) tryRemoveIdx(arrIdx);
      }
      // Still unchanged? Try 1-based variant
      try { after = (engine as any).listTrackEffectsDetailed?.(tid) || []; } catch {}
      if (!after || after.length === before.length) {
        if (Number.isFinite(engineIdx) && engineIdx >= 0) tryRemoveIdx(engineIdx + 1);
      }
      // Try id-based removal if supported
      try { after = (engine as any).listTrackEffectsDetailed?.(tid) || []; } catch {}
      if ((!after || after.length === before.length) && typeof (engine as any).removeTrackEffectById === 'function' && Number.isFinite(effId)) {
        try { (engine as any).removeTrackEffectById(tid, effId); } catch {}
      }
      // Last resort: pass the provided key directly
      try { after = (engine as any).listTrackEffectsDetailed?.(tid) || []; } catch {}
      if (!after || after.length === before.length) {
        tryRemoveIdx(key as any);
      }
      // Nudge scheduling if transport is/was playing
      if (wasPlaying) {
        try { (engine as any).pause?.(); } catch {}
        try { (engine as any).play?.(); } catch {}
      }
    },
    setMasterEffectField(index: number, field: string, value: number) { if (!engine) return; engine.setMasterEffectField(index, field, value); },
    addTrackGainDb(trackId: string, db: number) { if (!engine) return; engine.addTrackGainDb(Number(trackId), db); },
    addMasterGainDb(db: number) { if (!engine) return; engine.addMasterGainDb(db); },
    // Expose section waveform for timeline rendering in legacy mode
    getClipWaveform(trackId: string, clipId: string, points = 240): Float32Array { if (!engine) return new Float32Array(0); try { return engine.getSectionWaveform(Number(clipId), points); } catch { return new Float32Array(0); } },
    async exportWav() {
      if (!engine) throw new Error('Legacy engine not loaded');
      setBusy(true); setProgress(10);
      const buffer: AudioBuffer = await engine.renderAudioBuffer();
      setProgress(70);
      const { blob } = audioBufferToWav(buffer, 16);
      const url = URL.createObjectURL(blob);
      setProgress(100);
      // Hide shortly after completion to let UI handoff download
      setTimeout(() => { setBusy(false); setProgress(0); }, 160);
      return { blob, url, size: blob.size, mime: 'audio/wav' } as any;
    },
    async exportMp3() {
      if (!engine) throw new Error('Legacy engine not loaded');
      setBusy(true); setProgress(10);
      const buffer: AudioBuffer = await engine.renderAudioBuffer();
      setProgress(50);
      const channels: Float32Array[] = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      const worker = new Worker('/mp3Worker.js');
      const result = await new Promise<{ blob: Blob }>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<any>) => {
          // Optional PROGRESS support if worker posts updates
          if (e.data && e.data.type === 'PROGRESS' && typeof e.data.value === 'number') {
            const v = Math.max(51, Math.min(99, Math.round(e.data.value)));
            setProgress(v);
            return;
          }
          if (e.data && e.data.ok && e.data.blob) {
            setProgress(100);
            resolve({ blob: e.data.blob });
            worker.terminate();
          } else {
            const msg = e.data?.error || 'MP3 export failed';
            worker.terminate();
            reject(new Error(msg));
          }
        };
        worker.onerror = (err) => { worker.terminate(); reject(err); };
        const transfers = channels.map((c) => c.buffer as ArrayBuffer);
        setProgress(70);
        worker.postMessage({ type: 'mp3', channels, sampleRate: buffer.sampleRate, kbps: 192 }, transfers as any);
      });
      const url = URL.createObjectURL(result.blob);
      setProgress(100);
      setTimeout(() => { setBusy(false); setProgress(0); }, 160);
      return { blob: result.blob, url, size: result.blob.size, mime: 'audio/mpeg' } as any;
    },
    async renderToNewTrack() {
      if (!engine) throw new Error('Legacy engine not loaded');
      setBusy(true); setProgress(10);
      // Render to buffer, encode to WAV, decode via facade to chest, add section
      const buffer: AudioBuffer = await engine.renderAudioBuffer();
      setProgress(70);
      const { blob } = audioBufferToWav(buffer, 16);
      const ab = await blob.arrayBuffer();
      const chest = await engine.decodeArrayBuffer(ab, 'Rendered Mix');
      const trackId = engine.addTrack('Rendered Mix');
      engine.addSectionFromChest(trackId, chest, 0, 'Rendered Mix');
      setProgress(100);
      setTimeout(()=> { setBusy(false); setProgress(0); }, 200);
    },
    async exportProject() {
      if (!engine) throw new Error('Legacy engine not loaded');
      try {
        const blob = (engine as any).exportProjectEncoding?.();
        if (blob) {
          const url = URL.createObjectURL(blob);
          return { blob, url, size: blob.size, mime: 'application/octet-stream' } as any;
        }
        throw new Error('exportProjectEncoding not available');
      } catch (e) { throw e; }
    },
    async importProject(file: File) {
      if (!engine) throw new Error('Legacy engine not loaded');
      const ab = await file.arrayBuffer();
      if ((engine as any).importProjectEncoding) {
        await (engine as any).importProjectEncoding(ab);
      } else {
        throw new Error('importProjectEncoding not available');
      }
    },
    async addRhythmTrack(opts: { kind: 'click'|'tabla'|'piano'; bpm: number; bars: number; subdivision?: 'quarter'|'eighth'; single?: boolean }) {
      if (!engine) throw new Error('Legacy engine not loaded');
      setBusy(true); setProgress(5);
      const sr = engine.getSampleRate ? engine.getSampleRate() : 44100;
      const beatSec = 60 / Math.max(1, opts.bpm || 120);
      const step = (opts.subdivision === 'eighth') ? beatSec/2 : beatSec;
      const bars = Math.max(1, opts.bars || 1);
      const totalDur = bars * 4 * beatSec;
      // Build a single-hit PCM and decode once to reuse chest
      const hitLen = Math.floor(sr * 0.12);
      const single = new Float32Array(hitLen);
      for (let i = 0; i < hitLen; i++) {
        const t = i / sr; const env = Math.exp(-t * (opts.kind==='piano'?8:(opts.kind==='tabla'?14:28)));
        const s1 = Math.sin(2*Math.PI*(opts.kind==='piano'?440:(opts.kind==='tabla'?240:1200))*t);
        const s2 = (opts.kind==='piano') ? 0.4*Math.sin(2*Math.PI*660*t) : (opts.kind==='tabla'?0.25*Math.sin(2*Math.PI*360*t):0);
        single[i] = (s1 + s2) * env * 0.9;
      }
      const wavAb = float32ToWavPCM16(single, sr);
      const chest = await engine.decodeArrayBuffer(wavAb, `${opts.kind}`);
      const ensureTrack = () => {
        const name = `${opts.kind.toUpperCase()} ${opts.bpm}bpm`;
        const existing = (engine.getTracksSnapshot?.() || []).find((t:any)=> t.name === name)?.id;
        return existing || engine.addTrack(name);
      };
      if (opts.single) {
        const trackId = ensureTrack();
        const at = engine.getTime ? engine.getTime() : 0;
        engine.addSectionFromChest(trackId, chest, at, `${opts.kind}`);
        setProgress(100);
      } else {
        const trackId = engine.addTrack(`${opts.kind.toUpperCase()} ${opts.bpm}bpm`);
        const stepsTotal = Math.max(1, Math.floor(totalDur / step));
        let i = 0;
        for (let t = 0; t < totalDur - 1e-4; t += step) {
          engine.addSectionFromChest(trackId, chest, t, `${opts.kind}`);
          i++; if (i % 2 === 0) setProgress(Math.min(95, Math.round((i / stepsTotal) * 95)));
        }
        setProgress(100);
      }
      // If transport is currently running, nudge the facade to reschedule so the new section is audible immediately
      try { (engine as any).pause?.(); } catch {}
      try { engine.play(); } catch {}
      setTimeout(()=> { setBusy(false); setProgress(0); }, 180);
    },
  }), [engine, time, duration, tracks, playing, busy, progress]);

  // Lightweight undo/redo stack using inverse operations where possible
  type Op = { undo: () => void; redo: () => void };
  const pastRef = useRef<Op[]>([]);
  const futureRef = useRef<Op[]>([]);
  const record = (op: Op) => { pastRef.current.push(op); futureRef.current = []; };

  // Wrap selected mutators to support undo/redo in legacy mode
  const withHistory = useMemo(() => ({
    setTrackGain: (id: string, v: number) => {
      const t = tracks.find(t => t.id === id); const prev = t ? t.gain.gain.value : undefined;
      (api as any).setTrackGain(id, v);
      if (typeof prev === 'number') record({ undo: () => (api as any).setTrackGain(id, prev), redo: () => (api as any).setTrackGain(id, v) });
    },
    setTrackPan: (id: string, v: number) => {
      const t = tracks.find(t => t.id === id); const prev = t && t.pan ? t.pan.pan.value : 0;
      (api as any).setTrackPan(id, v);
      record({ undo: () => (api as any).setTrackPan(id, prev), redo: () => (api as any).setTrackPan(id, v) });
    },
    setTrackMute: (id: string, m: boolean) => {
      const t = tracks.find(t => t.id === id); const prev = t ? !!t.muted : false;
      (api as any).setTrackMute(id, m);
      record({ undo: () => (api as any).setTrackMute(id, prev), redo: () => (api as any).setTrackMute(id, m) });
    },
    setTrackSolo: (id: string, s: boolean) => {
      const t = tracks.find(t => t.id === id); const prev = t ? !!t.solo : false;
      (api as any).setTrackSolo(id, s);
      record({ undo: () => (api as any).setTrackSolo(id, prev), redo: () => (api as any).setTrackSolo(id, s) });
    },
    moveClip: (targetTrackId: string, clipId: string, newBegin: number) => {
      // find current location
      const from = tracks.find(t => t.clips.some(c => c.id === clipId));
      const oldTrackId = from?.id || targetTrackId;
      const oldBegin = from?.clips.find(c => c.id === clipId)?.beginTime || 0;
      (api as any).moveClip(targetTrackId, clipId, newBegin);
      record({
        undo: () => (api as any).moveClip(oldTrackId, clipId, oldBegin),
        redo: () => (api as any).moveClip(targetTrackId, clipId, newBegin),
      });
    },
    trimClip: async (trackId: string, clipId: string, newBegin: number, newEnd: number) => {
      // Snapshot-based history for robustness across legacy facades
      const take = async () => {
        try { const blob = (engine as any).exportProjectEncoding?.(); return blob ? await blob.arrayBuffer() : null; } catch { return null; }
      };
      const restore = (ab: ArrayBuffer | null) => {
        if (!ab) return;
        try { (engine as any).importProjectEncoding?.(ab); prevSigRef.current = "__force__" + Date.now(); } catch {}
      };
      const before = await take();
      try { (api as any).trimClip(trackId, clipId, newBegin, newEnd); } catch {}
      const after = await take();
      record({ undo: () => restore(before), redo: () => restore(after) });
    },
    // Operations that are hard to invert: snapshot project around them
    duplicateClip: async (trackId: string, clipId: string) => {
      const take = async () => {
        try { const blob = (engine as any).exportProjectEncoding?.(); return blob ? await blob.arrayBuffer() : null; } catch { return null; }
      };
      const restore = (ab: ArrayBuffer | null) => { if (!ab) return; try { (engine as any).importProjectEncoding?.(ab); prevSigRef.current = "__force__" + Date.now(); } catch {} };
      const before = await take();
      try { (api as any).duplicateClip(trackId, clipId); } catch {}
      const after = await take();
      record({ undo: () => restore(before), redo: () => restore(after) });
    },
    splitClip: async (trackId: string, clipId: string, at: number) => {
      const take = async () => {
        try { const blob = (engine as any).exportProjectEncoding?.(); return blob ? await blob.arrayBuffer() : null; } catch { return null; }
      };
      const restore = (ab: ArrayBuffer | null) => { if (!ab) return; try { (engine as any).importProjectEncoding?.(ab); prevSigRef.current = "__force__" + Date.now(); } catch {} };
      const before = await take();
      try { (api as any).splitClip(trackId, clipId, at); } catch {}
      const after = await take();
      record({ undo: () => restore(before), redo: () => restore(after) });
    },
    deleteClip: async (trackId: string, clipId: string) => {
      const take = async () => {
        try { const blob = (engine as any).exportProjectEncoding?.(); return blob ? await blob.arrayBuffer() : null; } catch { return null; }
      };
      const restore = (ab: ArrayBuffer | null) => { if (!ab) return; try { (engine as any).importProjectEncoding?.(ab); prevSigRef.current = "__force__" + Date.now(); } catch {} };
      const before = await take();
      try { (api as any).deleteClip(trackId, clipId); } catch {}
      const after = await take();
      record({ undo: () => restore(before), redo: () => restore(after) });
    },
    deleteTrack: async (id: string) => {
      const take = async () => {
        try { const blob = (engine as any).exportProjectEncoding?.(); return blob ? await blob.arrayBuffer() : null; } catch { return null; }
      };
      const restore = (ab: ArrayBuffer | null) => { if (!ab) return; try { (engine as any).importProjectEncoding?.(ab); prevSigRef.current = "__force__" + Date.now(); } catch {} };
      const before = await take();
      try { (api as any).deleteTrack(id); } catch {}
      const after = await take();
      record({ undo: () => restore(before), redo: () => restore(after) });
    },
    setClipFade: async (trackId: string, clipId: string, fin: number, fout: number) => {
      const take = async () => {
        try { const blob = (engine as any).exportProjectEncoding?.(); return blob ? await blob.arrayBuffer() : null; } catch { return null; }
      };
      const restore = (ab: ArrayBuffer | null) => { if (!ab) return; try { (engine as any).importProjectEncoding?.(ab); prevSigRef.current = "__force__" + Date.now(); } catch {} };
      const before = await take();
      try { (api as any).setClipFade?.(trackId, clipId, fin, fout); } catch {}
      const after = await take();
      record({ undo: () => restore(before), redo: () => restore(after) });
    },
    setTrackVolumeEnvelopePoints: (id: string, pts: Array<{time:number; value:number}>) => {
      const prev = (api as any).getTrackVolumeEnvelopePoints?.(id) || [];
      (api as any).setTrackVolumeEnvelopePoints?.(id, pts);
      record({ undo: () => (api as any).setTrackVolumeEnvelopePoints?.(id, prev), redo: () => (api as any).setTrackVolumeEnvelopePoints?.(id, pts) });
    },
        // Playback rate mapping (best-effort on legacy): try known method names, else no-op
    setGlobalPlaybackRate(rate: number) {
      if (!engine) return;
      const r = Math.max(0.25, Math.min(4, Number(rate) || 1));
      try { (engine as any).setGlobalPlaybackRate?.(r); return; } catch {}
      try { (engine as any).setPlaybackRate?.(r); return; } catch {}
      try {
        const tracks: any[] = (engine as any).getTracksSnapshot?.() || [];
        for (const t of tracks) try { (engine as any).setTrackPlaybackRate?.(t.id, r); } catch {}
      } catch {}
    }
  }), [api, tracks]);

  const undo = () => { const op = pastRef.current.pop(); if (!op) return; futureRef.current.push(op); try { op.undo(); } catch {} };
  const redo = () => { const op = futureRef.current.pop(); if (!op) return; pastRef.current.push(op); try { op.redo(); } catch {} };

  return { ...api, ...withHistory, undo, redo, canUndo: () => pastRef.current.length > 0, canRedo: () => futureRef.current.length > 0 } as any;
}

function dataURLToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1] || '';
  const raw = atob(base64);
  const ab = new ArrayBuffer(raw.length);
  const ua = new Uint8Array(ab);
  for (let i = 0; i < raw.length; i++) ua[i] = raw.charCodeAt(i);
  return ab;
}

// Build a 16-bit PCM mono WAV ArrayBuffer from Float32 samples [-1..1]
function float32ToWavPCM16(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numCh = 1;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = samples.length * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  writeString(dv, 0, 'RIFF');
  dv.setUint32(4, 36 + dataSize, true);
  writeString(dv, 8, 'WAVE');
  writeString(dv, 12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * blockAlign, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, 16, true);
  writeString(dv, 36, 'data');
  dv.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] || 0));
    dv.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }
  return ab;
}

// Write an AudioBuffer to a WAV Blob
function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 32 = 16) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numCh;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const headerSize = 44;
  const total = headerSize + dataSize;
  const ab = new ArrayBuffer(total);
  const dv = new DataView(ab);
  // RIFF
  writeString(dv, 0, 'RIFF');
  dv.setUint32(4, 36 + dataSize, true);
  writeString(dv, 8, 'WAVE');
  // fmt 
  writeString(dv, 12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); // PCM
  dv.setUint16(22, numCh, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * blockAlign, true);
  dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, bitDepth, true);
  // data
  writeString(dv, 36, 'data');
  dv.setUint32(40, dataSize, true);
  const channels: Float32Array[] = Array.from({length: numCh}, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, (channels[ch]![i] || 0)));
      if (bitDepth === 16) {
        const v = s < 0 ? s * 0x8000 : s * 0x7FFF;
        dv.setInt16(offset, v, true); offset += 2;
      } else {
        dv.setInt32(offset, s < 0 ? s * 0x80000000 : s * 0x7FFFFFFF, true); offset += 4;
      }
    }
  }
  const blob = new Blob([ab], { type: 'audio/wav' });
  return { blob };
}


function writeString(dv: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) dv.setUint8(offset + i, str.charCodeAt(i));
}

// Minimal WAV encoder (16 or 32-bit PCM), adapted from minimal engine.
// function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 32) {
//   const numCh = buffer.numberOfChannels;
//   const sampleRate = buffer.sampleRate;
//   const length = buffer.length * numCh;
//   const bytesPerSample = bitDepth / 8;
//   const blockAlign = numCh * bytesPerSample;
//   const dataSize = buffer.length * blockAlign;
//   const headerSize = 44;
//   const ab = new ArrayBuffer(headerSize + dataSize);
//   const dv = new DataView(ab);
//   writeString(dv, 0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); writeString(dv, 8, 'WAVE');
//   writeString(dv, 12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
//   dv.setUint16(22, numCh, true); dv.setUint32(24, sampleRate, true);
//   dv.setUint32(28, sampleRate * blockAlign, true); dv.setUint16(32, blockAlign, true);
//   dv.setUint16(34, bitDepth, true); writeString(dv, 36, 'data'); dv.setUint32(40, dataSize, true);
//   const channels: Float32Array[] = Array.from({ length: numCh }, (_, i) => buffer.getChannelData(i));
//   let offset = headerSize;
//   for (let i = 0; i < buffer.length; i++) {
//     for (let ch = 0; ch < numCh; ch++) {
//       const s = Math.max(-1, Math.min(1, (channels[ch]![i] || 0)));
//       if (bitDepth === 16) {
//         const v = s < 0 ? s * 0x8000 : s * 0x7FFF;
//         dv.setInt16(offset, v, true); offset += 2;
//       } else {
//         dv.setInt32(offset, s < 0 ? s * 0x80000000 : s * 0x7FFFFFFF, true); offset += 4;
//       }
//     }
//   }
//   const blob = new Blob([ab], { type: 'audio/wav' });
//   return { blob };
// }
// function writeString(dv: DataView, offset: number, str: string) {
//   for (let i = 0; i < str.length; i++) dv.setUint8(offset + i, str.charCodeAt(i));
// }
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
}



