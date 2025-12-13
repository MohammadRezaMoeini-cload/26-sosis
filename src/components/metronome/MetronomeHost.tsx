import React, { useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore
import { useMetronome } from './metronome test/hooks/useMetronome';

type MetroState = {
  playing: boolean;
  tempo: number;
  timeSignature: { beatsPerMeasure: number; beatValue: number };
  subdivision: number;
  accentLevels: number[];
  soundType: string;
  masterVolume: number;
};

export default function MetronomeHost() {
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [timeSignature, setTimeSignature] = useState({ beatsPerMeasure: 4, beatValue: 4 });
  const [subdivision, setSubdivision] = useState(0);
  const [accentLevels, setAccentLevels] = useState<number[]>([4, 2, 2, 2]);
  const [soundType, setSoundType] = useState('sine');
  const [masterVolume, setMasterVolume] = useState(0.8);

  // Drive audio engine (no UI)
  useMetronome(
    tempo,
    timeSignature,
    subdivision,
    playing,
    accentLevels,
    soundType,
    masterVolume,
    (beat: number) => {
      try {
        window.dispatchEvent(new CustomEvent('mix:metroBeat', { detail: { beat } }));
      } catch {}
    }
  );

  const publishState = () => {
    const detail: MetroState = { playing, tempo, timeSignature, subdivision, accentLevels, soundType, masterVolume };
    try { window.dispatchEvent(new CustomEvent('mix:metroState', { detail })); } catch {}
  };

  useEffect(() => { publishState(); }, [playing, tempo, timeSignature, subdivision, accentLevels, soundType, masterVolume]);

  useEffect(() => {
    const api = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      toggle: () => setPlaying(p => !p),
      setTempo: (v: number) => setTempo(Math.max(10, Math.min(500, Number(v) || 0))),
      setTimeSignature: (bpm: number, denom: number) => setTimeSignature({ beatsPerMeasure: Math.max(1, Math.floor(bpm || 4)), beatValue: Math.max(1, Math.floor(denom || 4)) }),
      setSubdivision: (i: number) => setSubdivision(Math.max(0, Math.floor(i || 0))),
      setAccentLevels: (arr: number[]) => setAccentLevels(Array.isArray(arr) ? arr.slice(0) : [4,2,2,2]),
      setSoundType: (s: string) => setSoundType(String(s || 'sine')),
      setVolume: (v: number) => setMasterVolume(Math.max(0, Math.min(1, Number(v) || 0))),
      getState: (): MetroState => ({ playing, tempo, timeSignature, subdivision, accentLevels, soundType, masterVolume }),
    };
    (window as any).mix_metro = api;
    publishState();
    return () => { try { delete (window as any).mix_metro; } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hidden host
  return <div style={{ display: 'none' }} aria-hidden="true" />;
}

