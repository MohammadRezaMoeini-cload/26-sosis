import React, { Suspense } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;

};

// Dynamically import the provided metronome app to avoid TS module typing issues.
// @ts-ignore - bundler resolves the .jsx file at runtime
const LazyMetronomeApp = React.lazy(() => import('./metronome test/App.jsx'));

export default function MetronomeModal({ open, onClose }: Props) {
  return (
    <div
      className="metronome-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: open ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: window.innerWidth>1000?'60%':"100%",
          height: window.innerWidth>1000?'60%':"70%",
          background: '#111',
          border: '1px solid #333',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            background: '#333',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
        <div style={{ width: '100%', height: '100%' }}>
          <Suspense fallback={<div style={{ color: '#fff', padding: 16 }}>Loading metronome…</div>}>
            {/* The embedded metronome fills this container */}
            {/* It exposes onPlayingChange so we can start the host transport when it turns on. */}
            { /* @ts-ignore*/ }
            <LazyMetronomeApp onPlayingChange={(playing: boolean) => { if (playing) onMetronomePlay?.(); }} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
