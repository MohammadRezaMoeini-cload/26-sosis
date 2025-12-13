import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  studioMode: boolean;
  setStudioMode: (v: boolean) => void;
  audioInputs: MediaDeviceInfo[];
  inputDeviceId: string | '';
  setInputDeviceId: (id: string) => void;
  refreshDevices: () => Promise<void> | void;
  micGranted?: boolean;
  micError?: string | null;
  requestMicPermission: () => Promise<void> | void;
};

export default function RecordingSettingsModal({ open, onClose, studioMode, setStudioMode, audioInputs, inputDeviceId, setInputDeviceId, refreshDevices, micGranted, micError, requestMicPermission }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[6500] flex items-center justify-center bg-black/70">
      <div className="w-[min(92vw,520px)] rounded-2xl border border-slate-700 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-slate-100">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="text-lg font-semibold">Recording Settings</div>
          <button className="px-2 py-1 rounded-md bg-slate-800 border border-slate-600 hover:bg-slate-700" onClick={onClose} aria-label="Close">Close</button>
        </div>
        <div className="p-4 space-y-4">
          <div className="text-xs text-slate-300">Configure microphone processing and select the input device. Use Studio Mode to disable browser voice filters for fuller instrument capture (support varies by device).</div>

          <label className="flex items-center justify-between px-3 py-2 rounded-md bg-slate-800/60 border border-slate-700">
            <span className="text-sm">Studio Mode</span>
            <button
              className={`px-3 py-1 text-xs rounded-md border ${studioMode ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-700 border-slate-600 text-white/85'}`}
              onClick={() => setStudioMode(!studioMode)}
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
                value={inputDeviceId as any}
                onChange={(e) => setInputDeviceId(e.target.value)}
                onFocus={() => refreshDevices()}
              >
                {audioInputs.length === 0 && <option value="">Default Microphone</option>}
                {audioInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>{d.label || `Microphone ${i+1}`}</option>
                ))}
              </select>
              <button className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => refreshDevices()}>Refresh</button>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Tip: browsers may require mic permission before showing device names.</div>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => requestMicPermission()}>Grant Mic Permission</button>
            {typeof micGranted === 'boolean' && (
              <span className={`text-xs ${micGranted ? 'text-emerald-400' : 'text-slate-400'}`}>{micGranted ? 'Granted' : 'Not granted'}</span>
            )}
          </div>
          {micError && <div className="text-[11px] text-red-400">{micError}</div>}
        </div>
      </div>
    </div>
  );
}

