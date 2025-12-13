# MixMaster (React + Vite)

This is a minimal React app that wraps a Web Audio mixing engine.

Features now:
- Import audio files (creates a track per file)
- Play/Pause, seek indicator
- Per-track gain and pan, mute/solo
- Master analyser meter
- Offline export to WAV (16‑bit)

Planned/next:
- MP3 export via `lame.js` in a Web Worker
- Multiple clips per track with editing
- Volume envelopes and effects

## Getting started

1) Install deps (from `mixmaster/`):

```
npm install
```

2) Run dev server:

```
npm run dev
```

3) Build:

```
npm run build
npm run preview
```

## Optional MP3 export and legacy engine

Drop a `lame.js` into `mixmaster/public/lame.js` to enable MP3 in a future step. You already have one at:

```
MusicRecorder/src/python/audiocatapp/static/js/lame.js
```

Copy it into `mixmaster/public/` or serve from CDN.

### Use the legacy engine from MusicRecorder (recommended for feature parity)

1) Build the engine facade from the root of MusicRecorder:

```
python do2.py client build
```

This generates `build/js/engine.js` and copies it to `src/python/audiocatapp/static/js/engine.js`.

2) To use it in this React app during development, copy it into `mixmaster/public/engine.js`:

```
cp build/js/engine.js mixmaster/public/engine.js
```

3) The app will auto-detect `window.app.EngineFacade` at runtime and switch to the legacy engine. Otherwise it falls back to the minimal Web Audio engine.

## Notes
- This engine is a minimal facade for mixing and export, designed to evolve toward the full feature set.
- It does not depend on the Closure-compiled bundle; we’ll bridge features incrementally.
