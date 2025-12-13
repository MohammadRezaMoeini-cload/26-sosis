import React, { useEffect, useRef, useState } from 'react';

type Props = {
  onRecorded: (file: File) => Promise<void> | void;
};

export default function RecordPanel({ onRecorded }: Props) {
  const [recState, setRecState] = useState<'idle'|'arming'|'ready'|'recording'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef<MediaStream | null>(null);
  const recRef = useRef<any>(null); // MediaRecorder | null
  const chunksRef = useRef<Blob[]>([]);
  const startTsRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recRef.current && recRef.current.state === 'recording') {
        try { recRef.current.stop(); } catch {}
      }
      mediaRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, []);

  const arm = async () => {
    try {
      setErr(null);
      setRecState('arming');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      setRecState('ready');
    } catch (e: any) {
      setErr(e?.message || 'Microphone permission denied');
      setRecState('idle');
    }
  };

  const start = () => {
    if (!mediaRef.current) return;
    try {
      const MR: any = (window as any).MediaRecorder || (globalThis as any).MediaRecorder;
      const rec = new MR(mediaRef.current, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      rec.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `Recording-${new Date().toISOString().replace(/[:.]/g,'-')}.webm`, { type: 'audio/webm' });
        await onRecorded(file);
        setElapsed(0);
      };
      rec.start(100); // timeslice ms
      recRef.current = rec;
      startTsRef.current = performance.now();
      const tick = () => { setElapsed((performance.now() - startTsRef.current)/1000); timerRef.current = requestAnimationFrame(tick) as any; };
      timerRef.current = requestAnimationFrame(tick) as any;
      setRecState('recording');
    } catch (e: any) {
      setErr(e?.message || 'Recording failed');
    }
  };

  const stop = () => {
    try { if (recRef.current) recRef.current.stop(); } catch {}
    if (timerRef.current) { cancelAnimationFrame(timerRef.current); timerRef.current = null; }
    mediaRef.current?.getTracks().forEach(t => t.stop());
    mediaRef.current = null;
    setRecState('idle');
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Record</h3>
      {err && <div className="text-red-400 mb-2">{err}</div>}
      {recState === 'idle' && (
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition active:scale-95" onClick={arm}>Arm Mic</button>
      )}
      {recState === 'arming' && (
        <div className="text-slate-400">Requesting mic permission…</div>
      )}
      {recState === 'ready' && (
        <button className="px-3 py-2 rounded-md border border-emerald-600/50 bg-emerald-600 hover:bg-emerald-500 text-white transition active:scale-95" onClick={start}>Start Recording</button>
      )}
      {recState === 'recording' && (
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition active:scale-95" onClick={stop}>Stop</button>
          <span className="tabular-nums text-sky-400 font-semibold">{formatTime(elapsed)}</span>
        </div>
      )}
      <div className="text-slate-400 mt-1 text-sm">Adds a new track from your microphone.</div>
    </div>
  );
}

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

