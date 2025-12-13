import React, { useEffect, useMemo, useRef, useState } from 'react';
import Transport from './components/Transport';
import Timeline from './components/Timeline';
import EffectsPanel from './components/EffectsPanel';
import { useEngine } from './hooks/useEngine';
import MetronomeModal from './components/metronome/MetronomeModal';
import RhythmLibrary from './components/RhythmLibrary';
import RythemModal from './components/Rythem/RythemModal';
import LoadingOverlay from './components/LoadingOverlay';
import CountdownOverlay from './components/CountdownOverlay';
import RecordingSettingsModal from './components/RecordingSettingsModal';
import MiniMetronome from './components/metronome/MiniMetronome';
import { exportProject as exportProjectFile, importProject as importProjectFile } from './project';
import { quantizePxPerSecToLegacy } from './legacy/legacyScale';
import type { Track, Clip } from './engine/types';

export default function App() {
  const api = useEngine();
  const { engine, time, duration, tracks, playing } = api;
  const legacy = (api as any).legacy === true;
  // Old sidebar + FX drawer removed in favor of compact layout
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Inline recording (no modal)
  const recMediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<any>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [masterFxOpen, setMasterFxOpen] = useState(false);
  const [masterSettingsOpen, setMasterSettingsOpen] = useState(false);
  const [rhythmOpen, setRhythmOpen] = useState(false);
  // Per-clip fade editing moved to Timeline overlays; header inputs removed.

  // Cache static waveforms per track to avoid recomputation every render
  const waveCache = useRef<Map<string, Float32Array>>(new Map());
  const [, forceTick] = useState(0);
  const [selected, setSelected] = useState<{ trackId: string; clipId: string } | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const tracksRef = useRef<Track[]>(tracks as unknown as Track[]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  const prevTrackIdsRef = useRef<string[]>([]);
  const [metronomeOpen, setMetronomeOpen] = useState(false);
  const baseTempoRef = useRef<number>(120);
  // Ruler/grid mode and musical scale
  const [rulerMode, setRulerMode] = useState<'time' | 'bars'>('time');
  const [rulerTempo, setRulerTempo] = useState<number>(120);
  const [rulerTS, setRulerTS] = useState<{ beatsPerMeasure: number; beatValue: number }>({ beatsPerMeasure: 4, beatValue: 4 });
  const [rulerSubdivision, setRulerSubdivision] = useState<number>(0);
  // Lifted zoom for timeline → footer control
  const [zoom, setZoom] = useState<number>(10);
  // rAF-throttled zoom setter; snap to legacy scale only after idle
  const zoomRafRef = useRef<number | null>(null);
  const lastZoomRef = useRef<number>(zoom);
  const zoomIdleRef = useRef<number | null>(null);
  const setZoomSmooth = (z: number) => {
    lastZoomRef.current = z;
    if (zoomRafRef.current == null) {
      zoomRafRef.current = requestAnimationFrame(() => {
        zoomRafRef.current = null;
        // apply raw value during drag for smoothness
        setZoom(lastZoomRef.current);
      });
    }
    // defer quantization to avoid jumpy UI while dragging
    if (legacy) {
      try { if (zoomIdleRef.current) { window.clearTimeout(zoomIdleRef.current as any); } } catch { }
      zoomIdleRef.current = window.setTimeout(() => {
        setZoom((v) => {
          // For legacy engine, keep integer px/sec to allow finer granularity
          // and avoid coarse legacy snapping; still clamp to sane bounds.
          const clamped = Math.max(10, Math.min(1200, v));
          return Math.round(clamped);
        });
      }, 120) as any;
    }
  };
  // Global touch fade mode (mobile)
  const [freezeTouch, setFreezeTouch] = useState<boolean>(false);
  const [isArming, setIsArming] = useState(false);
  const wasPlayingBeforeArmRef = useRef(false);
  const [footerMenuOpen, setFooterMenuOpen] = useState(false);
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  // Force remount of Timeline on hard reset
  const [timelineKey, setTimelineKey] = useState(0);
  useEffect(() => {
    return () => {
      try { if (zoomIdleRef.current) window.clearTimeout(zoomIdleRef.current as any); } catch { }
      try { if (zoomRafRef.current != null) cancelAnimationFrame(zoomRafRef.current); } catch { }
    };
  }, []);

  // Delete all tracks and reset UI to initial state
  const handleHardReset = async () => {
    try { api.pause(); } catch {}
    const ok = typeof window !== 'undefined' && (window as any).confirm
      ? (window as any).confirm('Remove all tracks and reset the project?')
      : true;
    if (!ok) return;
    try {
      const ids: string[] = (tracksRef.current || tracks || []).map((t: any) => String(t.id));
      for (const id of ids) {
        try {
          const p = (api as any).deleteTrack?.(id);
          if (p && typeof (p as any).then === 'function') await p;
        } catch {}
      }
    } catch {}
    try { api.seek(0); } catch {}
    setSelected(null);
    setSelectedTrackId(null);
    setFreezeTouch(false);
    setMasterFxOpen(false);
    setMasterSettingsOpen(false);
    setFooterMenuOpen(false);
    try { setZoomSmooth(quantizePxPerSecToLegacy(120)); } catch { setZoomSmooth(120); }
    setTimelineKey((k) => k + 1);
  };

  // Global keyboard shortcuts: Undo/Redo and Zoom
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      const ctrlMeta = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      const isEditable = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        (target as any).isContentEditable === true ||
        target.tagName === 'SELECT'
      );
      // Undo / Redo
      if (ctrlMeta && (key === 'z' || key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          (api as any).redo?.();
        } else {
          (api as any).undo?.();
        }
        return;
      }
      if (ctrlMeta && (key === 'y' || key === 'Y')) {
        e.preventDefault();
        (api as any).redo?.();
        return;
      }
      // Zoom shortcuts (desktop keyboards)
      if (!ctrlMeta) {
        if (key === '+' || key === '=') {
          e.preventDefault();
          const cur = lastZoomRef.current || zoom;
          // Smaller step to allow more discrete values
          setZoomSmooth(Math.min(1200, Math.max(10, cur * 1.06)));
          return;
        }
        if (key === '-' || key === '_') {
          e.preventDefault();
          const cur = lastZoomRef.current || zoom;
          setZoomSmooth(Math.max(10, Math.min(1200, cur / 1.06)));
          return;
        }
        if (key === '0') {
          e.preventDefault();
          // reset to a sane default
          setZoomSmooth(quantizePxPerSecToLegacy(120));
          return;
        }
        // Delete selected clip
        if (!isEditable && key === 'Delete') {
          if (selected?.trackId && selected.clipId) {
            e.preventDefault();
            try { (api as any).deleteClip?.(selected.trackId, selected.clipId); } catch { }
            setSelected(null);
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, zoom, selected]);
  // Map metronome tempo to playback speed (relative to base tempo)
  useEffect(() => {
    const onTempo = (e: any) => {
      try {
        const tempo = Number(e?.detail?.tempo);
        if (!Number.isFinite(tempo) || tempo <= 0) return;
        const rate = Math.max(0.25, Math.min(4, tempo / (baseTempoRef.current || 120)));
        (api as any).setGlobalPlaybackRate?.(rate);
        setRulerTempo(tempo);
      } catch { }
    };
    window.addEventListener('mix:metronomeTempo' as any, onTempo as any);
    return () => window.removeEventListener('mix:metronomeTempo' as any, onTempo as any);
  }, [api]);
  // Listen to metronome app for time signature + subdivision
  useEffect(() => {
    const onGrid = (e: any) => {
      try {
        const d = e?.detail || {};
        if (typeof d.tempo === 'number') setRulerTempo(Math.max(1, Math.floor(d.tempo)));
        if (d.timeSignature && typeof d.timeSignature.beatsPerMeasure === 'number' && typeof d.timeSignature.beatValue === 'number') {
          setRulerTS({ beatsPerMeasure: d.timeSignature.beatsPerMeasure, beatValue: d.timeSignature.beatValue });
        }
        if (typeof d.subdivision === 'number') setRulerSubdivision(Math.max(0, Math.floor(d.subdivision)));
      } catch { }
    };
    window.addEventListener('mix:metronomeGrid' as any, onGrid as any);
    return () => window.removeEventListener('mix:metronomeGrid' as any, onGrid as any);
  }, []);
  // Countdown to record
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [recSettingsOpen, setRecSettingsOpen] = useState(false);
  // Recording duration timer
  const [recElapsed, setRecElapsed] = useState<number>(0);
  const recTimerRef = useRef<number | null>(null);
  // Temporary placeholder track created when recording starts with no tracks
  const tempRecordingTrackIdRef = useRef<string | number | null>(null);
  // Recording quality: Studio Mode disables browser voice filters (EC/NS/AGC)
  const [studioMode, setStudioMode] = useState<boolean>(true);
  // Mic permission state (for device labels on mobile)
  const [micGranted, setMicGranted] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  // Audio input devices (for selecting built-in vs. external mics)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState<string | ''>('');
  const recStartSecRef = useRef<number>(0);
  const targetTrackIdRef = useRef<string | null>(null); // optional: preferred track for the take

  const refreshDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = (list || []).filter((d) => d.kind === 'audioinput');
      setAudioInputs(inputs as any);
      if (!inputDeviceId && inputs[0]) setInputDeviceId(inputs[0].deviceId);
    } catch { }
  };

  // Mobile orientation gate: show full-screen overlay in portrait on small screens
  const [isPortrait, setIsPortrait] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const showRotateOverlay = isSmallScreen && isPortrait;

  const pickAudioMime = () => {
    try {
      const mr: any = (window as any).MediaRecorder;
      if (mr && typeof mr.isTypeSupported === 'function') {
        const order = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
        for (const t of order) { if (mr.isTypeSupported(t)) return t; }
      }
    } catch { }
    return 'audio/webm';
  };

  const getUserMediaCompat = async (constraints: MediaStreamConstraints): Promise<MediaStream> => {
    try {
      if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
        return await navigator.mediaDevices.getUserMedia(constraints);
      }
    } catch (e) {
      // continue to legacy fallback
    }
    const legacy: any = (navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).msGetUserMedia;
    if (legacy) {
      return await new Promise<MediaStream>((resolve, reject) => legacy.call(navigator, constraints, resolve, reject));
    }
    throw new Error('getUserMedia not supported in this browser');
  };

  // const startRecording = async () => {
  //   try {
  //     const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  //     const deviceConstraint = inputDeviceId ? { deviceId: { ideal: inputDeviceId } as any } : {};
  //     const baseAudio: any = studioMode
  //       ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  //       : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  //     const tuned: any = isIOS ? { ...baseAudio, ...deviceConstraint } : { ...baseAudio, channelCount: 2, sampleRate: 48000, ...deviceConstraint };
  //     const stream = await getUserMediaCompat({ audio: tuned } as any);
  //     setMicGranted(true);
  //     recMediaRef.current = stream;
  //     const MR: any = (window as any).MediaRecorder || (globalThis as any).MediaRecorder;
  //     if (!MR) { alert('Recording not supported in this browser.'); return; }
  //     const rec = new MR(stream, { mimeType: pickAudioMime() });
  //     recChunksRef.current = [];
  //     rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) recChunksRef.current.push(e.data); };
  //     // rec.onstop = async () => {
  //     //   const blob = new Blob(recChunksRef.current, { type: 'audio/webm' });
  //     //   const file = new File([blob], `Recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, { type: 'audio/webm' });
  //     //   try { await api.importToNewTrack(file); } catch { }
  //     //   recChunksRef.current = [];
  //     // };
  //     rec.onstop = async () => {
  //       const blob = new Blob(recChunksRef.current, { type: 'audio/webm' });
  //       const file = new File([blob], `Recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`, { type: 'audio/webm' });

  //       try {
  //         // capture current playhead and current track ids before import
  //         const targetBeginSec = Math.max(0, Math.round(api.time || 0)); // snap to whole second
  //         const beforeIds = new Set((tracksRef.current || []).map((t: any) => String(t.id)));

  //         await api.importToNewTrack(file);

  //         // wait until a new track shows up (import is async; engine state updates next tick)
  //         const waitForNewTrack = async (timeoutMs = 2000, stepMs = 50) => {
  //           const start = performance.now();
  //           while (performance.now() - start < timeoutMs) {
  //             const now = tracksRef.current || [];
  //             const added = now.find((t: any) => !beforeIds.has(String(t.id)));
  //             if (added && added.clips && added.clips[0]) return added;
  //             await new Promise(r => setTimeout(r, stepMs));
  //           }
  //           return null;
  //         };

  //         const newTrack = await waitForNewTrack();
  //         if (newTrack && newTrack.clips && newTrack.clips[0]) {
  //           const clip = newTrack.clips[0];
  //           // move the brand-new clip to the playhead (snapped)
  //           (api as any).moveClip?.(String(newTrack.id), String(clip.id), targetBeginSec);
  //           // (Optional) seek to end of the placed clip:
  //           // api.seek(targetBeginSec + (clip.durationSec || 0));
  //         }
  //       } catch (e) {
  //         console.error(e);
  //       } finally {
  //         recChunksRef.current = [];
  //       }
  //     };

  //     recRef.current = rec;
  //     rec.start(100);
  //     setRecording(true);
  //     try { (api as any).play?.(); } catch { }
  //     // Start elapsed timer
  //     try { if (recTimerRef.current) { window.clearInterval(recTimerRef.current as any); recTimerRef.current = null; } } catch { }
  //     setRecElapsed(0);
  //     const id = window.setInterval(() => {
  //       setRecElapsed((v) => v + 1);
  //     }, 1000);
  //     recTimerRef.current = id as any;
  //   } catch (e) { console.error(e); }
  // };

  const startRecording = async () => {
    try {
      // If no pre-armed stream (edge case), get one now
      if (!recMediaRef.current) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
        const deviceConstraint = inputDeviceId ? { deviceId: { ideal: inputDeviceId } as any } : {};
        const baseAudio: any = studioMode
          ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
        const tuned: any = isIOS
          ? { ...baseAudio, ...deviceConstraint }
          : { ...baseAudio, channelCount: 2, sampleRate: 48000, ...deviceConstraint };

        recMediaRef.current = await getUserMediaCompat({ audio: tuned } as any);
        setMicGranted(true);
      }

      const stream = recMediaRef.current!;
      const MR: any = (window as any).MediaRecorder || (globalThis as any).MediaRecorder;
      if (!MR) { alert('Recording not supported in this browser.'); setIsArming(false); setFreezeTouch(false); return; }

      const rec = new MR(stream, { mimeType: pickAudioMime() });
      recRef.current = rec;
      recChunksRef.current = [];

      rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) recChunksRef.current.push(e.data); };

      rec.onstop = async () => {
        // Stop the entire transport the moment recording ends
        try { (api as any).stop?.(); } catch { }
        try { (api as any).pause?.(); } catch { }

        try {
          const blob = new Blob(recChunksRef.current, { type: 'audio/webm' });
          const file = new File(
            [blob],
            `Recording-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
            { type: 'audio/webm' }
          );

          // Place the recorded take exactly where the playhead was when recording started.
          const beginSec = Math.max(0, Number(recStartSecRef.current || 0));

          // Snapshot track ids before import
          const beforeIds = new Set((tracks || []).map((t: any) => String(t.id)));

          // Prefer importing to a chosen track if your engine supports it
          const wantTrackId = targetTrackIdRef.current;

          if (wantTrackId && typeof (api as any).importToTrack === "function") {
            // Import directly to the selected lane at the decided begin time
            await (api as any).importToTrack(wantTrackId, file, beginSec);
          } else {
            // Fallback: engine makes a new track
            await (api as any).importToNewTrack?.(file);
          }

          // Find the newly added clip/track when importing to a new track
          const waitForNew = async (timeoutMs = 2500, stepMs = 50) => {
            const t0 = performance.now();
            while (performance.now() - t0 < timeoutMs) {
              // prefer engine getter if available; else use state
              const now = (api as any).getTracks?.() ?? tracks;
              const addedTrack = now?.find((t: any) => !beforeIds.has(String(t.id)));
              if (addedTrack?.clips?.[0]) return addedTrack;
              await new Promise(r => setTimeout(r, stepMs));
            }
            return null;
          };

          const usedDirectImport = !!(wantTrackId && typeof (api as any).importToTrack === 'function');
          let track = usedDirectImport ? null : await waitForNew();

          // If the engine wrongly imported into master, try to create/move to a proper track
          if (track?.isMaster || track?.type === "master") {
            // Try to create a dedicated "Recording" track and re-import there if your API allows
            if (typeof (api as any).createTrack === "function" && typeof (api as any).importToTrack === "function") {
              const recTrackId = await (api as any).createTrack({ kind: "audio", name: "Recording" });
              // re-import to the proper track (simple/robust) and discard the master take
              await (api as any).deleteClip?.(String(track.clips[0].id)); // best-effort
              await (api as any).importToTrack(recTrackId, file);
              // refresh the reference to the newly added track
              const before2 = (api as any).getTracks?.() ?? tracks;
              track = (api as any).getTracks?.()?.find((t: any) => t.id === recTrackId)
                ?? (before2 as any[]).find((t: any) => t.id === recTrackId);
            }
          }

          // Finally, place the clip at the chosen begin time; if a target track was selected
          // and import created a new track, move the new clip into the selected lane and remove the empty import lane.
          if (!usedDirectImport && track?.clips?.[0]) {
            const clip = track.clips[0];
            const wantId = targetTrackIdRef.current;
            if (wantId && String(wantId) !== String(track.id)) {
              (api as any).moveClip?.(String(wantId), String(clip.id), beginSec);
              try { (api as any).deleteTrack?.(String(track.id)); } catch { }
            } else {
              (api as any).moveClip?.(String(track.id), String(clip.id), beginSec);
            }
            // (duration is inherent to the file; clip will end at beginSec + duration)
          }
        } catch (err) {
          console.error(err);
        } finally {
          recChunksRef.current = [];
          recMediaRef.current?.getTracks?.().forEach(t => t.stop());
          recRef.current = null;
          recMediaRef.current = null;
          // Cleanup any temporary placeholder track created during start
          try {
            const tmp = tempRecordingTrackIdRef.current;
            if (tmp != null) {
              (api as any).deleteTrack?.(String(tmp));
            }
          } catch { }
          finally {
            tempRecordingTrackIdRef.current = null;
          }
          setRecording(false);
          try {
            if (recTimerRef.current) { window.clearInterval(recTimerRef.current as any); recTimerRef.current = null; }
          } catch { }
          setRecElapsed(0);
          setIsArming(false);
          setFreezeTouch(false);
        }
      };


      // Start the recorder
      try { (api as any).resumeAudio?.(); } catch { }
      rec.start(250); // small timeslice keeps data flowing on mobile
      // ✅ Always roll the transport during recording
      try { (api as any).play?.(); } catch { }

      // If you want the transport running while recording:
      try {
        if (wasPlayingBeforeArmRef.current) {
          (api as any).play?.();
        }
      } catch { }

      setRecording(true);

      // start the elapsed timer
      try { if (recTimerRef.current) { window.clearInterval(recTimerRef.current as any); recTimerRef.current = null; } } catch { }
      setRecElapsed(0);
      recTimerRef.current = window.setInterval(() => setRecElapsed(v => v + 1), 1000) as any;
    } catch (e) {
      console.error(e);
      alert('Failed to start recording. Please check microphone permissions.');
    } finally {
      // Unfreeze UI after we attempted to start
      setFreezeTouch(false);
      setIsArming(false);
    }
  };

  // const stopRecording = () => {
  //   try { recRef.current?.stop(); } catch { }
  //   try { recMediaRef.current?.getTracks().forEach(t => t.stop()); } catch { }
  //   recRef.current = null; recMediaRef.current = null;
  //   setRecording(false);
  //   try { if (recTimerRef.current) { window.clearInterval(recTimerRef.current as any); recTimerRef.current = null; } } catch { }
  //   setRecElapsed(0);
  // };

  const stopRecording = () => {
    // stop the engine transport first (stop all playing tracks)
    try { (api as any).stop?.(); } catch { }
    try { (api as any).pause?.(); } catch { } // safety

    // stop the recorder & release mic
    try { recRef.current?.stop(); } catch { }
    try { recMediaRef.current?.getTracks().forEach(t => t.stop()); } catch { }
    recRef.current = null;
    recMediaRef.current = null;

    setRecording(false);
    try {
      if (recTimerRef.current) { window.clearInterval(recTimerRef.current as any); recTimerRef.current = null; }
    } catch { }
    setRecElapsed(0);
    setIsArming(false);
    setFreezeTouch(false);
    // Best-effort cleanup of placeholder if user manually stopped before onstop handler
    try {
      const tmp = tempRecordingTrackIdRef.current;
      if (tmp != null) {
        (api as any).deleteTrack?.(String(tmp));
      }
    } catch { }
    finally {
      tempRecordingTrackIdRef.current = null;
    }
  };
  // const handleRecordClick = () => {
  //   if (recording) { stopRecording(); return; }
  //   try { setFooterMenuOpen(false); } catch { }
  //   try {
  //     if (!micGranted) {
  //       getUserMediaCompat({ audio: true } as any).then(s => { try { s.getTracks().forEach(t => t.stop()); } catch { } });
  //     }
  //   } catch { }
  //   setCountdownOpen(true);
  // };

  const handleRecordClick = async () => {
    if (recording) { stopRecording(); return; }
    if (isArming || countdownOpen) return;           // avoid double-arming
    setIsArming(true);

    try { setFooterMenuOpen(false); } catch { }

    // Freeze transport & remember play state
    try {
      wasPlayingBeforeArmRef.current = !!(api as any).isPlaying;
    } catch { wasPlayingBeforeArmRef.current = false; }
    try { (api as any).pause?.(); } catch { }
    setFreezeTouch(true);

    // 🔒 Pre-arm microphone while we’re still in a user gesture
    try {
      // Use your tuned constraints (same ones you use in startRecording)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
      const deviceConstraint = inputDeviceId ? { deviceId: { ideal: inputDeviceId } as any } : {};
      const baseAudio: any = studioMode
        ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      const tuned: any = isIOS
        ? { ...baseAudio, ...deviceConstraint }
        : { ...baseAudio, channelCount: 2, sampleRate: 48000, ...deviceConstraint };

      const stream = await getUserMediaCompat({ audio: tuned } as any);
      setMicGranted(true);
      recMediaRef.current = stream;                  // keep pre-armed stream
    } catch (err) {
      // Permission denied or no device — unfreeze and bail
      setFreezeTouch(false);
      setIsArming(false);
      alert('Microphone permission is required to record.');
      return;
    }

    // ✅ Only now show the countdown (no more permission prompts to block it)
    setCountdownOpen(true);
  };
  useEffect(() => {
    const check = () => {
      try {
        const portrait = (window.matchMedia && window.matchMedia('(orientation: portrait)').matches) || (window.innerHeight > window.innerWidth);
        setIsPortrait(!!portrait);
        setIsSmallScreen(window.innerWidth <= 900);
      } catch {
        setIsPortrait(false);
        setIsSmallScreen(false);
      }
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // Refresh input devices when opening Master Settings (labels become available after mic permission)
  useEffect(() => {
    if (masterSettingsOpen) refreshDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterSettingsOpen]);


  // Reset per-track waveform cache when the track set changes (e.g., project import)
  useEffect(() => {
    const ids = tracks.map((t: any) => t.id as string);
    const prev = prevTrackIdsRef.current;
    const changed = ids.length !== prev.length || ids.some((id: string, i: number) => id !== prev[i]);
    if (changed) {
      waveCache.current.clear();
      prevTrackIdsRef.current = ids;
      // Nudge UI to re-request waves for new tracks
      forceTick((t: number) => t + 1);
    }
  }, [tracks]);
  useEffect(() => {
    if (!legacy || !(engine as any).getTrackWaveform) return;
    // Generate missing waveforms lazily to avoid blocking the main thread
    const idsNeeding = tracks.map((t: any) => t.id as string).filter((id: string) => !waveCache.current.has(id));
    if (idsNeeding.length === 0) return;
    let cancelled = false;
    const gen = async () => {
      for (const id of idsNeeding) {
        if (cancelled) break;
        try {
          const data: Float32Array = (engine as any).getTrackWaveform(Number(id), 240);
          waveCache.current.set(id, data);
          // Nudge a re-render for this newly available waveform only
          forceTick((t: number) => t + 1);
        } catch { }
        // Yield between tracks to keep UI responsive
        await new Promise(r => setTimeout(r, 0));
      }
    };
    gen();
    return () => { cancelled = true; };
  }, [legacy, engine, tracks]);

  // Provide split callback for Timeline double-click
  useEffect(() => {
    (window as any).__mix_splitClip = (trackId: string, clipId: string, at: number) => {
      (api as any).splitClip?.(trackId, clipId, at);
    };
    return () => { delete (window as any).__mix_splitClip; };
  }, [api]);

  // Global keyboard: Space toggles Play/Pause when focus is not in an input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isSpace = e.code === 'Space' || e.key === ' ';
      if (!isSpace) return;
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const editable = target?.getAttribute?.('contenteditable') === 'true';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || editable) return;
      e.preventDefault();
      try { (api as any).resumeAudio?.(); } catch { }
      try { (playing ? api.pause() : api.play()); } catch { }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, playing]);

  // Global keyboard: Ctrl/Cmd+Z undo, Ctrl+Shift+Z or Ctrl+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const editable = target?.getAttribute?.('contenteditable') === 'true';
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || editable) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const k = (e.key || '').toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        if (e.shiftKey) { try { (api as any).redo?.(); } catch { } }
        else { try { (api as any).undo?.(); } catch { } }
      } else if (k === 'y') {
        e.preventDefault();
        try { (api as any).redo?.(); } catch { }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  // Provide envelope getters/setters for Timeline overlay editor
  useEffect(() => {
    (window as any).mix_getTrackEnvPts = (id: string) => {
      try { return (api as any).getTrackVolumeEnvelopePoints?.(id) || []; } catch { return []; }
    };
    (window as any).mix_setTrackEnvPts = (id: string, pts: Array<{ time: number; value: number }>) => {
      try { (api as any).setTrackVolumeEnvelopePoints?.(id, pts); } catch { }
    };
    return () => { delete (window as any).mix_getTrackEnvPts; delete (window as any).mix_setTrackEnvPts; };
  }, [api]);

  // Provide simple global hooks for Timeline's get-started overlay (record/import)
  useEffect(() => {
    (window as any).mix_recordClick = () => { try { handleRecordClick(); } catch { } };
    (window as any).mix_importAudio = async (files: File[] | FileList) => {
      try {
        const list: File[] = Array.from(files as any);
        for (const f of list) await (api as any).importToNewTrack?.(f);
      } catch { }
    };
    return () => { try { delete (window as any).mix_recordClick; delete (window as any).mix_importAudio; } catch { } };
  }, [api, handleRecordClick]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {showRotateOverlay && (
        <div className="fixed inset-0 z-[6000] md:hidden flex items-center justify-center bg-black/90 text-white">
          <div className="text-center px-6 w-[min(92vw,520px)]">
            <div className="mx-auto mb-5 rounded-2xl border border-slate-800 bg-black shadow-2xl overflow-hidden">
              <video
                className="block w-full h-auto"
                src="/rotate.mp4"
                autoPlay
                muted
                loop
                playsInline
                aria-label="Rotate animation"
              />
            </div>
            <h2 className="text-xl font-semibold mb-1">Rotate your device</h2>
            <p className="text-slate-300">Please rotate to landscape to use MixMaster.</p>
          </div>
        </div>
      )}
      <LoadingOverlay open={Boolean((api as any).busy)} progress={(api as any).progress || 0} title="Adding Track" subtitle="Decoding audio and preparing waveform" />
      <CountdownOverlay
        open={countdownOpen}
        seconds={3}
        onComplete={async () => {
          setCountdownOpen(false);

          // capture exact start time at the moment we’re about to roll
          const nowTime = Number((api as any).time ?? 0);
          recStartSecRef.current = Math.max(0, nowTime); // no snap so it’s *exactly* where the user hit Record

          // Prefer selected track from Timeline (if any); else let engine create one
          targetTrackIdRef.current = selectedTrackId ? String(selectedTrackId) : null;
          // Keep the exact playhead start time; do not override to append after last clip.

          // If there are no tracks yet, create a temporary placeholder so
          // the UI shows a lane and legacy transport has something to roll against.
          try {
            const currentTracks = (api as any).getTracks?.() ?? tracksRef.current ?? [];
            if (!currentTracks || currentTracks.length === 0) {
              let tid: any = null;
              // Prefer modern engine API
              if (typeof (api as any).createTrack === 'function') {
                tid = await (api as any).createTrack('Recording…');
              } else if (engine && typeof (engine as any).createTrack === 'function') {
                tid = (engine as any).createTrack('Recording…');
              } else if (engine && typeof (engine as any).addTrack === 'function') {
                // Legacy facade
                tid = (engine as any).addTrack('Recording…');
              } else if (typeof (api as any).addTrack === 'function') {
                tid = await (api as any).addTrack('Recording…');
              }
              if (tid != null) tempRecordingTrackIdRef.current = tid;
            }
          } catch { }

          await startRecording();
        }}
        message="Recording starts in"
      />
      <RecordingSettingsModal
        open={recSettingsOpen}
        onClose={() => setRecSettingsOpen(false)}
        studioMode={studioMode}
        setStudioMode={setStudioMode}
        audioInputs={audioInputs}
        inputDeviceId={inputDeviceId}
        setInputDeviceId={setInputDeviceId}
        refreshDevices={refreshDevices}
        micGranted={micGranted}
        micError={micError}
        requestMicPermission={async () => {
          try {
            const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
            try { tmp.getTracks().forEach(t => t.stop()); } catch { }
            await refreshDevices();
          } catch { }
        }}
      />
      {/* App Header (compact, one row) */}
      <header className="sticky flex justify-end top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-3 lg:w-full py-2 md:w-[70%] sm:w-[70%] ">
          {/* Logo + title */}
          <div className="flex items-center gap-2 select-none min-w-0">
            <div className="h-7 w-7 rounded-full bg-slate-800 grid place-items-center shadow-inner shrink-0">
              <span className="text-cyan-400 text-base">♫</span>
            </div>
            <div className="text-xl font-bold tracking-tight truncate">
              <span className="text-white">Mix</span>
              <span className="text-sky-400">Master</span>
            </div>
          </div>

          {/* Controls – icon sized buttons to save vertical space */}
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            {/* Play/Pause */}
            <button className="mm-ico-btn" title={playing ? 'Pause' : 'Play'} onClick={() => { playing ? api.pause() : api.play() }} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M8 5C6.895 5 6 5.895 6 7L6 17C6 18.105 6.895 19 8 19C9.105 19 10 18.105 10 17L10 7C10 5.895 9.105 5 8 5 z M 16 5C14.895 5 14 5.895 14 7L14 17C14 18.105 14.895 19 16 19C17.105 19 18 18.105 18 17L18 7C18 5.895 17.105 5 16 5 z" fill="#EFEFE7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path d="M11.396484 4.1113281C9.1042001 4.2020187 7 6.0721788 7 8.5917969L7 39.408203C7 42.767694 10.742758 44.971891 13.681641 43.34375L41.490234 27.935547C44.513674 26.260259 44.513674 21.739741 41.490234 20.064453L13.681641 4.65625C12.94692 4.2492148 12.160579 4.0810979 11.396484 4.1113281 z" fill="#EFEFE7" />
                </svg>
              )}
            </button>
            {/* Duplicate */}
            <button
              className="mm-ico-btn"
              title="Duplicate Clip"
              disabled={!selected}
              onClick={() => selected && (api as any).duplicateClip?.(selected.trackId, selected.clipId)}
              aria-label="Duplicate Clip"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
                <path d="M17 4L17 6L44 6L44 40L36 40L36 42L46 42L46 4L17 4 z M 4 8L4 46L34 46L34 45L34 8L4 8 z M 6 10L32 10L32 44L6 44L6 10 z M 18 20L18 26L12 26L12 28L18 28L18 34L20 34L20 28L26 28L26 26L20 26L20 20L18 20 z" fill="#EFEFE7" />
              </svg>
            </button>
            {/* Delete */}
            {/* <button
              className="mm-ico-btn"
              title="Delete Clip"
              disabled={!selected}
              onClick={() => selected && (api as any).deleteClip?.(selected.trackId, selected.clipId)}
              aria-label="Delete Clip"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                <path d="M28 6C25.791 6 24 7.791 24 10L24 12L23.599609 12L10 14L10 17L54 17L54 14L40.400391 12L40 12L40 10C40 7.791 38.209 6 36 6L28 6 z M 28 10L36 10L36 12L28 12L28 10 z M 12 19L14.701172 52.322266C14.869172 54.399266 16.605453 56 18.689453 56L45.3125 56C47.3965 56 49.129828 54.401219 49.298828 52.324219L51.923828 20L12 19 z M 24.414062 26.585938L32 34.171875L39.585938 26.585938L42.414062 29.414062L34.828125 37L42.414062 44.585938L39.585938 47.414062L32 39.828125L24.414062 47.414062L21.585938 44.585938L29.171875 37L21.585938 29.414062L24.414062 26.585938 z" fill="#EFEFE7" />
              </svg>
            </button> */}

            {/* Fades moved to timeline overlays */}

            {/* Import */}
            <label className="mm-ico-btn cursor-pointer" title="Import Audio" aria-label="Import Audio">
              <input type="file" accept="audio/*" multiple className="hidden"
                onChange={async (e) => { const files = e.target.files; if (!files) return; for (const f of Array.from(files)) await api.importToNewTrack(f); e.currentTarget.value = ''; }} />
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
                <path d="M21.65625 4C20.320313 4 19.066406 4.519531 18.121094 5.464844L9.464844 14.121094C8.519531 15.066406 8 16.320313 8 17.65625L8 57C8 58.652344 9.347656 60 11 60L51 60C52.652344 60 54 58.652344 54 57L54 7C54 5.347656 52.652344 4 51 4 Z M 22 6L51 6C51.550781 6 52 6.449219 52 7L52 57C52 57.550781 51.550781 58 51 58L11 58C10.449219 58 10 57.550781 10 57L10 18L19 18C20.652344 18 22 16.652344 22 15 Z M 20 6.5L20 15C20 15.550781 19.550781 16 19 16L10.5 16C10.605469 15.835938 10.734375 15.679688 10.878906 15.535156L19.535156 6.878906C19.679688 6.738281 19.835938 6.613281 20 6.5 Z M 31 20C30.449219 20 30 20.449219 30 21L30 32L19 32C18.449219 32 18 32.449219 18 33C18 33.550781 18.449219 34 19 34L30 34L30 45C30 45.550781 30.449219 46 31 46C31.550781 46 32 45.550781 32 45L32 34L43 34C43.550781 34 44 33.550781 44 33C44 32.449219 43.550781 32 43 32L32 32L32 21C32 20.449219 31.550781 20 31 20 Z M 13 52C12.449219 52 12 52.449219 12 53L12 55C12 55.550781 12.449219 56 13 56C13.550781 56 14 55.550781 14 55L14 53C14 52.449219 13.550781 52 13 52 Z M 18 52C17.449219 52 17 52.449219 17 53L17 55C17 55.550781 17.449219 56 18 56C18.550781 56 19 55.550781 19 55L19 53C19 52.449219 18.550781 52 18 52 Z M 23 52C22.449219 52 22 52.449219 22 53L22 55C22 55.550781 22.449219 56 23 56C23.550781 56 24 55.550781 24 55L24 53C24 52.449219 23.550781 52 23 52 Z M 28 52C27.449219 52 27 52.449219 27 53L27 55C27 55.550781 27.449219 56 28 56C28.550781 56 29 55.550781 29 55L29 53C29 52.449219 28.550781 52 28 52 Z M 33 52C32.449219 52 32 52.449219 32 53L32 55C32 55.550781 32.449219 56 33 56C33.550781 56 34 55.550781 34 55L34 53C34 52.449219 33.550781 52 33 52 Z M 38 52C37.449219 52 37 52.449219 37 53L37 55C37 55.550781 37.449219 56 38 56C38.550781 56 39 55.550781 39 55L39 53C39 52.449219 38.550781 52 38 52 Z M 43 52C42.449219 52 42 52.449219 42 53L42 55C42 55.550781 42.449219 56 43 56C43.550781 56 44 55.550781 44 55L44 53C44 52.449219 43.550781 52 43 52 Z M 48 52C47.449219 52 47 52.449219 47 53L47 55C47 55.550781 47.449219 56 48 56C48.550781 56 49 55.550781 49 55L49 53C49 52.449219 48.550781 52 48 52Z" fill="#EFEFE7" />
              </svg>
            </label>
            {/* Reset Project */}
            <button
              className="mm-ico-btn"
              title="Reset Project (Remove All Tracks)"
              aria-label="Reset Project"
              onClick={handleHardReset}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M3 6h18v2H3zM5 10h14l-1.2 10.2A2 2 0 0 1 15.81 22H8.19A2 2 0 0 1 6.2 20.2zM10 2h4v2h-4z" fill="#EFEFE7" />
              </svg>
            </button>

            {/* Export WAV */}
            <button className="mm-ico-btn" title="Export WAV" aria-label="Export WAV"
              onClick={async () => { try { const r = await api.exportWav(); const a = document.createElement('a'); a.href = r.url; a.download = 'mix.wav'; document.body.appendChild(a); a.click(); document.body.removeChild(a); } catch { } }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
                <path d="M8 0C5.800781 0 4 1.800781 4 4L4 11L1 11C0.398438 11 0 11.5 0 12L0 18C0 18.5 0.398438 19 1 19L4 19L4 22C4 24.199219 5.800781 26 8 26L20 26C22.199219 26 24 24.199219 24 22L24 8C24 6.898438 23.011719 5.886719 21.3125 4.1875C21.011719 3.988281 20.800781 3.699219 20.5 3.5C20.300781 3.199219 20.011719 2.988281 19.8125 2.6875C18.113281 0.988281 17.101563 0 16 0 Z M 8 2L15.3125 2C16.011719 2.199219 16 3.101563 16 4L16 7C16 7.601563 16.398438 8 17 8L20 8C21 8 22 8 22 9L22 12C22 11.5 21.601563 11 21 11L6 11L6 4C6 2.898438 6.898438 2 8 2 Z M 14.40625 12.09375L15.6875 12.09375C15.789063 12.09375 15.8125 12.085938 15.8125 12.1875L16.5 14.5C16.601563 15 16.804688 15.507813 16.90625 15.90625C17.007813 15.40625 17.113281 15 17.3125 14.5L18 12.1875C18 12.085938 18.09375 12.09375 18.09375 12.09375L19.40625 12.09375C19.40625 12.09375 19.5 12.085938 19.5 12.1875L19.5 12.3125L17.59375 17.6875C17.59375 17.789063 17.5 17.8125 17.5 17.8125L16.09375 17.8125C15.992188 17.8125 16 17.789063 16 17.6875L14.3125 12.3125L14.3125 12.1875 Z M 2 12.1875L3.40625 12.1875C3.507813 12.1875 3.5 12.210938 3.5 12.3125L4 14.5C4.101563 14.898438 4.085938 15.289063 4.1875 15.6875C4.289063 15.289063 4.40625 14.898438 4.40625 14.5L4.90625 12.3125C4.90625 12.210938 5 12.1875 5 12.1875L6.3125 12.1875C6.414063 12.1875 6.40625 12.210938 6.40625 12.3125L6.8125 14.59375C6.914063 14.894531 6.898438 15.292969 7 15.59375C7 15.394531 7.09375 15.199219 7.09375 15L7.1875 14.5L7.59375 12.3125C7.59375 12.210938 7.6875 12.1875 7.6875 12.1875L9.09375 12.1875L9.09375 12.3125L7.6875 17.6875C7.6875 17.789063 7.695313 17.8125 7.59375 17.8125L6.3125 17.8125C6.210938 17.8125 6.1875 17.789063 6.1875 17.6875L5.6875 15.40625C5.585938 15.105469 5.601563 14.800781 5.5 14.5C5.398438 14.800781 5.414063 15.105469 5.3125 15.40625L4.8125 17.6875C4.8125 17.789063 4.6875 17.8125 4.6875 17.8125L3.40625 17.8125C3.304688 17.8125 3.3125 17.789063 3.3125 17.6875L2 12.3125 Z M 10.8125 12.1875L12.40625 12.1875C12.507813 12.1875 12.5 12.210938 12.5 12.3125L14.1875 17.6875C14.289063 17.6875 14.289063 17.710938 14.1875 17.8125L14.09375 17.90625L12.8125 17.90625C12.710938 17.90625 12.6875 17.914063 12.6875 17.8125L12.3125 16.5L11 16.5L10.59375 17.8125C10.59375 17.914063 10.5 17.90625 10.5 17.90625L9.1875 17.90625C9.1875 17.90625 9.09375 17.914063 9.09375 17.8125L9.09375 17.6875L10.6875 12.3125C10.6875 12.210938 10.8125 12.1875 10.8125 12.1875 Z M 11.59375 13.6875C11.59375 13.886719 11.5 14.113281 11.5 14.3125L11.1875 15.3125L12.09375 15.3125L11.8125 14.3125C11.710938 14.113281 11.695313 13.886719 11.59375 13.6875 Z M 22 18L22 22C22 23.101563 21.101563 24 20 24L8 24C6.898438 24 6 23.101563 6 22L6 19L21 19C21.601563 19 22 18.5 22 18Z" fill="#EFEFE7" />
              </svg>
            </button>
            {/* Export MP3 */}
            <button className="mm-ico-btn disabled:opacity-40" title="Export MP3" aria-label="Export MP3" disabled={!((api as any).exportMp3)}
              onClick={async () => { try { const r = await (api as any).exportMp3(); const a = document.createElement('a'); a.href = r.url; a.download = 'mix.mp3'; document.body.appendChild(a); a.click(); document.body.removeChild(a); } catch { } }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
                <path d="M8 0C5.796875 0 4 1.796875 4 4L4 11L1 11C0.449219 11 0 11.449219 0 12L0 18C0 18.550781 0.449219 19 1 19L4 19L4 22C4 24.203125 5.796875 26 8 26L20 26C22.203125 26 24 24.203125 24 22L24 8C24 6.9375 23.027344 5.929688 21.28125 4.21875C21.039063 3.980469 20.777344 3.714844 20.53125 3.46875C20.285156 3.222656 20.019531 2.992188 19.78125 2.75C18.070313 1.003906 17.0625 0 16 0 Z M 8 2L15.28125 2C16.003906 2.183594 16 3.050781 16 3.9375L16 7C16 7.550781 16.449219 8 17 8L20 8C20.996094 8 22 8.003906 22 9L22 22C22 23.105469 21.105469 24 20 24L8 24C6.894531 24 6 23.105469 6 22L6 19L18 19C18.550781 19 19 18.550781 19 18L19 12C19 11.449219 18.550781 11 18 11L6 11L6 4C6 2.894531 6.894531 2 8 2 Z M 10.875 11.9375C11.699219 11.9375 12.304688 12.109375 12.71875 12.4375C13.140625 12.773438 13.375 13.296875 13.375 13.875C13.375 14.46875 13.179688 14.992188 12.8125 15.34375C12.367188 15.765625 11.683594 16 10.84375 16C10.730469 16 10.625 15.976563 10.53125 15.96875L10.53125 17.875C10.53125 17.949219 10.480469 18.03125 10.40625 18.03125L9.125 18.03125C9.050781 18.03125 8.96875 17.949219 8.96875 17.875L8.96875 12.21875C8.96875 12.15625 9.03125 12.074219 9.09375 12.0625C9.570313 11.984375 10.167969 11.9375 10.875 11.9375 Z M 1.9375 12L3.65625 12C3.71875 12 3.761719 12.035156 3.78125 12.09375L4.34375 14C4.5 14.582031 4.621094 15.109375 4.71875 15.5625C4.839844 15.082031 5.007813 14.511719 5.15625 14L5.78125 12.09375C5.800781 12.039063 5.847656 12 5.90625 12L7.59375 12C7.664063 12 7.714844 12.054688 7.71875 12.125L8.03125 17.84375C8.039063 17.859375 8.0625 17.855469 8.0625 17.875C8.0625 17.949219 7.980469 18.03125 7.90625 18.03125L6.625 18.03125C6.554688 18.03125 6.503906 17.945313 6.5 17.875L6.40625 15.6875C6.390625 15.242188 6.382813 14.738281 6.375 14.21875C6.25 14.671875 6.113281 15.152344 5.96875 15.59375L5.25 17.8125C5.234375 17.871094 5.183594 17.90625 5.125 17.90625L4.125 17.90625C4.066406 17.90625 4.015625 17.871094 4 17.8125L3.375 15.59375C3.261719 15.1875 3.15625 14.765625 3.0625 14.34375C3.042969 14.820313 3.027344 15.304688 3 15.71875L2.90625 17.875C2.902344 17.945313 2.820313 18 2.75 18L1.5625 18C1.527344 18 1.492188 17.996094 1.46875 17.96875C1.441406 17.941406 1.433594 17.910156 1.4375 17.875L1.78125 12.125C1.785156 12.054688 1.867188 12 1.9375 12 Z M 15.875 12.09375C17.238281 12.09375 17.84375 12.871094 17.84375 13.625C17.84375 14.179688 17.566406 14.632813 17.0625 14.90625C17.652344 15.140625 18.03125 15.652344 18.03125 16.28125C18.03125 17.378906 17.0625 18.09375 15.625 18.09375C14.839844 18.09375 14.222656 17.886719 13.90625 17.6875C13.855469 17.65625 13.828125 17.621094 13.84375 17.5625L14.125 16.5625C14.136719 16.523438 14.148438 16.515625 14.1875 16.5C14.222656 16.484375 14.277344 16.484375 14.3125 16.5C14.417969 16.554688 14.960938 16.8125 15.53125 16.8125C16.074219 16.8125 16.40625 16.59375 16.40625 16.21875C16.40625 15.734375 15.890625 15.5625 15.4375 15.5625L14.90625 15.5625C14.832031 15.5625 14.78125 15.480469 14.78125 15.40625L14.78125 14.46875C14.78125 14.394531 14.832031 14.34375 14.90625 14.34375L15.40625 14.34375C15.492188 14.339844 16.25 14.320313 16.25 13.84375C16.25 13.5625 15.992188 13.40625 15.5625 13.40625C15.117188 13.40625 14.652344 13.613281 14.46875 13.71875C14.433594 13.738281 14.414063 13.734375 14.375 13.71875C14.335938 13.703125 14.292969 13.664063 14.28125 13.625L14.03125 12.6875C14.015625 12.628906 14.015625 12.5625 14.0625 12.53125C14.40625 12.3125 15.113281 12.09375 15.875 12.09375 Z M 10.9375 13.1875C10.75 13.1875 10.617188 13.207031 10.53125 13.21875L10.53125 14.71875C10.609375 14.726563 10.714844 14.71875 10.84375 14.71875C11.46875 14.71875 11.8125 14.417969 11.8125 13.90625C11.8125 13.289063 11.265625 13.1875 10.9375 13.1875Z" fill="#EFEFE7" />
              </svg>
            </button>
            {/* Export Project */}
            {(() => {
              const canExportProject = (typeof (api as any).exportProject === 'function') || (engine && typeof (engine as any).getTracks === 'function'); return (
                <button className={`mm-ico-btn ${!canExportProject ? 'opacity-50 cursor-not-allowed' : ''}`} title={canExportProject ? 'Export Project' : 'Export not available in legacy engine'} aria-label="Export Project" disabled={!canExportProject}
                  onClick={async () => {
                    try {
                      let r: { url: string } | null = null;
                      if (typeof (api as any).exportProject === 'function') {
                        r = await (api as any).exportProject();
                      } else if (engine && typeof (engine as any).getTracks === 'function') {
                        const res = await exportProjectFile(engine as any);
                        r = { url: res.url } as any;
                      }
                      if (!r) return; // guarded by disabled
                      const a = document.createElement('a');
                      a.href = r.url; a.download = 'project.mix.json';
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      setTimeout(() => { try { URL.revokeObjectURL(r!.url); } catch { } }, 4000);
                    } catch (e) { console.error(e); alert('Export failed'); }
                  }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 24">
                    <path d="M4 0L4 7L1 7L1 16L4 16L4 20L13.400391 20L11.900391 18L6 18L6 16L15 16L16 16L22 16L22 14L22 9L22 7L20 7L20 5L15 0L4 0 z M 6 2L14 2L14 6L18 6L18 7L6 7L6 2 z M 5 9L6 9L6 12.5C6 13.3 5.3 14 4.5 14C3.7 14 3 13.3 3 12.5L4 12.5C4 12.8 4.2 13 4.5 13C4.8 13 5 12.8 5 12.5L5 9 z M 8.5996094 9C9.9996094 9 10.099609 10.3 10.099609 10.5L9.0996094 10.5C9.0996094 10.4 9.1 9.8007812 8.5 9.8007812C8.3 9.8007812 7.9 9.9003906 8 10.400391C8.1 10.800391 8.7007812 10.999609 8.8007812 11.099609C9.0007812 11.199609 10.099609 11.699219 10.099609 12.699219C10.099609 12.899219 9.9996094 13.999609 8.5996094 14.099609C7.0996094 13.999609 7 12.700391 7 12.400391L8 12.400391C8 12.500391 7.9992188 13.299219 8.6992188 13.199219C9.0992188 13.199219 9.1992188 12.899219 9.1992188 12.699219C9.1992188 12.299219 8.9 12.100391 8.5 11.900391C8 11.600391 7.1996094 11.300391 7.0996094 10.400391C7.0996094 9.5003906 7.7996094 9 8.5996094 9 z M 16 9L17.199219 9L19 12.199219L19 9L20 9L20 9.3789062L20 14L18.800781 14L17 10.699219L17 14L16 14L16 9 z M 13 9.0996094C14.9 9.0996094 15 10.899219 15 11.199219L15 12C15 12.3 14.9 14.099609 13 14.099609C11 14.099609 11 12.4 11 12L11 11.199219C11 10.799219 11.2 9.0996094 13 9.0996094 z M 13 9.9003906C12.1 9.9003906 12 10.999219 12 11.199219L12 12C12 12.2 12.2 13.299219 13 13.199219C13.8 13.199219 14 12.2 14 12L14 11.199219C14 10.999219 13.9 9.9003906 13 9.9003906 z M 18 18L18 20L15.900391 20L18.900391 24L21.900391 20L20 20L20 18L18 18 z" fill="#EFEFE7" />
                  </svg>
                </button>
              );
            })()}
            {/* Import Project */}
            {(() => {
              const canImportProject = (typeof (api as any).importProject === 'function') || (engine && typeof (engine as any).getTracks === 'function'); return (
                <label className={`mm-ico-btn ${!canImportProject ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} title={canImportProject ? 'Import Project' : 'Import not available in legacy engine'} aria-label="Import Project">
                  <input type="file" accept="application/json" className="hidden" disabled={!canImportProject}
                    onChange={async (e) => {
                      const f = e.currentTarget.files?.[0]; if (!f) return;
                      try {
                        if (typeof (api as any).importProject === 'function') {
                          await (api as any).importProject(f);
                        } else if (engine) {
                          await importProjectFile(engine as any, f);
                        }
                      } catch (err) { console.error(err); alert('Import failed'); }
                      finally { e.currentTarget.value = ''; }
                    }} />
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    <path d="M4.5 2C3.6774686 2 3 2.6774686 3 3.5L3 8L4 8L4 3.5C4 3.2185314 4.2185314 3 4.5 3L9 3L9 6L12 6L12 8L13 8L13 5.2929688L9.7070312 2L4.5 2 z M 10 3.7070312L11.292969 5L10 5L10 3.7070312 z M 2 9L2 11.5L2 12.5C2 12.781469 1.7814686 13 1.5 13C1.2185314 13 1 12.781469 1 12.5L1 12L0 12L0 12.5C0 13.322531 0.6774686 14 1.5 14C2.3225314 14 3 13.322531 3 12.5L3 11.5L3 9L2 9 z M 5.5 9C4.91 9 4.5649062 9.2384531 4.3789062 9.4394531C3.9679062 9.8824531 3.9989531 10.472 4.0019531 10.5C4.0019531 11.308 4.7364375 11.672453 5.2734375 11.939453C5.6994375 12.150453 6 12.313812 6 12.507812C6 12.509813 5.990375 12.751766 5.859375 12.884766C5.830375 12.913766 5.747 13 5.5 13L4.0917969 13C4.1517969 13.191 4.2476875 13.402891 4.4296875 13.587891C4.6146875 13.775891 4.951 14 5.5 14C6.049 14 6.3862656 13.774937 6.5722656 13.585938C6.9982656 13.152938 6.9990469 12.558 6.9980469 12.5C6.9980469 11.68 6.2577969 11.311969 5.7167969 11.042969C5.2977969 10.834969 5.0029531 10.67375 5.0019531 10.46875C5.0019531 10.46675 4.9932812 10.242187 5.1132812 10.117188C5.1872812 10.040188 5.318 10 5.5 10L6.9140625 10C6.7460625 9.497 6.316 9 5.5 9 z M 9.5 9C8.6774686 9 8 9.6774686 8 10.5L8 12.5C8 13.322531 8.6774686 14 9.5 14C10.322531 14 11 13.322531 11 12.5L11 10.5C11 9.6774686 10.322531 9 9.5 9 z M 12 9L12 14L13 14L13 11.357422L14 14L15 14L15 9L14 9L14 11.642578L13 9L12 9 z M 9.5 10C9.7814686 10 10 10.218531 10 10.5L10 12.5C10 12.781469 9.7814686 13 9.5 13C9.2185314 13 9 12.781469 9 12.5L9 10.5C9 10.218531 9.2185314 10 9.5 10 z" fill="#EFEFE7" />
                  </svg>
                </label>
              );
            })()}

            {/* Metronome */}
            <button className="mm-ico-btn" title="Metronome" onClick={() => setMetronomeOpen(true)} aria-label="Metronome">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
                <path d="M27 2.003906C26.761719 2.003906 26.527344 2.089844 26.339844 2.257813L20.410156 7.679688C20.242188 7.832031 20.132813 8.035156 20.097656 8.257813L19.820313 10L17.675781 22.847656L19.417969 24.589844L21.847656 10L23 10L23 28.171875L25 30.171875L25 10L29 10L29 12L27 12L27 14L29 14L29 16L27 16L27 18L29 18L29 20L27 20L27 22L29 22L29 24L27 24L27 26L29 26L29 28L27 28L27 30L29 30L29 32L25.414063 32L12.707031 19.292969L12.746094 19.253906C12.894531 19.105469 12.933594 18.871094 12.839844 18.679688L11.3125 15.621094C11.160156 15.3125 10.75 15.25 10.511719 15.488281L9.707031 16.292969L7.707031 14.292969L6.292969 15.707031L8.292969 17.707031L7.492188 18.511719C7.25 18.75 7.3125 19.15625 7.617188 19.3125L10.675781 20.839844C10.871094 20.9375 11.101563 20.898438 11.253906 20.746094L11.292969 20.707031L17.074219 26.484375L14.015625 44.835938C13.964844 45.125 14.046875 45.421875 14.234375 45.644531C14.425781 45.871094 14.707031 46 15 46C15 47.105469 15.894531 48 17 48C18.105469 48 19 47.105469 19 46L35 46C35 47.105469 35.894531 48 37 48C38.105469 48 39 47.105469 39 46C39.292969 46 39.574219 45.871094 39.765625 45.644531C39.953125 45.421875 40.035156 45.125 39.984375 44.835938L39.015625 39L39.585938 39L40.292969 39.707031C40.542969 39.96875 40.917969 40.074219 41.265625 39.980469C41.617188 39.890625 41.890625 39.617188 41.980469 39.265625C42.074219 38.917969 41.96875 38.542969 41.707031 38.292969L40.707031 37.292969C40.519531 37.105469 40.265625 37 40 37L38.679688 37L38.347656 35L40 35C40.359375 35.003906 40.695313 34.816406 40.878906 34.503906C41.058594 34.191406 41.058594 33.808594 40.878906 33.496094C40.695313 33.183594 40.359375 32.996094 40 33L38.015625 33L34.179688 10L34.183594 10L34.128906 9.695313L33.984375 8.835938C33.984375 8.828125 33.980469 8.824219 33.980469 8.816406L33.882813 8.25C33.847656 8.03125 33.734375 7.832031 33.574219 7.679688L27.65625 2.257813C27.472656 2.089844 27.238281 2.003906 27 2.003906 Z M 31 10L32.152344 10L35.820313 32L31 32 Z M 18.8125 28.222656L22.585938 32L18.183594 32Z" fill="#EFEFE7" />
              </svg>
            </button>

            {/* Ruler mode: Time vs Bars */}
            <button
              className={`mm-ico-btn ${rulerMode === 'bars' ? 'mm-ico-btn--ok' : ''}`}
              title={rulerMode === 'bars' ? 'Ruler: Bars/Beats' : 'Ruler: Time (seconds)'}
              aria-label="Toggle Ruler Mode"
              onClick={() => setRulerMode(m => m === 'time' ? 'bars' : 'time')}
            >
              {/* simple grid icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
                <path d="M13 10C11.35503 10 10 11.35503 10 13L10 67C10 68.64497 11.35503 70 13 70L67 70C68.64497 70 70 68.64497 70 67L70 13C70 11.35503 68.64497 10 67 10L13 10 z M 13 12L29 12 A 1 1 0 0 0 30 13 A 1 1 0 0 0 31 12L49 12 A 1 1 0 0 0 50 13 A 1 1 0 0 0 51 12L67 12C67.56503 12 68 12.43497 68 13L68 29 A 1 1 0 0 0 67 30 A 1 1 0 0 0 68 31L68 49 A 1 1 0 0 0 67 50 A 1 1 0 0 0 68 51L68 67C68 67.56503 67.56503 68 67 68L51 68 A 1 1 0 0 0 50 67 A 1 1 0 0 0 49 68L31 68 A 1 1 0 0 0 30 67 A 1 1 0 0 0 29 68L13 68C12.43497 68 12 67.56503 12 67L12 51 A 1 1 0 0 0 13 50 A 1 1 0 0 0 12 49L12 31 A 1 1 0 0 0 13 30 A 1 1 0 0 0 12 29L12 13C12 12.43497 12.43497 12 13 12 z M 30 15 A 1 1 0 0 0 29 16 A 1 1 0 0 0 30 17 A 1 1 0 0 0 31 16 A 1 1 0 0 0 30 15 z M 50 15 A 1 1 0 0 0 49 16 A 1 1 0 0 0 50 17 A 1 1 0 0 0 51 16 A 1 1 0 0 0 50 15 z M 30 19 A 1 1 0 0 0 29 20 A 1 1 0 0 0 30 21 A 1 1 0 0 0 31 20 A 1 1 0 0 0 30 19 z M 50 19 A 1 1 0 0 0 49 20 A 1 1 0 0 0 50 21 A 1 1 0 0 0 51 20 A 1 1 0 0 0 50 19 z M 30 23 A 1 1 0 0 0 29 24 A 1 1 0 0 0 30 25 A 1 1 0 0 0 31 24 A 1 1 0 0 0 30 23 z M 50 23 A 1 1 0 0 0 49 24 A 1 1 0 0 0 50 25 A 1 1 0 0 0 51 24 A 1 1 0 0 0 50 23 z M 30 27 A 1 1 0 0 0 29 28 A 1 1 0 0 0 30 29 A 1 1 0 0 0 31 28 A 1 1 0 0 0 30 27 z M 50 27 A 1 1 0 0 0 49 28 A 1 1 0 0 0 50 29 A 1 1 0 0 0 51 28 A 1 1 0 0 0 50 27 z M 16 29 A 1 1 0 0 0 15 30 A 1 1 0 0 0 16 31 A 1 1 0 0 0 17 30 A 1 1 0 0 0 16 29 z M 20 29 A 1 1 0 0 0 19 30 A 1 1 0 0 0 20 31 A 1 1 0 0 0 21 30 A 1 1 0 0 0 20 29 z M 24 29 A 1 1 0 0 0 23 30 A 1 1 0 0 0 24 31 A 1 1 0 0 0 25 30 A 1 1 0 0 0 24 29 z M 28 29 A 1 1 0 0 0 27 30 A 1 1 0 0 0 28 31 A 1 1 0 0 0 29 30 A 1 1 0 0 0 28 29 z M 32 29 A 1 1 0 0 0 31 30 A 1 1 0 0 0 32 31 A 1 1 0 0 0 33 30 A 1 1 0 0 0 32 29 z M 36 29 A 1 1 0 0 0 35 30 A 1 1 0 0 0 36 31 A 1 1 0 0 0 37 30 A 1 1 0 0 0 36 29 z M 40 29 A 1 1 0 0 0 39 30 A 1 1 0 0 0 40 31 A 1 1 0 0 0 41 30 A 1 1 0 0 0 40 29 z M 44 29 A 1 1 0 0 0 43 30 A 1 1 0 0 0 44 31 A 1 1 0 0 0 45 30 A 1 1 0 0 0 44 29 z M 48 29 A 1 1 0 0 0 47 30 A 1 1 0 0 0 48 31 A 1 1 0 0 0 49 30 A 1 1 0 0 0 48 29 z M 52 29 A 1 1 0 0 0 51 30 A 1 1 0 0 0 52 31 A 1 1 0 0 0 53 30 A 1 1 0 0 0 52 29 z M 56 29 A 1 1 0 0 0 55 30 A 1 1 0 0 0 56 31 A 1 1 0 0 0 57 30 A 1 1 0 0 0 56 29 z M 60 29 A 1 1 0 0 0 59 30 A 1 1 0 0 0 60 31 A 1 1 0 0 0 61 30 A 1 1 0 0 0 60 29 z M 64 29 A 1 1 0 0 0 63 30 A 1 1 0 0 0 64 31 A 1 1 0 0 0 65 30 A 1 1 0 0 0 64 29 z M 30 31 A 1 1 0 0 0 29 32 A 1 1 0 0 0 30 33 A 1 1 0 0 0 31 32 A 1 1 0 0 0 30 31 z M 50 31 A 1 1 0 0 0 49 32 A 1 1 0 0 0 50 33 A 1 1 0 0 0 51 32 A 1 1 0 0 0 50 31 z M 30 35 A 1 1 0 0 0 29 36 A 1 1 0 0 0 30 37 A 1 1 0 0 0 31 36 A 1 1 0 0 0 30 35 z M 50 35 A 1 1 0 0 0 49 36 A 1 1 0 0 0 50 37 A 1 1 0 0 0 51 36 A 1 1 0 0 0 50 35 z M 30 39 A 1 1 0 0 0 29 40 A 1 1 0 0 0 30 41 A 1 1 0 0 0 31 40 A 1 1 0 0 0 30 39 z M 50 39 A 1 1 0 0 0 49 40 A 1 1 0 0 0 50 41 A 1 1 0 0 0 51 40 A 1 1 0 0 0 50 39 z M 30 43 A 1 1 0 0 0 29 44 A 1 1 0 0 0 30 45 A 1 1 0 0 0 31 44 A 1 1 0 0 0 30 43 z M 50 43 A 1 1 0 0 0 49 44 A 1 1 0 0 0 50 45 A 1 1 0 0 0 51 44 A 1 1 0 0 0 50 43 z M 30 47 A 1 1 0 0 0 29 48 A 1 1 0 0 0 30 49 A 1 1 0 0 0 31 48 A 1 1 0 0 0 30 47 z M 50 47 A 1 1 0 0 0 49 48 A 1 1 0 0 0 50 49 A 1 1 0 0 0 51 48 A 1 1 0 0 0 50 47 z M 16 49 A 1 1 0 0 0 15 50 A 1 1 0 0 0 16 51 A 1 1 0 0 0 17 50 A 1 1 0 0 0 16 49 z M 20 49 A 1 1 0 0 0 19 50 A 1 1 0 0 0 20 51 A 1 1 0 0 0 21 50 A 1 1 0 0 0 20 49 z M 24 49 A 1 1 0 0 0 23 50 A 1 1 0 0 0 24 51 A 1 1 0 0 0 25 50 A 1 1 0 0 0 24 49 z M 28 49 A 1 1 0 0 0 27 50 A 1 1 0 0 0 28 51 A 1 1 0 0 0 29 50 A 1 1 0 0 0 28 49 z M 32 49 A 1 1 0 0 0 31 50 A 1 1 0 0 0 32 51 A 1 1 0 0 0 33 50 A 1 1 0 0 0 32 49 z M 36 49 A 1 1 0 0 0 35 50 A 1 1 0 0 0 36 51 A 1 1 0 0 0 37 50 A 1 1 0 0 0 36 49 z M 40 49 A 1 1 0 0 0 39 50 A 1 1 0 0 0 40 51 A 1 1 0 0 0 41 50 A 1 1 0 0 0 40 49 z M 44 49 A 1 1 0 0 0 43 50 A 1 1 0 0 0 44 51 A 1 1 0 0 0 45 50 A 1 1 0 0 0 44 49 z M 48 49 A 1 1 0 0 0 47 50 A 1 1 0 0 0 48 51 A 1 1 0 0 0 49 50 A 1 1 0 0 0 48 49 z M 52 49 A 1 1 0 0 0 51 50 A 1 1 0 0 0 52 51 A 1 1 0 0 0 53 50 A 1 1 0 0 0 52 49 z M 56 49 A 1 1 0 0 0 55 50 A 1 1 0 0 0 56 51 A 1 1 0 0 0 57 50 A 1 1 0 0 0 56 49 z M 60 49 A 1 1 0 0 0 59 50 A 1 1 0 0 0 60 51 A 1 1 0 0 0 61 50 A 1 1 0 0 0 60 49 z M 64 49 A 1 1 0 0 0 63 50 A 1 1 0 0 0 64 51 A 1 1 0 0 0 65 50 A 1 1 0 0 0 64 49 z M 30 51 A 1 1 0 0 0 29 52 A 1 1 0 0 0 30 53 A 1 1 0 0 0 31 52 A 1 1 0 0 0 30 51 z M 50 51 A 1 1 0 0 0 49 52 A 1 1 0 0 0 50 53 A 1 1 0 0 0 51 52 A 1 1 0 0 0 50 51 z M 30 55 A 1 1 0 0 0 29 56 A 1 1 0 0 0 30 57 A 1 1 0 0 0 31 56 A 1 1 0 0 0 30 55 z M 50 55 A 1 1 0 0 0 49 56 A 1 1 0 0 0 50 57 A 1 1 0 0 0 51 56 A 1 1 0 0 0 50 55 z M 30 59 A 1 1 0 0 0 29 60 A 1 1 0 0 0 30 61 A 1 1 0 0 0 31 60 A 1 1 0 0 0 30 59 z M 50 59 A 1 1 0 0 0 49 60 A 1 1 0 0 0 50 61 A 1 1 0 0 0 51 60 A 1 1 0 0 0 50 59 z M 30 63 A 1 1 0 0 0 29 64 A 1 1 0 0 0 30 65 A 1 1 0 0 0 31 64 A 1 1 0 0 0 30 63 z M 50 63 A 1 1 0 0 0 49 64 A 1 1 0 0 0 50 65 A 1 1 0 0 0 51 64 A 1 1 0 0 0 50 63 z" fill="#EFEFE7" />
              </svg>
            </button>

            {/* Rhythm (quick access) */}
            <button className="mm-ico-btn" title="Add Rhythm Track…" onClick={() => setRhythmOpen(true)} aria-label="Add Rhythm Track">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 26">
                <path d="M21.0625 0.09375C20.953125 0.117188 20.851563 0.1875 20.75 0.25L9.125 7.28125C9.03125 7.339844 9.035156 7.527344 9.125 7.6875C9.214844 7.84375 9.371094 7.929688 9.46875 7.875L13.5 5.71875C14.9375 5.914063 16.222656 6.269531 17.28125 6.71875L19.03125 5.84375C18.074219 5.304688 16.910156 4.875 15.625 4.5625L21.4375 1.4375C21.863281 1.207031 22.070313 0.75 21.875 0.40625C21.726563 0.144531 21.390625 0.0195313 21.0625 0.09375 Z M 11 4C4.925781 4 0 6.585938 0 9.78125C0 12.976563 4.925781 15.59375 11 15.59375C17.074219 15.59375 22 13.761719 22 9.78125C22 9.132813 21.78125 8.519531 21.40625 7.9375L25.09375 6.84375C25.652344 6.679688 26.003906 6.230469 25.875 5.84375C25.753906 5.464844 25.199219 5.300781 24.65625 5.5L11.25 10.34375C11.148438 10.375 11.136719 10.53125 11.1875 10.6875C11.234375 10.839844 11.339844 10.9375 11.4375 10.90625L19.875 8.40625C20.261719 8.855469 20.46875 9.328125 20.46875 9.78125C20.46875 12.921875 15.363281 14.03125 11 14.03125C5.585938 14.03125 1.53125 11.789063 1.53125 9.78125C1.53125 7.988281 4.773438 6.03125 9.3125 5.625L11.34375 4C11.234375 3.996094 11.109375 4 11 4 Z M 0 11.34375L0 20.21875C0 22.015625 1.558594 23.625 4 24.6875L4 15.8125C1.558594 14.75 0 13.140625 0 11.34375 Z M 22 11.34375C22 13.582031 20.441406 15.132813 18 16.0625L18 24.9375C20.441406 24.007813 22 22.460938 22 20.21875 Z M 6 16.5L6 25.375C7.5 25.78125 9.195313 26 11 26C12.804688 26 14.5 25.828125 16 25.5L16 16.65625C14.5 16.984375 12.804688 17.125 11 17.125C9.195313 17.125 7.5 16.90625 6 16.5Z" fill="#EFEFE7" />
              </svg>
            </button>

            {/* Settings */}
            {/* <button className="mm-ico-btn" title="Settings" onClick={() => setMasterSettingsOpen(true)} aria-label="Settings">
              <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm8.9-3.9-.8-2 1.6-3.1-2.8-2.8-3.1 1.6-2-.8L12 0l-2 3.5-2 .8-3.1-1.6L2.1 5.5l1.6 3.1-.8 2L0 12l3.5 2 .8 2-1.6 3.1 2.8 2.8 3.1-1.6 2 .8L12 24l2-3.5 2-.8 3.1 1.6 2.8-2.8-1.6-3.1.8-2L24 12l-3.5-2z" /></svg>
            </button> */}
          </div>
        </div>
      </header>

      {/* Main area with full-width timeline (no left sidebar) */}
      <div className="relative flex-1 p-2 md:p-4 min-h-[calc(100vh-120px)] ">
        {/* Full-width timeline */}
        <div className="rounded-2xl border border-slate-800/80 h-full bg-gradient-to-b from-slate-800/70 to-slate-900/70 p-2 md:p-3 shadow-xl shadow-slate-900/40" style={{ minHeight: `${window.innerWidth > 1000 ? 'calc(100vh - 100px)' : 'calc(100vh - 55px)'}` }}>
          <Timeline
            key={timelineKey}
            time={time}
            duration={duration}
            tracks={tracks}
            onSeek={(t) => api.seek(t)}
            onPlay={() => api.play()}
            onPause={() => api.pause()}
            playing={playing}
            onPlaySelection={(trackId, clipId, a, b) => (api as any).playSelection?.(trackId, clipId, a, b)}
            onSplitClip={(trackId, clipId, at) => ((api as any).splitClipFast?.(trackId, clipId, at)) || (api as any).splitClip?.(trackId, clipId, at)}
            onMoveClip={(targetTrackId, clipId, newBegin) => (api as any).moveClip?.(targetTrackId, clipId, newBegin)}
            onTrimClip={(trackId, clipId, newBegin, newEnd) => (api as any).trimClip?.(trackId, clipId, newBegin, newEnd)}
            onSplitRange={async (trackId, clipId, startAbs, endAbs) => {
              const [a, b] = startAbs <= endAbs ? [startAbs, endAbs] : [endAbs, startAbs];
              const waitFor = async (pred: () => any, timeoutMs = 1200, stepMs = 40) => {
                const t0 = performance.now();
                while (performance.now() - t0 < timeoutMs) {
                  const v = pred(); if (v) return v; await new Promise(r => setTimeout(r, stepMs));
                }
                return null;
              };
              try {
                await (api as any).splitClip?.(trackId, clipId, a);
                const mid1 = await waitFor(() => {
                  const tr = (tracksRef.current || []).find((t: Track) => String(t.id) === String(trackId));
                  return tr?.clips.find((c: Clip) => Math.abs(c.beginTime - a) < 1e-3);
                });
                const midId = mid1?.id || clipId;
                await (api as any).splitClip?.(trackId, midId, b);
                const middle = await waitFor(() => {
                  const tr = (tracksRef.current || []).find((t: Track) => String(t.id) === String(trackId));
                  return tr?.clips.find((c: Clip) => Math.abs(c.beginTime - a) < 1e-3 && Math.abs(c.durationSec - (b - a)) < 1e-2);
                });
                if (middle?.id) (api as any).deleteClip?.(trackId, middle.id);
              } catch { }
            }}
            getClipWaveform={(api as any).getClipWaveform}
            selectedClipId={selected?.clipId}
            onSelectClip={(trackId, clipId) => setSelected({ trackId, clipId })}
            selectedTrackId={selectedTrackId || undefined}
            onSelectTrack={(id) => setSelectedTrackId(id)}

            // inline track controls
            onTrackGain={(id, v) => api.setTrackGain(id, v)}
            onTrackPan={(id, v) => api.setTrackPan(id, v)}
            onTrackMute={(id, m) => api.setTrackMute(id, m)}
            onTrackSolo={(id, s) => api.setTrackSolo(id, s)}
            listTrackEffectsDetailed={(api as any).listTrackEffectsDetailed}
            setTrackEffectField={(api as any).setTrackEffectField}
            listEffects={(api as any).listEffects}
            addTrackEffect={(api as any).addTrackEffect}
            removeTrackEffect={(api as any).removeTrackEffect}
            onDeleteClip={(trackId, clipId) => (api as any).deleteClip?.(trackId, clipId)}
            zoom={zoom}
            onZoom={setZoomSmooth}
            onSetClipFade={(trackId, clipId, fin, fout) => (api as any).setClipFade?.(trackId, clipId, fin, fout)}
            onDeleteTrack={(id) => { (api as any).deleteTrack?.(id); if (selected?.trackId === id) setSelected(null); }}
            onAddTrack={async () => {
              try {
                const newId = await (api as any).createTrack?.({ name: 'Track' });
                if (newId != null) setSelectedTrackId(String(newId));
              } catch { }
            }}
            freezeTouch={freezeTouch}
            onToggleFreezeTouch={(on) => { setFreezeTouch(on); if (on) api.pause(); }}
            gridMode={rulerMode}
            tempoBpm={rulerTempo}
            timeSignature={rulerTS}
            subdivision={rulerSubdivision}
          />
        </div>
      </div>
      {/* Removed sidebar and FX drawer for more wave space */}

      {/* Bottom transport dock */}
      <footer className="sticky bottom-0 z-30 md:z-[5000] sm:[5000] bg-gradient-to-t from-black/70 to-slate-900/80 backdrop-blur border-t border-slate-800 ">
        <div className="flex items-center gap-3 md:gap-4 px-3 md:px-4">
          <div className=" md:hidden sm:hidden lg:flex items-center gap-2">
            <button className="mm-ico-btn" title="Master FX" onClick={() => setMasterFxOpen(true)} aria-label="Master FX">
              <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" /></svg>
            </button>
            {/* <button className="mm-ico-btn" title="Settings" onClick={() => setMasterSettingsOpen(true)} aria-label="Settings">
              <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm8.9-3.9-.8-2 1.6-3.1-2.8-2.8-3.1 1.6-2-.8L12 0l-2 3.5-2 .8-3.1-1.6L2.1 5.5l1.6 3.1-.8 2L0 12l3.5 2 .8 2-1.6 3.1 2.8 2.8 3.1-1.6 2 .8L12 24l2-3.5 2-.8 3.1 1.6 2.8-2.8-1.6-3.1.8-2L24 12l-3.5-2z" /></svg>
            </button> */}
            {/* Quick metronome toggle */}
            <MiniMetronome />
          </div>
          {/* Mobile: quick actions button (right) */}
          <div className="md:absolute sm:absolute lg:hidden  w-full bottom-1 right-4" style={{ direction: "rtl" }}>
            <button
              className="rounded-full  text-white  shadow-lg"
              onClick={() => setFooterMenuOpen(!footerMenuOpen)}
              aria-label="Show menu"
              title="Show menu"
            >
              <svg width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#38bdf8" /><text x="16" y="21" textAnchor="middle" fontSize="16" fill="#fff">+</text></svg>
            </button>
          </div>
          {/* Mobile: timeline zoom slider (center) */}
          <div className="lg:hidden flex-1 md:flex sm:flex justify-center">
            <div className="flex items-center gap-3 px-2 py-1 rounded-md bg-slate-900/70 border border-slate-700 shadow z-[3500]">
              <span className="text-[11px] text-white/70">Zoom</span>
              <input
                className="mm-range mm-range-zoom w-56"
                type="range"
                min={10}
                max={1000}
                step={1}
                value={zoom}
                onChange={(e) => setZoomSmooth(parseInt((e.target as HTMLInputElement).value))}
              />
              <span className="text-[11px] text-white/60 tabular-nums w-10 text-right">{zoom}</span>
              <button
                className="px-2 py-1 text-[11px] rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700"
                onClick={() => setRecSettingsOpen(true)}
                title="Recording settings"
              >Rec Mode</button>
              {/* Studio Mode toggle: disables browser voice filters for fuller instrument capture */}
              <div className="flex items-center gap-1 pl-2 ml-2 border-l border-slate-700">
                <span className="text-[11px] text-white/70">Studio</span>
                <button
                  className={`px-2 py-1 text-[11px] rounded-md border ${studioMode ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-white/80'}`}
                  onClick={() => setStudioMode((v) => !v)}
                  title={studioMode ? 'Studio Mode ON (no EC/NS/AGC)' : 'Studio Mode OFF (voice filters on)'}
                  aria-pressed={studioMode}
                >
                  {studioMode ? 'On' : 'Off'}
                </button>
              </div>
              {recording && (
                <div className="flex items-center gap-2 pl-2 ml-2 border-l border-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" aria-label="Recording" />
                  <span className="text-[12px] tabular-nums text-white/80" aria-live="polite">
                    {(() => { const m = Math.floor(recElapsed / 60); const s = (recElapsed % 60).toString().padStart(2, '0'); return `${m}:${s}`; })()}
                  </span>
                  <button
                    className="mm-ico-btn bg-red-600 border-red-500 hover:bg-red-500"
                    title="Stop Recording"
                    aria-label="Stop Recording"
                    onClick={stopRecording}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4"><rect x="7" y="7" width="10" height="10" fill="currentColor" /></svg>
                  </button>
                </div>
              )}
            </div>


          </div>
          <div className="lg:flex md:hidden sm:hidden flex-1 min-w-0">
            <Transport
              playing={playing}
              time={time}
              duration={duration}
              onPlay={() => api.play()}
              onPause={() => api.pause()}
              onSeek={(t) => api.seek(t)}
              onSplit={selected ? () => (api as any).splitClip?.(selected.trackId, selected.clipId, time) : undefined}
              onUndo={(api as any).undo}
              onRedo={(api as any).redo}
              canUndo={(api as any).canUndo?.()}
              canRedo={(api as any).canRedo?.()}
              onOpenMetronome={() => setMetronomeOpen(true)}
              zoom={zoom}
              onZoom={setZoomSmooth}
              onAddRhythmHit={({ kind, bpm }) => (api as any).addRhythmTrack?.({ kind, bpm, bars: 1, subdivision: 'quarter', single: true })}
              onRecord={handleRecordClick}
              recording={recording}
            />
          </div>
          <div className="hidden md:block w-24 h-3 border border-slate-700 rounded bg-slate-900 shadow-inner" />

        </div>
        {footerMenuOpen && (
          <div
            className="fixed inset-[-5px] z-[5000] flex items-end justify-end mr-12 mb-3 md:hidden "
            // style={{ background: 'rgba(0,0,0,0.7)' }}
            onClick={() => setFooterMenuOpen(false)}
          >
            <div
              className="absolute mb-5 flex flex-col gap-2 h-full bg-success"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-full h-full">
                <div className='absolute '>
                  {[
                    {
                      icon: "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0",
                      title: "Record",
                      onClick: () => { handleRecordClick(); }
                    },
                    {
                      icon: "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z",
                      title: "Undo",
                      onClick: () => {
                        (api as any).undo?.();
                        setFooterMenuOpen(false);
                      },
                      disabled: !(api as any).canUndo?.()
                    },
                    {
                      icon: "M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z",
                      title: "Redo",
                      onClick: () => {
                        (api as any).redo?.();
                        setFooterMenuOpen(false);
                      },
                      disabled: !(api as any).canRedo?.()
                    },
                    {
                      icon: "M19.2928932,12 L14,12 L14,19.5 C14,19.7761424 13.7761424,20 13.5,20 C13.2238576,20 13,19.7761424 13,19.5 L13,3.5 C13,3.22385763 13.2238576,3 13.5,3 C13.7761424,3 14,3.22385763 14,3.5 L14,11 L19.2928932,11 L16.1464466,7.85355339 C15.9511845,7.65829124 15.9511845,7.34170876 16.1464466,7.14644661 C16.3417088,6.95118446 16.6582912,6.95118446 16.8535534,7.14644661 L20.8535534,11.1464466 C21.0488155,11.3417088 21.0488155,11.6582912 20.8535534,11.8535534 L16.8535534,15.8535534 C16.6582912,16.0488155 16.3417088,16.0488155 16.1464466,15.8535534 C15.9511845,15.6582912 15.9511845,15.3417088 16.1464466,15.1464466 L19.2928932,12 Z M4.70710678,11 L10,11 L10,3.5 C10,3.22385763 10.2238576,3 10.5,3 C10.7761424,3 11,3.22385763 11,3.5 L11,19.5 C11,19.7761424 10.7761424,20 10.5,20 C10.2238576,20 10,19.7761424 10,19.5 L10,12 L4.70710678,12 L7.85355339,15.1464466 C8.04881554,15.3417088 8.04881554,15.6582912 7.85355339,15.8535534 C7.65829124,16.0488155 7.34170876,16.0488155 7.14644661,15.8535534 L3.14644661,11.8535534 C2.95118446,11.6582912 2.95118446,11.3417088 3.14644661,11.1464466 L7.14644661,7.14644661 C7.34170876,6.95118446 7.65829124,6.95118446 7.85355339,7.14644661 C8.04881554,7.34170876 8.04881554,7.65829124 7.85355339,7.85355339 L4.70710678,11 Z",
                      title: "Split",
                      onClick: () => {
                        if (selected) (api as any).splitClip?.(selected.trackId, selected.clipId, time);
                        setFooterMenuOpen(false);
                      },
                      disabled: !selected
                    },
                    {
                      icon: "M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z",
                      title: "Master FX",
                      onClick: () => {
                        setMasterFxOpen(true);
                        setFooterMenuOpen(false);
                      }
                    },
                    {
                      icon: "M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z",
                      title: "Settings",
                      onClick: () => {
                        setMasterSettingsOpen(true);
                        setFooterMenuOpen(false);
                      }
                    }
                  ].map((item, index) => (
                    <button
                      key={item.title}
                      className={`w-8 h-8 rounded-full ${item.disabled ? 'bg-blue-500/50 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'} flex items-center justify-center transition-colors shadow-lg`}
                      title={item.title}
                      onClick={item.onClick}
                      disabled={item.disabled}
                      style={{
                        transform: `translateY(${-index * 38}px)`,
                        position: 'absolute',
                        bottom: 0
                      }}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 text-white">
                        <path fill="currentColor" d={item.icon} />
                      </svg>
                    </button>
                  ))}
                </div>

              </div>

            </div>
          </div>
        )}
      </footer>

      <MetronomeModal
        open={metronomeOpen}
        onClose={() => setMetronomeOpen(false)}

      />

      {/* Right drawer: Master FX */}
      {legacy && masterFxOpen && (
        <div className="fixed inset-y-0 right-0 w-[360px] md:w-[420px] bg-slate-900 border-l border-slate-800 shadow-2xl z-[3001] pt-16 pb-24 overflow-auto">
          <div className="px-3 py-2 flex items-center justify-between border-b border-slate-800">
            <div className="text-lg font-semibold">Master FX</div>
            <button className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => setMasterFxOpen(false)} title="Close">Close</button>
          </div>
          <div className="p-3">
            <EffectsPanel
              tracks={tracks.map((t: any) => ({ id: t.id, name: (t as any).name || 'Track' }))}
              legacy={legacy}
              listEffects={(api as any).listEffects}
              addMasterEffect={(api as any).addMasterEffect}
              addTrackEffect={(api as any).addTrackEffect}
              addMasterGainDb={(api as any).addMasterGainDb}
              addTrackGainDb={(api as any).addTrackGainDb}
            />
          </div>
        </div>
      )}

      {/* Right drawer: Master Settings (basic placeholder) */}
      {masterSettingsOpen && (
        <div className="fixed z-[3000] inset-y-0 right-0 w-[340px] md:w-[380px] bg-slate-900 border-l border-slate-800 shadow-2xl  pt-16 pb-24 overflow-auto">
          <div className="px-3 py-2 flex items-center justify-between border-b border-slate-800">
            <div className="text-lg font-semibold">Master Settings</div>
            <button className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => setMasterSettingsOpen(false)} title="Close">Close</button>
          </div>
          <div className="p-4 text-slate-300">
            <p className="mb-3 text-slate-400">Global project options and utilities.</p>
            <div className="space-y-3">
              <button className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => setMetronomeOpen(true)}>Open Metronome</button>
              <button className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => alert('Use mic button in transport to record')}>Record New Track…</button>
              <button className="px-3 py-2 rounded-md bg-sky-700 hover:bg-sky-600" onClick={() => setRhythmOpen(true)}>Add Rhythm Track…</button>
            </div>
          </div>
        </div>
      )}
      <RythemModal
        open={rhythmOpen}
        onClose={() => setRhythmOpen(false)}
        onCommit={async (buffer, name) => {
          try {
            // Encode to WAV and import so it works for both minimal and legacy engines
            const toWav = (buf: AudioBuffer) => {
              const numCh = buf.numberOfChannels; const sr = buf.sampleRate; const bytesPerSample = 2; const blockAlign = numCh * bytesPerSample; const dataSize = buf.length * blockAlign; const ab = new ArrayBuffer(44 + dataSize); const dv = new DataView(ab);
              const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
              ws(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE'); ws(12, 'fmt ');
              dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, numCh, true);
              dv.setUint32(24, sr, true); dv.setUint32(28, sr * blockAlign, true); dv.setUint16(32, blockAlign, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, dataSize, true);
              const ch: Float32Array[] = Array.from({ length: numCh }, (_, i) => buf.getChannelData(i)); let off = 44; for (let i = 0; i < buf.length; i++) { for (let c = 0; c < numCh; c++) { const s = Math.max(-1, Math.min(1, (ch[c]![i] || 0))); const v = s < 0 ? s * 0x8000 : s * 0x7FFF; dv.setInt16(off, v, true); off += 2; } }
              return new Blob([ab], { type: 'audio/wav' });
            };
            const blob = toWav(buffer);
            const file = new File([blob], `${name.replace(/\s+/g, '_')}.wav`, { type: 'audio/wav' });
            await (api as any).importToNewTrack?.(file);
          } catch (e) { console.error(e); }
        }}
        onImportFile={async (file) => { try { await (api as any).importToNewTrack?.(file); } catch (e) { console.error(e); } }}
        onHostPlay={() => api.play()}
        onHostPause={() => api.pause()}
        defaultDurationSec={duration}
      />
    </div>
  );
}

