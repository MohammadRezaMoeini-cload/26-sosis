// Classic worker for MP3 encoding using lame.js placed in /public.
// Expects Float32 PCM channels via transferable ArrayBuffers.

self.onmessage = function (e) {
  const data = e.data || {};
  if (data.type !== 'mp3') return;
  const { channels, sampleRate, kbps = 192 } = data;
  try {
    // Load lame.js from public root. It defines a global function lamejs().
    self.importScripts('/lame.js');
    if (typeof self.lamejs === 'function') {
      // Initialize and expose Mp3Encoder on self.
      self.lamejs();
    }
    const Mp3Encoder = self.Mp3Encoder;
    if (!Mp3Encoder) throw new Error('Mp3Encoder not found. Ensure /lame.js is available.');
    const numCh = Math.min(2, (channels && channels.length) ? channels.length : 1);
    const ch0 = new Float32Array(channels[0]);
    const ch1 = numCh > 1 ? new Float32Array(channels[1]) : ch0;
    const length = Math.max(ch0.length, ch1.length);
    const toInt16 = (f32, begin, end) => {
      const out = new Int16Array(end - begin);
      for (let i = begin, j = 0; i < end; i++, j++) {
        const s = Math.max(-1, Math.min(1, f32[i] || 0));
        out[j] = s < 0 ? (s * 0x8000) : (s * 0x7FFF);
      }
      return out;
    };
    const enc = new Mp3Encoder(numCh, sampleRate, kbps);
    const CHUNK = 1152;
    const parts = [];
    for (let i = 0; i < length; i += CHUNK) {
      const end = Math.min(length, i + CHUNK);
      const left = toInt16(ch0, i, end);
      const right = numCh > 1 ? toInt16(ch1, i, end) : left;
      const mp3buf = enc.encodeBuffer(left, right);
      if (mp3buf && mp3buf.length) parts.push(mp3buf);
    }
    const last = enc.flush();
    if (last && last.length) parts.push(last);
    // Concatenate Int8Array parts into a Blob.
    const blob = new Blob(parts, { type: 'audio/mpeg' });
    self.postMessage({ ok: true, blob });
  } catch (err) {
    self.postMessage({ ok: false, error: (err && err.message) || String(err) });
  }
};

