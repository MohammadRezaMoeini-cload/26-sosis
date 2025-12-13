import { useEffect, useMemo, useRef, useState } from 'react';
import { SOUND_SAMPLES, getSubdivisionPatterns } from '../constants';

// Lightweight metronome scheduler using Web Audio API.
// Supports oscillator types (sine/square/triangle/sawtooth) and sample playback via SOUND_SAMPLES.
// Schedules primary beat + subdivision ticks with short click envelopes.
export function useMetronome(
  tempo,
  timeSignature, // { beatsPerMeasure, beatValue }
  subdivision, // index into getSubdivisionPatterns(beatValue)
  isPlaying,
  accentLevels, // array length beatsPerMeasure (0..4)
  soundType, // 'sine' | 'square' | 'triangle' | 'sawtooth' | 'woodblock' | 'tabla'
  masterVolume,
  onTick // (beatIndex) => void
) {
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const timerIdRef = useRef(0);
  const nextTimeRef = useRef(0);
  const beatIndexRef = useRef(0);
  const decodedSamplesRef = useRef({});
  const accentRef = useRef([]);

  // Keep latest accent levels without restarting the scheduler on every change
  useEffect(() => {
    accentRef.current = Array.isArray(accentLevels) ? accentLevels.slice() : [];
  }, [accentLevels]);

  // Create audio context + graph once
  useEffect(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, masterVolume || 0.8));
      gain.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = gain;
    }
    return () => {
      // Ensure metronome audio stops immediately on unmount
      const ctx = ctxRef.current;
      try { if (ctx && ctx.state !== 'closed') ctx.suspend(); } catch {}
      try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch {}
      ctxRef.current = null;
      masterGainRef.current = null;
    };
  }, []);

  // Update master volume smoothly
  useEffect(() => {
    const gain = masterGainRef.current;
    const ctx = ctxRef.current;
    if (gain && ctx) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(0);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, masterVolume || 0)), now + 0.02);
    }
  }, [masterVolume]);

  // Decode sample buffers on-demand
  useEffect(() => {
    const ctx = ctxRef.current;
    const wantsSample = soundType && !(soundType === 'sine' || soundType === 'square' || soundType === 'triangle' || soundType === 'sawtooth');
    if (!ctx || !wantsSample) return;
    if (decodedSamplesRef.current[soundType]) return;
    const b64 = SOUND_SAMPLES[soundType];
    if (!b64) return; // no custom samples provided; fallback will be oscillator
    try {
      const arr = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      ctx.decodeAudioData(arr.buffer.slice(0)).then(buf => {
        decodedSamplesRef.current[soundType] = buf;
      }).catch(() => {});
    } catch {
      // ignore decode errors; use oscillator fallback
    }
  }, [soundType]);

  const beatDurSec = useMemo(() => {
    const qps = 60 / Math.max(1, tempo || 120); // seconds per quarter note
    const ratio = 4 / Math.max(1, timeSignature?.beatValue || 4);
    return qps * ratio; // seconds per beat (based on denominator)
  }, [tempo, timeSignature?.beatValue]);

  // Schedule a click at absolute AudioContext time
  const scheduleClick = (time, isPrimary, intensity) => {
    const ctx = ctxRef.current;
    const out = masterGainRef.current;
    if (!ctx || !out) return;

    const normalizedIntensity = Math.max(0, Math.min(4, intensity ?? 2)); // 0..4
    const level = 0.25 + (normalizedIntensity / 4) * 0.5; // 0.25..0.75

    const useOsc = !decodedSamplesRef.current[soundType];
    if (useOsc || soundType === 'sine' || soundType === 'square' || soundType === 'triangle' || soundType === 'sawtooth') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      try { osc.type = (['sine','square','triangle','sawtooth'].includes(soundType) ? soundType : 'square'); } catch {}
      // Emphasize primary beats with higher frequency
      const base = isPrimary ? 1100 : 800;
      const freq = base + normalizedIntensity * (isPrimary ? 80 : 50);
      osc.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(0.0001, time);
      // very short click envelope
      g.gain.exponentialRampToValueAtTime(level, time + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
      osc.connect(g);
      g.connect(out);
      try { osc.start(time); osc.stop(time + 0.07); } catch {}
    } else {
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = decodedSamplesRef.current[soundType];
      // Simple per-click gain envelope
      const peak = (isPrimary ? 1.0 : 0.8) * level;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
      src.connect(g); g.connect(out);
      try { src.start(time); } catch {}
    }
  };

  // Main scheduler
  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    let cancelled = false;
    const lookaheadMs = 25; // timer interval
    const scheduleAheadSec = 0.12; // schedule horizon

    const patterns = getSubdivisionPatterns(timeSignature?.beatValue || 4);
    const pattern = patterns[subdivision] || { notes: [{ timeOffset: 0, isPrimary: true }] };

    const schedule = () => {
      if (cancelled) return;
      const now = ctx.currentTime;
      while (nextTimeRef.current < now + scheduleAheadSec) {
        const beatIdx = beatIndexRef.current;
        const acc = accentRef.current || [];
        const intensity = (acc[beatIdx] ?? 2);
        // schedule primary + subdivision clicks within this beat
        const notes = Array.isArray(pattern?.notes) && pattern.notes.length > 0 ? pattern.notes : [{ timeOffset: 0, isPrimary: true }];
        for (const n of notes) {
          const at = nextTimeRef.current + Math.max(0, Number(n.timeOffset || 0)) * beatDurSec;
          const isPrimary = !!n.isPrimary || n.timeOffset === 0;
          scheduleClick(at, isPrimary, intensity);
          if (isPrimary && typeof onTick === 'function' && (at - now) < 0.05) {
            // Notify UI near-real-time; avoid flooding for non-primary
            try { onTick(beatIdx); } catch {}
          }
        }
        // advance to next beat
        nextTimeRef.current += beatDurSec;
        beatIndexRef.current = (beatIndexRef.current + 1) % Math.max(1, timeSignature?.beatsPerMeasure || 4);
      }
      timerIdRef.current = window.setTimeout(schedule, lookaheadMs);
    };

    // Start/stop
    if (isPlaying) {
      if (ctx.state === 'suspended') ctx.resume();
      if (!timerIdRef.current) {
        // align next beat slightly ahead to avoid immediate cutoff
        nextTimeRef.current = ctx.currentTime + 0.05;
        schedule();
      }
    } else {
      if (timerIdRef.current) {
        window.clearTimeout(timerIdRef.current);
        timerIdRef.current = 0;
      }
      // Reset visual beat on stop; next start begins at beat 0
      beatIndexRef.current = 0;
      // Best-effort immediate audio halt
      try { if (ctx.state === 'running') ctx.suspend(); } catch {}
    }

    return () => {
      cancelled = true;
      if (timerIdRef.current) { window.clearTimeout(timerIdRef.current); timerIdRef.current = 0; }
    };
  }, [isPlaying, tempo, timeSignature?.beatsPerMeasure, timeSignature?.beatValue, subdivision, beatDurSec, soundType, onTick]);

  return { audioContext: ctxRef.current };
}

export default useMetronome;

