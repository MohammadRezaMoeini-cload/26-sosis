import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type StudioRecorderProps = {
  className?: string;
  onComplete?: (blob: Blob) => void;
  defaultStudioMode?: boolean;
};

type RecState = 'idle' | 'recording';

function isIOS(): boolean {
  try {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
  } catch { return false; }
}

async function getUserMediaCompat(constraints: MediaStreamConstraints): Promise<MediaStream> {
  try {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      return await navigator.mediaDevices.getUserMedia(constraints);
    }
  } catch {}
  const legacy: any = (navigator as any).getUserMedia || (navigator as any).webkitGetUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).msGetUserMedia;
  if (legacy) {
    return await new Promise<MediaStream>((resolve, reject) => legacy.call(navigator, constraints, resolve, reject));
  }
  throw new Error('getUserMedia not supported in this browser');
}

function pickAudioMime(): string {
  try {
    const MR: any = (window as any).MediaRecorder;
    if (MR && typeof MR.isTypeSupported === 'function') {
      const order = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
      for (const t of order) { if (MR.isTypeSupported(t)) return t; }
    }
  } catch {}
  return 'audio/webm';
}

export default function StudioRecorder({ className, onComplete, defaultStudioMode = true }: StudioRecorderProps) {
  const [studioMode, setStudioMode] = useState<boolean>(defaultStudioMode);
  const [micGranted, setMicGranted] = useState<boolean>(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState<string | ''>('');

  const [state, setState] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState<number>(0);
  const tickRef = useRef<number | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = (list || []).filter((d) => d.kind === 'audioinput');
      setAudioInputs(inputs as any);
      if (!inputDeviceId && inputs[0]) setInputDeviceId(inputs[0].deviceId);
    } catch {}
  }, [inputDeviceId]);

  const requestPermission = useCallback(async () => {
    try {
      setMicError(null);
      const s = await getUserMediaCompat({ audio: true });
      setMicGranted(true);
      try { s.getTracks().forEach(t => t.stop()); } catch {}
      await refreshDevices();
    } catch (e) {
      setMicGranted(false);
      const err = e as any;
      setMicError((err?.name ? err.name + ': ' : '') + (err?.message || 'Microphone permission denied'));
    }
  }, [refreshDevices]);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const constraints = useMemo(() => {
    const deviceConstraint = inputDeviceId ? { deviceId: { ideal: inputDeviceId } as any } : {};
    const base: any = studioMode
      ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
    if (isIOS()) return { audio: { ...base, ...deviceConstraint } } as MediaStreamConstraints;
    return { audio: { ...base, channelCount: 2, sampleRate: 48000, ...deviceConstraint } } as MediaStreamConstraints;
  }, [studioMode, inputDeviceId]);

  const start = useCallback(async () => {
    if (state === 'recording') return;
    try {
      const stream = await getUserMediaCompat(constraints);
      setMicGranted(true);
      mediaRef.current = stream;
      const mime = pickAudioMime();
      const MR: any = (window as any).MediaRecorder;
      if (!MR) throw new Error('MediaRecorder not supported');
      const rec: MediaRecorder = new MR(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (ev: BlobEvent) => { if (ev.data && ev.data.size) chunksRef.current.push(ev.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        onComplete?.(blob);
      };
      recRef.current = rec;
      rec.start(100);
      setState('recording');
      setElapsed(0);
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      tickRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000) as any;
    } catch (e) {
      const err = e as any;
      setMicError((err?.name ? err.name + ': ' : '') + (err?.message || 'Unable to start recording'));
    }
  }, [constraints, onComplete, state]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    try { mediaRef.current?.getTracks().forEach(t => t.stop()); } catch {}
    recRef.current = null; mediaRef.current = null;
    setState('idle');
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  }, []);

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-base font-semibold">Studio Recorder</div>
        <button className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-xs" onClick={requestPermission}>Grant Mic Permission</button>
      </div>

      <div className="space-y-3">
        <label className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700">
          <span className="text-sm">Studio Mode</span>
          <button
            className={`px-3 py-1 text-xs rounded-md border ${studioMode ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-white/85'}`}
            onClick={() => setStudioMode(v => !v)}
            aria-pressed={studioMode}
          >
            {studioMode ? 'On' : 'Off'}
          </button>
        </label>

        <div>
          <div className="text-xs text-slate-400 mb-1">Input Device</div>
          <div className="flex items-center gap-2">
            <select
              className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 flex-1"
              value={inputDeviceId}
              onChange={(e) => setInputDeviceId(e.target.value)}
              onFocus={() => refreshDevices()}
            >
              {audioInputs.length === 0 && <option value="">Default Microphone</option>}
              {audioInputs.map((d, i) => (
                <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i + 1}`}</option>
              ))}
            </select>
            <button className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => refreshDevices()}>Refresh</button>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Tip: browsers may require mic permission before showing device names.</div>
        </div>

        <div className="flex items-center gap-2">
          {state === 'idle' ? (
            <button className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 border border-emerald-500" onClick={start}>Start</button>
          ) : (
            <button className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-500 border border-red-500" onClick={stop}>Stop</button>
          )}
          <span className="text-xs text-white/80">{state === 'recording' ? `Recording… ${fmt(elapsed)}` : 'Idle'}</span>
          <span className={`text-xs ${micGranted ? 'text-emerald-400' : 'text-slate-400'} ml-auto`}>{micGranted ? 'Permission: Granted' : 'Permission: Unknown'}</span>
        </div>

        {micError && (
          <div className="text-[12px] text-red-400">{micError}</div>
        )}
      </div>
    </div>
  );
}

