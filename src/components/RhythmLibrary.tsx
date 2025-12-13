import React, { useState } from 'react';

type RhythmOpts = { kind: 'click'|'tabla'|'piano'; bpm: number; bars: number; subdivision?: 'quarter'|'eighth'; single?: boolean };
type Props = { onAdd: (opts: RhythmOpts) => void };
export default function RhythmLibrary({ onAdd }: Props) {
  const [kind, setKind] = useState<'click'|'tabla'|'piano'>('click');
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(4);
  const [subdivision, setSubdivision] = useState<'quarter'|'eighth'>('quarter');

  return (
    <div className="section">
      <h3 style={{marginTop:0}}>Rhythm Library</h3>
      <div className="row">
        <label style={{width:80}}>Preset</label>
        <select value={kind} onChange={(e)=>setKind(e.target.value as any)}>
          <option value="click">Click</option>
          <option value="tabla">Tabla</option>
          <option value="piano">Piano</option>
        </select>
      </div>
      <div className="row">
        <label style={{width:80}}>BPM</label>
        <input type="number" value={bpm} onChange={(e)=>setBpm(parseInt(e.target.value||'120',10))} min={20} max={300} />
      </div>
      <div className="row">
        <label style={{width:80}}>Bars</label>
        <input type="number" value={bars} onChange={(e)=>setBars(parseInt(e.target.value||'4',10))} min={1} max={64} />
      </div>
      <div className="row">
        <label style={{width:80}}>Step</label>
        <select value={subdivision} onChange={(e)=>setSubdivision(e.target.value as any)}>
          <option value="quarter">Quarter</option>
          <option value="eighth">Eighth</option>
        </select>
      </div>
      <div className="row" style={{gap:8, display:'flex'}}>
        <button className="btn" onClick={()=> onAdd({ kind, bpm, bars, subdivision, single: true })}>Add One Hit at Playhead</button>
        <button className="btn" onClick={()=> onAdd({ kind, bpm, bars, subdivision })}>Add Pattern (separate clips)</button>
      </div>
      <p className="hint">One Hit: inserts a single sample at the cursor. Pattern: creates separate movable clips for each step.</p>
    </div>
  );
}
