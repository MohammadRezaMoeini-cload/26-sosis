import React, { useMemo, useState } from 'react';

type Props = {
  selected?: { trackId: string; clipId: string } | null;
  tracks: { id: string; name: string }[];
  onDelete: (trackId: string, clipId: string) => void;
  onDuplicate: (trackId: string, clipId: string) => void;
  onSetFade: (trackId: string, clipId: string, fadeInSec: number, fadeOutSec: number) => void;
};

export default function ClipTools({ selected, tracks, onDelete, onDuplicate, onSetFade }: Props) {
  const [fi, setFi] = useState(0);
  const [fo, setFo] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const clipName = useMemo(() => {
    if (!selected) return null;
    const t = tracks.find(x => x.id === selected.trackId);
    return t ? `${t.name}` : null;
  }, [selected, tracks]);

  if (!selected) return null;
  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Clip Tools</h3>
      <div className="text-slate-400 mb-2">Selected: {clipName || selected.clipId}</div>
      <div className="flex gap-2 mb-3">
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition" onClick={() => onDuplicate(selected.trackId, selected.clipId)}>Duplicate</button>
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition" onClick={() => onDelete(selected.trackId, selected.clipId)}>Delete</button>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <label className="w-32 text-slate-400">Fade In (s)</label>
          <input className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 w-24" type="number" min={0} step={0.05} value={fi} onChange={(e)=>setFi(parseFloat(e.target.value)||0)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="w-32 text-slate-400">Fade Out (s)</label>
          <input className="px-2 py-1 rounded-md bg-slate-900 border border-slate-700 w-24" type="number" min={0} step={0.05} value={fo} onChange={(e)=>setFo(parseFloat(e.target.value)||0)} />
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-md border border-emerald-600/50 bg-emerald-600 hover:bg-emerald-500 text-white transition" onClick={() => { onSetFade(selected.trackId, selected.clipId, fi, fo); setMsg('Fades applied'); setTimeout(()=>setMsg(null), 1000); }}>Apply Fades</button>
          {msg && <span className="text-slate-400">{msg}</span>}
        </div>
      </div>
    </div>
  );
}

