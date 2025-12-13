import React, { useEffect, useRef, useState } from 'react';
import { ExportResult } from '../engine/types';

type Props = {
  onExportWav: () => Promise<ExportResult>;
  onExportMp3?: () => Promise<ExportResult>;
  onExportProject?: () => Promise<{ blob: Blob; url: string; size: number }>;
  onImportProject?: (file: File) => Promise<void>;
  onRenderToTrack?: () => Promise<void> | void;
  legacy?: boolean;
};

export default function ExportPanel({ onExportWav, onExportMp3, onExportProject, onImportProject, onRenderToTrack, legacy }: Props) {
  const [down, setDown] = useState<ExportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [projDown, setProjDown] = useState<{ url: string; size: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-download when an export completes
  useEffect(() => {
    if (!down) return;
    try {
      const a = document.createElement('a');
      a.href = down.url;
      a.download = `mix.${down.mime === 'audio/mpeg' ? 'mp3' : 'wav'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a short delay to allow download
      setTimeout(() => { try { URL.revokeObjectURL(down.url); } catch {} }, 10000);
    } catch {}
  }, [down]);

  // Auto-download for project export
  useEffect(() => {
    if (!projDown) return;
    try {
      const a = document.createElement('a');
      a.href = projDown.url;
      a.download = 'project.mix.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { try { URL.revokeObjectURL(projDown.url); } catch {} }, 10000);
    } catch {}
  }, [projDown]);
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Export</h3>
      <div className="flex flex-wrap gap-2">
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40 active:scale-95" disabled={busy} onClick={async () => {
          try { setBusy(true); const r = await onExportWav(); setDown(r); } finally { setBusy(false); }
        }}>Export WAV</button>
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40 active:scale-95" disabled={busy || !onExportMp3} onClick={async () => {
          if (!onExportMp3) return;
          try { setBusy(true); const r = await onExportMp3(); setDown(r); } finally { setBusy(false); }
        }}>Export MP3</button>
        {onRenderToTrack && (
          <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40 active:scale-95" disabled={busy} onClick={async () => {
            try { setBusy(true); await onRenderToTrack(); } finally { setBusy(false); }
          }}>Render To Track</button>
        )}
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40 active:scale-95" disabled={busy || !onExportProject} onClick={async () => {
          if (!onExportProject) return;
          try { setBusy(true); const r = await onExportProject(); setProjDown({ url: r.url, size: r.size }); } finally { setBusy(false); }
        }}>Export Project</button>
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40 active:scale-95" disabled={busy || !onImportProject} onClick={() => fileRef.current?.click()}>Import Project</button>
        <input ref={fileRef} type="file" accept="application/json" style={{display:'none'}} onChange={async (e) => {
          const input = e.currentTarget as HTMLInputElement | null;
          const file = input?.files?.[0];
          if (!file || !onImportProject) { if (input) input.value=''; return; }
          setBusy(true);
          try { await onImportProject(file); } finally { setBusy(false); if (fileRef.current) fileRef.current.value=''; }
        }} />
      </div>
      {down && (
        <div className="mt-2">
          <a className="px-3 py-2 inline-block rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition" href={down.url} download={`mix.${down.mime==='audio/mpeg'?'mp3':'wav'}`}>Download Audio ({(down.size/1024/1024).toFixed(2)} MB)</a>
        </div>
      )}
      {projDown && (
        <div className="mt-2">
          <a className="px-3 py-2 inline-block rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition" href={projDown.url} download={`project.mix.json`}>Download Project ({(projDown.size/1024).toFixed(1)} KB)</a>
        </div>
      )}
      {legacy && !onExportMp3 && (
        <div className="text-slate-400 mt-2">Legacy MP3/WAV export not yet wired.</div>
      )}
    </div>
  );
}
