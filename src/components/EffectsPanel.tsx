import React, { useEffect, useMemo, useState } from 'react';

type Props = {
  tracks: { id: string; name: string }[];
  legacy: boolean;
  listEffects?: () => { id: number; key: string; name: string }[];
  addMasterEffect?: (effectId: number) => void;
  addTrackEffect?: (trackId: string, effectId: number) => void;
  setTrackEffectField?: (trackId: string, index: number, field: string, value: number) => void;
  setMasterEffectField?: (index: number, field: string, value: number) => void;
  addTrackGainDb?: (trackId: string, db: number) => void;
  addMasterGainDb?: (db: number) => void;
};

export default function EffectsPanel({ tracks, legacy, listEffects, addMasterEffect, addTrackEffect, setTrackEffectField, setMasterEffectField, addTrackGainDb, addMasterGainDb }: Props) {
  const [selectedTrack, setSelectedTrack] = useState<string | undefined>(tracks[0]?.id);
  useEffect(() => {
    if (!selectedTrack && tracks[0]) setSelectedTrack(tracks[0].id);
  }, [tracks, selectedTrack]);

  const effects = useMemo(() => legacy && listEffects ? listEffects() : [], [legacy, listEffects]);

  if (!legacy) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-2">Effects</h3>
        <div className="text-slate-400">Effects available when using the legacy engine.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Effects</h3>
      <div className="flex items-center gap-2 mb-2">
        <label className="w-16 text-slate-400">Track</label>
        <select
          className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition flex-1"
          value={selectedTrack}
          onChange={(e) => setSelectedTrack(e.target.value)}
        >
          {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition" onClick={() => addMasterGainDb && addMasterGainDb(6)}>Master: +6dB Gain</button>
        <button className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40" disabled={!selectedTrack} onClick={() => selectedTrack && addTrackGainDb && addTrackGainDb(selectedTrack, 6)}>Track: +6dB Gain</button>
      </div>
      <div className="grid gap-2">
        {effects.map(eff => (
          <div key={eff.id} className="flex items-center justify-between gap-2 bg-slate-900/40 border border-slate-800 rounded-md px-3 py-2">
            <div className="text-sm"><span className="text-slate-400">{eff.key}</span> — {eff.name}</div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition" onClick={() => addMasterEffect && addMasterEffect(eff.id)}>Add to Master</button>
              <button className="px-3 py-1.5 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition disabled:opacity-40" disabled={!selectedTrack} onClick={() => selectedTrack && addTrackEffect && addTrackEffect(selectedTrack, eff.id)}>Add to Track</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
