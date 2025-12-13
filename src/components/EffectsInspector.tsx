import React, { useEffect, useMemo, useState } from "react";
import RotaryKnob from "./comon/RotaryKnob"; // same path used in Timeline

type TrackOpt = { id: string; name: string };

type Field = {
  name: string;
  min?: number;
  max?: number;
  value: number | boolean;
  decimals?: number;  // used to derive step / formatting
};
type EffectInfo = { index: number; id: number; name: string; fields: Field[] };

type Props = {
  tracks: TrackOpt[];
  listTrackEffectsDetailed: (trackId: string) => EffectInfo[];
  setTrackEffectField: (
    trackId: string,
    index: number,
    field: string,
    value: number // engine expects number; booleans are sent as 0/1 (same as before)
  ) => void;
  initialTrackId?: string;
  // Optional: available effects palette + adder (legacy only)
  listEffects?: () => { id: number; key: string; name: string }[];
  addTrackEffect?: (trackId: string, effectId: number) => void;
  removeTrackEffect?: (trackId: string, index: number) => void;
};

export default function EffectsInspector({
  tracks,
  listTrackEffectsDetailed,
  setTrackEffectField,
  initialTrackId,
  listEffects,
  addTrackEffect,
  removeTrackEffect,
}: Props) {
  const [trackId, setTrackId] = useState<string>(() => initialTrackId || tracks[0]?.id || "");
  useEffect(() => {
    if (initialTrackId) setTrackId(initialTrackId);
  }, [initialTrackId]);

  // force refresh after writes (legacy API returns same object reference)
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!tracks.find((t) => t.id === trackId)) setTrackId(tracks[0]?.id || "");
  }, [tracks, trackId]);

  const effects = useMemo(
    () => (trackId ? listTrackEffectsDetailed?.(trackId) || [] : []),
    [trackId, listTrackEffectsDetailed, tick]
  );
  const palette = useMemo(() => (typeof listEffects === 'function' ? listEffects() : []), [listEffects]);
  const [selEff, setSelEff] = useState<number | ''>(() => (palette[0]?.id ?? ''));
  useEffect(() => {
    if (!palette || palette.length === 0) { setSelEff(''); return; }
    if (selEff === '' || !palette.find(p => p.id === selEff)) setSelEff(palette[0]!.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette.length]);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Effects Inspector</h3>

      <div className="flex items-center gap-2 mb-2">
        <label className="w-16 text-slate-400">Track</label>
        <select
          className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition flex-1"
          value={trackId}
          onChange={(e) => setTrackId(e.target.value)}
        >
          {tracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {/* Palette to add a new effect to current track */}
      {addTrackEffect && palette && palette.length > 0 && (
        <div className="mb-3">
          <div className="text-sm text-slate-300 mb-1">Add Effect</div>
          <div className="flex items-center gap-2 mb-2">
            <select
              className="px-3 py-2 rounded-md border border-slate-700 bg-slate-800 hover:bg-slate-700 transition min-w-[220px]"
              value={(typeof selEff === 'number' ? selEff : (palette[0]?.id ?? '')) as any}
              onChange={(e) => setSelEff(parseInt(e.target.value))}
            >
              {palette.map((eff) => (
                <option key={eff.id} value={eff.id}>{eff.name} ({eff.key})</option>
              ))}
            </select>
            <button
              className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 text-white"
              title="Add effect"
              onClick={() => { try { const id = (typeof selEff==='number'? selEff : palette[0]?.id); if (typeof id === 'number') { addTrackEffect(trackId, id); setTick(t=>t+1);} } catch {} }}
            >
              Add
            </button>
          </div>
          <div className="hidden gap-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))' }}>
            {palette.map((eff) => (

              <button
                key={eff.id}
                className="px-2 py-1.5 text-left rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100"
                title={`${eff.key} — ${eff.name}`}
                onClick={() => { try { addTrackEffect(trackId, eff.id); setTick((t) => t + 1); } catch {} }}
              >
                <div className="text-[11px] text-slate-400">{eff.key}</div>
                <div className="text-sm">{eff.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {effects.length === 0 ? (
        <div className="text-slate-400">No effects</div>
      ) : (
        <div className="flex flex-col gap-3">
          {effects.map((eff) => (
            <div
              key={eff.index}
              className="border border-slate-800 rounded-md p-3 bg-slate-900/40"
            >
              <div className="font-semibold mb-2 flex items-center justify-between">
                <span>{eff.name}</span>
                <div className="flex items-center gap-2">
                  {/* Reset all params of this effect */}
                  <button
                    className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                    title="Reset all parameters"
                    onClick={() => {
                      try {
                        (eff.fields || []).forEach((f) => {
                          const isNum = typeof f.value === 'number' && Number.isFinite(f.value as number);
                          const isBool = typeof f.value === 'boolean';
                          const name = f.name || 'Param';
                          if (isNum) {
                            const min = typeof f.min === 'number' ? f.min : 0;
                            const max = typeof f.max === 'number' ? f.max : 1;
                            const mid = min + (max - min) / 2;
                            setTrackEffectField(trackId, eff.index, name, mid);
                          } else if (isBool) {
                            setTrackEffectField(trackId, eff.index, name, 0);
                          }
                        });
                        setTick((t) => t + 1);
                      } catch {}
                    }}
                  >
                    Reset
                  </button>
                  {removeTrackEffect && (
                    <button
                      className="px-2 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200"
                      title="Remove effect from track"
                      onClick={() => {
                        try {
                          // Prefer removing by stable effect id; engine hook resolves id/index internally
                          removeTrackEffect(trackId, eff.id);
                          setTick((t) => t + 1);
                        } catch {}
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of knobs / controls */}
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
                }}
              >
                {(eff.fields || []).map((f) => {
                  const isNum =
                    typeof f.value === "number" && Number.isFinite(f.value as number);
                  const isBool = typeof f.value === "boolean";

                  if (isNum) {
                    const decimals =
                      typeof f.decimals === "number" && f.decimals >= 0
                        ? f.decimals
                        : 2;
                    const step = Math.pow(10, -decimals);
                    const min = typeof f.min === "number" ? f.min : 0;
                    const max = typeof f.max === "number" ? f.max : 1;
                    const name = f.name || "Param";

                    return (
                      <RotaryKnob
                        key={name}
                        label={name}
                        value={f.value as number}
                        min={min}
                        max={max}
                        step={step}
                        size={44}
                        defaultValue={min + (max - min) / 2}
                        formatValue={(v) => (v as number).toFixed(decimals)}
                        onChange={(v) => {
                          setTrackEffectField(trackId, eff.index, name, v);
                          setTick((t) => t + 1);
                        }}
                      />
                    );
                  }

                  if (isBool) {
                    const checked = !!f.value;
                    return (
                      <label
                        key={f.name}
                        className="flex items-center gap-2 text-sm px-2 py-1 rounded-md bg-slate-800/40 border border-slate-700/50"
                        title={f.name}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            // keep legacy numeric 0/1 behavior
                            setTrackEffectField(
                              trackId,
                              eff.index,
                              f.name,
                              e.target.checked ? 1 : 0
                            );
                            setTick((t) => t + 1);
                          }}
                        />
                        <span className="truncate">{f.name}</span>
                      </label>
                    );
                  }

                  // Unknown field type → read-only
                  return (
                    <div
                      key={f.name}
                      className="text-sm text-slate-300 px-2 py-1 rounded bg-slate-800/30"
                      title={String(f.value)}
                    >
                      {f.name}: {String(f.value)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
