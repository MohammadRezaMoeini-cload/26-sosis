import { Clip, Track, TrackId, ExportResult } from './types';

export type EngineEvents = {
  time: (t: number) => void;
  duration: (d: number) => void;
  tracks: () => void;
};

type Listener<K extends keyof EngineEvents> = EngineEvents[K];

const DISABLE_FADES = false;

export class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private analyser: AnalyserNode;
  private tracks = new Map<TrackId, Track>();
  private startAbs = 0; // when play started in ctx time
  private offset = 0; // playhead offset in project seconds
  private playing = false;
  private globalRate = 1; // transport speed multiplier
  private emitter = new Map<keyof EngineEvents, Set<Function>>();
  // Ephemeral selection preview (single buffer source routed through the track gain)
  private previewSource: AudioBufferSourceNode | null = null;
  private previewStopTimer: number | null = null;

  constructor(context?: AudioContext) {
    this.ctx = context || new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.setMasterGain(1);
  }

  on<K extends keyof EngineEvents>(event: K, cb: Listener<K>) {
    if (!this.emitter.has(event)) this.emitter.set(event, new Set());
    this.emitter.get(event)!.add(cb as any);
    return () => this.off(event, cb);
  }
  off<K extends keyof EngineEvents>(event: K, cb: Listener<K>) {
    this.emitter.get(event)?.delete(cb as any);
  }
  private emit<K extends keyof EngineEvents>(event: K, ...args: Parameters<EngineEvents[K]>) {
    this.emitter.get(event)?.forEach((fn) => (fn as any)(...args));
  }

  getContext() { return this.ctx; }
  getAnalyser() { return this.analyser; }
  getMasterGain() { return this.masterGain.gain.value; }
  setMasterGain(v: number) { this.masterGain.gain.value = v; }

  async decodeFile(file: File): Promise<AudioBuffer> {
    const buf = await file.arrayBuffer();
    return this.ctx.decodeAudioData(buf);
  }

  createTrack(name?: string): TrackId {
    const id = crypto.randomUUID();
    const gain = this.ctx.createGain();
    const pan = ('createStereoPanner' in this.ctx) ? this.ctx.createStereoPanner() : undefined;
    if (pan) {
      gain.connect(pan);
      pan.connect(this.masterGain);
    } else {
      gain.connect(this.masterGain);
    }
    const track: Track = {
      id,
      name: name || `Track ${this.tracks.size + 1}`,
      gain,
      pan,
      muted: false,
      solo: false,
      playbackRate: 1,
      clips: [],
      activeSources: new Set(),
      volumeEnvelope: [{ time: 0, value: 1 }],
    };
    this.tracks.set(id, track);
    this.emit('tracks');
    return id;
  }

  getTracks(): Track[] { return [...this.tracks.values()]; }
  removeTrack(id: TrackId) {
    const t = this.tracks.get(id);
    if (!t) return;
    this.stopTrack(t);
    t.gain.disconnect();
    t.pan?.disconnect();
    this.tracks.delete(id);
    this.emit('tracks');
  }

  setTrackGain(id: TrackId, v: number) { this.tracks.get(id)?.gain.gain.setValueAtTime(v, this.ctx.currentTime); }
  setTrackPan(id: TrackId, v: number) { this.tracks.get(id)?.pan?.pan.setValueAtTime(v, this.ctx.currentTime); }
  setTrackMute(id: TrackId, muted: boolean) { const t = this.tracks.get(id); if (t) { t.muted = muted; if (this.playing) this.restart(); } }
  setTrackSolo(id: TrackId, solo: boolean) { const t = this.tracks.get(id); if (t) { t.solo = solo; if (this.playing) this.restart(); } }
  setTrackPlaybackRate(id: TrackId, rate: number) { const t = this.tracks.get(id); if (!t) return; t.playbackRate = Math.max(0.1, Math.min(4, rate || 1)); if (this.playing) this.restart(); }
  setGlobalPlaybackRate(rate: number) { const r = Math.max(0.1, Math.min(4, rate || 1)); this.globalRate = r; for (const t of this.tracks.values()) t.playbackRate = r; if (this.playing) this.restart(); }

  addClip(trackId: TrackId, buffer: AudioBuffer, beginTime = 0, offsetSec = 0, durationSec?: number): string {
    const t = this.tracks.get(trackId);
    if (!t) throw new Error('Track not found');
    const id = crypto.randomUUID();
    const dur = durationSec ?? (buffer.duration - offsetSec);
    t.clips.push({ id, buffer, beginTime, offsetSec, durationSec: dur, playbackRate: 1, fadeInSec: 0, fadeOutSec: 0 });
    this.emit('tracks');
    this.emit('duration', this.getDuration());
    if (this.playing) this.restart();
    return id;
  }

  removeClip(trackId: TrackId, clipId: string) {
    const t = this.tracks.get(trackId);
    if (!t) return;
    t.clips = t.clips.filter(c => c.id !== clipId);
    this.emit('duration', this.getDuration());
  }

  moveClip(trackId: TrackId, clipId: string, newBeginTime: number, targetTrackId?: TrackId) {
    const src = this.tracks.get(trackId);
    if (!src) return;
    const idx = src.clips.findIndex(c => c.id === clipId);
    if (idx < 0) return;
    const clip = src.clips[idx]!;
    // Remove from source if moving across tracks
    if (targetTrackId && targetTrackId !== trackId) {
      src.clips.splice(idx, 1);
      const dst = this.tracks.get(targetTrackId);
      if (!dst) return;
      clip.beginTime = Math.max(0, newBeginTime);
      dst.clips.push(clip);
    } else {
      clip.beginTime = Math.max(0, newBeginTime);
    }
    this.emit('tracks');
    this.emit('duration', this.getDuration());
    if (this.playing) this.restart();
  }

  setClipBounds(trackId: TrackId, clipId: string, newBeginTime: number, newOffsetSec: number, newDurationSec: number) {
    const t = this.tracks.get(trackId); if (!t) return;
    const c = t.clips.find(c => c.id === clipId); if (!c) return;
    c.beginTime = Math.max(0, newBeginTime);
    c.offsetSec = Math.max(0, newOffsetSec);
    c.durationSec = Math.max(0, newDurationSec);
    this.emit('tracks');
    this.emit('duration', this.getDuration());
    if (this.playing) this.restart();
  }

  trimClip(trackId: TrackId, clipId: string, newBegin: number, newEnd: number) {
    const t = this.tracks.get(trackId); if (!t) return;
    const c = t.clips.find(c => c.id === clipId); if (!c) return;
    const oldEnd = c.beginTime + c.durationSec;
    const deltaLeft = Math.max(0, newBegin - c.beginTime);
    const deltaRight = Math.max(0, oldEnd - newEnd);
    const newOffset = c.offsetSec + deltaLeft;
    const newDuration = Math.max(0, c.durationSec - deltaLeft - deltaRight);
    this.setClipBounds(trackId, clipId, Math.max(0, newBegin), newOffset, newDuration);
  }

  splitClip(trackId: TrackId, clipId: string, atTimeAbs: number) {
    const t = this.tracks.get(trackId); if (!t) return;
    const idx = t.clips.findIndex(c => c.id === clipId); if (idx < 0) return;
    const c = t.clips[idx]!;
    const rel = atTimeAbs - c.beginTime; if (rel <= 0 || rel >= c.durationSec) return;
    const first: Clip = { id: crypto.randomUUID(), buffer: c.buffer, beginTime: c.beginTime, offsetSec: c.offsetSec, durationSec: rel, fadeInSec: 0, fadeOutSec: 0 };
    const second: Clip = { id: crypto.randomUUID(), buffer: c.buffer, beginTime: c.beginTime + rel, offsetSec: c.offsetSec + rel, durationSec: c.durationSec - rel, fadeInSec: 0, fadeOutSec: 0 };
    // Replace original with two new clips
    t.clips.splice(idx, 1, first, second);
    this.emit('tracks');
    this.emit('duration', this.getDuration());
    if (this.playing) this.restart();
  }

  getDuration(): number {
    let d = 0;
    for (const t of this.tracks.values()) {
      for (const c of t.clips) d = Math.max(d, c.beginTime + c.durationSec);
    }
    return d;
  }

  getCurrentTime(): number { return this.playing ? this.offset + (this.ctx.currentTime - this.startAbs) * this.globalRate : this.offset; }

  async resumeContext() { if (this.ctx.state !== 'running') await this.ctx.resume(); }

  async play() {
    if (this.playing) return;
    await this.resumeContext();
    this.startAbs = this.ctx.currentTime;
    this.playing = true;
    this.scheduleAll();
    this.pumpTime();
  }

  pause() {
    if (!this.playing) return;
    this.offset = this.getCurrentTime();
    this.stopAll();
    this.playing = false;
    this.emit('time', this.offset);
  }

  /** Stop any active selection preview */
  stopSelectionPreview() {
    try { if (this.previewSource) this.previewSource.stop(); } catch {}
    try { if (this.previewSource) this.previewSource.disconnect(); } catch {}
    this.previewSource = null;
    if (this.previewStopTimer != null) { try { clearTimeout(this.previewStopTimer); } catch {} this.previewStopTimer = null; }
  }

  /** Play only a clip region [startAbs, endAbs) without starting the transport */
  async playSelectionPreview(trackId: string, clipId: string, startAbs: number, endAbs: number) {
    // Stop any current preview and pause transport to avoid overlap
    this.stopSelectionPreview();
    if (this.playing) this.pause();
    await this.resumeContext();
    const t = this.tracks.get(trackId); if (!t) return;
    const c = t.clips.find(c => c.id === clipId); if (!c) return;
    const start = Math.max(c.beginTime, Math.min(c.beginTime + c.durationSec, startAbs));
    const end = Math.max(start, Math.min(c.beginTime + c.durationSec, endAbs));
    const rel = start - c.beginTime;
    const offset = c.offsetSec + rel;
    const dur = Math.max(0, end - start);
    if (dur <= 0) return;
    const src = this.ctx.createBufferSource();
    src.buffer = c.buffer;
    const clipRate = (c as any).playbackRate || 1;
    src.playbackRate.value = t.playbackRate * clipRate;
    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(t.gain);
    try { src.start(0, offset, dur); } catch {}
    this.previewSource = src;
    // Best-effort stop timer in case onended doesn't fire (mobile quirks)
    const ms = Math.ceil(dur * 1000) + 30;
    this.previewStopTimer = window.setTimeout(() => this.stopSelectionPreview(), ms) as any;
    src.onended = () => this.stopSelectionPreview();
  }

  seek(timeSec: number) {
    this.offset = Math.max(0, timeSec);
    if (this.playing) this.restart(); else this.emit('time', this.offset);
  }

  private restart() {
    this.stopAll();
    this.startAbs = this.ctx.currentTime;
    this.playing = true;
    this.scheduleAll();
  }

  private stopTrack(t: Track) {
    for (const s of t.activeSources) { try { s.stop(); } catch {} s.disconnect(); }
    t.activeSources.clear();
  }

  private stopAll() {
    for (const t of this.tracks.values()) this.stopTrack(t);
  }

  private anySolo(): boolean { for (const t of this.tracks.values()) if (t.solo) return true; return false; }

  private scheduleAll() {
    const now = this.ctx.currentTime;
    const t0 = this.offset;
    const soloed = this.anySolo();
    for (const t of this.tracks.values()) {
      this.stopTrack(t);
      if (t.muted) continue;
      if (soloed && !t.solo) continue;
      // Apply volume envelope automation on the track gain, relative to playhead (t0).
      try {
        const env = t.volumeEnvelope || [];
        const valueAt = (sec: number) => {
          const sorted = env.slice().sort((a,b)=>a.time-b.time);
          if (sorted.length === 0) return 1;
          if (sec <= sorted[0]!.time) return sorted[0]!.value;
          for (let i=0;i<sorted.length-1;i++) {
            const a = sorted[i]!; const b = sorted[i+1]!;
            if (sec >= a.time && sec <= b.time) {
              const r = (sec - a.time) / Math.max(1e-6, (b.time - a.time));
              return a.value + r * (b.value - a.value);
            }
          }
          return sorted[sorted.length-1]!.value;
        };
        t.gain.gain.cancelScheduledValues(0);
        const startVal = valueAt(t0);
        t.gain.gain.setValueAtTime(startVal, now);
        const sorted = env.slice().sort((a,b)=>a.time-b.time);
        for (const p of sorted) {
          const when = now + Math.max(0, p.time - t0);
          t.gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(2, p.value)), when);
        }
      } catch {}
      for (const c of t.clips) {
        const rel = c.beginTime - t0; // when this clip should start relative to playhead
        const startAt = Math.max(0, rel);
        const offset = rel < 0 ? -rel + c.offsetSec : c.offsetSec;
        const dur = Math.max(0, c.durationSec - (offset - c.offsetSec));
        if (dur <= 0) continue;
        const src = this.ctx.createBufferSource();
        src.buffer = c.buffer;
        const clipRate = (c as any).playbackRate || 1;
        src.playbackRate.value = t.playbackRate * clipRate;
        // Per-clip gain to support fades
        const clipGain = this.ctx.createGain();
        clipGain.gain.cancelScheduledValues(0);
        clipGain.gain.setValueAtTime(1, now + startAt);
        const fin = DISABLE_FADES ? 0 : Math.max(0, c.fadeInSec || 0);
        const fout = DISABLE_FADES ? 0 : Math.max(0, c.fadeOutSec || 0);
        if (fin > 0) {
          clipGain.gain.setValueAtTime(0, now + startAt);
          clipGain.gain.linearRampToValueAtTime(1, now + startAt + Math.min(fin, dur));
        }
        if (fout > 0) {
          const endAt = now + startAt + dur;
          const fadeStart = Math.max(now + startAt, endAt - Math.min(fout, dur));
          clipGain.gain.setValueAtTime(1, fadeStart);
          clipGain.gain.linearRampToValueAtTime(0, endAt);
        }
        src.connect(clipGain);
        clipGain.connect(t.gain);
        try { src.start(now + startAt, offset, dur); } catch {}
        t.activeSources.add(src);
        src.onended = () => t.activeSources.delete(src);
      }
    }
  }

  private pumpTime() {
    if (!this.playing) return;
    this.emit('time', this.getCurrentTime());
    requestAnimationFrame(() => this.pumpTime());
  }

  // Offline rendering of current project mix.
  async renderOffline(): Promise<AudioBuffer> {
    const duration = this.getDuration();
    if (duration <= 0) throw new Error('Nothing to render');
    const sampleRate = this.ctx.sampleRate;
    const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const masterGain = offline.createGain();
    masterGain.gain.value = this.masterGain.gain.value;
    masterGain.connect(offline.destination);

    const soloed = this.anySolo();
    for (const t of this.tracks.values()) {
      if (t.muted) continue;
      if (soloed && !t.solo) continue;
      const gain = offline.createGain();
      gain.gain.value = t.gain.gain.value;
      const pan = (offline as any).createStereoPanner ? (offline as any).createStereoPanner() as StereoPannerNode : undefined;
      if (pan) {
        (pan as StereoPannerNode).pan.value = t.pan?.pan.value ?? 0;
        gain.connect(pan);
        (pan as StereoPannerNode).connect(masterGain);
      } else {
        gain.connect(masterGain);
      }
      // Track envelope automation in offline
      try {
        const env = (t.volumeEnvelope || []).slice().sort((a,b)=>a.time-b.time);
        const valueAt = (sec: number) => {
          if (env.length === 0) return 1;
          if (sec <= env[0]!.time) return env[0]!.value;
          for (let i=0;i<env.length-1;i++) { const a=env[i]!; const b=env[i+1]!; if (sec>=a.time && sec<=b.time) { const r=(sec-a.time)/Math.max(1e-6, (b.time-a.time)); return a.value + r*(b.value-a.value); } }
          return env[env.length-1]!.value;
        };
        const param = gain.gain as AudioParam;
        param.cancelScheduledValues(0);
        param.setValueAtTime(valueAt(0), 0);
        for (const p of env) param.linearRampToValueAtTime(Math.max(0, Math.min(2, p.value)), Math.max(0, p.time));
      } catch {}

      for (const c of t.clips) {
        const src = offline.createBufferSource();
        src.buffer = c.buffer;
        const clipRate2 = (c as any).playbackRate || 1;
        src.playbackRate.value = t.playbackRate * clipRate2;
        src.connect(gain);
        try { src.start(c.beginTime, c.offsetSec, c.durationSec); } catch {}
      }
    }
    const rendered = await offline.startRendering();
    return rendered;
  }

  // Envelope API for tracks
  getTrackVolumeEnvelopePoints(id: TrackId): Array<{time:number; value:number}> {
    const t = this.tracks.get(id); return t?.volumeEnvelope ? t.volumeEnvelope.slice() : [];
  }
  setTrackVolumeEnvelopePoints(id: TrackId, pts: Array<{time:number; value:number}>) {
    const t = this.tracks.get(id); if (!t) return;
    t.volumeEnvelope = (pts || []).map(p => ({ time: Math.max(0, p.time||0), value: Math.max(0, Math.min(2, p.value||0)) })).sort((a,b)=>a.time-b.time);
    this.emit('tracks');
    if (this.playing) this.restart();
  }

  async exportWav(bitDepth: 16 | 32 = 16): Promise<ExportResult> {
    const buffer = await this.renderOffline();
    const { blob } = audioBufferToWav(buffer, bitDepth);
    const url = URL.createObjectURL(blob);
    return { blob, url, size: blob.size, mime: 'audio/wav' };
  }

  // Duplicate clip: create a copy placed immediately after the source clip.
  duplicateClip(trackId: TrackId, clipId: string) {
    const t = this.tracks.get(trackId); if (!t) return;
    const idx = t.clips.findIndex(c => c.id === clipId); if (idx < 0) return;
    const c = t.clips[idx]!;
    const id = crypto.randomUUID();
    const copy: Clip = {
      id,
      buffer: c.buffer,
      beginTime: c.beginTime + c.durationSec,
      offsetSec: c.offsetSec,
      durationSec: c.durationSec,
      fadeInSec: c.fadeInSec,
      fadeOutSec: c.fadeOutSec,
    };
    t.clips.splice(idx + 1, 0, copy);
    this.emit('tracks');
    this.emit('duration', this.getDuration());
    if (this.playing) this.restart();
    return id;
  }

  setClipFade(trackId: TrackId, clipId: string, fadeInSec: number, fadeOutSec: number) {
    const t = this.tracks.get(trackId); if (!t) return;
    const c = t.clips.find(c => c.id === clipId); if (!c) return;
    if (DISABLE_FADES) {
      c.fadeInSec = 0;
      c.fadeOutSec = 0;
    } else {
      c.fadeInSec = Math.max(0, fadeInSec || 0);
      c.fadeOutSec = Math.max(0, fadeOutSec || 0);
    }
    this.emit('tracks');
    if (this.playing) this.restart();
  }

  setClipPlaybackRate(trackId: TrackId, clipId: string, rate: number) {
    const t = this.tracks.get(trackId); if (!t) return;
    const c = t.clips.find(c => c.id === clipId); if (!c) return;
    (c as any).playbackRate = Math.max(0.25, Math.min(4, Number(rate) || 1));
    if (this.playing) this.restart(); else this.emit('tracks');
  }
}

// Helper: AudioBuffer -> WAV Blob
function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 32) {
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

  // Interleave and write
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
