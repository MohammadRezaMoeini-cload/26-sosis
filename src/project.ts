import { AudioEngine } from './engine/AudioEngine';

type EffectSnapshot = { id: number; fields: Record<string, number | boolean> };
type ProjectV1 = {
  format: 'mixmaster-project/v1';
  assets: Record<string, { mime: string; dataUrl: string }>;
  tracks: Array<{
    name: string;
    gain: number;
    pan?: number;
    muted: boolean;
    solo: boolean;
    effects?: EffectSnapshot[]; // optional, legacy only
    envPts?: Array<{ time: number; value: number }>; // track volume envelope (optional)
    clips: Array<{
      assetId: string;
      beginTime: number;
      offsetSec: number;
      durationSec: number;
      fadeInSec?: number;
      fadeOutSec?: number;
    }>;
  }>;
  masterEffects?: EffectSnapshot[]; // optional, legacy only
};

export async function exportProject(engine: AudioEngine): Promise<{ blob: Blob; url: string; size: number }> {
  const tracks = engine.getTracks();
  // Collect unique buffers
  const bufIds = new Map<AudioBuffer, string>();
  const assets: ProjectV1['assets'] = {};
  let nextId = 1;
  const tracksOut: ProjectV1['tracks'] = [];
  for (const t of tracks) {
    const tOut: ProjectV1['tracks'][number] = {
      name: (t as any).name || 'Track',
      gain: t.gain.gain.value,
      pan: t.pan?.pan.value ?? 0,
      muted: t.muted,
      solo: t.solo,
      clips: []
    };
    // Track envelope points
    try { tOut.envPts = engine.getTrackVolumeEnvelopePoints(t.id); } catch { tOut.envPts = undefined; }
    for (const c of t.clips) {
      let id = bufIds.get(c.buffer);
      if (!id) {
        id = `a${nextId++}`;
        bufIds.set(c.buffer, id);
        const { blob } = audioBufferToWav(c.buffer, 16);
        const dataUrl = await blobToDataURL(blob);
        assets[id] = { mime: 'audio/wav', dataUrl };
      }
      tOut.clips.push({
        assetId: id,
        beginTime: c.beginTime,
        offsetSec: c.offsetSec,
        durationSec: c.durationSec,
        fadeInSec: c.fadeInSec || 0,
        fadeOutSec: c.fadeOutSec || 0,
      });
    }
    tracksOut.push(tOut);
  }
  const project: ProjectV1 = { format: 'mixmaster-project/v1', assets, tracks: tracksOut };
  const json = JSON.stringify(project);
  const blob = new Blob([json], { type: 'application/json' });
  return { blob, url: URL.createObjectURL(blob), size: blob.size };
}

export async function importProject(engine: AudioEngine, file: File): Promise<void> {
  const text = await file.text();
  const project = JSON.parse(text) as ProjectV1;
  if (!project || project.format !== 'mixmaster-project/v1') throw new Error('Invalid project');
  // Decode assets into AudioBuffers
  const ctx = engine.getContext();
  const assetBuffers = new Map<string, AudioBuffer>();
  for (const [id, a] of Object.entries(project.assets)) {
    const ab = dataURLToArrayBuffer(a.dataUrl);
    const buf = await ctx.decodeAudioData(ab);
    assetBuffers.set(id, buf);
  }
  // Reset engine by removing all tracks
  for (const t of engine.getTracks()) engine.removeTrack(t.id);
  // Recreate tracks
  for (const t of project.tracks) {
    const tid = engine.createTrack(t.name);
    engine.setTrackGain(tid, t.gain);
    if (typeof t.pan === 'number') engine.setTrackPan(tid, t.pan);
    engine.setTrackMute(tid, t.muted);
    engine.setTrackSolo(tid, t.solo);
    // Restore envelope (if provided)
    try { if (t.envPts && Array.isArray(t.envPts)) engine.setTrackVolumeEnvelopePoints(tid, t.envPts); } catch {}
    for (const c of t.clips) {
      const buf = assetBuffers.get(c.assetId);
      if (!buf) continue;
      const cid = engine.addClip(tid, buf, c.beginTime, c.offsetSec, c.durationSec);
      engine.setClipFade(tid, cid, c.fadeInSec || 0, c.fadeOutSec || 0);
    }
  }
}

// Utilities (duplicated from AudioEngine to avoid circular deps)
function audioBufferToWav(buffer: AudioBuffer, bitDepth: 16 | 32) {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = buffer.length * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  writeString(dv, 0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); writeString(dv, 8, 'WAVE');
  writeString(dv, 12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true); dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * blockAlign, true); dv.setUint16(32, blockAlign, true);
  dv.setUint16(34, bitDepth, true); writeString(dv, 36, 'data'); dv.setUint32(40, dataSize, true);
  const channels: Float32Array[] = Array.from({ length: numCh }, (_, i) => buffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, (channels[ch]![i] || 0)));
      if (bitDepth === 16) { const v = s < 0 ? s * 0x8000 : s * 0x7FFF; dv.setInt16(offset, v, true); offset += 2; }
      else { dv.setInt32(offset, s < 0 ? s * 0x80000000 : s * 0x7FFFFFFF, true); offset += 4; }
    }
  }
  const blob = new Blob([ab], { type: 'audio/wav' });
  return { blob };
}
function writeString(dv: DataView, offset: number, str: string) { for (let i = 0; i < str.length; i++) dv.setUint8(offset + i, str.charCodeAt(i)); }
function blobToDataURL(blob: Blob): Promise<string> { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); }); }
function dataURLToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64 = dataUrl.split(',')[1] || '';
  const raw = atob(base64);
  const ab = new ArrayBuffer(raw.length);
  const ua = new Uint8Array(ab);
  for (let i = 0; i < raw.length; i++) ua[i] = raw.charCodeAt(i);
  return ab;
}
