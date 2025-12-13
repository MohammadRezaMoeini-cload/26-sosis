import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Track } from '../engine/types';
import EffectsInspector from './EffectsInspector';
import { SlidersHorizontal, Headphones, VolumeX, Trash2, Zap, Touchpad, TouchpadOff, Speaker, Volume, Volume1Icon, Volume2Icon } from "lucide-react";
import RotaryKnob from './comon/RotaryKnob';
import { pickLegacyScale } from '../legacy/legacyScale';
import { fmt } from '../utils/time';

type Props = {
  time: number;
  duration: number;
  tracks: Track[];
  onSeek: (t: number) => void;
  // Transport control (for selection playback)
  onPlay?: () => void;
  onPause?: () => void;
  playing?: boolean;
  onPlaySelection?: (trackId: string, clipId: string, startAbs: number, endAbs: number) => void;
  onMoveClip: (targetTrackId: string, clipId: string, newBegin: number) => void;
  onTrimClip?: (trackId: string, clipId: string, newBegin: number, newEnd: number) => void;
  // Optional wave provider for legacy clips
  getClipWaveform?: (trackId: string, clipId: string, points?: number) => Float32Array;
  selectedClipId?: string;
  onSelectClip?: (trackId: string, clipId: string) => void;
  // Track selection (click empty lane area)
  selectedTrackId?: string;
  onSelectTrack?: (trackId: string) => void;
  // (speed controls removed per request)
  // Inline track controls
  onTrackGain?: (trackId: string, value: number) => void;
  onTrackPan?: (trackId: string, value: number) => void;
  onTrackMute?: (trackId: string, value: boolean) => void;
  onTrackSolo?: (trackId: string, value: boolean) => void;
  // FX chips (legacy): list applied effects for a given track
  listTrackEffectsDetailed?: (trackId: string) => Array<{ index: number; id: number; name: string; fields: any[] }>;
  // FX inspector writes
  setTrackEffectField?: (trackId: string, index: number, field: string, value: number | boolean) => void;
  // FX palette (legacy): available effects + add-to-track
  listEffects?: () => Array<{ id: number; key: string; name: string }>;
  addTrackEffect?: (trackId: string, effectId: number) => void;
  // FX removal (legacy)
  removeTrackEffect?: (trackId: string, index: number) => void;
  // Delete only the selected clip on a track (not the whole track)
  onDeleteClip?: (trackId: string, clipId: string) => void;
  // Split a selected time range inside a clip (absolute times)
  onSplitRange?: (trackId: string, clipId: string, startAbs: number, endAbs: number) => void;
  // Split a single clip at absolute time
  onSplitClip?: (trackId: string, clipId: string, atAbs: number) => void;
  // Zoom from footer controls
  zoom: number;
  onZoom: (z: number) => void;
  // Set clip fade durations directly from timeline
  onSetClipFade?: (trackId: string, clipId: string, fadeInSec: number, fadeOutSec: number) => void;
  // Track-level delete
  onDeleteTrack?: (trackId: string) => void;
  // Create a new empty track (add lane)
  onAddTrack?: () => void;
  // Global: freeze transport + movement, enable tap-to-set-fade on mobile
  freezeTouch?: boolean;
  onToggleFreezeTouch?: (on: boolean) => void;
  // Ruler/grid mode controls
  gridMode?: 'time' | 'bars';
  tempoBpm?: number; // for 'bars' mode
  timeSignature?: { beatsPerMeasure: number; beatValue: number };
  subdivision?: number; // metronome subdivision index (0 none, 1=8ths, 2=triplets, 3=16ths)
};

// Simple timeline with draggable clips and zoom
export default function Timeline({ time, duration, tracks, onSeek, onPlay, onPause, playing, onPlaySelection, onMoveClip, onTrimClip, getClipWaveform, selectedClipId, onSelectClip, selectedTrackId, onSelectTrack, onTrackGain, onTrackPan, onTrackMute, onTrackSolo, listTrackEffectsDetailed, setTrackEffectField, listEffects, addTrackEffect, removeTrackEffect, onDeleteClip, onSplitRange, onSplitClip, zoom, onZoom, onSetClipFade, onDeleteTrack, onAddTrack, freezeTouch = false, onToggleFreezeTouch, gridMode = 'time', tempoBpm = 120, timeSignature = { beatsPerMeasure: 4, beatValue: 4 }, subdivision = 0 }: Props) {
  const FADES_DISABLED = false;
  const pxPerSec = zoom; // px per second driven by footer
  const isBarsMode = gridMode === 'bars';
  const beatsPerMeasure = Math.max(1, Math.floor((timeSignature?.beatsPerMeasure as any) || 4));
  const beatValue = Math.max(1, Math.floor((timeSignature?.beatValue as any) || 4));
  const bpm = Math.max(1, Number(tempoBpm || 120));
  // Treat denominator note as the beat; one beat length (sec)
  const secPerBeat = 60 / bpm;
  const secPerBar = beatsPerMeasure * secPerBeat;
  const minorPerBeat = React.useMemo(() => {
    const idx = Math.max(0, Math.floor(subdivision || 0));
    if (idx <= 0) return 1;
    if (idx === 1) return 2; // eighths
    if (idx === 2) return 3; // triplets
    if (idx === 3) return 4; // sixteenths
    if (idx === 4) return 6; // sextuplets
    return 8;
  }, [subdivision]);
  const heightPerTrack = 96; // Taller lanes for clearer waves

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const phWasPlayingRef = useRef<boolean>(false);
  // Per-clip original absolute bounds snapshot for non-destructive re-trim/extend
  const originalBoundsRef = useRef<Map<string, { begin: number; end: number }>>(new Map());
  // Multi-touch pinch-to-zoom state (mobile/tablets)
  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<null | { id1: number; id2: number; startDist: number; startZoom: number }>(null);
  // One-finger horizontal pan on mobile (for grid background)
  const panRef = useRef<null | { id: number; startX: number; startScroll: number; lastX: number; lastT: number; vx: number }>(null);
  // Viewport width in pixels (for canvases that should only draw visible area)
  const [viewW, setViewW] = useState<number>(0);
  useEffect(() => {
    const update = () => setViewW(topScrollRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  // Hover time on the ruler (domain time under cursor)
  const [hoverSec, setHoverSec] = useState<number | null>(null);
  const scrollXRef = useRef(0);
  const [scrollX, setScrollX] = useState(0);
  const bgRef = useRef<HTMLCanvasElement>(null); // background grid (columns)
  const laneInfoW = 233; // fits compact controls but keeps more room for waves
  // Keep playhead anchored on zoom changes
  const prevZoomRef = useRef<number>(pxPerSec);

  // Waveform cache per clip id
  const waveCache = useRef<Map<string, Float32Array>>(new Map());
  // Original full-width waveform snapshot per clip (kept for the whole session)
  // We keep a moderately high-resolution array and slice it for the current (begin,end)
  const originalWaveCache = useRef<Map<string, { points: number; data: Float32Array }>>(new Map());
  // Last drawn window slice per clip to keep something visible during transient states (e.g., drag at high zoom)
  const lastSliceRef = useRef<Map<string, Float32Array>>(new Map());
  // Track clip signatures so we can invalidate caches when a clip is split/trimmed under the same id
  const clipSigRef = useRef<Map<string, string>>(new Map());
  // When the track set changes, clear waveform cache and prune per-track UI state
  useEffect(() => {
    try { waveCache.current.clear(); } catch { }
    const ids = new Set(tracks.map(t => String(t.id)));
    setEnvTracks(prev => { const n = new Set<string>(); prev.forEach(id => { if (ids.has(id)) n.add(id); }); return n; });
    setFxPop(prev => (prev && !ids.has(String(prev.trackId)) ? null : prev));
    setVolPop(prev => (prev && !ids.has(String(prev.trackId)) ? null : prev));
  }, [tracks]);
  // Invalidate per-clip caches when the engine mutates clips in-place (e.g., split)
  useEffect(() => {
    try {
      const nowIds = new Set<string>();
      for (const t of tracks) {
        for (const c of t.clips) {
          const id = String(c.id);
          nowIds.add(id);
          const sig = `${String(t.id)}|${Number(c.beginTime || 0).toFixed(3)}|${Number(c.durationSec || 0).toFixed(3)}`;
          const prev = clipSigRef.current.get(id);
          if (prev !== sig) {
            clipSigRef.current.set(id, sig);
            try { originalWaveCache.current.delete(id); } catch {}
            try { lastSliceRef.current.delete(id); } catch {}
            try { for (const k of Array.from(waveCache.current.keys())) { if (k.startsWith(id + ':')) waveCache.current.delete(k); } } catch {}
            try { originalBoundsRef.current.set(id, { begin: Number(c.beginTime || 0), end: Number(c.beginTime || 0) + Number(c.durationSec || 0) }); } catch {}
          }
        }
      }
      for (const id of Array.from(clipSigRef.current.keys())) {
        if (!nowIds.has(id)) {
          clipSigRef.current.delete(id);
          try { originalWaveCache.current.delete(id); } catch {}
          try { lastSliceRef.current.delete(id); } catch {}
          try { for (const k of Array.from(waveCache.current.keys())) { if (k.startsWith(id + ':')) waveCache.current.delete(k); } } catch {}
          try { originalBoundsRef.current.delete(id); } catch {}
        }
      }
    } catch {}
  }, [tracks]);
  // On zoom change, clear transient wave cache (original cache upscales if needed)
  useEffect(() => {
    try { waveCache.current.clear(); } catch { }
  }, [pxPerSec]);

  // Local overlay state for track-pop popovers
  const [fxPop, setFxPop] = useState<null | { trackId: string; x: number; y: number }>(null);
  const [volPop, setVolPop] = useState<null | { trackId: string; x: number; y: number }>(null);
  // Add Track quick menu (empty/import/record)
  const [addPop, setAddPop] = useState<null | { x: number; y: number }>(null);
  const [addPopOpen, setAddPopOpen] = useState(false);
  const addPopRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  // Fade edit visibility per track
  // Fade overlays per track
  const [fadeTracks, setFadeTracks] = useState<Set<string>>(() => new Set());
  const toggleFadeTrack = (id: string) => {
    setFadeTracks(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  // Selection tool removed: trim via handles only
  // Envelope edit visibility per track
  const [envTracks, setEnvTracks] = useState<Set<string>>(() => new Set());
  const toggleEnvTrack = (id: string) => setEnvTracks(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  // Do not auto-enable envelope overlays; show only when user toggles
  const [controlPanelOpen, setControlPanelOpen] = useState(false);
  const [controlPanelPos, setControlPanelPos] = useState({ x: 0, y: 0 });
  const controlPanelRef = useRef<HTMLDivElement>(null);
  // Initial get-started overlay visibility; hide on first track add after a tick
  const [showStartOverlay, setShowStartOverlay] = useState<boolean>(true);
  useEffect(() => {
    if (tracks && tracks.length > 0 && showStartOverlay) {
      try {
        const hide = () => setShowStartOverlay(false);
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(hide);
        else setTimeout(hide, 0);
      } catch { setShowStartOverlay(false); }
    }
  }, [tracks, showStartOverlay]);


  // Robust duration and grid width (avoid NaN / disappearing timeline)
  const safeDuration = useMemo(() => {
    let d = 0;
    for (const t of tracks) for (const c of t.clips) d = Math.max(d, (c.beginTime || 0) + (c.durationSec || 0));
    const eng = Number.isFinite(duration) && duration > 0 ? duration : 0;
    return Math.max(eng, d, 10);
  }, [duration, tracks]);
  // Adaptive domain. At high zoom, expand as you scroll so it feels infinite.
  // At low zoom, shrink back to the natural content domain to avoid huge scroll extents.
  const _vw = topScrollRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const viewEndSec = Math.max(0, (scrollX + _vw - laneInfoW) / Math.max(1, pxPerSec));
  const padSec = Math.max(30, (_vw / Math.max(1, pxPerSec)) * 2);
  // Ensure domain includes the current playhead time even at low zoom
  const baseSec = Math.max(safeDuration + 30, (Number.isFinite(time) ? Number(time) : 0) + 30);
  const dynamicSec = Math.max(baseSec, viewEndSec + padSec);
  const isHighZoom = pxPerSec >= 160; // only expand at high zoom
  const domainSec = isHighZoom ? dynamicSec : baseSec;
  const width = Math.max(800, Math.ceil(domainSec * pxPerSec));
  // Content width equals domain; do not inflate using scroll position
  const fullWidth = width + laneInfoW;

  // When zooming out or reducing domain, clamp scroll so the viewport stays inside bounds
  useEffect(() => {
    const el = topScrollRef.current; if (!el) return;
    const vwNow = el.clientWidth || _vw;
    const maxScroll = Math.max(0, fullWidth - vwNow);
    if (scrollX > maxScroll) {
      el.scrollLeft = maxScroll;
      setScrollX(maxScroll);
    }
  }, [fullWidth]);
  const totalHeight = tracks.length * heightPerTrack;

  // When zoom changes, keep the playhead at the same viewport X by adjusting scroll
  useEffect(() => {
    const el = topScrollRef.current; if (!el) { prevZoomRef.current = pxPerSec; return; }
    const prev = prevZoomRef.current;
    if (!Number.isFinite(prev) || prev <= 0 || prev === pxPerSec) return;
    const t = Number.isFinite(time) ? time : 0;
    const vw = el.clientWidth || 0;
    let desired = el.scrollLeft || 0;
    if (pxPerSec < prev) {
      // Zooming OUT: center playhead in the viewport
      desired = (laneInfoW + t * pxPerSec) - vw / 2;
    } else {
      // Zooming IN: keep playhead anchored at the same viewport X
      const prevViewportX = (laneInfoW + t * prev) - scrollXRef.current;
      desired = (laneInfoW + t * pxPerSec) - prevViewportX;
    }
    // Clamp to content bounds based on current fullWidth
    const maxScroll = Math.max(0, fullWidth - vw);
    desired = Math.max(0, Math.min(maxScroll, Math.round(desired)));
    if (Math.abs((el.scrollLeft || 0) - desired) > 0) {
      el.scrollLeft = desired;
      scrollXRef.current = desired;
      setScrollX(desired);
    }
    prevZoomRef.current = pxPerSec;
  }, [pxPerSec, time, laneInfoW, fullWidth]);

  // Draw vertical column grid behind clips (full width)
  useEffect(() => {
    const canvas = bgRef.current; if (!canvas) return;
    const container = gridRef.current; if (!container) return;
    // Only draw the visible viewport width to avoid giant canvases at high zoom
    const vw = Math.max(1, viewW);
    const vh = totalHeight;
    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    canvas.width = Math.floor(vw * dpr); canvas.height = Math.floor(vh * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#0e1424';
    ctx.fillRect(0, 0, vw, vh);
    // Compute minor column width
    let colW = 8; let minorPerMajor = 8; let perBarMinor = 0;
    if (!isBarsMode) {
      const scale = pickLegacyScale(pxPerSec);
      const majorSec = scale.majorTickSec;
      minorPerMajor = (scale.minorTicksPerMajor + 1);
      colW = Math.max(2, Math.round((majorSec * pxPerSec) / minorPerMajor));
    } else {
      const secPerMinor = secPerBeat / Math.max(1, minorPerBeat);
      colW = Math.max(2, Math.round(secPerMinor * pxPerSec));
      minorPerMajor = Math.max(1, minorPerBeat);
      perBarMinor = beatsPerMeasure * minorPerMajor;
    }
    // Anchor columns to time zero at x = laneInfoW
    const relScroll = scrollX - laneInfoW; // pixels scrolled past time zero
    const firstColOffset = laneInfoW - (relScroll % colW);
    const iStart = Math.floor(relScroll / colW);
    for (let x = firstColOffset, i = 0; x <= vw + colW; x += colW, i++) {
      const iAbs = iStart + i;
      // Light alternating background per minor slot
      ctx.fillStyle = iAbs % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0)';
      ctx.fillRect(x, 0, colW, vh);
      // Line strength by hierarchy
      // Emphasize the exact columns where the playhead/clip snap occurs (legacy major step)
      let color = 'rgba(255,255,255,0.06)'; let lw = 1;
      if (!isBarsMode) {
        const isMajor = (iAbs % minorPerMajor) === 0;
        if (isMajor) { color = 'rgba(255,255,255,0.24)'; lw = 2; }
      } else {
        const isBeat = (iAbs % minorPerMajor) === 0;
        const isBar = perBarMinor > 0 && (iAbs % perBarMinor) === 0;
        if (isBar) { color = 'rgba(255,255,255,0.22)'; lw = 2; }
        else if (isBeat) { color = 'rgba(250,250,255,0.14)'; lw = 1; }
      }
      ctx.fillStyle = color; ctx.fillRect(Math.round(x - 0.5), 0, lw, vh);
    }
  }, [totalHeight, pxPerSec, tracks.length, scrollX, viewW, isBarsMode, beatsPerMeasure, minorPerBeat, secPerBeat]);

  // Sync scroll between top ruler scroll bar and content
  useEffect(() => {
    const el = topScrollRef.current; if (!el) return;
    const onScroll = () => { scrollXRef.current = el.scrollLeft; setScrollX(el.scrollLeft); };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);
  // Close popovers on ESC or resize
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setFxPop(null); setVolPop(null); setRangeSel(null); setAddPop(null); } };
    const onResize = () => { setFxPop(null); setVolPop(null); setRangeSel(null); setAddPop(null); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, []);
  // Animate and outside-click to close add menu
  useEffect(() => {
    if (addPop) {
      setAddPopOpen(false);
      const id = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => setAddPopOpen(true)) : setTimeout(() => setAddPopOpen(true), 0 as any);
      const onDown = (ev: any) => {
        try {
          if (addPopRef.current && !addPopRef.current.contains(ev.target as Node)) setAddPop(null);
        } catch { setAddPop(null); }
      };
      window.addEventListener('pointerdown', onDown, { capture: true } as any);
      return () => {
        try { typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id as any) : clearTimeout(id as any); } catch {}
        window.removeEventListener('pointerdown', onDown, { capture: true } as any);
      };
    } else {
      setAddPopOpen(false);
    }
  }, [addPop]);

  // Drag state
  const dragRef = useRef<
    | { mode: 'move'; trackId: string; targetTrackId: string; clipId: string; startX: number; startY: number; origBegin: number; origLeftPx: number; origWidthPx: number; clipDur: number; pointerType?: string; pointerId?: number; started?: boolean; gridRect?: DOMRect; el?: HTMLElement }
    | { mode: 'trim-left' | 'trim-right'; trackId: string; clipId: string; startX: number; startY: number; origBegin: number; origEnd: number; origLeftPx: number; origWidthPx: number; baseBegin: number; baseEnd: number; baseLeftPx: number; baseRightPx: number; pointerType?: string; started?: boolean; el?: HTMLElement }
    | { mode: 'fade-in' | 'fade-out'; trackId: string; clipId: string; startX: number; startY: number; origFadeIn: number; origFadeOut: number; clipDur: number; pointerType?: string; started?: boolean; el?: HTMLElement }
    | { mode: 'select' | 'select-left' | 'select-right'; trackId: string; clipId: string; startX: number; startY: number; clipBegin: number; clipDur: number; aSec: number; bSec: number; pointerType?: string; el?: HTMLElement }
    | null
  >(null);
  // (speed preview state removed)
  const [rangeSel, setRangeSel] = useState<null | { trackId: string; clipId: string; aSec: number; bSec: number }>(null);
  // Option: keep selection active and adjustable after Trim/Cut
  const [postEditAdjust, setPostEditAdjust] = useState<boolean>(true);
  // When linked, selection drags will actually adjust clip trim (expand/shrink)
  const [linkedSel, setLinkedSel] = useState<null | { trackId: string; clipId: string }>(null);
  // Trim preview overlay (keep waveform static during drag, but show visual deltas)
  const trimPreviewRef = useRef<Map<string, { leftPx: number; rightPx: number }>>(new Map());
  // Freeze waveform view while moving a clip (no re-slicing per frame)
  const [movingClipId, setMovingClipId] = useState<string | null>(null);
  // Pending trim commits waiting for engine snapshot to reflect; used to keep live override
  const pendingTrimRef = useRef<Map<string, { begin: number; end: number }>>(new Map());
  // Selection playback guard (stop at selection end)
  const selectionPlayRef = useRef<null | { end: number }>(null);
  useEffect(() => {
    if (!selectionPlayRef.current) return;
    const end = selectionPlayRef.current.end;
    const t = Number(time || 0);
    if (Number.isFinite(t) && t >= end - 1e-3) {
      try { onPause?.(); } catch { }
      selectionPlayRef.current = null;
    }
  }, [time]);
  // Live trim preview overrides during drag (begin/end in seconds)
  const liveTrimRef = useRef<Map<string, { begin: number; end: number }>>(new Map());
  // Optimistic move: hold new begin position until engine snapshot lands to avoid flicker
  const pendingMoveRef = useRef<Map<string, { begin: number; trackId: string; t0: number }>>(new Map());
  const [, forceRender] = useState(0);
  // Clear linkage if selection goes away or option disabled
  useEffect(() => {
    if (!postEditAdjust || !rangeSel) setLinkedSel(null);
  }, [postEditAdjust, rangeSel]);
  useEffect(() => {
    if (freezeTouch) return;                       // don't move during countdown/drag-freeze
    const el = topScrollRef.current;
    if (!el) return;

    const viewportW = el.clientWidth;              // visible width of the top scroll container
    const playheadX = laneInfoW + (Number.isFinite(time) ? time : 0) * pxPerSec; // in content coords
    const rightEdge = el.scrollLeft + viewportW;

    // Keep a small look-ahead margin so the head doesn't "kiss" the edge
    const margin = Math.max(48, Math.min(120, viewportW * 0.08));

    // Only scroll forward; if user seeks left we don't auto-jump back
    if (playheadX > rightEdge - margin) {
      // Center-ish placement so user can see what's coming
      const targetLeft = Math.max(0, playheadX - Math.round(viewportW * 0.35));
      // Set scroll; your onScroll handler will sync scrollX state
      el.scrollTo({ left: targetLeft, behavior: 'auto' }); // 'auto' keeps it snappy for real-time
    }
  }, [time, pxPerSec, laneInfoW, freezeTouch]);   // re-run on time tick or zoom changes

  const onPointerDownClip = (e: React.PointerEvent, trackId: string, clipId: string, begin: number, end: number) => {
    e.preventDefault();
    document.body.style.overflow = 'hidden';
    try { (document.body.style as any).userSelect = 'none'; } catch { }

    // Mark this clip as selected immediately so the user sees a border
    try { onSelectClip?.(String(trackId), String(clipId)); } catch { }
    // Selection tool removed

    // Force pointer capture for better mobile handling
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    // Add touch-action none to prevent unwanted scrolling
    target.style.touchAction = 'none';
    let isLeft = (e.target as HTMLElement).dataset.handle === 'left';
    let isRight = (e.target as HTMLElement).dataset.handle === 'right';
    // Increase drag sensitivity
    const origLeftPx = begin * pxPerSec;
    const origWidthPx = (end - begin) * pxPerSec;
    const clipEl = (e.currentTarget as HTMLElement).closest('[data-clip]') as HTMLElement | null;
    if (clipEl) {
      try { clipEl.style.willChange = isLeft || isRight ? 'left, width' : 'transform'; } catch { }
    }
    // If user grabbed near an edge (within 10px), treat it as handle to avoid accidental move
    try {
      if (!isLeft && !isRight && clipEl) {
        const r = clipEl.getBoundingClientRect();
        const x = e.clientX - r.left;
        const zone = 10;
        if (x <= zone) isLeft = true; else if (x >= r.width - zone) isRight = true;
      }
    } catch { }
    // Selection gesture disabled; trimming via handles only
    if (!freezeTouch && (isLeft || isRight)) {
      // Capture original clip bounds the first time we trim this clip during this session
      const base = originalBoundsRef.current.get(String(clipId)) || { begin, end };
      if (!originalBoundsRef.current.has(String(clipId))) originalBoundsRef.current.set(String(clipId), { begin, end });
      dragRef.current = {
        mode: isLeft ? 'trim-left' : 'trim-right',
        trackId,
        clipId,
        startX: e.clientX,
        startY: e.clientY,
        origBegin: begin,
        origEnd: end,
        origLeftPx,
        origWidthPx,
        // baseBegin: base.begin,
        // baseEnd: base.end,
        // el: clipEl || undefined,
        baseBegin: (originalBoundsRef.current.get(String(clipId)) || { begin, end }).begin,
        baseEnd: (originalBoundsRef.current.get(String(clipId)) || { begin, end }).end,
        el: (e.currentTarget as HTMLElement).closest('[data-clip]') as HTMLElement,
        baseLeftPx: base.begin * pxPerSec,
        baseRightPx: base.end * pxPerSec,
        pointerType: (e as any).pointerType,
        started: false,
      };
    } else if (!freezeTouch) {
      // Add gridRect calculation for better track switching
      const gridRect = gridRef.current?.getBoundingClientRect();
      dragRef.current = {
        mode: 'move',
        trackId,
        targetTrackId: trackId,
        clipId,
        startX: e.clientX,
        startY: e.clientY,
        origBegin: begin,
        origLeftPx,
        origWidthPx: Math.max(12, (end - begin) * pxPerSec),
        clipDur: Math.max(0.001, end - begin),
        pointerType: (e as any).pointerType,
        pointerId: (e as any).pointerId,
        started: false,
        gridRect, // Store grid dimensions for better tracking
        el: clipEl || undefined
      };
      // Do not mark as moving until the drag actually starts
    }
    // Tap-to-set-fade shortcut only in explicit Touch Fade Mode (avoid accidental re-enabling when fades are hidden)
    // const isFadeTap = !FADES_DISABLED && freezeTouch;
    const isFadeTap = false;
    const targetEl = e.target as HTMLElement;
    const onFadeOverlay = !!(targetEl?.getAttribute('data-fade-left') || targetEl?.getAttribute('data-fade-right'));
    // In freeze mode, ignore trim-handle drags entirely (only overlays can drag)
    if (freezeTouch && (isLeft || isRight)) {
      return;
    }
    if (!FADES_DISABLED && isFadeTap && !isLeft && !isRight && !onFadeOverlay) {
      try {
        const clipEl = e.currentTarget as HTMLElement; // the clip container
        const rect = clipEl.getBoundingClientRect();
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const relSec = x / pxPerSec;
        const clipDur = Math.max(0.01, end - begin);
        const track = tracks.find(tt => String(tt.id) === String(trackId));
        const c = track?.clips.find(cc => cc.id === clipId);
        const currentIn = Math.max(0, c?.fadeInSec || 0);
        const currentOut = Math.max(0, c?.fadeOutSec || 0);
        let fin = currentIn;
        let fout = currentOut;
        if (relSec <= clipDur / 2) {
          fin = Math.max(0, Math.min(clipDur - currentOut - 0.01, relSec));
        } else {
          const distToEnd = Math.max(0, clipDur - relSec);
          fout = Math.max(0, Math.min(clipDur - currentIn - 0.01, distToEnd));
        }
        onSetClipFade?.(String(trackId), String(clipId), fin, fout);
        return; // don't start move
      } catch { }
    }
    // Note: dragRef for trim/move was already set above with base bounds.
    // Avoid overwriting it here, so extension can respect original clip size.
  };
  // rAF-throttled move/trim updates for smoother dragging
  const rafRef = useRef<number | 0>(0 as any);
  const pendingRef = useRef<{ e: React.PointerEvent | null }>({ e: null });
  // Track whether the transport was playing when a drag begins so we can resume
  const wasPlayingBeforeDragRef = useRef<boolean>(false);
  const applyDrag = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    const dx = e.clientX - d.startX;

    const dy = e.clientY - d.startY;
    const startThresh = (d as any).pointerType === 'touch' ? 14 : 6;
    const dist = Math.hypot(dx, dy);
    if (d.mode !== 'select') {
      if (!(d as any).started && dist < startThresh) return;
      if (!(d as any).started) {
        (d as any).started = true;
        if (d.mode === 'move') { try { setMovingClipId(String((d as any).clipId)); } catch { } }
        // If transport is currently playing, pause it during drag and remember to resume
        try {
          if (!freezeTouch && playing && typeof onPause === 'function') {
            wasPlayingBeforeDragRef.current = true;
            onPause();
          }
        } catch {}
      }
    }
    if (d.mode === 'move') {
      // Update target track based on vertical movement
      const grid = (dragRef as any).gridRect || gridRef.current?.getBoundingClientRect();
      if (grid) {
        const y = e.clientY - grid.top;
        const laneIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(y / heightPerTrack)));
        d.targetTrackId = tracks[laneIndex]?.id || d.trackId;
      }
      // Draw a temporary indicator by translating element with subtle snap to ruler cells
      const el = (d as any).el as HTMLElement | null;
      if (el) {
        let dxSnap = dx;
        try {
          // Compute ruler cell duration in seconds for snapping
          // - Time mode: snap to the same major tick the ruler/grid uses (legacy scale)
          // - Bars mode: snap to beat subdivisions
          const scale = pickLegacyScale(pxPerSec);
          const secondsPerCellTime = Math.max(1e-6, scale.majorTickSec);
          const secondsPerCellBars = (secPerBeat / Math.max(1, minorPerBeat));
          const cellSec = isBarsMode ? secondsPerCellBars : secondsPerCellTime;
          if (Number.isFinite(cellSec) && cellSec > 0) {
            const origLeftPx = (d as any).origLeftPx as number;
            const newLeftPx = origLeftPx + dx;
            const newBeginSec = newLeftPx / Math.max(1e-6, pxPerSec);
            const nearestSec = Math.round(newBeginSec / cellSec) * cellSec;
            const nearestPx = Math.round(nearestSec * pxPerSec);
            // Sticky threshold: increase hardness so it snaps more eagerly
            const thresholdPx = Math.max(8, Math.min(24, Math.round(pxPerSec * 0.8))); // 10% of sec or 8–24 px
            const distPx = Math.abs(nearestPx - newLeftPx);
            if (distPx <= thresholdPx) {
              dxSnap = nearestPx - origLeftPx;
            }
          }
        } catch {}
        const dxSnapRounded = Math.round(dxSnap);
        el.style.transform = `translate3d(${dxSnapRounded}px, 0, 0)`;

        // Hard-stop barrier: reach neighbor boundaries that land on whole seconds → commit and end drag
        try {
          const targetTrack = tracks.find(tt => String(tt.id) === String(d.targetTrackId || d.trackId));
          const others = (targetTrack?.clips || []).filter(c => String(c.id) !== String(d.clipId));
          const clipDur = Math.max(0.001, (d as any).clipDur || ((d as any).origWidthPx || 0) / Math.max(1e-6, pxPerSec));
          const beginPreviewSec = ((d as any).origLeftPx + dxSnapRounded) / Math.max(1e-6, pxPerSec);
          // Build integer-second candidate positions that butt against neighbors without overlap
          const candidates: number[] = [];
          for (const c of others) {
            const s = Number(c.beginTime) || 0;
            const e = s + (Number(c.durationSec) || 0);
            candidates.push(e);           // start at neighbor end
            candidates.push(s - clipDur); // end at neighbor start
          }
          const nearInt = (t: number) => Math.abs(t - Math.round(t)) <= 1e-3;
          const usable = candidates.filter(t => t >= 0 && nearInt(t));
          if (usable.length > 0) {
            const barrierPx = Math.max(8, Math.min(24, Math.round(pxPerSec * 0.8)));
            let best: number | null = null; let bestDist = Infinity;
            for (const t of usable) {
              const dist = Math.abs((t - beginPreviewSec) * pxPerSec);
              if (dist < bestDist) { bestDist = dist; best = t; }
            }
            if (best !== null && bestDist <= barrierPx) {
              // Commit move at the integer boundary, ensure non-overlap after rounding
              const commitRounded = Math.max(0, Math.round(best));
              const nonOverlap = (pos: number) => others.every(c => !(pos < (c.beginTime + c.durationSec) && (pos + clipDur) > c.beginTime));
              const finalPos = nonOverlap(commitRounded) ? commitRounded : best;
              const finalDx = Math.round(finalPos * pxPerSec) - (d as any).origLeftPx;
              try { el.style.transform = `translate3d(${finalDx}px, 0, 0)`; } catch {}
              try { pendingMoveRef.current.set(String(d.clipId), { begin: finalPos, trackId: String(d.targetTrackId || d.trackId), t0: performance.now() }); } catch {}
              try {
                const trk = tracks.find(tt => String(tt.id) === String(d.targetTrackId || d.trackId));
                const moved = (trk || { clips: [] as any[] }).clips.find((cc: any) => String(cc.id) === String(d.clipId));
                const dur = Math.max(0.001, moved?.durationSec || clipDur);
                originalBoundsRef.current.set(String(d.clipId), { begin: finalPos, end: finalPos + dur });
              } catch {}
              try { forceRender(v => v + 1); } catch {}
              onMoveClip(d.targetTrackId, d.clipId, finalPos);
              try { if ((d as any).pointerId && el?.releasePointerCapture) el.releasePointerCapture((d as any).pointerId); } catch {}
              // Resume transport if we paused it at drag start
              try {
                if (wasPlayingBeforeDragRef.current && typeof onPlay === 'function') {
                  onPlay();
                  wasPlayingBeforeDragRef.current = false;
                }
              } catch {}
              dragRef.current = null;
              return;
            }
          }
        } catch {}
      }
    } else if (d.mode === 'trim-left' || d.mode === 'trim-right') {
      const startThresh = (d as any).pointerType === 'touch' ? 14 : 6;
      if (!(d as any).started && Math.hypot(dx, dy) < startThresh) {
        // Cancel micro trims on simple clicks to avoid shrinking to MIN_W
        try { const el = (d as any).el as HTMLElement | null; if (el) { el.style.left = ''; el.style.width = ''; el.style.willChange = ''; } } catch { }
        try { trimPreviewRef.current.delete(String((d as any).clipId)); } catch { }
        dragRef.current = null; return;
      }
      // Trim feedback: compute from original numbers to avoid drift
      const el = (d as any).el as HTMLElement | null;
      if (!el) return;
      const MIN_W = 12;
      if (d.mode === 'trim-left') {
        // Compute potential preview but keep waveform static during drag (no DOM resize)
        const minLeft = Math.min((d as any).baseLeftPx ?? d.origLeftPx, d.origLeftPx);
        const newLeftPx = Math.max(minLeft, Math.min(d.origLeftPx + dx, d.origLeftPx + d.origWidthPx - MIN_W));
        const newWidthPx = Math.max(MIN_W, d.origWidthPx - (newLeftPx - d.origLeftPx));
        const leftTrimPx = Math.max(0, Math.round(newLeftPx - d.origLeftPx));
        try { trimPreviewRef.current.set(String((d as any).clipId), { leftPx: leftTrimPx, rightPx: 0 }); } catch { }
        try { forceRender(v => v + 1); } catch { }
        // Do not mutate el.style or live waveform cache here to keep canvas static
      } else if (d.mode === 'trim-right') {
        // Compute potential preview but keep waveform static during drag (no DOM resize)
        const baseLeftPx = (d as any).baseLeftPx ?? d.origLeftPx;
        const baseRightPx = (d as any).baseRightPx ?? (d.origLeftPx + d.origWidthPx);
        const fullMaxWidth = Math.max(MIN_W, baseRightPx - baseLeftPx);
        const unclamped = d.origWidthPx + dx;
        const newWidthPx = Math.max(MIN_W, Math.min(fullMaxWidth, unclamped));
        const rightTrimPx = Math.max(0, Math.round(d.origWidthPx - newWidthPx));
        try { trimPreviewRef.current.set(String((d as any).clipId), { leftPx: 0, rightPx: rightTrimPx }); } catch { }
        try { forceRender(v => v + 1); } catch { }
        // Do not mutate el.style or live waveform cache here to keep canvas static
      }
    } else if (!FADES_DISABLED && (d.mode === 'fade-in' || d.mode === 'fade-out')) {
      // Update fade overlay widths live; on touch, use vertical swipes (up/down) to adjust length
      const el = (d as any).el as HTMLElement | null;
      if (!el) return;
      const wPx = parseFloat(getComputedStyle(el).width || '0');
      const useVertical = (d as any).pointerType === 'touch';
      const dpx = useVertical ? -dy : dx; // swipe up increases
      if (d.mode === 'fade-in') {
        const nextSec = Math.max(0, Math.min(d.clipDur - d.origFadeOut - 0.01, d.origFadeIn + dpx / pxPerSec));
        const nextPx = Math.max(0, Math.min(wPx, Math.round(nextSec * pxPerSec)));
        const left = el.querySelector(`[data-fade-left='${d.clipId}']`) as HTMLElement | null; if (left) left.style.width = nextPx + 'px';
      } else {
        const nextSec = Math.max(0, Math.min(d.clipDur - d.origFadeIn - 0.01, d.origFadeOut + (-dpx) / pxPerSec));
        const nextPx = Math.max(0, Math.min(wPx, Math.round(nextSec * pxPerSec)));
        const right = el.querySelector(`[data-fade-right='${d.clipId}']`) as HTMLElement | null; if (right) right.style.width = nextPx + 'px';
      }
    } else if (d.mode === 'select') {
      // Update selection range live as you drag
      const el2 = (d as any).el as HTMLElement | null;
      const rect = el2?.getBoundingClientRect();
      const clipBegin = (d as any).clipBegin as number;
      const clipDur = (d as any).clipDur as number;
      if (!rect || !Number.isFinite(clipBegin) || !Number.isFinite(clipDur)) return;
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const relSec = Math.max(0, Math.min(clipDur, x / Math.max(1e-6, pxPerSec)));
      const absSec = Math.max(clipBegin, Math.min(clipBegin + clipDur, clipBegin + relSec));
      const a = Math.min((d as any).aSec, absSec);
      const b = Math.max((d as any).aSec, absSec);
      setRangeSel({ trackId: String(d.trackId), clipId: String(d.clipId), aSec: a, bSec: b });
    } else if (d.mode === 'select-left' || d.mode === 'select-right') {
      const el2 = (d as any).el as HTMLElement | null;
      const rect = el2?.getBoundingClientRect();
      const clipBegin = (d as any).clipBegin as number;
      const clipDur = (d as any).clipDur as number;
      if (!rect || !Number.isFinite(clipBegin) || !Number.isFinite(clipDur)) return;
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const relSec = Math.max(0, Math.min(clipDur, x / Math.max(1e-6, pxPerSec)));
      const abs = Math.max(clipBegin, Math.min(clipBegin + clipDur, clipBegin + relSec));
      let a = Math.min((d as any).aSec, (d as any).bSec);
      let b = Math.max((d as any).aSec, (d as any).bSec);
      if (d.mode === 'select-left') a = Math.min(abs, b);
      else b = Math.max(abs, a);
      setRangeSel({ trackId: String(d.trackId), clipId: String(d.clipId), aSec: a, bSec: b });
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    // Prevent default touch behaviors
    e.preventDefault();
    e.stopPropagation();
    pendingRef.current.e = e;
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0 as any;
        const ev = pendingRef.current.e; pendingRef.current.e = null as any;
        if (ev) applyDrag(ev);
      }) as any;
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    // (speed preview cleared – feature removed)
    // Re-enable scrolling
    document.body.style.overflow = '';
    try { (document.body.style as any).userSelect = ''; } catch { }
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // Snap resolution: at higher zooms enable sub-10ms edits (down to 1ms)
    const legacySnap = pickLegacyScale(pxPerSec).majorTickSec / (pickLegacyScale(pxPerSec).minorTicksPerMajor + 1);
    const snap = (pxPerSec >= 2000) ? 0.001
               : (pxPerSec >= 1000) ? 0.002
               : (pxPerSec >= 500)  ? 0.005
               : (pxPerSec >= 200)  ? 0.01
               : legacySnap;
    if (d.mode === 'move') {
      // Treat as a click if very small movement and Touch Fade Mode is enabled → set fade at clicked position
      const startThresh = (d as any).pointerType === 'touch' ? 14 : 6;
      if (!(d as any).started && Math.hypot(dx, dy) < startThresh && !freezeTouch) {
        // Cancel tiny moves to avoid accidental nudge
        try { const el = (d as any).el as HTMLElement | null; if (el) { el.style.transform = ''; el.style.willChange = ''; } } catch { }
        try { setMovingClipId(null); } catch { }
        dragRef.current = null; return;
      }
      if (Math.hypot(dx, dy) < startThresh && freezeTouch && !FADES_DISABLED) {
        try {
          const el = (d as any).el as HTMLElement | null;
          if (el) {
            const rect = el.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const relSec = x / pxPerSec;
            const clipDur = Math.max(0.01, (d as any).origWidthPx ? (d as any).origWidthPx / pxPerSec : 0);
            let fin = 0, fout = 0;
            // Derive current fades from data attributes if available; fallback to 0
            const track = tracks.find(tt => String(tt.id) === String(d.trackId));
            const c = track?.clips.find(cc => cc.id === d.clipId);
            fin = Math.max(0, c?.fadeInSec || 0);
            fout = Math.max(0, c?.fadeOutSec || 0);
            if (relSec <= clipDur / 2) {
              fin = Math.max(0, Math.min(clipDur - fout - 0.01, relSec));
            } else {
              const distToEnd = Math.max(0, clipDur - relSec);
              fout = Math.max(0, Math.min(clipDur - fin - 0.01, distToEnd));
            }
            onSetClipFade?.(String(d.trackId), String(d.clipId), fin, fout);
            dragRef.current = null; return;
          }
        } catch { }
      }
      const newBegin = Math.max(0, d.origBegin + dx / pxPerSec);
      let snapped = Math.round(newBegin / snap) * snap;
      // Avoid overlapping other clips on the target track by snapping to nearest boundary
      try {
        const targetTrack = tracks.find(tt => String(tt.id) === String(d.targetTrackId));
        const movingClip = (tracks.find(tt => tt.clips.some(cc => cc.id === d.clipId)) || targetTrack)?.clips.find(cc => cc.id === d.clipId);
        const dur = Math.max(0.001, movingClip?.durationSec || ((d as any).origWidthPx ? (d as any).origWidthPx / pxPerSec : 0));
        if (targetTrack && Number.isFinite(dur) && dur > 0) {
          const others = targetTrack.clips.filter(c => c.id !== d.clipId);
          const overlaps = others.some(c => {
            const s = snapped; const e = s + dur; const os = c.beginTime; const oe = c.beginTime + c.durationSec;
            return s < oe && e > os; // overlap
          });
          if (overlaps) {
            // Build candidate positions at all neighbor boundaries
            const boundaries: number[] = [];
            for (const c of others) { boundaries.push(c.beginTime, c.beginTime + c.durationSec); }
            const candidates = boundaries.flatMap(b => [b, b - dur]).filter(v => Number.isFinite(v));
            // Choose nearest candidate that does not overlap any other clip
            const nonOverlap = (pos: number) => others.every(c => !(pos < (c.beginTime + c.durationSec) && (pos + dur) > c.beginTime));
            let best = snapped; let bestDist = Infinity;
            for (const pos of candidates) {
              const p = Math.max(0, pos);
              if (!nonOverlap(p)) continue;
              const dist = Math.abs(p - snapped);
              if (dist < bestDist) { bestDist = dist; best = p; }
            }
            if (bestDist < Infinity) snapped = Math.round(best / snap) * snap;
          }
        }
      } catch { }
      const el = (d as any).el as HTMLElement | null;
      // Keep the final transform until engine state reflects the move to avoid flicker
      if (el) { try { el.style.willChange = ''; } catch { } }
      try {
        pendingMoveRef.current.set(String(d.clipId), { begin: snapped, trackId: String(d.targetTrackId || d.trackId), t0: performance.now() });
        forceRender(v => v + 1);
      } catch { }
      onMoveClip(d.targetTrackId, d.clipId, snapped);
      // Update base bounds and caches so waveform window aligns after move
      try {
        const targetTrack = tracks.find(tt => String(tt.id) === String(d.targetTrackId || d.trackId));
        const moved = (targetTrack || { clips: [] as any[] }).clips.find((cc: any) => String(cc.id) === String(d.clipId));
        const dur = Math.max(0.001, moved?.durationSec || ((d as any).origWidthPx ? (d as any).origWidthPx / Math.max(1e-6, pxPerSec) : 0));
        originalBoundsRef.current.set(String(d.clipId), { begin: snapped, end: snapped + dur });
        const wc = waveCache.current; if (wc) { for (const k of Array.from(wc.keys())) { if (k.startsWith(String(d.clipId) + ':')) wc.delete(k); } }
      } catch { }
      try { setMovingClipId(null); } catch { }
      // Ensure React re-renders immediately so inline styles are reset
      try { forceRender(v => v + 1); } catch { }
    } else if (d.mode === 'trim-left' || d.mode === 'trim-right') {
      const startThresh = (d as any).pointerType === 'touch' ? 14 : 6;
      if (!(d as any).started && Math.hypot(dx, dy) < startThresh) {
        dragRef.current = null;
        return;
      }
      let newBegin = d.origBegin;
      let newEnd = d.origEnd;
      const baseBegin = (d as any).baseBegin ?? d.origBegin;
      const baseEnd = (d as any).baseEnd ?? d.origEnd;
      const minDurSec = 0.01;
      if (d.mode === 'trim-left') {
        const cand = d.origBegin + dx / pxPerSec;
        newBegin = Math.max(baseBegin, Math.min(d.origEnd - minDurSec, cand));
      }
      if (d.mode === 'trim-right') {
        // Keep begin fixed; drag only adjusts the end, clamped to the original base end
        const baseLeft = baseBegin;
        const baseRight = baseEnd;
        const endCand = d.origEnd + dx / Math.max(1e-6, pxPerSec);
        newBegin = Math.max(baseLeft, d.origBegin);
        newEnd = Math.max(newBegin + minDurSec, Math.min(baseRight, endCand));
      }
      // Round to nearest pixel to avoid sub-pixel drift at low zoom
      const _px = Math.max(1e-6, pxPerSec);
      const roundToPx = (sec: number) => Math.round(sec * _px) / _px;
      newBegin = roundToPx(newBegin);
      newEnd = roundToPx(newEnd);
      const el = (d as any).el as HTMLElement | null;
      if (el) { el.style.transform = ''; el.style.width = ''; el.style.left = ''; try { el.style.willChange = ''; } catch { } }
      if (newEnd > newBegin) onTrimClip?.(d.trackId, (d as any).clipId, newBegin, newEnd);
      const clipKey = String((d as any).clipId);
      // Clear any preview overlays
      try { trimPreviewRef.current.delete(clipKey); } catch { }
      // Temporary live override so UI reflects committed bounds until engine snapshot arrives
      try { liveTrimRef.current.set(clipKey, { begin: newBegin, end: newEnd }); } catch { }
      try { pendingTrimRef.current.set(clipKey, { begin: newBegin, end: newEnd }); } catch { }
      // Invalidate any cached waveform slices for this clip and refresh original cache
      try {
        const wc = waveCache.current; if (wc) { for (const k of Array.from(wc.keys())) { if (k.startsWith(clipKey + ':')) wc.delete(k); } }
        const trk = tracks.find(tt => String(tt.id) === String(d.trackId));
        const clipObj = trk?.clips.find(cc => String(cc.id) === clipKey);
        if (clipObj) {
          // Widen base if needed so new trim range is fully representable
          const prevBase = originalBoundsRef.current.get(clipKey) || { begin: clipObj.beginTime, end: clipObj.beginTime + clipObj.durationSec };
          const nextBase = { begin: Math.min(prevBase.begin, newBegin), end: Math.max(prevBase.end, newEnd) };
          originalBoundsRef.current.set(clipKey, nextBase);
          const baseW = Math.max(12, Math.floor((nextBase.end - nextBase.begin) * Math.max(1, pxPerSec)));
          ensureOriginalWave(String(d.trackId), clipKey, baseW, clipObj as any);
        }
      } catch { }
      // Force a re-render so the clip reflows immediately
      try { forceRender(v => v + 1); } catch { }
      // Nudge scroll a tiny bit at high zoom after a right-trim to ensure immediate canvas refresh
      if (d.mode === 'trim-right' && pxPerSec > 30) {
        try {
          const el = topScrollRef.current;
          if (el) {
            const maxScroll = Math.max(0, fullWidth - (el.clientWidth || 0));
            const next = Math.min(maxScroll, (el.scrollLeft || 0) + 1);
            el.scrollLeft = next;
            scrollXRef.current = next;
            setScrollX(next);
          }
        } catch { }
      }
      // Clear live override when engine snapshot reflects the change (see tracks effect)
      // Keep selection linked for further adjustments if enabled
      if (newEnd > newBegin && postEditAdjust) {
        try {
          setRangeSel({ trackId: String(d.trackId), clipId: String((d as any).clipId), aSec: newBegin, bSec: newEnd });
          setLinkedSel({ trackId: String(d.trackId), clipId: String((d as any).clipId) });
        } catch { }
      }
    } else if (d.mode === 'fade-in' || d.mode === 'fade-out') {
      const el = (d as any).el as HTMLElement | null;
      let fin = d.origFadeIn;
      let fout = d.origFadeOut;
      const startThresh = (d as any).pointerType === 'touch' ? 14 : 6;
      const isTap = Math.hypot(dx, dy) < startThresh;
      if (isTap && el) {
        // Treat as tap/click: compute absolute fade from pointer position
        const rect = el.getBoundingClientRect();
        const wSec = rect.width / pxPerSec;
        if (d.mode === 'fade-in') {
          const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
          fin = Math.max(0, Math.min(d.clipDur - fout - 0.01, x / pxPerSec));
        } else {
          const xFromRight = Math.max(0, Math.min(rect.width, rect.right - e.clientX));
          fout = Math.max(0, Math.min(d.clipDur - fin - 0.01, xFromRight / pxPerSec));
        }
      } else {
        // Drag case: delta-based
        const useVertical = (d as any).pointerType === 'touch';
        const dpx = useVertical ? -dy : dx; // swipe up increases
        if (d.mode === 'fade-in') fin = Math.max(0, Math.min(d.clipDur - fout - 0.01, d.origFadeIn + dpx / pxPerSec));
        else fout = Math.max(0, Math.min(d.clipDur - fin - 0.01, d.origFadeOut + (-dpx) / pxPerSec));
      }
      onSetClipFade?.(d.trackId, d.clipId, fin, fout);
    } else if (d.mode === 'select' || d.mode === 'select-left' || d.mode === 'select-right') {
      // Do NOT auto-trim on selection drag. Only update selection box.
      // Trimming should happen exclusively via the explicit Trim button.
      // Keep selection; clear if collapsed to near-zero width
      const sel = rangeSel;
      if (sel && sel.trackId === String(d.trackId) && sel.clipId === String(d.clipId)) {
        const width = Math.max(0, sel.bSec - sel.aSec);
        if (width < (1 / Math.max(1, pxPerSec))) {
          setRangeSel(null);
        }
      }
    }
    // If we paused at drag start, resume now that the edit is committed
    try {
      if (wasPlayingBeforeDragRef.current && typeof onPlay === 'function') {
        onPlay();
        wasPlayingBeforeDragRef.current = false;
      }
    } catch {}
    dragRef.current = null;
  };

  // Clear pending move transforms once engine state matches the optimistic value
  useEffect(() => {
    const now = performance.now();
    const remove: string[] = [];
    for (const [cid, pend] of pendingMoveRef.current.entries()) {
      let match = false;
      for (const t of tracks) {
        const c = t.clips.find(cc => String(cc.id) === String(cid));
        if (c && Math.abs(c.beginTime - pend.begin) < 1e-3 && String(t.id) === String(pend.trackId)) { match = true; break; }
      }
      if (match || now - pend.t0 > 1000) remove.push(cid);
    }
    if (remove.length) {
      remove.forEach(cid => {
        pendingMoveRef.current.delete(cid);
        try { const el = document.querySelector(`[data-clip='${cid}']`) as HTMLElement | null; if (el) el.style.transform = ''; } catch { }
      });
      forceRender(v => v + 1);
    }
  }, [tracks]);
  // Clear trim live override when engine snapshot reflects committed bounds
  useEffect(() => {
    if (!pendingTrimRef.current.size) return;
    const done: string[] = [];
    for (const [cid, exp] of pendingTrimRef.current.entries()) {
      let matched = false;
      for (const t of tracks) {
        const c = t.clips.find(cc => String(cc.id) === String(cid));
        if (c) {
          const be = Number(exp.begin || 0);
          const ee = Number(exp.end || 0);
          const actualBegin = Number(c.beginTime || 0);
          const actualEnd = Number(c.beginTime || 0) + Number(c.durationSec || 0);
          const eps = 1 / Math.max(1, pxPerSec); // within 1px tolerance
          if (Math.abs(actualBegin - be) <= eps && Math.abs(actualEnd - ee) <= eps) {
            matched = true; break;
          }
        }
      }
      if (matched) done.push(cid);
    }
    if (done.length) {
      for (const cid of done) {
        pendingTrimRef.current.delete(cid);
        try { liveTrimRef.current.delete(cid); } catch { }
      }
      try { forceRender(v => v + 1); } catch { }
    }
  }, [tracks, pxPerSec]);

  // Seek on background click
  const onBgClick = (e: React.MouseEvent) => {
    // const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    // const x = e.clientX - rect.left + scrollX; const y = e.clientY - rect.top;
    // const sec = Math.max(0, (x - laneInfoW) / pxPerSec);
    // const clamped = Math.max(0, Math.min(safeDuration, sec));
    // onSeek(clamped);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + scrollX;
    const y = e.clientY - rect.top;

    // ✅ NEW: don't seek if the click is inside the track-control column
    if (x < laneInfoW) return;

    const secAbs = Math.max(0, (x - laneInfoW) / Math.max(1e-6, pxPerSec));
    onSeek(secAbs);
    // If envelope editor is enabled for the tapped lane and freezeTouch mode is on,
    // also drop an envelope point at the playhead with mid value (1.0).
    if (freezeTouch) {
      const laneIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(y / heightPerTrack)));
      const track = tracks[laneIndex];
      if (track && envTracks.has(String(track.id))) {
        try {
          const getPts = (window as any).mix_getTrackEnvPts as undefined | ((id: string) => Array<{ time: number; value: number }>);
          const setPts = (window as any).mix_setTrackEnvPts as undefined | ((id: string, p: Array<{ time: number; value: number }>) => void);
          const pts = (typeof getPts === 'function') ? (getPts(String(track.id)) || []) : [];
          const next = [...pts, { time: secAbs, value: 1 }].sort((a, b) => a.time - b.time);
          if (typeof setPts === 'function') setPts(String(track.id), next);
        } catch { }
      }
    }
    // Track empty-area selection: if click is not over a clip in that lane, select the lane
    try {
      const laneIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(y / heightPerTrack)));
      const track = tracks[laneIndex];
      if (track) {
        const hit = (track.clips || []).some(c => secAbs >= c.beginTime && secAbs <= (c.beginTime + c.durationSec));
        if (!hit) onSelectTrack?.(String(track.id));
      }
    } catch { }
  };

  // Touch-friendly lane selection on background pointer down (no seeking here)
  const onBgPointerDown = (e: React.PointerEvent) => {
    // Mobile: one-finger horizontal pan over empty grid to scroll X
    if ((e as any).pointerType === 'touch' && !freezeTouch) {
      const gridEl = e.currentTarget as HTMLElement; const cont = topScrollRef.current;
      if (gridEl && cont) {
        const rect = gridEl.getBoundingClientRect();
        const xLocal = e.clientX - rect.left; if (xLocal < laneInfoW) return;
        try { gridEl.setPointerCapture?.(e.pointerId); } catch {}
        panRef.current = { id: e.pointerId, startX: e.clientX, startScroll: cont.scrollLeft, lastX: e.clientX, lastT: performance.now(), vx: 0 };
        const onMove = (ev: PointerEvent) => {
          const p = panRef.current; if (!p || ev.pointerId !== p.id) return;
          const dx = ev.clientX - p.startX;
          const vw = cont.clientWidth || 0; const max = Math.max(0, fullWidth - vw);
          const next = Math.max(0, Math.min(max, p.startScroll - dx));
          cont.scrollLeft = next; scrollXRef.current = next; setScrollX(next);
          const now = performance.now(); const dt = Math.max(1, now - p.lastT); p.vx = (ev.clientX - p.lastX) / dt; p.lastX = ev.clientX; p.lastT = now;
        };
        const onUp = (ev: PointerEvent) => {
          const p = panRef.current; panRef.current = null;
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          if (!p || ev.pointerId !== p.id) return;
          // inertia
          let vx = p.vx * 1100; // px/s
          const friction = 0.9; const min = 8; let last = performance.now();
          const step = () => {
            const el = topScrollRef.current; if (!el) return;
            const now = performance.now(); const dt = (now - last) / 1000; last = now;
            vx *= friction; if (Math.abs(vx) < min) return;
            const vw = el.clientWidth || 0; const max = Math.max(0, fullWidth - vw);
            const next = Math.max(0, Math.min(max, el.scrollLeft - vx * dt));
            if (Math.abs(next - el.scrollLeft) < 0.5) return;
            el.scrollLeft = next; scrollXRef.current = next; setScrollX(next);
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        };
        window.addEventListener('pointermove', onMove, { passive: true } as any);
        window.addEventListener('pointerup', onUp, { passive: true } as any);
        // Do not fall through to selection logic for this gesture
        return;
      }
    }
    try {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left + scrollX;
      const y = e.clientY - rect.top;
      if (x < laneInfoW) return; // ignore clicks on left controls
      const sec = Math.max(0, (x - laneInfoW) / Math.max(1e-6, pxPerSec));
      const laneIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(y / heightPerTrack)));
      const track = tracks[laneIndex];
      if (!track) return;
      const hit = (track.clips || []).some(c => sec >= c.beginTime && sec <= (c.beginTime + c.durationSec));
      if (!hit) onSelectTrack?.(String(track.id));
    } catch { }
  };

  const onGridDoubleClick = (e: React.MouseEvent) => {
    // const grid = gridRef.current?.getBoundingClientRect(); if (!grid) return;
    // const x = e.clientX - grid.left + scrollX; const y = e.clientY - grid.top;
    const grid = gridRef.current?.getBoundingClientRect(); if (!grid) return;
    const x = e.clientX - grid.left + scrollX;
    const y = e.clientY - grid.top;

    // ✅ NEW
    if (x < laneInfoW) return;
    const tAbs = Math.max(0, (x - laneInfoW) / pxPerSec); const laneIndex = Math.max(0, Math.min(tracks.length - 1, Math.floor(y / heightPerTrack)));
    const track = tracks[laneIndex]; if (!track) return;
    // Double-click: clear selection instead of split/envelope
    // Clear selection on double-click instead of splitting
    try { setRangeSel(null); } catch { }
    try { onSelectTrack?.(''); } catch { }
  };

  // Fetch or compute waveform for a clip id
  const getWave = (tId: string, clipId: string, clip: any, w: number): Float32Array | undefined => {
    // Cache by point count (approx one value per pixel, clamp to safe max)
    const MAX_POINTS = 8192;
    const points = Math.max(64, Math.min(MAX_POINTS, Math.floor(w)));
    const key = clipId + ':' + points;
    const cache = waveCache.current;
    if (cache.has(key)) return cache.get(key);
    try {
      let data: Float32Array | undefined = undefined;
      if (getClipWaveform) {
        // Some engines return empty for very large point counts; retry with lower resolution
        let want = points;
        for (let i = 0; i < 3; i++) {
          data = normalizeWaveform(getClipWaveform(tId, clipId, want));
          if (data && data.length > 8) break;
          want = Math.max(128, Math.floor(want / 2));
        }
      } else if (clip.buffer) {
        data = downsampleBuffer(clip.buffer, clip.offsetSec, clip.durationSec, points);
      }
      if (data) cache.set(key, data);
      return data;
    } catch { return undefined; }
  };

  // Seed and keep an original full-width waveform per clip, upscaling on demand at higher zooms
  const ensureOriginalWave = (tId: string, clipId: string, baseWidthPx: number, clip: any) => {
    const MAX_POINTS = 8192;
    const desired = Math.max(256, Math.min(MAX_POINTS, Math.floor(baseWidthPx)));
    const existing = originalWaveCache.current.get(String(clipId));
    if (existing && existing.points >= desired * 0.95) return; // good enough; keep
    try {
      let data: Float32Array | undefined = undefined;
      if (getClipWaveform) {
        let want = desired;
        for (let i = 0; i < 3; i++) {
          data = normalizeWaveform(getClipWaveform(tId, clipId, want));
          if (data && data.length > 8) break;
          want = Math.max(256, Math.floor(want / 2));
        }
      } else if (clip.buffer) {
        data = downsampleBuffer(clip.buffer, clip.offsetSec, clip.durationSec, desired);
      }
      if (data) originalWaveCache.current.set(String(clipId), { points: wavePointCount(data), data });
    } catch { }
  };

  // Compute a slice from the original waveform for the current (begin,end) window inside base (baseBegin, baseEnd)
  const sliceOriginalWave = (clipId: string, baseBegin: number, baseEnd: number, begin: number, end: number): Float32Array | undefined => {
    const entry = originalWaveCache.current.get(String(clipId));
    if (!entry || !entry.data || entry.data.length === 0) return undefined;
    const pointCount = wavePointCount(entry.data);
    const total = Math.max(1e-6, baseEnd - baseBegin);
    const p0 = Math.max(0, Math.min(1, (begin - baseBegin) / total));
    const p1 = Math.max(0, Math.min(1, (end - baseBegin) / total));
    const i0 = Math.max(0, Math.floor(p0 * (pointCount - 1)));
    const i1 = Math.max(i0 + 1, Math.min(pointCount, Math.ceil(p1 * (pointCount - 1))));
    try { return entry.data.subarray(i0 * 2, i1 * 2); } catch { return undefined; }
  };
  
  // Expand base bounds when clips are extended so waveform slices cover the full visible range.
  useEffect(() => {
    try {
      for (const t of tracks) {
        for (const c of t.clips) {
          const id = String(c.id);
          const curBegin = Number(c.beginTime || 0);
          const curEnd = curBegin + Number(c.durationSec || 0);
          const base = originalBoundsRef.current.get(id);
          if (!base) {
            originalBoundsRef.current.set(id, { begin: curBegin, end: curEnd });
            const baseW = Math.max(12, Math.round((curEnd - curBegin) * Math.max(1, pxPerSec)));
            ensureOriginalWave(String(t.id), id, baseW, c as any);
            continue;
          }
          if (curBegin < base.begin || curEnd > base.end) {
            const nextBegin = Math.min(curBegin, base.begin);
            const nextEnd = Math.max(curEnd, base.end);
            originalBoundsRef.current.set(id, { begin: nextBegin, end: nextEnd });
            try { for (const k of Array.from(waveCache.current.keys())) { if (k.startsWith(id + ':')) waveCache.current.delete(k); } } catch {}
            const baseW = Math.max(12, Math.round((nextEnd - nextBegin) * Math.max(1, pxPerSec)));
            ensureOriginalWave(String(t.id), id, baseW, c as any);
          }
        }
      }
    } catch {}
  }, [tracks, pxPerSec]);


  const toDb = (g: number) => (g <= 0 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(g))));

  const onRootPointerDown = (e: React.PointerEvent) => {
    // Track two-finger gestures for pinch zoom on touch devices
    if ((e as any).pointerType === 'touch') {
      touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Only initialize pinch if no clip drag is in progress
      if (touchesRef.current.size === 2 && !dragRef.current) {
        const ids = Array.from(touchesRef.current.keys());
        const a = touchesRef.current.get(ids[0]!)!;
        const b = touchesRef.current.get(ids[1]!)!;
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        pinchRef.current = { id1: ids[0]!, id2: ids[1]!, startDist: dist, startZoom: pxPerSec };
      }
    }
  };
  const onRootPointerMove = (e: React.PointerEvent) => {
    // Update touch positions and handle pinch scaling
    if ((e as any).pointerType === 'touch') {
      if (touchesRef.current.has(e.pointerId)) {
        touchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      const p = pinchRef.current;
      if (p) {
        // If a drag starts while pinching, cancel pinch zoom immediately
        if (dragRef.current) { pinchRef.current = null; }
        const a = touchesRef.current.get(p.id1);
        const b = touchesRef.current.get(p.id2);
        if (a && b) {
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          // Ignore tiny jitters; require ~6px distance change before zooming
          if (Math.abs(dist - p.startDist) >= 6 && !dragRef.current) {
            const factor = dist / Math.max(1, p.startDist);
            const next = Math.max(10, Math.min(1200, p.startZoom * factor));
            onZoom?.(next);
          }
          // Cancel any ongoing clip drag while pinching
          try { if (dragRef.current) dragRef.current = null; } catch { }
          // Do not prevent default on single finger; allow scroll with one finger
          // With two fingers, this is an explicit gesture, safe to prevent default
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }
    // Only pass through to clip/selection dragging when not pinching
    if (!pinchRef.current) onPointerMove(e);
  };
  const onRootPointerUp = (e: React.PointerEvent) => {
    if ((e as any).pointerType === 'touch') {
      touchesRef.current.delete(e.pointerId);
      const p = pinchRef.current;
      if (p && (e.pointerId === p.id1 || e.pointerId === p.id2)) {
        pinchRef.current = null;
      }
      // If fewer than 2 active touches remain, ensure pinch is cleared
      if (touchesRef.current.size < 2) pinchRef.current = null;
    }
    onPointerUp(e);
  };

  return (
    <div className="select-none" onPointerDown={onRootPointerDown} onPointerMove={onRootPointerMove} onPointerUp={onRootPointerUp}>
      <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900/40 relative" ref={containerRef}>

        {/* Top ruler (time/bars), non-scrollable; synced with scrollX */}
        <div
          className="relative"
          style={{ height: 32 }}
          ref={rulerRef}
          onMouseMove={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const x = e.clientX - rect.left; // viewport x
            const contentX = x + scrollX;    // add scroll offset
            const sec = (contentX - laneInfoW) / Math.max(1e-6, pxPerSec);
            if (Number.isFinite(sec) && sec >= 0) setHoverSec(sec); else setHoverSec(null);
          }}
          onMouseLeave={() => setHoverSec(null)}
        >
          {(() => {
            if (!isBarsMode) {
              const vw = topScrollRef.current?.clientWidth || viewW || 0;
              const startSec = Math.max(0, Math.floor((scrollX - laneInfoW) / Math.max(1e-6, pxPerSec)));
              const endSec = Math.max(0, Math.ceil((scrollX + vw - laneInfoW) / Math.max(1e-6, pxPerSec)));
              const scale = pickLegacyScale(pxPerSec);
              // Use the legacy scale grid for both background and ruler so ticks align perfectly
              const labelEverySec = Math.max(1, Math.round(scale.majorTickSec));
              const secondsPerCell = Math.max(1e-6, scale.majorTickSec); // draw one major cell per scale step
              const firstCell = Math.max(0, Math.floor(startSec / secondsPerCell) * secondsPerCell);
              const nodes: JSX.Element[] = [];
              for (let s = firstCell; s <= endSec; s += secondsPerCell) {
                const left = (laneInfoW + s * pxPerSec - scrollX);
                const widthPx = Math.max(1, secondsPerCell * pxPerSec);
                const showLabel = (Math.abs(s % labelEverySec) < 1e-6);
                nodes.push(
                  <SecondCell
                    key={`sec-cell-${s}`}
                    left={left}
                    width={widthPx}
                    second={s}
                    pxPerSec={pxPerSec}
                    minorPerMajor={Math.max(1, (scale.minorTicksPerMajor + 1))}
                    majorSec={scale.majorTickSec}
                    showLabel={showLabel}
                    label={fmt(s, false)}
                  />
                );
              }
              return (
                <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 32, pointerEvents: 'none' }}>
                  {nodes}
                </div>
              );
            } else {
              const vw = topScrollRef.current?.clientWidth || viewW || 0;
              const startSecAbs = Math.max(0, (scrollX - laneInfoW) / Math.max(1e-6, pxPerSec));
              const endSecAbs = Math.max(0, (scrollX + vw - laneInfoW) / Math.max(1e-6, pxPerSec));
              const firstBar = Math.max(0, Math.floor(startSecAbs / Math.max(1e-6, secPerBar)));
              const lastBar = Math.max(firstBar, Math.ceil(endSecAbs / Math.max(1e-6, secPerBar)));
              const nodes: JSX.Element[] = [];
              for (let bar = firstBar; bar <= lastBar; bar++) {
                const barStartSec = bar * secPerBar;
                const left = (laneInfoW + barStartSec * pxPerSec - scrollX);
                const widthPx = Math.max(1, secPerBar * pxPerSec);
                const text = `${bar + 1}`;
                nodes.push(
                  <BarCell
                    key={`bar-cell-${bar}`}
                    left={left}
                    width={widthPx}
                    beatsPerMeasure={beatsPerMeasure}
                    minorPerBeat={minorPerBeat}
                    label={text}
                  />
                );
              }
              return (
                <div aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 32, pointerEvents: 'none' }}>
                  {nodes}
                </div>
              );
            }
          })()}
          {/* Playhead time readout for exact alignment at high zoom */}
          {Number.isFinite(time) && (
            <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 32, pointerEvents: 'none' }}>
              <div
                style={{
                  position: 'absolute',
                  left: Math.round(laneInfoW - scrollX + (Number.isFinite(time) ? time : 0) * pxPerSec),
                  top: 2,
                  transform: 'translateX(-50%)',
                  padding: '1px 6px',
                  fontSize: 11,
                  lineHeight: '14px',
                  color: '#e2e8f0',
                  background: 'rgba(2,6,23,0.85)',
                  border: '1px solid rgba(148,163,184,0.35)',
                  borderRadius: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {(() => {
                  const t = Math.max(0, Number(time || 0));
                  const major = fmt(t, false);
                  const minor = `:${String(Math.floor(t * 1000) % 1000).padStart(3, '0')}`;
                  return (
                    <span>
                      <span style={{ fontWeight: 600, fontSize: 12 }}>{major}</span>
                      <span style={{ fontSize: 10, opacity: 0.85 }}>{minor}</span>
                    </span>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Draggable playhead triangle handle */}
          {Number.isFinite(time) && (
            <PlayheadHandle
              x={Math.round(laneInfoW - scrollX + (Number(time) || 0) * pxPerSec)}
              onDragTo={(clientX) => {
                const rr = rulerRef.current; if (!rr) return;
                const rect = rr.getBoundingClientRect();
                const viewX = clientX - rect.left;
                const contentX = viewX + scrollX;
                let sec = (contentX - laneInfoW) / Math.max(1e-6, pxPerSec);
                const scale = pickLegacyScale(pxPerSec);
                const step = Math.max(1e-6, scale.majorTickSec);
                const nearest = Math.round(sec / step) * step;
                const distPx = Math.abs(nearest - sec) * pxPerSec;
                const stickPx = Math.max(8, Math.min(22, Math.round(pxPerSec * 0.8)));
                if (distPx <= stickPx) sec = nearest;
                sec = Math.max(0, sec);
                onSeek(sec);
              }}
              onDragState={(dragging) => {
                try {
                  if (dragging) {
                    if (playing) { onPause?.(); phWasPlayingRef.current = true; }
                  } else if (phWasPlayingRef.current) {
                    onPlay?.(); phWasPlayingRef.current = false;
                  }
                } catch {}
              }}
            />
          )}
        </div>
        { tracks.length === 0  && (
          <div className="flex mt-10 justify-center inset-0 z-[4000] place-items-center backdrop-blur-sm" >
            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-2xl">
              <div className="text-center">
                <div className="text-2xl font-semibold text-white">Welcome</div>
                <div className="text-sm text-slate-300">Import audio or start recording</div>
              </div>
              <div className="flex gap-3">
                <label className="px-4 py-2 rounded-lg bg-white/80 hover:bg-white text-slate-900 font-medium cursor-pointer shadow" title="Import Audio" onClick={(e) => e.stopPropagation()}>
                  <input type="file" accept="audio/*" multiple className="hidden"
                    onChange={(e) => {
                      e.stopPropagation();
                      const files = e.currentTarget.files; if (!files) return;
                      try { (window as any).mix_importAudio?.(files); } catch { }
                      // defer clearing after import call; overlay will hide on next frame when tracks > 0
                      setTimeout(() => { try { (e.currentTarget as any).value = ''; } catch { } }, 0);
                    }} />
                  Import
                </label>
                <button className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-medium shadow" onClick={(e) => { e.stopPropagation(); try { (window as any).mix_recordClick?.(); } catch { } }} title="Record">Record</button>
              </div>
            </div>
          </div>
        )}
        {/* Content area (we translate by scrollX so scrollbar lives on top) */}
        <div className="relative" ref={gridRef} style={{ width: fullWidth, height: totalHeight + 'px' }} onClick={onBgClick} onPointerDown={onBgPointerDown} onDoubleClick={onGridDoubleClick}
          onWheel={(e) => { if (freezeTouch) return; if (topScrollRef.current) { topScrollRef.current.scrollLeft += e.deltaY + e.deltaX; setScrollX(topScrollRef.current.scrollLeft); } }}>
          {/* Background columns */}
          <div style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
            {/* background grid canvas draws only viewport area using scrollX offset */}
            <canvas ref={bgRef} style={{ position: 'absolute', left: 0, top: 0, width: viewW + 'px', height: totalHeight + 'px', zIndex: 0 }} />
          </div>
          {/* Playhead — hidden during freeze-touch mode */}
          {!freezeTouch && (
            <div className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-[3000]" style={{ left: Math.round(laneInfoW - scrollX + (Number.isFinite(time) ? time : 0) * pxPerSec) + 'px' }} />
          )}
          <div className="lg:hidden fixed top-2 left-6 z-[4000]">
            <button
              className="rounded-full bg-sky-600 p-2 shadow-lg hover:bg-sky-700 transition-colors"
              onClick={() => setControlPanelOpen(!controlPanelOpen)}
            >
              <SlidersHorizontal className="w-5 h-5 text-white" />
            </button>
          </div>
          {controlPanelOpen && (
            <div
              ref={controlPanelRef}
              className="fixed z-[5001] touch-none "
              style={{
                // left: controlPanelPos.x,
                // top: controlPanelPos.y,
                left: "0px",
                top: "0px",
                maxWidth: '90vw',
                height: "100%",
                width: "200px",

              }}
              onPointerDown={(e) => {
                const target = controlPanelRef.current;
                if (!target) return;

                const rect = target.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const offsetY = e.clientY - rect.top;

                target.setPointerCapture(e.pointerId);

                const onMove = (moveEvent: PointerEvent) => {
                  const newX = Math.max(0, Math.min(window.innerWidth - rect.width, moveEvent.clientX - offsetX));
                  const newY = Math.max(0, Math.min(window.innerHeight - rect.height, moveEvent.clientY - offsetY));
                  setControlPanelPos({ x: newX, y: newY });
                };

                const onUp = () => {
                  target.releasePointerCapture(e.pointerId);
                  window.removeEventListener('pointermove', onMove);
                  window.removeEventListener('pointerup', onUp);
                };

                window.addEventListener('pointermove', onMove);
                window.addEventListener('pointerup', onUp);
              }}
            >
              <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-700 h-full ">
                <div className="flex items-center justify-between p-2 border-b border-slate-700 cursor-move">
                  <span className="text-sm font-semibold text-slate-300">Track Controls</span>
                  <button
                    className="p-1 hover:bg-slate-800 rounded"
                    onClick={() => setControlPanelOpen(false)}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400">
                      <path fill="currentColor" d="M19 6.4L17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" />
                    </svg>
                  </button>
                </div>
                <div className="h-full flex flex-col overflow-y-auto mb-4">
                  {tracks.map((t, ti) => (
                    <div key={t.id} className=" last:mb-0">
                      {/* Reuse your existing track control panel content here */}
                      <div className="">
                        {/* ... your existing track control content ... */}
                        <div
                          key={t.id}
                          className="relative"
                          style={{
                            height: 'auto',
                            borderBottom: '1px solid rgba(255,255,255,0.08)'
                          }}
                        >
                          <div
                            className="relative md:block"
                            style={{ zIndex: 3000 }}
                          >
                            <div className="h-full px-1 py-0 flex flex-col w-5/6">
                              {/* leave 3px gap top/bottom so rounded corners are never clipped by the next lane */}
                              <div className=" w-full h-[calc(100%-6px)] my-[3px] rounded-xl p-1.5 relative z-[1]">
                                {/* header — shorter */}
                                <div className="flex items-center gap-1 mb-1">
                                  <div
                                    className="flex-1 truncate px-1.5 py-0.5 rounded bg-slate-800 text-slate-100 text-[10px] font-semibold leading-[14px]"
                                    title={(t as any).name || "Track"}
                                  >
                                    {(t as any).name || "Track"}
                                  </div>

                                  {/* FX icon smaller */}
                                  <button
                                    className="grid place-items-center w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 active:scale-95"
                                    title="FX"
                                    onClick={(e) => {
                                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                      setFxPop({ trackId: t.id as any, x: r.left + 8, y: r.bottom + 8 });
                                      setVolPop(null);
                                    }}
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-100" />
                                  </button>
                                  {/* Delete track */}
                                  <button
                                    className="grid place-items-center w-6 h-6 rounded-md bg-slate-700 hover:bg-red-600 active:scale-95"
                                    title="Delete track"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const ok = typeof window !== 'undefined' && (window as any).confirm ? (window as any).confirm('Delete this track?') : true;
                                      if (ok) onDeleteTrack?.(t.id as any);
                                    }}
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-slate-100" />
                                  </button>
                                </div>
                                <div className='flex flex-row gap-4 ml-3'>
                                  {/* GAIN — hairline slider */}
                                  {(() => {
                                    const toDb = (g: number) => (g <= 0 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(g))));
                                    const db = toDb(t.gain.gain.value);
                                    return (
                                      <div className='flex flex-row'>
                                        {/* photo-style line slider */}
                                        <RotaryKnob
                                          label=""
                                          value={t.gain.gain.value}
                                          min={0}
                                          max={2}
                                          step={0.01}
                                          defaultValue={1}
                                          size={40}                // try 36–48 to match your panel
                                          formatValue={(v) => `${toDb(v).toFixed(1)} dB`}
                                          onChange={(v) => onTrackGain?.(t.id as any, v)}
                                        />
                                      </div>
                                    );
                                  })()}
                                  {/* PAN — hairline slider */}
                                  {(() => {
                                    const pan = t.pan?.pan.value ?? 0;
                                    return (
                                      <div className='flex flex-row'>
                                        <RotaryKnob
                                          label=""
                                          value={t.pan?.pan.value ?? 0}
                                          min={-1}
                                          max={1}
                                          step={0.01}
                                          defaultValue={0}
                                          size={40}
                                          formatValue={(v) =>
                                            v === 0 ? "0.00" : v < 0 ? `L ${Math.abs(v).toFixed(2)}` : `R ${v.toFixed(2)}`
                                          }
                                          onChange={(v) => onTrackPan?.(t.id as any, v)}
                                        />
                                      </div>
                                    );
                                  })()}
                                  {/* actions — smaller icon buttons */}
                                  <div>
                                    <div className="flex flex-col grid-cols-3 gap-1 mb-1">
                                      <button
                                        className={`grid place-items-center w-6 h-6 rounded bg-white text-slate-900 border border-slate-300 ${t.muted ? "ring-2 ring-emerald-400" : ""
                                          }`}
                                        title="Mute"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTrackMute?.(t.id as any, !t.muted);
                                        }}
                                      >
                                        {t.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2Icon className="w-3.5 h-3.5" />}
                                      </button>

                                      <button
                                        className={`grid place-items-center w-6 h-6 rounded bg-white text-slate-900 border border-slate-300 ${t.solo ? "ring-2 ring-emerald-400" : ""
                                          }`}
                                        title="Solo"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onTrackSolo?.(t.id as any, !t.solo);
                                        }}
                                      >
                                        <Headphones className="w-3.5 h-3.5" />
                                      </button>

                                      {(() => {
                                        const hasSel = !!(selectedClipId && t.clips.some((c) => c.id === selectedClipId));
                                        return (
                                          <button
                                            className="grid place-items-center w-6 h-6 rounded bg-white text-slate-900 border border-slate-300 disabled:opacity-40"
                                            title="Delete selected clip"
                                            disabled={!hasSel}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (hasSel && selectedClipId) onDeleteClip?.(t.id as any, selectedClipId);
                                            }}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        );
                                      })()}
                                    </div>

                                  </div>

                                  {/* effect chips — compact */}
                                  <div className="flex items-center gap-0.5 flex-wrap h-[14px]">
                                    {(listTrackEffectsDetailed?.(t.id as any) || []).map((fx, i) => (
                                      <button
                                        key={i}
                                        className="mm-chip text-[10px] h-5 px-1 py-0"
                                        title={fx.name}
                                        onClick={(e) => {
                                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                          setFxPop({ trackId: t.id as any, x: r.left, y: r.bottom + 6 });
                                        }}
                                      >
                                        <Zap className="w-3 h-3 mr-0.5 opacity-80" />
                                        {fx.name}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {/* tiny separators */}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Add Track button pinned at bottom of the last lane's panel */}
                      {ti === tracks.length - 1 && onAddTrack && (
                        <button
                          className="absolute bottom-0 left-2 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white grid place-items-center shadow-md z-[3330]"
                          title="Add New Track"
                          aria-label="Add New Track"
                                                  onClick={(e) => {
                          e.stopPropagation();
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setAddPop({ x: r.left, y:  420 });
                        }}
                          // onClick={(e) => { e.stopPropagation(); try { onAddTrack?.(); } catch { } }}
                        >
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      )}

                    </div>
                  ))}

                </div>
              </div>
            </div>
          )}
          {/* Track lanes */}

          {tracks.map((t, ti) => (
            <div
              key={t.id}
              className={`relative ${selectedTrackId === String(t.id) ? 'ring-2 ring-sky-500/40 bg-sky-400/5' : ''}`}
              style={{
                height: heightPerTrack + 'px',
                borderBottom: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              {/* Left column: track control panel (styled like screenshot) */}
              {/* <div className="absolute  top-0 h-full" style={{ width: laneInfoW,left:"-10px",zIndex:"3000" }}>
                <div className="h-full px-2 py-2 flex flex-col justify-center">
                  <div className="mm-trackpanel">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex-1 truncate px-2 py-0.5 rounded bg-slate-800 text-white text-[12px] font-semibold">
                        {(t as any).name || 'Track'}
                      </div>
                      <button className="mm-ico-btn" title="FX" onClick={(e)=>{ const r=(e.currentTarget as HTMLElement).getBoundingClientRect(); setFxPop({ trackId: t.id as any, x: r.left + 8, y: r.bottom + 8 }); setVolPop(null); }}>FX</button>
                    </div>
                    {(() => { const toDb=(g:number)=> g<=0?-60: Math.max(-60, Math.min(12, 20*Math.log10(g))); const db=toDb(t.gain.gain.value); return (
                      <>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="text-amber-300">-60</span>
                          <span className="text-slate-200">dB Gain: <span className="text-amber-300 tabular-nums">{db.toFixed(1)}</span></span>
                          <span className="text-amber-300">12</span>
                        </div>
                        <input className="mm-range w-full mb-1" type="range" min={0} max={2} step={0.01} value={t.gain.gain.value} onChange={(e)=> onTrackGain?.(t.id as any, parseFloat(e.target.value))} />
                      </>
                    ); })()}
                    {(() => { const pan=t.pan?.pan.value ?? 0; return (
                      <>
                        <div className="flex items-center justify-between text-[12px] mb-1">
                          <span className="text-yellow-300">L</span>
                          <span className="text-slate-200">Pan: <span className="text-yellow-300 tabular-nums">{pan.toFixed(2)}</span></span>
                          <span className="text-yellow-300">R</span>
                        </div>
                        <input className="mm-range w-full mb-2" type="range" min={-1} max={1} step={0.01} value={pan} onChange={(e)=> onTrackPan?.(t.id as any, parseFloat(e.target.value))} />
                      </>
                    ); })()}
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      <button className={`px-2 py-1 rounded bg-white text-slate-900 border border-slate-300 ${t.muted ? 'ring-2 ring-emerald-400' : ''}`} onClick={(e)=>{ e.stopPropagation(); onTrackMute?.(t.id as any, !t.muted); }}>Mute</button>
                      <button className={`px-2 py-1 rounded bg-white text-slate-900 border border-slate-300 ${t.solo ? 'ring-2 ring-emerald-400' : ''}`} onClick={(e)=>{ e.stopPropagation(); onTrackSolo?.(t.id as any, !t.solo); }}>Solo</button>
                      {(() => { const hasSel=!!(selectedClipId && t.clips.some(c=>c.id===selectedClipId)); return (
                        <button className="px-2 py-1 rounded bg-white text-slate-900 border border-slate-300 disabled:opacity-40" disabled={!hasSel} onClick={(e)=>{ e.stopPropagation(); if (hasSel && selectedClipId) onDeleteClip?.(t.id as any, selectedClipId); }}>Delete</button>
                      ); })()}
                    </div>
                    <div className="grid gap-1">
                      <div className="h-[2px] bg-slate-600 rounded" />
                      <div className="h-[2px] bg-slate-500 rounded" />
                    </div>
                    <div className="flex items-center gap-1 flex-wrap min-h-[18px] mt-1">
                      {(listTrackEffectsDetailed?.(t.id as any) || []).map((fx,i)=>(
                        <button key={i} className="mm-chip" onClick={(e)=>{ const r=(e.currentTarget as HTMLElement).getBoundingClientRect(); setFxPop({ trackId: t.id as any, x: r.left, y: r.bottom + 6 }); }}>{fx.name}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div> */}
              <div
                className="absolute top-0 h-full md:hidden lg:block "
                style={{ width: laneInfoW, left: "0px", zIndex: 3003 }}
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); }}
                onDoubleClick={(e) => { e.stopPropagation(); }}
              >
                <div className="h-full px-1 py-0 flex flex-col">
                  {/* leave 3px gap top/bottom so rounded corners are never clipped by the next lane */}
                  <div className=" mm-trackpanel h-[calc(100%-6px)] my-[3px] rounded-xl bg-slate-900/70 ring-1 ring-slate-700 p-1.5 relative z-[1]">
                    {/* header — shorter */}
                    <div className="flex items-center gap-1 mb-1">
                      <div
                        className="flex-1 truncate px-1.5 py-0.5 rounded bg-slate-800 text-slate-100 text-[10px] font-semibold leading-[14px]"
                        title={(t as any).name || "Track"}
                      >
                        {(t as any).name || "Track"}
                      </div>

                      {/* FX icon smaller */}
                      <button
                        className="grid place-items-center w-6 h-6 rounded-md bg-slate-700 hover:bg-slate-600 active:scale-95"
                        title="FX"
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setFxPop({ trackId: t.id as any, x: r.left + 8, y: r.bottom + 8 });
                          setVolPop(null);
                        }}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-100" />
                      </button>
                      {/* Delete track */}
                      <button
                        className="grid place-items-center w-6 h-6 rounded-md bg-slate-700 hover:bg-red-600 active:scale-95"
                        title="Delete track"
                        onClick={(e) => {
                          e.stopPropagation();
                          const ok = typeof window !== 'undefined' && (window as any).confirm ? (window as any).confirm('Delete this track?') : true;
                          if (ok) onDeleteTrack?.(t.id as any);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-slate-100" />
                      </button>
                    </div>
                    <div className='flex flex-row gap-4 ml-3'>
                      {/* GAIN — hairline slider */}
                      {(() => {
                        const toDb = (g: number) => (g <= 0 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(g))));
                        const db = toDb(t.gain.gain.value);
                        return (
                          <div className='flex flex-row'>
                            {/* photo-style line slider */}
                            <RotaryKnob
                              label=""
                              value={t.gain.gain.value}
                              min={0}
                              max={2}
                              step={0.01}
                              defaultValue={1}
                              size={40}                // try 36–48 to match your panel
                              formatValue={(v) => `${toDb(v).toFixed(1)} dB`}
                              onChange={(v) => onTrackGain?.(t.id as any, v)}
                            />
                          </div>
                        );
                      })()}
                      {/* PAN — hairline slider */}
                      {(() => {
                        const pan = t.pan?.pan.value ?? 0;
                        return (
                          <div className='flex flex-row'>
                            <RotaryKnob
                              label=""
                              value={t.pan?.pan.value ?? 0}
                              min={-1}
                              max={1}
                              step={0.01}
                              defaultValue={0}
                              size={40}
                              formatValue={(v) =>
                                v === 0 ? "0.00" : v < 0 ? `L ${Math.abs(v).toFixed(2)}` : `R ${v.toFixed(2)}`
                              }
                              onChange={(v) => onTrackPan?.(t.id as any, v)}
                            />
                          </div>
                        );
                      })()}
                      {/* actions — smaller icon buttons */}
                      <div>
                        <div className="flex flex-row grid-cols-3 gap-1 mb-1">
                          <button
                            className={`grid place-items-center w-6 h-6 rounded bg-white text-slate-900 border border-slate-300 ${t.muted ? "ring-2 ring-emerald-400" : ""
                              }`}
                            title="Mute"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrackMute?.(t.id as any, !t.muted);
                            }}
                          >
                            {t.muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2Icon className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            className={`grid place-items-center w-6 h-6 rounded bg-white text-slate-900 border border-slate-300 ${t.solo ? "ring-2 ring-emerald-400" : ""
                              }`}
                            title="Solo"
                            onClick={(e) => {
                              e.stopPropagation();
                              onTrackSolo?.(t.id as any, !t.solo);
                            }}
                          >
                            <Headphones className="w-3.5 h-3.5" />
                          </button>

                          {(() => {
                            const hasSel = !!(selectedClipId && t.clips.some((c) => c.id === selectedClipId));
                            return (
                              <button
                                className="grid place-items-center w-6 h-6 rounded bg-white text-slate-900 border border-slate-300 disabled:opacity-40"
                                title="Delete selected clip"
                                disabled={!hasSel}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasSel && selectedClipId) onDeleteClip?.(t.id as any, selectedClipId);
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            );
                          })()}
                        </div>
                        <div className="grid gap-0.5 m-2">
                          <div className="h-[1px] bg-slate-600 rounded" />
                          <div className="h-[1px] bg-slate-500 rounded" />
                        </div>
                      </div>

                      {/* effect chips — compact */}
                      <div className="flex items-center gap-0.5 flex-wrap h-[14px]">
                        {(listTrackEffectsDetailed?.(t.id as any) || []).map((fx, i) => (
                          <button
                            key={i}
                            className="mm-chip text-[10px] h-5 px-1 py-0"
                            title={fx.name}
                            onClick={(e) => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setFxPop({ trackId: t.id as any, x: r.left, y: r.bottom + 6 });
                            }}
                          >
                            <Zap className="w-3 h-3 mr-0.5 opacity-80" />
                            {fx.name}
                          </button>
                        ))}
                      </div>

                      {/* toggles row: envelope editor + fade handles */}
                      <div className="hidden items-center gap-1 mt-1 lg:flex">
                        {/* Envelope edit toggle */}
                        <button
                          className={`grid place-items-center w-6 h-6 rounded-md ${envTracks.has(String(t.id)) ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'} active:scale-95`}
                          title={envTracks.has(String(t.id)) ? 'Hide Envelope Editor' : 'Show Envelope Editor'}
                          onClick={() => toggleEnvTrack(String(t.id))}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 17l5-6 4 3 6-8 3 2" stroke="#fff" strokeWidth="2" fill="none" /></svg>
                        </button>
                        <button
                          className={`grid place-items-center w-6 h-6 rounded-md bg-slate-700 opacity-50 cursor-not-allowed`}
                          title={'Fades disabled'}
                          onClick={(e) => { e.preventDefault(); }}
                          disabled
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#0b1220" /></linearGradient></defs><path d="M3 5h4v14H3zM9 5h12v14H9z" fill="url(#g1)" /></svg>
                        </button>
                        {/* Selection tool toggle removed */}
                      </div>

                    </div>
                    {/* tiny separators */}

                    {/* Add Track button pinned at bottom of the last lane's panel */}
                    {ti === tracks.length - 1 && onAddTrack && (
                      <button
                        className="absolute bottom-[-35px] left-2 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white grid place-items-center shadow-md"
                        title="Add New Track"
                        aria-label="Add New Track"
                        onClick={(e) => {
                          e.stopPropagation();
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setAddPop({ x: r.left, y: r.bottom + 8 });
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    )}


                  </div>
                </div>
              </div>


              {/* Volume guide labels (top=+6dB, mid=0dB, bottom=silence) */}
              <div className="absolute" style={{ left: laneInfoW, right: 0, top: Math.round(heightPerTrack * 0.15) + 'px', height: '1px', background: 'rgba(190, 242, 100, 0.25)' }} />
              <div className="absolute" style={{ left: laneInfoW, right: 0, top: Math.round(heightPerTrack * 0.50) + 'px', height: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div className="absolute" style={{ left: laneInfoW, right: 0, top: Math.round(heightPerTrack * 0.85) + 'px', height: '1px', background: 'rgba(190,190,190,0.2)' }} />
              <div className="absolute left-2" style={{ top: Math.round(heightPerTrack * 0.15) - 12 + 'px', color: '#bef264', fontSize: '12px' }}>+6 dB</div>
              <div className="absolute left-2" style={{ top: Math.round(heightPerTrack * 0.50) - 12 + 'px', color: 'rgba(255,255,255,0.75)', fontSize: '12px' }}>0 dB</div>
              <div className="absolute left-2" style={{ top: Math.round(heightPerTrack * 0.85) - 12 + 'px', color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>Silence</div>
              {/* Mobile quick toggles: Envelope + Fades */}
              <div className="absolute md:hidden flex items-center gap-1" style={{ left: window.innerWidth > 1000 ? laneInfoW + 8 : 0, top: 24, zIndex: 3003 }}>
                <button className={`grid place-items-center w-6 h-6 rounded-md ${envTracks.has(String(t.id)) ? 'bg-amber-600' : 'bg-slate-700'} active:scale-95`} title={envTracks.has(String(t.id)) ? 'Hide Envelope' : 'Show Envelope'} onClick={() => toggleEnvTrack(String(t.id))}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><path d="M3 17l5-6 4 3 6-8 3 2" stroke="#fff" strokeWidth="2" fill="none" /></svg>
                </button>
                <button className={`grid place-items-center w-6 h-6 rounded-md ${fadeTracks.has(String(t.id)) ? 'bg-emerald-600' : 'bg-slate-700'} active:scale-95`} title={fadeTracks.has(String(t.id)) ? 'Hide Fades' : 'Show Fades'} onClick={() => toggleFadeTrack(String(t.id))}>
                  <svg viewBox="0 0 24 24" width="14" height="14"><defs><linearGradient id="g1m" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#22c55e" /><stop offset="100%" stopColor="#0b1220" /></linearGradient></defs><path d="M3 5h4v14H3zM9 5h12v14H9z" fill="url(#g1m)" /></svg>
                </button>
                {/* Selection tool toggle removed (mobile) */}
                <button
                  className={`grid place-items-center w-6 h-6 rounded-md ${freezeTouch ? 'bg-sky-600' : 'bg-slate-700'} active:scale-95`}
                  title={freezeTouch ? 'Disable Touch Fade Mode' : 'Enable Touch Fade Mode'}
                  onClick={() => onToggleFreezeTouch?.(!freezeTouch)}
                >
                  {freezeTouch ? <TouchpadOff className="w-3.5 h-3.5 text-white" /> : <Touchpad className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
              {/* Mobile fade +/- controls removed. Tap/drag on the waveform to set fades while Touch Fade Mode is enabled or fades are visible. */}

              {/* Envelope overlay (drawn and translated with scrollX) */}
              <TrackEnvelopeOverlay trackId={t.id as any} height={heightPerTrack}
                laneLeft={laneInfoW} scrollX={scrollX} pxPerSec={pxPerSec} width={viewW}
                enabled={envTracks.has(String(t.id))} />
              {/* Clips */}
              {t.clips.map(c => {
                let beginForUi = Number.isFinite(c.beginTime) ? c.beginTime : 0;
                const pend = pendingMoveRef.current.get(String(c.id));
                if (pend && String(pend.trackId) === String(t.id)) beginForUi = pend.begin;
                // Apply live trim preview overrides if any
                let renderBegin = c.beginTime;
                let renderEnd = c.beginTime + c.durationSec;
                try {
                  const live = liveTrimRef.current.get(String(c.id));
                  if (live) { renderBegin = live.begin; renderEnd = live.end; beginForUi = live.begin; }
                } catch { }
                const left = Math.max(0, Math.floor(beginForUi * pxPerSec + 1e-6));
                const widthPx = Math.max(12, Math.ceil(Math.max(0.001, (renderEnd - renderBegin)) * pxPerSec - 1e-6));
                // Seed base bounds the first time we see this clip in the session
                try {
                  if (!originalBoundsRef.current.has(String(c.id))) {
                    originalBoundsRef.current.set(String(c.id), { begin: c.beginTime, end: c.beginTime + c.durationSec });
                  }
                } catch { }
                const base = originalBoundsRef.current.get(String(c.id)) || { begin: c.beginTime, end: c.beginTime + c.durationSec };
                const baseWidthPx = Math.max(12, Math.round((base.end - base.begin) * pxPerSec));
                // Ensure we have an original waveform snapshot for this clip
                ensureOriginalWave(String(t.id), String(c.id), baseWidthPx, c);
                // Prefer full original cached data (resolution adapts on zoom); fallback to live/getWave
                const entry = originalWaveCache.current.get(String(c.id));
                const waveFull = (entry && entry.data && entry.data.length ? entry.data : undefined) || getWave(t.id, c.id, c, widthPx);
                return (
                  <div key={c.id} data-clip={c.id}
                    onPointerDown={(e) => onPointerDownClip(e, t.id, c.id, c.beginTime, c.beginTime + c.durationSec)}
                    onClick={(e) => {
                      onSelectClip && onSelectClip(t.id, c.id);
                      const targetEl = e.target as HTMLElement;
                      if (targetEl?.getAttribute('data-handle') || targetEl?.getAttribute('data-fade-left') || targetEl?.getAttribute('data-fade-right')) return;
                    }}
                    className={`absolute z-10 rounded-lg overflow-hidden cursor-grab will-change-[transform,width,left] transition-all duration-150 ${selectedClipId === c.id ? 'bg-slate-800/80' : 'bg-slate-800/60'}`}
                    style={{
                      left: (Number.isFinite(left) ? left : 0) + laneInfoW - scrollX,
                      top: 8,
                      height: heightPerTrack - 16 + 'px',
                      width: Number.isFinite(widthPx) ? widthPx : 12,
                      border: selectedClipId === c.id ? '2px solid #38bdf8' : '1px solid rgba(255,255,255,0.18)',
                      boxShadow: selectedClipId === c.id
                        ? '0 0 0 2px rgba(56,189,248,0.35), 0 10px 20px rgba(2,6,23,0.65)'
                        : '0 6px 14px rgba(0,0,0,0.45)'
                    }}>
                    {/* Speed badge removed */}
                    {/* Selection button removed */}
                    {/* Left trim handle as a visible button */}
                    <div
                      data-handle="left"
                      style={{
                        position: 'absolute', left: -2, top: 0, bottom: 0,
                        width: 12,
                        cursor: freezeTouch ? 'default' : 'ew-resize',
                        background: 'linear-gradient(to right, rgba(234,179,8,0.8), rgba(234,179,8,0.2))',
                        borderRight: '1px solid rgba(0,0,0,0.25)',
                        borderRadius: '8px 4px 4px 8px',
                        zIndex: 300
                      }}
                      onPointerDown={(e) => onPointerDownClip(e, t.id, c.id, c.beginTime, c.beginTime + c.durationSec)}
                      title="Drag to trim/extend from start"
                    />

                    {(() => {
                      // Visible slice for CURRENT TRIMMED WINDOW using original full-resolution data
                      const vw = topScrollRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
                      const clipLeftAbs = laneInfoW + left; // content-space x of clip start
                      const viewStart = scrollX;
                      const viewEnd = scrollX + vw;
                      const isMovingThis = movingClipId === String(c.id);
                      const isTrimmingThis = !!(dragRef.current && (dragRef.current as any).clipId && (dragRef.current as any).mode && ((dragRef.current as any).mode === 'trim-left' || (dragRef.current as any).mode === 'trim-right') && String((dragRef.current as any).clipId) === String(c.id));
                      // Ensure waveform stays rendered while trimming/moving at high zoom (border cases can misclassify intersection)
                      const intersects = isMovingThis || isTrimmingThis || ((clipLeftAbs < viewEnd) && ((clipLeftAbs + Math.max(1, widthPx)) >= viewStart));
                      if (!intersects) return null;
                      const hiddenLeftPx = isMovingThis ? 0 : Math.max(0, Math.ceil(viewStart - clipLeftAbs));
                      const visibleWidthRaw = isMovingThis ? widthPx : Math.max(0, widthPx - hiddenLeftPx);
                      // While moving, render full clip width so the viewport shows the correct portion as the element translates
                      const visibleWidth = Math.max(1, Math.floor(isMovingThis ? widthPx : Math.min(visibleWidthRaw, vw)));

                      let windowData: Float32Array | undefined;
                      try {
                        const baseBegin0 = base.begin; const baseEnd0 = base.end;
                        windowData = sliceOriginalWave(String(c.id), baseBegin0, baseEnd0, renderBegin, renderEnd);
                      } catch { windowData = undefined; }
                      // Fallbacks
                      if (!windowData || windowData.length === 0) windowData = waveFull;
                      // Extra guard while moving at high zoom: fetch a quick slice directly if cache is empty
                      if ((!windowData || windowData.length === 0) && isMovingThis) {
                        try {
                          const want = Math.max(256, Math.min(4096, Math.floor(visibleWidth)));
                          if (getClipWaveform) windowData = getClipWaveform(String(t.id), String(c.id), want);
                        } catch { /* ignore */ }
                      }
                      // If still empty, reuse the last slice rendered for this clip
                      if ((!windowData || windowData.length === 0)) {
                        const prev = lastSliceRef.current.get(String(c.id));
                        if (prev && prev.length) windowData = prev;
                      }

                      // Crop the window data to the visible portion in seconds (unless moving, then draw full window)
                      let slice: Float32Array | undefined = windowData;
                      try {
                      if (windowData && windowData.length > 0 && !isMovingThis) {
                        const segDurSec = Math.max(1e-6, (renderEnd - renderBegin));
                        const hiddenLeftSec = hiddenLeftPx / Math.max(1e-6, pxPerSec);
                        const visibleSec = Math.max(1e-6, Math.min(segDurSec - hiddenLeftSec, visibleWidth / Math.max(1e-6, pxPerSec)));
                        const totalPoints = wavePointCount(windowData);
                        const totalN = totalPoints - 1;
                        const sIdx = Math.max(0, Math.floor((hiddenLeftSec / segDurSec) * totalN));
                        const eIdx = Math.max(sIdx + 1, Math.min(totalPoints, Math.ceil(((hiddenLeftSec + visibleSec) / segDurSec) * totalN)));
                        slice = windowData.subarray(sIdx * 2, eIdx * 2);
                      }
                      } catch { /* keep slice */ }

                      // Force canvas remount when any of these change
                      const waveKey = `${String(c.id)}:${Math.round(renderBegin * 1000)}:${Math.round(renderEnd * 1000)}:${visibleWidth}:${Math.round(scrollX)}:${Math.round(pxPerSec)}:${isMovingThis ? 'mv' : 'st'}`;
                      // Cache the latest good slice
                      try { if (windowData && windowData.length) lastSliceRef.current.set(String(c.id), windowData); } catch {}
                      // Avoid giant canvases while moving at high zoom: draw a capped canvas and scale to width
                      const maxDraw = Math.max(2048, Math.floor(vw * 2));
                      const drawWidth = isMovingThis ? Math.max(1, Math.min(visibleWidth, maxDraw)) : visibleWidth;
                      const scaleX = isMovingThis ? (visibleWidth / Math.max(1, drawWidth)) : 1;
                      return (
                        <div style={{ position: 'absolute', left: hiddenLeftPx, top: 0, right: 'auto', bottom: 0, transform: scaleX !== 1 ? `scaleX(${scaleX})` : undefined, transformOrigin: 'left top' }}>
                          <WaveCanvas key={waveKey} width={drawWidth} height={heightPerTrack - 16} data={slice} />
                        </div>
                      );
                    })()}
                    {/* Fade overlays */}

                    {/* Trim preview overlays (static waveform, highlight deltas) */}
                    {(() => {
                      const pv = trimPreviewRef.current.get(String(c.id));
                      if (!pv || (pv.leftPx <= 0 && pv.rightPx <= 0)) return null;
                      const leftW = Math.max(0, Math.min(widthPx, pv.leftPx | 0));
                      const rightW = Math.max(0, Math.min(widthPx - leftW, pv.rightPx | 0));
                      return (
                        <>
                          {leftW > 0 && (
                            <>
                              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: leftW, background: 'rgba(2,6,23,0.45)', pointerEvents: 'none' }} />
                              <div style={{ position: 'absolute', left: Math.max(0, leftW - 1), top: 0, bottom: 0, width: 2, background: 'rgba(59,130,246,0.85)', pointerEvents: 'none' }} />
                            </>
                          )}
                          {rightW > 0 && (
                            <>
                              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: rightW, background: 'rgba(2,6,23,0.45)', pointerEvents: 'none' }} />
                              <div style={{ position: 'absolute', right: Math.max(0, rightW - 1), top: 0, bottom: 0, width: 2, background: 'rgba(59,130,246,0.85)', pointerEvents: 'none' }} />
                            </>
                          )}
                        </>
                      );
                    })()}

                    {/* When fades are hidden, show clip start/end times instead of fade durations */}
                    {fadeTracks.has(String(t.id)) && (
                      <>
                        <div
                          style={{ position: 'absolute', left: 6, bottom: 6, fontSize: 10, color: '#052e16', background: 'rgba(34,197,94,0.85)', padding: '2px 4px', borderRadius: 4, pointerEvents: 'none' }}
                          title={`Clip Start: ${fmt(c.beginTime, true)}`}
                        >
                          {fmt(c.beginTime, true)}
                        </div>
                        <div
                          style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 10, color: '#0b1a36', background: 'rgba(59,130,246,0.85)', padding: '2px 4px', borderRadius: 4, pointerEvents: 'none' }}
                          title={`Clip End: ${fmt(c.beginTime + c.durationSec, true)}`}
                        >
                          {fmt(c.beginTime + c.durationSec, true)}
                        </div>
                      </>
                    )}

                    {/* Range selection overlay removed */}
                    {/* Right trim handle as a visible button */}
                    <div
                      data-handle="right"
                      style={{
                        position: 'absolute', right: -2, top: 0, bottom: 0,
                        width: 12,
                        cursor: freezeTouch ? 'default' : 'ew-resize',
                        background: 'linear-gradient(to left, rgba(59,130,246,0.8), rgba(59,130,246,0.2))',
                        borderLeft: '1px solid rgba(0,0,0,0.25)',
                        borderRadius: '4px 8px 8px 4px'
                      }}
                      onPointerDown={(e) => onPointerDownClip(e, t.id, c.id, c.beginTime, c.beginTime + c.durationSec)}
                      title="Drag to trim/extend from end"
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        {/* Bottom scroll area synced to content */}
        <div
          ref={topScrollRef}
          className='scroll-class'
          style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', overscrollBehavior: 'contain', touchAction: 'pan-x' }}
          onPointerDown={(e) => { /* keep native scroll; avoid pinch/drag handlers above */ e.stopPropagation(); }}
          onMouseMove={(e) => {
            const cont = topScrollRef.current; if (!cont) return;
            const rect = cont.getBoundingClientRect();
            const x = e.clientX - rect.left; // viewport x
            const contentX = x + scrollX;    // add scroll offset
            const sec = (contentX - laneInfoW) / Math.max(1e-6, pxPerSec);
            if (Number.isFinite(sec) && sec >= 0) setHoverSec(sec); else setHoverSec(null);
          }}
          onMouseLeave={() => setHoverSec(null)}
        >
          {/* filler to create scrollbar width */}
          <div style={{ width: fullWidth, height: '18px' }} />
        </div>

        {/* Zoom moved to footer */}
        {/* Overlays: FX inspector and Volume popover */}
        {fxPop && (
          <FXFloatingPanel
            x={fxPop.x}
            y={fxPop.y}
            title="Effect Parameters"
            onClose={() => setFxPop(null)}
            time={time}
            onPause={onPause}
          >
            <EffectsInspector
              tracks={tracks.map((tt: any) => ({ id: tt.id as any, name: (tt as any).name || 'Track' }))}
              listTrackEffectsDetailed={(id) => listTrackEffectsDetailed?.(id) || []}
              setTrackEffectField={(id, idx, field, value) => setTrackEffectField?.(id, idx, field, value)}
              initialTrackId={fxPop.trackId}
              listEffects={listEffects}
              addTrackEffect={(tid, effId) => addTrackEffect?.(tid, effId)}
              removeTrackEffect={(tid, idx) => removeTrackEffect?.(tid, idx)}
            />
          </FXFloatingPanel>
        )}
        {volPop && (
          <FXFloatingPanel x={volPop.x} y={volPop.y} width={260} title="Volume" onClose={() => setVolPop(null)}>
            {(() => {
              const track = tracks.find(tt => String(tt.id) === String(volPop.trackId));
              const gain = track?.gain?.gain?.value ?? 1;
              const toDb = (g: number) => g <= 0 ? -60 : Math.max(-60, Math.min(12, 20 * Math.log10(g)));
              const db = toDb(gain);
              return (
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-300 w-10 text-right">-60</div>
                  <input className="mm-range flex-1" type="range" min={0} max={2} step={0.01} value={gain} onChange={(e) => onTrackGain?.(volPop.trackId, parseFloat(e.target.value))} />
                  <div className="text-xs text-slate-300 w-8">12</div>
                  <div className="text-right w-14 tabular-nums text-emerald-300">{db.toFixed(1)} dB</div>
                </div>
              );
            })()}
            <div className="mt-2 text-right">
              <button className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700" onClick={() => onTrackGain?.(volPop.trackId, 1)}>Reset</button>
            </div>
          </FXFloatingPanel>
        )}
        {/* Add-Track quick menu */}
        {addPop && (
          <div
            ref={addPopRef}
            className="fixed z-[5002]"
            style={{ left: Math.round(addPop.x), top: Math.round(addPop.y) }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              className="rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl p-2 min-w-[180px]"
              style={{
                transformOrigin: 'left top',
                transform: addPopOpen ? 'scale(1) translateY(0px)' : 'scale(0.96) translateY(-4px)',
                opacity: addPopOpen ? 1 : 0,
                transition: 'opacity 120ms ease, transform 120ms ease'
              }}
            >
              <div className="text-xs font-semibold text-slate-300 px-1 pb-1">Add Track</div>
              <div className="flex flex-col gap-1">
                <button
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm text-left"
                  onClick={() => { try { onAddTrack?.(); } catch {} setAddPop(null); }}
                >
                  + Empty Track
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm text-left"
                  onClick={() => { try { importInputRef.current?.click(); } catch {} }}
                >
                  Import Audio…
                </button>
                <button
                  className="px-2 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-sm text-left"
                  onClick={() => { try { (window as any).mix_recordClick?.(); } catch {} setAddPop(null); }}
                >
                  Record
                </button>
                {/* hidden file input */}
                <input
                  ref={importInputRef}
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    if (files && files.length) {
                      try { (window as any).mix_importAudio?.(files); } catch {}
                    }
                    try { (e.currentTarget as any).value = ''; } catch {}
                    setAddPop(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    
  );
}

// Envelope overlay: fetches points from legacy/minimal engine via window.api hooks exposed in App through engine
function TrackEnvelopeOverlay({ trackId, height, laneLeft, scrollX, pxPerSec, width, enabled = false }: { trackId: string; height: number; laneLeft: number; scrollX: number; pxPerSec: number; width: number; enabled?: boolean }) {
  const drawRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLCanvasElement>(null);
  const [pts, setPts] = useState<Array<{ time: number; value: number }>>([]);
  const longPressRef = useRef<number | null>(null);

  // Fetch getter/setter from window wiring (App passes engine methods on window for Timeline usage)
  const getPts = (window as any).mix_getTrackEnvPts as undefined | ((id: string) => Array<{ time: number; value: number }>);
  const setPtsApi = (window as any).mix_setTrackEnvPts as undefined | ((id: string, p: Array<{ time: number; value: number }>) => void);

  // Local unlimited-point cache (engine may downsample/limit). Keep full-resolution points per track id.
  const cache: Map<string, Array<{ time: number; value: number }>> = ((): any => {
    const w = window as any;
    if (!w.__mix_env_cache) w.__mix_env_cache = new Map();
    return w.__mix_env_cache;
  })();

  useEffect(() => {
    // Prefer local cache if we have it; otherwise seed from engine and cache
    try {
      if (cache.has(trackId)) {
        setPts([...(cache.get(trackId) || [])]);
      } else if (typeof getPts === 'function') {
        const fromEngine = getPts(trackId) || [];
        cache.set(trackId, [...fromEngine]);
        setPts([...fromEngine]);
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackId]);

  // Draw (only when enabled)
  useEffect(() => {
    if (!enabled) return;
    const canvas = drawRef.current; if (!canvas) return; const w = Math.max(1, Math.ceil(width || (window.innerWidth || 1200))); const h = height;
    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    // Translate so x=0 aligns to laneLeft and scrollX
    ctx.save();
    ctx.translate(laneLeft - scrollX, 0);
    // Draw static center baseline (0 dB)
    {
      const midY = Math.round(height * 0.50);
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(Math.max(0, Math.ceil(width)), midY);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Build path
    const path = new Path2D();
    const line = (t: number) => Math.round((t) * pxPerSec);
    // Center-line mapping: v=1 at mid, v=0 bottom band, v=2 top band
    const valToY = (v: number) => {
      const minY = Math.round(height * 0.15); const maxY = Math.round(height * 0.85); const midY = Math.round(height * 0.50);
      const clamped = Math.max(0, Math.min(2, v));
      return midY - (clamped - 1) * ((maxY - minY) / 2);
    };
    const sorted: Array<{ time: number; value: number }> = [...(pts as any || [])].sort((a: any, b: any) => a.time - b.time);
    const all: Array<{ time: number; value: number }> = sorted.length > 0 ? sorted : [{ time: 0, value: 1 }];
    if (all.length > 0) {
      // Extend from start (t=0) using the first point's value
      const first = all[0]!;
      const firstY = valToY(first.value);
      path.moveTo(0, firstY);
      const firstX = line(first.time);
      if (firstX > 0) path.lineTo(firstX, firstY);
      // Connect through all points
      for (let i = 0; i < all.length; i++) {
        path.lineTo(line(all[i]!.time), valToY(all[i]!.value));
      }
      // Extend flat to the end of the canvas
      const last = all[all.length - 1]!;
      const lastY = valToY(last.value);
      const endX = Math.max(line(last.time), Math.ceil(width));
      path.lineTo(endX, lastY);
    }
    ctx.strokeStyle = '#a3e635'; ctx.lineWidth = 2; ctx.stroke(path);
    // Draw small points
    ctx.fillStyle = '#bef264';
    for (const p of all) { ctx.beginPath(); ctx.arc(line(p.time), valToY(p.value), 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }, [pts, height, laneLeft, scrollX, pxPerSec, width, enabled]);

  // Basic editing: click adds/moves near point; Alt+click on a point removes
  const pickIndex = (x: number, yAbs: number, tolerance: number = 4) => {
    const toLocalX = x - (laneLeft - scrollX);
    const t = toLocalX / pxPerSec; // sec
    const minDist = Math.max(1, tolerance);
    let idx = -1; let best = Infinity;
    const valToY = (v: number) => { const minY = Math.round(height * 0.15); const maxY = Math.round(height * 0.85); const midY = Math.round(height * 0.50); const clamped = Math.max(0, Math.min(2, v)); return midY - (clamped - 1) * ((maxY - minY) / 2); };
    (pts as any[]).forEach((p: any, i: number) => { const px = (p.time || 0) * pxPerSec; const py = valToY(p.value || 1); const d = Math.hypot(px - toLocalX, py - yAbs); if (d < minDist && d < best) { best = d; idx = i; } });
    return { idx, t };
  };
  const dragRef = useRef<{ idx: number; startX: number; startY: number; start: { time: number; value: number } } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const yAbs = e.clientY - rect.top; // full lane height
    const tol = (e as any).pointerType === 'touch' ? 12 : 4;
    const { idx, t } = pickIndex(x, yAbs, tol);
    // Desktop: Alt+click removes. Mobile: long-press removes.
    if (idx >= 0 && e.altKey) {
      const next = [...pts]; next.splice(idx, 1); setPts(next); try { cache.set(trackId, next); } catch { }; setPtsApi?.(trackId, next); return;
    }
    if (idx >= 0 && !e.shiftKey) {
      dragRef.current = { idx, startX: x, startY: yAbs, start: { ...((pts as any[])[idx]) } };
      (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
      // Setup long-press to remove on touch
      if ((e as any).pointerType === 'touch') {
        try { if (longPressRef.current) window.clearTimeout(longPressRef.current as any); } catch { }
        longPressRef.current = window.setTimeout(() => {
          const next = [...pts]; next.splice(idx, 1); setPts(next); try { cache.set(trackId, next); } catch { }; setPtsApi?.(trackId, next);
          dragRef.current = null;
        }, 550) as any;
      }
      return;
    }
    const valToYInv = (yy: number) => { const minY = Math.round(height * 0.15); const maxY = Math.round(height * 0.85); const midY = Math.round(height * 0.50); const clampedY = Math.max(minY, Math.min(maxY, yy)); const ratio = (midY - clampedY) / ((maxY - minY) / 2); return Math.max(0, Math.min(2, 1 + ratio)); };
    // Add new point snapped to center (0 dB) initially; user can drag to adjust
    const v = 1; // center line
    const next = [...pts, { time: Math.max(0, t), value: v }].sort((a, b) => a.time - b.time);
    setPts(next); try { cache.set(trackId, next); } catch { }; setPtsApi?.(trackId, next);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current; if (!d) return;
    e.preventDefault();
    // Moving cancels any pending long-press delete
    if (longPressRef.current) { try { window.clearTimeout(longPressRef.current as any); } catch { }; longPressRef.current = null; }
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left; const yAbs = e.clientY - rect.top;
    const toLocalX = x - (laneLeft - scrollX);
    const valToYInv = (yy: number) => { const minY = Math.round(height * 0.15); const maxY = Math.round(height * 0.85); const midY = Math.round(height * 0.50); const clampedY = Math.max(minY, Math.min(maxY, yy)); const ratio = (midY - clampedY) / ((maxY - minY) / 2); return Math.max(0, Math.min(2, 1 + ratio)); };
    const t = Math.max(0, toLocalX / pxPerSec);
    const v = valToYInv(yAbs);
    const next = [...(pts as any[])]; next[d.idx] = { time: t, value: v }; (next as any[]).sort((a: any, b: any) => a.time - b.time);
    setPts(next); try { cache.set(trackId, next); } catch { }
  };
  const onUp = () => {
    if (longPressRef.current) { try { window.clearTimeout(longPressRef.current as any); } catch { }; longPressRef.current = null; }
    if (dragRef.current) { try { cache.set(trackId, pts); } catch { }; setPtsApi?.(trackId, pts); dragRef.current = null; }
  };

  // Render canvases: both canvases cover the full lane height so editing happens directly over the waveform
  if (!enabled) return null;
  return (
    <>
      <canvas ref={drawRef} style={{ position: 'absolute', left: 0, width: width + 'px', top: 0, height: height + 'px', pointerEvents: 'none', zIndex: 3001 }} />
      <canvas
        ref={hitRef}
        className=' '
        style={{ position: 'absolute', left: 0, width: width + 'px', top: 0, height: height + 'px', pointerEvents: 'auto', zIndex: 3002, touchAction: 'none', cursor: 'crosshair' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
    </>
  );
}

function BarCell({ left, width, beatsPerMeasure, minorPerBeat, label }: { left: number; width: number; beatsPerMeasure: number; minorPerBeat: number; label: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    const h = 12;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    const totalMinor = Math.max(1, Math.floor(beatsPerMeasure) * Math.max(1, Math.floor(minorPerBeat)));
    ctx.strokeStyle = 'rgba(148,163,184,0.55)';
    ctx.beginPath();
    for (let i = 1; i < totalMinor; i++) {
      const x = Math.round((i / totalMinor) * width) + 0.5;
      const isBeat = (i % Math.max(1, Math.floor(minorPerBeat)) === 0);
      const top = isBeat ? 0 : 6;
      ctx.moveTo(x, top);
      ctx.lineTo(x, h);
    }
    ctx.stroke();
  }, [width, beatsPerMeasure, minorPerBeat]);

  return (
    <div style={{ position: 'absolute', left, top: 0, width, height: 32, pointerEvents: 'none' }}>
      {/* Major bar tick: taller than sub-ticks so labeled bars stand out */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 2,
          height: 20,
          backgroundColor: 'rgba(255,255,255,0.8)'
        }}
      />
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: width, height: 12 }}>
        <canvas ref={ref} style={{ width: width + 'px', height: '12px' }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 2, transform: 'translateX(-50%)', color: '#e5e7eb', fontSize: 11, fontWeight: 600, textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
        {label}
      </div>
    </div>
  );
}

function SecondCell({ left, width, second, pxPerSec, minorPerMajor, majorSec, showLabel, label }: { left: number; width: number; second: number; pxPerSec: number; minorPerMajor: number; majorSec: number; showLabel?: boolean; label?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  React.useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    const h = 12;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, h);
    // Match background grid: draw minor ticks derived from legacy scale
    const subdiv = Math.max(1, Math.round((width / Math.max(1e-6, pxPerSec)) / Math.max(1e-6, majorSec) * Math.max(1, minorPerMajor)));
    const stepPx = Math.max(1, Math.round((majorSec * pxPerSec) / Math.max(1, minorPerMajor)));
    ctx.strokeStyle = 'rgba(148,163,184,0.5)';
    ctx.beginPath();
    for (let i = 1; i < subdiv; i++) {
      const x = Math.min(width - 1, i * stepPx) + 0.5;
      const tall = (i % Math.max(1, Math.floor(subdiv / 2)) === 0);
      const mid = (i % Math.max(1, Math.floor(subdiv / 4)) === 0);
      const top = tall ? 0 : (mid ? 3 : 6);
      ctx.moveTo(x, top);
      ctx.lineTo(x, h);
    }
    ctx.stroke();
  }, [width, pxPerSec, minorPerMajor, majorSec]);

  const labelText = label ?? fmt(second, false);

  return (
    <div style={{ position: 'absolute', left, top: 0, width, height: 32, pointerEvents: 'none' }}>
      {/* left-edge major tick handled by canvas/grid; we render sub-degrees here */}
      {/* Emphasize labeled seconds with a taller major tick (where snapping/playhead sticks) */}
      {showLabel && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: 2,
            height: 13,
            backgroundColor: 'rgba(255,255,255,0.85)'
          }}
        />
      )}
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: width, height: 12 }}>
        <canvas ref={ref} style={{ width: width + 'px', height: '12px' }} />
      </div>
      {showLabel && (
        <div style={{ position: 'absolute', left: 0, top: 2, transform: 'translateX(-50%)', color: '#e5e7eb', fontSize: 11, fontWeight: 600, textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>
          {labelText}
        </div>
      )}
    </div>
  );
} function WaveCanvas({ width, height, data }: { width: number; height: number; data?: Float32Array }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = Math.max(1, Math.min(3, (window.devicePixelRatio || 1)));
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#0b1220'); bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    if (!data || data.length === 0) return;
    const samples = Math.max(1, Math.floor(data.length / 2));
    const mid = height / 2;
    const amp = 0.8; // make waveform a little smaller
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let x = 0; x < width; x++) {
      const pos = (x / Math.max(1, width)) * (samples - 1);
      const i0 = Math.floor(pos);
      const i1 = Math.min(samples - 1, i0 + 1);
      const t = pos - i0;
      const hi0 = clampWave(data[i0 * 2 + 1]); const hi1 = clampWave(data[i1 * 2 + 1]);
      const hi = hi0 + (hi1 - hi0) * t; // linear interpolate for smoother curve
      ctx.lineTo(x, mid - hi * mid * amp);
    }
    for (let x = width - 1; x >= 0; x--) {
      const pos = (x / Math.max(1, width)) * (samples - 1);
      const i0 = Math.floor(pos);
      const i1 = Math.min(samples - 1, i0 + 1);
      const t = pos - i0;
      const lo0 = clampWave(data[i0 * 2]); const lo1 = clampWave(data[i1 * 2]);
      const lo = lo0 + (lo1 - lo0) * t;
      ctx.lineTo(x, mid - lo * mid * amp);
    }
    ctx.closePath();
    ctx.fillStyle = '#a7f3d0';
    ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; ctx.stroke();
  }, [width, height, data]);
  return <canvas ref={ref} style={{ display: 'block', width: width + 'px', height: height + 'px' }} />
}

// Small draggable triangle positioned above the playhead. Emits clientX while dragging.
function PlayheadHandle({ x, onDragTo, onDragState }: { x: number; onDragTo: (clientX: number) => void; onDragState?: (dragging: boolean) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const draggingRef = React.useRef<boolean>(false);
  const pidRef = React.useRef<number | null>(null);

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    draggingRef.current = true; pidRef.current = (e as any).pointerId ?? null;
    try { (e.currentTarget as any).setPointerCapture?.((e as any).pointerId); } catch {}
    onDragState?.(true);
    onDragTo(e.clientX);
    const move = (ev: PointerEvent) => { if (!draggingRef.current) return; onDragTo(ev.clientX); };
    const up = (ev: PointerEvent) => {
      draggingRef.current = false; onDragState?.(false);
      try { (ref.current as any)?.releasePointerCapture?.(pidRef.current as any); } catch {}
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  };

  const size = 20; // triangle width
  const color = '#22d3ee'; // cyan-400 like
  return (
    <div style={{ position: 'absolute', left: x, top: "10px", transform: 'translateX(-40%)', height: 24, pointerEvents: 'none' }}>
      <div ref={ref} onPointerDown={onDown} style={{ pointerEvents: 'auto', cursor: 'ew-resize', touchAction: 'none', padding: '4px 8px' }} aria-label="Move playhead">
        <svg width={size} height={20} viewBox="0 0 12 12">
          <polygon points="5,0 10,10 0,10" fill={color} stroke="#0e7490" strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

// function pickNiceStep(pxPerSec: number) {
//   // Prefer readable labels at high zoom, match 5s cadence like DAWs
//   if (pxPerSec >= 160) return 5;
//   // Otherwise aim ~80px per label using nice steps
//   const targetPx = 80;
//   const s = targetPx / pxPerSec;
//   const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
//   for (const st of steps) if (st >= s) return st;
//   return 600;
// }
// function pickSnap(pxPerSec: number) {
//   // Finer snapping at high zoom for small time-domain edits
//   if (pxPerSec >= 2000) return 0.001; // 1 ms
//   if (pxPerSec >= 1000) return 0.002; // 2 ms
//   if (pxPerSec >= 500) return 0.005;  // 5 ms
//   if (pxPerSec >= 200) return 0.01;   // 10 ms
//   if (pxPerSec >= 120) return 0.02;   // 20 ms
//   if (pxPerSec >= 80) return 0.05;    // 50 ms
//   if (pxPerSec >= 40) return 0.1;     // 100 ms
//   return 0.25;                        // 250 ms
// }
// function formatTime(s: number) {
//   const m = Math.floor(s / 60); const ss = Math.floor(s % 60).toString().padStart(2, '0');
//   return `${m}:${ss}`;
// }
// --- time grid helpers (place once in Timeline.tsx) ---
function pickNiceStep(pxPerSec: number): number {
  const targetPx = 110;                     // ~label spacing in px
  const raw = targetPx / Math.max(1, pxPerSec);
  const nice: number[] = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
  let best: number = nice[0]!;
  for (const s of nice) if (Math.abs(s - raw) < Math.abs(best - raw)) best = s;
  return best;
}
function formatTime(sec: number): string {
  if (!Number.isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec - Math.floor(sec)) * 1000);
  return (sec < 60 && ms > 0)
    ? `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function pickSnap(pxPerSec: number): number {
  // grid-snap equal to a smaller subdivision of the main step
  const step = pickNiceStep(pxPerSec);
  if (step >= 1) return step / 4;     // quarter-second or more
  if (step >= 0.1) return step / 5;   // 20 ms – 100 ms
  return 0.01;                        // min 10 ms
}


function downsampleBuffer(buf: AudioBuffer, offsetSec: number, durationSec: number, points: number): Float32Array {
  const sr = buf.sampleRate; const start = Math.floor(offsetSec * sr); const end = Math.min(buf.length, Math.floor((offsetSec + durationSec) * sr));
  const length = Math.max(0, end - start); if (length <= 0) return new Float32Array(0);
  const stride = Math.max(1, Math.floor(length / points));
  const out = new Float32Array(points * 2); const chs = buf.numberOfChannels;
  for (let p = 0; p < points; p++) {
    const begin = start + p * stride; const stop = Math.min(end, begin + stride);
    let minV = 1, maxV = -1;
    for (let i = begin; i < stop; i++) {
      let sum = 0; for (let c = 0; c < chs; c++) sum += (buf.getChannelData(c)[i] || 0);
      const v = sum / Math.max(1, chs);
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    if (stop <= begin) { minV = 0; maxV = 0; }
    out[p * 2] = clampWave(minV);
    out[p * 2 + 1] = clampWave(maxV);
  }
  return out;
}

function clampWave(v: number | undefined): number { return Math.max(-1, Math.min(1, v || 0)); }

function normalizeWaveform(raw?: Float32Array): Float32Array {
  if (!raw) return new Float32Array(0);
  const hasNegative = raw.some(v => v < -1e-4);
  const hasPairs = raw.length % 2 === 0 && hasNegative;
  if (hasPairs) return raw;
  const out = new Float32Array(raw.length * 2);
  for (let i = 0; i < raw.length; i++) {
    const v = clampWave(raw[i]);
    const mag = Math.abs(v);
    out[i * 2] = -mag; // min
    out[i * 2 + 1] = mag; // max
  }
  return out;
}

function wavePointCount(data?: Float32Array): number {
  if (!data || data.length === 0) return 0;
  return Math.max(1, Math.floor(data.length / 2));
}
function FXFloatingPanel({ x, y, width, title = 'Panel', onClose, children, time, onPause }: { x: number; y: number; width?: number; title?: string; onClose: () => void; children: React.ReactNode; time?: number; onPause?: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x, y });
  useEffect(() => { setPos({ x, y }); }, [x, y]);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onMove = (e: PointerEvent) => { if (!dragRef.current) return; setPos(p => ({ x: e.clientX - dragRef.current!.dx, y: e.clientY - dragRef.current!.dy })); };
    const onUp = () => { dragRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);

  // Selection playback guard: stops transport exactly at selection end
  const selPlayRef = useRef<null | { end: number }>(null);
  useEffect(() => {
    if (!selPlayRef.current) return;
    const end = selPlayRef.current.end;
    const t = Number(time || 0);
    if (Number.isFinite(t) && t >= end - 1e-3) {
      try { onPause?.(); } catch { }
      selPlayRef.current = null;
    }
  }, [time]);
  const onDown = (e: React.PointerEvent) => {
    // Prevent scrolling while dragging modal
    e.preventDefault();
    document.body.style.overflow = 'hidden';
    e.preventDefault();
    document.body.style.overflow = 'hidden';

    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const dx = e.clientX - pos.x;
    const dy = e.clientY - pos.y;
    dragRef.current = { dx, dy };
    const onMove = (ev: PointerEvent) => {
      ev.preventDefault();
      if (!dragRef.current) return;

      // Constrain to viewport bounds
      const newX = Math.max(0, Math.min(window.innerWidth - (width || 300), ev.clientX - dragRef.current.dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, ev.clientY - dragRef.current.dy));

      setPos({ x: newX, y: newY });
    };
    const onUp = () => {
      document.body.style.overflow = '';
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  return (
    <div
      ref={ref}
      className="mm-pop fixed touch-none select-none"
      style={{
        left: Math.round(pos.x) + 'px',
        top: Math.round(pos.y) + 'px',
        width: width,
        maxWidth: '95vw',
        maxHeight: '100%'
      }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2 cursor-move" onPointerDown={onDown}>
        <div className="font-semibold">{title}</div>
        <button className="mm-ico-btn" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" className="w-4 h-4"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z" /></svg>
        </button>
      </div>
      <div className="max-h-[340px] overflow-auto pr-1 scroll-class">
        {children}
      </div>
    </div>
  );
}
