Studio Recorder: Studio Mode + Mic Settings
=================================================

This repo includes a reusable component that encapsulates microphone recording with:

- Studio Mode (disables browser voice filters: echoCancellation, noiseSuppression, autoGainControl)
- Input device selection (built‑in vs. external mics)
- Permission request flow compatible with mobile browsers
- iOS‑friendly getUserMedia constraints
- MIME auto‑detection for MediaRecorder
- Elapsed timer and start/stop UX

Files
-----
- `src/components/StudioRecorder.tsx`
  Self‑contained React component. Import it in any project.

Optional (used in this app):
- `src/components/RecordingSettingsModal.tsx` – a modal wrapper variant.
- App wiring in `src/App.tsx` shows how to integrate permissions with a countdown.

How Studio Mode works
---------------------
Browsers often enable voice processing by default. Studio Mode flips off:

```
echoCancellation: false
noiseSuppression: false
autoGainControl: false
```

When Studio Mode is off, the component enables them (EC/NS/AGC) for a voice‑focused capture.

Input device selection
----------------------
`enumerateDevices()` is used to list `audioinput` devices. Device labels appear only after the user grants mic permission. The selected `deviceId` is applied using `{ deviceId: { ideal: <id> } }` in constraints.

Mobile/iOS constraints
----------------------
On iOS/Safari, strict `sampleRate`/`channelCount` can cause `OverConstrainedError`. The component automatically avoids those on iOS and only uses them on other platforms:

- iOS: `{ audio: { …base, deviceId } }`
- Others: `{ audio: { …base, channelCount: 2, sampleRate: 48000, deviceId } }`

Permission flow (mobile‑friendly)
---------------------------------
The component exposes a “Grant Mic Permission” button that calls `getUserMedia({audio:true})` inside a direct user gesture (click/tap). This is necessary on many mobile browsers.

MIME type selection
-------------------
MediaRecorder MIME is detected via `MediaRecorder.isTypeSupported`: tries `audio/webm;codecs=opus`, then `audio/webm`, `audio/mp4`, `audio/aac`. Falls back to `audio/webm`.

Usage
-----
```
import StudioRecorder from './components/StudioRecorder';

export default function Page() {
  return (
    <div className="p-4">
      <StudioRecorder
        defaultStudioMode={true}
        onComplete={(blob) => {
          // Do something with the recorded Blob
          // Example: download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'recording.webm';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        }}
      />
    </div>
  );
}
```

Drop‑in checklist for another project
-------------------------------------
1. Copy `src/components/StudioRecorder.tsx` into your project.
2. Ensure your site is served over HTTPS (required for mic in most browsers).
3. (Optional) Add a button for permission preflight on mobile, or use the built‑in button.
4. If you use a reverse proxy during local dev with Vite, configure HMR correctly (WSS/host) to avoid endless reloads – see `vite.config.ts` in this repo for an example.

Notes & limitations
-------------------
- Some embedded webviews block microphone APIs regardless of HTTPS.
- iOS Safari requires user gestures to start streams; use the provided “Grant Mic Permission” button first if necessary.
- MediaRecorder isn’t supported on very old browsers; consider a WAV fallback if you must support them.

