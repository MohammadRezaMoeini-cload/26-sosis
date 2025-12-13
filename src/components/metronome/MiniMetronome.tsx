import React, { useEffect, useState } from 'react';

type Props = {
  className?: string;
};

export default function MiniMetronome({ className = '' }: Props) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const onState = (e: any) => { try { setPlaying(!!e.detail.playing); } catch { } };
    window.addEventListener('mix:metronomePlaying' as any, onState as any);
    return () => { window.removeEventListener('mix:metronomePlaying' as any, onState as any); };
  }, []);

  return (
    <button
      className={`mm-ico-btn ${className}`}
      title={playing ? 'Pause Metronome' : 'Play Metronome'}
      aria-label={playing ? 'Pause Metronome' : 'Play Metronome'}
      onClick={() => {
        const next = !playing;
        try { window.dispatchEvent(new CustomEvent('mix:setMetronomePlaying', { detail: { playing: next } })); } catch { }
        setPlaying(next);
      }}
    >
      {playing ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30">
          <path d="M15,3C8.373,3,3,8.373,3,15c0,6.627,5.373,12,12,12s12-5.373,12-12C27,8.373,21.627,3,15,3z M14,19c0,0.552-0.448,1-1,1 s-1-0.448-1-1v-8c0-0.552,0.448-1,1-1s1,0.448,1,1V19z M18,19c0,0.552-0.448,1-1,1s-1-0.448-1-1v-8c0-0.552,0.448-1,1-1s1,0.448,1,1 V19z" fill="#EFEFE7" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
          <path d="M32,6C17.641,6,6,17.641,6,32c0,14.359,11.641,26,26,26s26-11.641,26-26C58,17.641,46.359,6,32,6z M25,45V19l21.914,13L25,45z" fill="#EFEFE7" />
        </svg>
      )}
    </button>
  );
}
