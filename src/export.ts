import { AudioEngine } from './engine/AudioEngine';
import { ExportResult } from './engine/types';

export async function exportWavViaWorker(engine: AudioEngine, bitDepth: 16 | 32 = 16): Promise<ExportResult> {
  const buffer = await engine.renderOffline();
  const channels = [...Array(buffer.numberOfChannels)].map((_, i) => buffer.getChannelData(i));
  const worker = new Worker(new URL('./workers/exportWorker.ts', import.meta.url), { type: 'module' });
  const result: ExportResult = await new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ ok: boolean; blob: Blob }>) => {
      if (!e.data || !e.data.ok) return reject(new Error('Export failed'));
      const blob = e.data.blob;
      resolve({ blob, url: URL.createObjectURL(blob), size: blob.size, mime: 'audio/wav' });
      worker.terminate();
    };
    worker.onerror = (err) => { worker.terminate(); reject(err); };
    worker.postMessage({ type: 'wav', channels, sampleRate: buffer.sampleRate, bitDepth });
  });
  return result;
}

export async function exportMp3ViaWorker(engine: AudioEngine, kbps = 192): Promise<ExportResult> {
  const buffer = await engine.renderOffline();
  const channels = [...Array(buffer.numberOfChannels)].map((_, i) => buffer.getChannelData(i));
  // Use classic worker in public/ to importScripts lame.js
  const worker = new Worker('/mp3Worker.js');
  const result: ExportResult = await new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<{ ok: boolean; blob?: Blob; error?: string }>) => {
      if (!e.data || !e.data.ok || !e.data.blob) {
        worker.terminate();
        return reject(new Error(e.data?.error || 'MP3 export failed'));
      }
      const blob = e.data.blob;
      resolve({ blob, url: URL.createObjectURL(blob), size: blob.size, mime: 'audio/mpeg' });
      worker.terminate();
    };
    worker.onerror = (err) => { worker.terminate(); reject(err); };
    // Transfer ArrayBuffers for efficiency
    const transfers = channels.map((f) => f.buffer);
    worker.postMessage({ type: 'mp3', channels, sampleRate: buffer.sampleRate, kbps }, transfers as any);
  });
  return result;
}

