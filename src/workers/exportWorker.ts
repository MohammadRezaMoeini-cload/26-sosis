// Simple WAV encoder worker

type WavJob = {
  type: 'wav';
  channels: Float32Array[]; // interleaved per channel arrays
  sampleRate: number;
  bitDepth: 16 | 32;
};

self.onmessage = (e: MessageEvent<WavJob>) => {
  const { type } = e.data;
  if (type === 'wav') {
    const { channels, sampleRate, bitDepth } = e.data;
    const numCh = channels.length;
    const length = channels[0]?.length || 0;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numCh * bytesPerSample;
    const dataSize = length * blockAlign;
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
    dv.setUint16(34, bitDepth, true);
    writeString(dv, 36, 'data');
    dv.setUint32(40, dataSize, true);
    let offset = 44;
    for (let i = 0; i < length; i++) {
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
    (self as any).postMessage({ ok: true, blob }, [ab]);
  }
};

function writeString(dv: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
}

export {};
