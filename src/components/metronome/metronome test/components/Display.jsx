import React, { useEffect, useRef, useState } from 'react';
// import type { TimeSignature } from '../types';
import BeatIndicator from './BeatIndicator';
import { getSubdivisionPatterns } from '../constants';
// First, import all note icons and assets
import { note21 } from './assets/note21.jsx';
import { note22 } from './assets/note22.jsx';
import { note23 } from './assets/note23.jsx';
import { note24 } from './assets/note24.jsx';
import { note25 } from './assets/note25.jsx';
import { note26 } from './assets/note26.jsx';
import { note27 } from './assets/note27.jsx';
import { note28 } from './assets/note28.jsx';
import { note29 } from './assets/note29.jsx';
import { note30 } from './assets/note30.jsx';
import { note31 } from './assets/note31.jsx';
import { note11 } from './assets/note11';
import { note12 } from './assets/note12';
import { note13 } from './assets/note13';
import { note14 } from './assets/note14';
import { note15 } from './assets/note15';
import { note16 } from './assets/note16';
import { note17 } from './assets/note17';
import { note18 } from './assets/note18';
import { note32 } from './assets/note32';
import { note33 } from './assets/note33';
import { note34 } from './assets/note34';
import { note35 } from './assets/note35';
import { note36 } from './assets/note36';
import { note161 } from './assets/note161.jsx';
import { note162 } from './assets/note162.jsx';
import { note163 } from './assets/note163.jsx';
import { note164 } from './assets/note164.jsx';
import { noteT1 } from './assets/noteT1.jsx';
import { noteT2 } from './assets/noteT2.jsx';
import { noteT3 } from './assets/noteT3.jsx';
import twoHalfIcon from './assets/twoHalfIcon.jsx';

import {
  SubWholeNoteIcon,
  SubRestHalfIcon,
  SubHalfTripletIcon,
  SubFourQuartersWholeIcon,
  SubQuarterTripletsWholeIcon,
  SubSextupletRnnIcon,
  SubSextupletNrnIcon,
  SubdivisionThirtySecondOffbeatIcon,
  SubdivisionThirtySecondTripletIcon,
  SubdivisionThirtySecondTripletRestNoteNoteIcon,
  SubdivisionThirtySecondTripletNoteRestNoteIcon,
  SubdivisionThirtySecondTripletNoteNoteRestIcon,
  SubdivisionSixtyFourthIcon,
  SubdivisionSixtyFourthOffbeatIcon,
  SubdivisionSixtyFourthTripletIcon,
  SubdivisionSixtyFourthTripletRestNoteNoteIcon,
  SubdivisionSixtyFourthTripletNoteRestNoteIcon,
  SubdivisionSixtyFourthTripletNoteNoteRestIcon,
  SubdivisionOneTwentyEighthIcon,
  QuarterNoteIcon
} from './icons';

// interface DisplayProps {
//   tempo: number;
//   tempoName: string;
//   timeSignature: TimeSignature;
//   currentBeat: number;
//   accentLevels: number[];
//   onAccentChange: (beatIndex: number) => void;
//   subdivision: number;
//   onTempoClick: () => void;
//   onTimeSignatureClick: () => void;
// }

const Display = ({
  tempo,
  tempoName,
  timeSignature,
  currentBeat,
  accentLevels,
  onAccentChange,
  subdivision,
  onTempoClick,
  onTimeSignatureClick,
}) => {
  // Visual fallback for active beat highlighting if currentBeat isn't updating
  const [visBeat, setVisBeat] = useState(-1);
  const [visPlaying, setVisPlaying] = useState(false);
  const [visTempo, setVisTempo] = useState(tempo);
  const loopIdRef = useRef(0);
  const startTsRef = useRef(0);
  // Track freshness of callback-driven beat updates; if stale, fall back to time-derived beat
  const lastCbBeatAtRef = useRef(0);

  useEffect(() => { setVisTempo(tempo); }, [tempo]);

  useEffect(() => {
    const onPlaying = (e) => {
      try {
        const val = (e && e.detail != null) ? (e.detail.playing ?? e.detail) : false;
        const playing = !!val;
        setVisPlaying(playing);
        if (playing) startTsRef.current = performance.now();
        else setVisBeat(-1);
      } catch {}
    };
    const onTempo = (e) => {
      try { if (e && e.detail && typeof e.detail.tempo === 'number') setVisTempo(e.detail.tempo); } catch {}
    };
    window.addEventListener('mix:metronomePlaying', onPlaying);
    window.addEventListener('mix:metronomeTempo', onTempo);
    return () => {
      window.removeEventListener('mix:metronomePlaying', onPlaying);
      window.removeEventListener('mix:metronomeTempo', onTempo);
    };
  }, []);

  // Always keep a light UI scheduler running while playing so the indicator never freezes
  useEffect(() => {
    if (!visPlaying) {
      if (loopIdRef.current) { window.clearTimeout(loopIdRef.current); loopIdRef.current = 0; }
      return;
    }
    const tick = () => {
      const beatDurMs = (60 / Math.max(1, visTempo || 120)) * (4 / Math.max(1, timeSignature?.beatValue || 4)) * 1000;
      const elapsed = performance.now() - (startTsRef.current || performance.now());
      const measureBeats = Math.max(1, timeSignature?.beatsPerMeasure || 4);
      const beat = Math.floor(elapsed / Math.max(1, beatDurMs)) % measureBeats;
      setVisBeat(beat);
      loopIdRef.current = window.setTimeout(tick, 30);
    };
    tick();
    return () => { if (loopIdRef.current) { window.clearTimeout(loopIdRef.current); loopIdRef.current = 0; } };
  }, [visPlaying, visTempo, timeSignature?.beatsPerMeasure, timeSignature?.beatValue]);

  // Record time of latest callback (audio-scheduled) beat; align fallback at measure start
  useEffect(() => {
    if (typeof currentBeat === 'number' && currentBeat >= 0) {
      lastCbBeatAtRef.current = performance.now();
      // When we get beat 0 from the audio scheduler, reset our UI clock so it stays in-phase
      if (currentBeat === 0 && visPlaying) {
        startTsRef.current = performance.now();
        setVisBeat(0);
      }
    }
  }, [currentBeat, visPlaying]);

  // Prefer the audio callback beat, but if it goes stale (e.g., UI thread busy during clicks),
  // smoothly fall back to the time-derived beat until callbacks resume.
  const nowTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const cbStale = visPlaying && (nowTs - (lastCbBeatAtRef.current || 0) > 180);
  const displayedBeat = visPlaying && cbStale
    ? visBeat
    : ((currentBeat != null && currentBeat >= 0) ? currentBeat : visBeat);

const renderSubdivisionIcon = () => {
  const patterns = getSubdivisionPatterns(timeSignature.beatValue);
  const currentPattern = patterns[subdivision];
  if (!currentPattern) return null;

  const IconComponent = (() => {
    switch (currentPattern.iconType) {
      // Quarter note based
      case 'quarter': return note21;
      case 'eighth': return note22;
      case 'eighth1': return note29;
      case 'eighth_offbeat': return note23;
      case 'eighth_triplet': return note24;
      case 'sixteenth': return note28;
      case 'sixteenth1': return note30;
      case 'sixteenth2': return note161;
      case 'thirty_second1': return note162;
      case 'triplet_rest_note_note': return note25;
      case 'triplet_note_rest_note': return note26;
      case 'triplet_note_note_rest': return note27;

      // Whole note based
      case 'whole': return SubWholeNoteIcon;
      case 'sub_two_halves': return twoHalfIcon;
      case 'sub_rest_half': return SubRestHalfIcon;
      case 'sub_half_triplet': return SubHalfTripletIcon;
      case 'sub_four_quarters_whole': return SubFourQuartersWholeIcon;
      case 'sub_quarter_triplets_whole': return SubQuarterTripletsWholeIcon;
      case 'sub_sextuplet_rnn': return SubSextupletRnnIcon;
      case 'sub_sextuplet_nrn': return SubSextupletNrnIcon;

      // Half note based
      case 'sub_half_note': return note11;
      case 'sub_two_quarters': return note12;
      case 'sub_rest_quarter': return note13;
      case 'sub_quarter_triplet': return note14;
      case 'sub_four_eighths': return note15;
      case 'sub_eighth_triplets': return note16;
      case 'sub_triplet_middle_note': return note17;
      case 'sub_triplet_swing': return note18;

      // Sixteenth based
      case 'sixteenth_offbeat': return note31;
      case 'sixteenth_triplet': return note32;
      case 'sixteenth_triplet_rest_note_note': return note33;
      case 'sixteenth_triplet_note_rest_note': return note34;
      case 'sixteenth_triplet_note_note_rest': return note35;

      // Thirty-second based
      case 'thirty_second': return note36;
      case 'thirty_second2': return noteT1;
      case 'thirty_second_triplet1': return note164;
      case 'thirty_second_offbeat': return SubdivisionThirtySecondOffbeatIcon;
      case 'thirty_second_triplet': return SubdivisionThirtySecondTripletIcon;
      case 'thirty_second_triplet_rest_note_note': return SubdivisionThirtySecondTripletRestNoteNoteIcon;
      case 'thirty_second_triplet_note_rest_note': return SubdivisionThirtySecondTripletNoteRestNoteIcon;
      case 'thirty_second_triplet_note_note_rest': return SubdivisionThirtySecondTripletNoteNoteRestIcon;

      // Sixty-fourth based
      case 'sixty_fourth': return SubdivisionSixtyFourthIcon;
      case 'sixty_fourth_offbeat': return SubdivisionSixtyFourthOffbeatIcon;
      case 'sixty_fourth_triplet': return SubdivisionSixtyFourthTripletIcon;
      case 'sixty_fourth_triplet_rest_note_note': return SubdivisionSixtyFourthTripletRestNoteNoteIcon;
      case 'sixty_fourth_triplet_note_rest_note': return SubdivisionSixtyFourthTripletNoteRestNoteIcon;
      case 'sixty_fourth_triplet_note_note_rest': return SubdivisionSixtyFourthTripletNoteNoteRestIcon;

      // One-twenty-eighth
      case 'one_twenty_eighth': return SubdivisionOneTwentyEighthIcon;

      default: return note21; // Default to quarter note
    }
  })();

  return IconComponent ? (
    <div style={{ color: '#0891b2' }}> {/* This is the tailwind cyan-600 color */}
      <IconComponent className="h-10 w-auto" style={{ fill: 'currentColor', stroke: 'currentColor' }} />
    </div>
  ) : null;
};

  return (
    <div className="bg-black/80 rounded-lg p-3 border border-gray-700 shadow-inner h-full">
      <div className="grid grid-cols-3 gap-2 text-center text-gray-400 mb-2">
        {/* TEMPO */}
        <button onClick={onTempoClick} className="flex flex-col items-center rounded-lg hover:bg-white/5 p-1 transition-colors">
          <span className="text-sm font-bold text-pink-400">TEMPO</span>
          <div className="h-16 flex items-center justify-center">
            <QuarterNoteIcon className="w-5 h-5 text-cyan-400 mr-1" />
            <span className="text-4xl font-mono text-cyan-400 leading-none">{tempo}</span>
          </div>
          <span className="text-xs text-gray-500 h-4">{tempoName}</span>
        </button>
        
        {/* TIME SIGNATURE */}
        <button onClick={onTimeSignatureClick} className="flex flex-col items-center rounded-lg hover:bg-white/5 p-1 transition-colors">
          <span className="text-sm font-bold text-pink-400">T.S.</span>
          <div className="h-16 flex items-center justify-center">
            <span className="text-4xl font-mono text-cyan-400 leading-none">
              {timeSignature.beatsPerMeasure}/{timeSignature.beatValue}
            </span>
          </div>
          <span className="text-xs text-gray-500 h-4">&nbsp;</span>
        </button>

        {/* SUBDIVISION */}
        <button onClick={onTimeSignatureClick} className="flex flex-col items-center rounded-lg hover:bg-white/5 p-1 transition-colors">
          <span className="text-sm font-bold text-pink-400">SUB DIV.</span>
           <div className="h-16 flex items-center justify-center" key={subdivision}>
             {renderSubdivisionIcon()}
           </div>
           <span className="text-xs text-gray-500 h-4">&nbsp;</span>
        </button>
      </div>
      <div className="bg-gray-900/50 p-2 rounded flex justify-center items-center space-x-2 h-1/2" style={{ touchAction: 'none' }}>
        {accentLevels.map((level, index) => (
          <BeatIndicator
            key={index}
            isActive={displayedBeat >= 0 && index === displayedBeat}
            accentLevel={level}
            onClick={() => onAccentChange(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default Display;
