MixMaster – Worklog and Next Steps

Status (done today)
- Fixed EffectsInspector crash for boolean fields (e.g., Reverb reversed).
- Stabilized legacy pause and edits (no more “Uncaught 2”).
- Added Split at playhead (toolbar + selection in Timeline).
- Added Clip Tools: duplicate, delete, fade in/out.
- Implemented per-clip fades in minimal engine; bridged fades in legacy via volume envelope.
- Added mic recording panel (MediaRecorder) that imports result as a new track.

- Wired legacy WAV/MP3 export (render via facade + workers).
- Auto-download for WAV/MP3/Project exports.
- Legacy project export/import now preserves: tracks, section placements, per-section assets, track/master effects.

Pending tasks (pick up next)
1) Rebuild/copy legacy facade
   - From `MusicRecorder/`: `python do2.py client build`
   - Copy: `cp build/js/engine.js mixmaster/public/engine.js`

2) Legacy-only editing to surface in UI
   - Section speed (playback rate) control
   - Effect chain reordering + removal per track
   - Basic envelope editing for track volume/pan (add/move/remove points)

3) Export improvements
   - Wire legacy WAV export (via renderer)
   - MP3 export (place `lame.js` into `mixmaster/public/` and add worker)

Notes
- Fades in legacy are applied by track volume envelope around the section window; overlapping sections on the same track will be affected. For per-section-only fades, we’d need a dedicated gain in the section graph.
- Selection lives in App state and drives Split/Clip Tools. Double-click in Timeline still performs a quick split at pointer.

Quick commands (optional)
- Dev: `cd mixmaster && npm run dev`
- Build: `cd mixmaster && npm run build && npm run preview`

Addenda — Follow-ups and Reminders

Export/Import (Project)
- Minimal engine:
  - Keep current project schema (assets + tracks/clips). Effects are ignored — OK for now.
  - Add versioning/migrations in schema for future fields.
- Legacy engine:
  - DONE: Export per-section WAV assets using `exportSectionWavArrayBuffer` to preserve splits/duplicates precisely.
  - DONE: Include track effects (id + field values) and master effects.
  - TODO: Export/import track volume/pan envelopes (requires new facade getters/setters).
  - TODO: Consider de-duplicating assets when multiple sections share the same source/time window (optional optimization).
  - TODO: Validate import idempotency (export→import→export yields equivalent structure).

Engine Facade (MusicRecorder)
- DONE: `renderAudioBuffer()` promise wrapper for offline renderer.
- DONE: `exportSectionWavArrayBuffer(sectionId, bitDepth)` + symbol export.
- TODO: Facade API for envelopes:
  - getTrackVolumeEnvelopePoints(trackId) -> [{time,value}]
  - setTrackVolumeEnvelopePoints(trackId, pts)
  - getTrackPanEnvelopePoints(trackId) / setTrackPanEnvelopePoints
- TODO: Optional: expose per-section fade values for round-tripping (currently bridged via envelope).

UI/UX
- ExportPanel: show progress and error toasts for long exports (especially MP3 worker).
- ExportPanel: indicate legacy vs minimal capabilities; hide disabled buttons.
- Timeline: add marquee selection + multi-clip operations.
- Timeline: keyboard shortcuts (delete, duplicate, split, nudge, undo/redo).
- Mixer: track mini-wave currently shows a single static overview — consider showing merged per-track waveform spanning all sections.
- EffectsPanel: add reordering/removal for track effect chains in legacy mode.

Undo/Redo
- Minimal: snapshot-based undo/redo is in place.
- Legacy: basic undo/redo for gain/pan/mute/solo, move/trim, duplicate.
- TODO: extend legacy undo/redo to include split, delete, fades, effect add/remove/reorder (may require capturing/restore snapshots via facade).

Workers and Performance
- MP3 worker: ensure `/public/lame.js` present; consider showing a progress bar (worker can post PROGRESS events if extended).
- WAV worker: already in-module worker for minimal engine; verify large projects don’t block UI.
- Waveform generation: cache per-clip waveforms; invalidate on trim/split; throttle recomputation.

Compatibility and Parity
- Pan units: minimal uses [-1..1], legacy uses degrees (-45..45) — confirm UI normalization when switching engines.
- Sample rate: confirm offline render sample rate parity across engines; warn if mismatch on import.
- Effect field types: handle booleans robustly (already fixed); audit remaining effect models.

Build/Dev Ergonomics
- One-liner script to rebuild + copy facade:
  - `cd MusicRecorder && python3 do2.py client build && cp build/js/engine.js ../mixmaster/public/engine.js`
- Consider a predev hook in mixmaster to check for `public/engine.js` and `public/lame.js`.

Testing
- Add regression tests for project round-trip (export→import→export) comparing:
  - clip counts, begin/duration, track counts, effect ids/order, and key field values.
- Manual QA matrix: minimal vs legacy; WAV/MP3 exporting; project import; multi-track, multi-clip cases.

Known Limitations
- Legacy fades are applied via volume envelope and affect overlapping sections on the same track.
- Minimal engine has no effects pipeline yet; effects in imported projects are ignored safely.
- Project assets can be large (base64 WAV). Consider a referenced-assets mode later (URLs).

---

# UI Overview and Responsibilities

This section documents the current UI structure, what each part does, where the code lives, and a small backlog of UI-only tasks. The intent is to make it easy to find and reason about every visible control without touching the audio engines.

## App Shell

- Entry: `mixmaster/src/App.tsx:1`
- Layout: Responsive grid with a header, a left sidebar (panels) and a main column (Timeline + Mixer).
- Mobile: Sidebar becomes a drawer toggled by the ☰ button. Metronome opened via the gear button.
- Styling: Tailwind via CDN in `mixmaster/index.html:1`; minimal overrides in `mixmaster/src/styles.css:1`.

## Header + Transport

- Header (in `App.tsx`): shows brand, a gear button (opens Metronome), and the mobile drawer toggle.
- Transport: `mixmaster/src/components/Transport.tsx:1`
  - Props-driven. Does not talk to engines directly.
  - Buttons: Play/Pause, Metronome, optional Split, Undo/Redo.
  - Time: shows current time and duration; has a click-to-seek progress bar (desktop).
  - Events bubble to `App.tsx` which calls `useEngine()` methods.

## Sidebar Panels

- File Import: `mixmaster/src/components/FileImport.tsx:1`
  - Accepts multiple audio files; hands `FileList` up via `onFiles`.
  - `App` loops files and imports each into a new track through the engine.

- Record Panel: `mixmaster/src/components/RecordPanel.tsx:1`
  - Handles mic arming (getUserMedia), recording (MediaRecorder), and elapsed time display.
  - On stop, emits a `File` to `onRecorded` for import as a new track.

- Effects Panel: `mixmaster/src/components/EffectsPanel.tsx:1` (legacy only)
  - Lists available legacy effects via `listEffects()`.
  - Actions: add effect to Master or to a selected Track; quick +6dB helpers.
  - No direct state; delegates to engine facade via callbacks.

- Clip Tools: `mixmaster/src/components/ClipTools.tsx:1`
  - Operates on the currently selected clip (id + owning track).
  - Actions: Duplicate, Delete, Apply fades (seconds) via engine callbacks.

- Effects Inspector: `mixmaster/src/components/EffectsInspector.tsx:1` (legacy only)
  - Reads a track’s effects and renders dynamic controls for each field.
  - Numeric fields: shows sliders with the correct min/max/precision.
  - Boolean fields: shows a checkbox. Updates routed to engine on change.

- Export Panel: `mixmaster/src/components/ExportPanel.tsx:1`
  - Audio export: WAV and (when wired) MP3. Auto-creates a download link.
  - Project export: downloads a JSON project; Import restores a project file.
  - Optional “Render To Track” funnels a render back into a new track.

## Main Column

- Timeline: `mixmaster/src/components/Timeline.tsx:1`
  - Renders time ruler, lanes per track, and draggable/trim-able clips.
  - Waveform: fetches per-clip wave peaks via `getClipWaveform()` or downsamples from an in-memory buffer when available.
  - Interactions:
    - Click background seeks playhead.
    - Drag a clip to move between tracks and along time (snaps to a step derived from zoom).
    - Trim using left/right handles (snapped). Enforced minimum width.
    - Double-click within a lane splits the first clip under the pointer via a window callback that `App.tsx` wires to the engine.
  - Zoom: slider controls px/sec; ruler tick spacing adapts with `pickNiceStep`.

- Mixer: `mixmaster/src/components/Mixer.tsx:1`
  - Shows a master level meter (reads from a WebAudio `AnalyserNode`).
  - Renders a `TrackStrip` per track with Gain, Pan, Mute, Solo controls.
  - Can display a static per-track waveform preview if provided by `renderTrackExtras`.

-------------------------------------------------------------------------------

Worklog — Loader/Progress + Rhythm + Fade/Envelope (latest)

Done today
- Loader overlay wired globally (`components/LoadingOverlay.tsx`) and rendered in `App.tsx`.
- Legacy engine (`useLegacyEngine`): report `busy` + `progress` for
  - Import audio: FileReader bytes → 0–70%; facade decode/insert → ramps to 100%.
  - Render to track: 10 → 70 → 100.
  - Add rhythm track: step loop drives progress up to ~95%; 100% on finish.
- Auto-hide guard: legacy poll loop now completes loader when a new track arrives while busy.
- Timeline: per-clip full-height fade overlays; single-click to set fades; touch support.
- Envelope editor: per-track toggle, full-lane editing; double-click adds point at time+value and suppresses split.
- Rhythm modal refreshed; quick “Add Rhythm Track…” button in header.

Next (tomorrow)
- Loader
  - Replace decode ramp with real progress if facade can expose it; else add worker with PROGRESS posts.
  - Show overlay for Project Import and mic-recording finalize.
  - Include track name in overlay subtitle; ensure overlay hides on cancel/escape.
- Timeline UX
  - Tooltip with precise seconds/dB while dragging fades/envelope.
  - Optional per-clip envelope mode (besides per-track).
- Rhythm
  - Option to place rendered clip at playhead; optional sample-based voices.


- Track Strip: `mixmaster/src/components/TrackStrip.tsx:1`
  - Pure UI component; reads current gain/pan from the provided `Track` object and emits change events upward.
  - Uses `TrackWave` to draw the optional static preview.

- Track Wave: `mixmaster/src/components/TrackWave.tsx:1`
  - Lightweight canvas renderer for a precomputed Float32Array of peaks.

## Modal

- Metronome: `mixmaster/src/components/metronome/MetronomeModal.tsx:1`
  - Fullscreen overlay with a lazily loaded embedded app.
  - Exposes `onPlayingChange` so starting the metronome can also start host transport.

## Hook → Engine Bridge

- `useEngine`: `mixmaster/src/hooks/useEngine.ts:1`
  - Source of truth for `engine`, `time`, `duration`, `tracks`, `playing`.
  - All engine calls happen through callbacks provided by this hook; UI components remain presentational.

## Styling Notes

- Tailwind classes provide most visuals and animations (hover/active/transition).
- Minimal CSS in `styles.css` to prevent conflicts and keep base tokens.
- Color theme matches a dark studio palette; accents use cyan/sky/emerald.

## UI Backlog (No engine changes required)

- Bottom Dock: large timecode, transport buttons, and record button bar pinned to bottom of viewport.
- Clip Badges: show small “FX” tokens on clips and per-track chip rows summarizing effect chains.
- Keyboard Shortcuts: delete, duplicate, split at playhead, nudge, undo/redo, zoom in/out.
- Marquee Select on Timeline: drag to select multiple clips; operate on selections.
- Accessible Focus: clear outlines and ARIA labels for all interactive controls.
- Track UX: rename tracks inline; reorder tracks by drag; color tags per track.
- Toasts: success/error banners for long operations (export/import/recording).
