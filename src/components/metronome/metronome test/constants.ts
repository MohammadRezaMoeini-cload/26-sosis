import type { SubdivisionPattern } from './types';

export const MIN_TEMPO = 10;
export const MAX_TEMPO = 500;

const TEMPO_NAMES: { [key: number]: string } = {
  10: 'Larghissimo',
  40: 'Grave',
  60: 'Largo',
  66: 'Larghetto',
  76: 'Adagio',
  108: 'Andante',
  120: 'Moderato',
  168: 'Allegro',
  176: 'Vivace',
  200: 'Presto',
  208: 'Prestissimo',
};

// ======================================================================
// ==                    CUSTOM AUDIO SAMPLES (Base64)                 ==
// ======================================================================
// To add a new sound:
// 1. Add a new key here (e.g., 'my_sound').
// 2. Paste your Base64 encoded audio file as the value.
// 3. Add the key to `SoundType` in `types.ts`.
// 4. Add an `<option>` in the dropdown in `App.tsx`.
// ======================================================================
export const SOUND_SAMPLES: { [key: string]: string } = {
  // --- PASTE YOUR BASE64 STRING FOR WOOD BLOCK PRO HERE ---
  'woodblock': '', 
  // --- PASTE YOUR BASE64 STRING FOR TABLA KIT (DEMO) HERE ---
  'tabla': '',
};


export const getTempoName = (tempo: number): string => {
  let name = '';
  for (const bpm in TEMPO_NAMES) {
    if (tempo >= parseInt(bpm, 10)) {
      name = TEMPO_NAMES[Number(bpm)]!;
    } else {
      break;
    }
  }
  return name;
};

// Subdivisions for when the beat is a Whole Note (e.g., x/1 time)
const SUBDIVISIONS_FOR_1: SubdivisionPattern[] = [
  // 1. Whole Note
  { name: 'Whole Note', iconType: 'whole', notes: [{ timeOffset: 0, isPrimary: true }] },
  // 2. Two Half Notes
  { name: 'Two Half Notes', iconType: 'sub_two_halves', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5, isSecondary: true }] },
  // 3. Half Rest + Half Note ممکنه نیاز به تغییر داشته باشه
  { name: 'Half Rest + Half Note', iconType: 'sub_rest_half', notes: [ { timeOffset: 0, isPrimary: true }, { timeOffset: 0.5, isSecondary: true }] },
  // 4. Half Note Triplet
  { name: 'Half Note Triplet', iconType: 'sub_half_triplet', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }, { timeOffset: 2/3 }] },
  // 5. Four Quarter Notes
  { name: 'Four Quarter Notes', iconType: 'sub_four_quarters_whole', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.25 }, { timeOffset: 0.5, isSecondary: true }, { timeOffset: 0.75 }] },
  // 6. Quarter Note Triplets (x2)
  { name: 'Quarter Note Triplets', iconType: 'sub_quarter_triplets_whole', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/6 }, { timeOffset: 2/6 }, { timeOffset: 0.5, isSecondary: true }, { timeOffset: 4/6 }, { timeOffset: 5/6 }] },
];

// Subdivisions for when the beat is a Quarter Note (e.g., x/4 time)
const SUBDIVISIONS_FOR_4: SubdivisionPattern[] = [
  // 1. Quarter Note
  { name: 'Quarter Note', iconType: 'quarter', notes: [{ timeOffset: 0, isPrimary: true }] },
  // 2. Two Eighth Notes
  { name: 'Two Eighth Notes', iconType: 'eighth', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5 }] },
  // 3. Eighth Rest + Eighth Note ممکن است نیاز به تغییر داشته باشه
  { name: 'Eighth Rest + Note', iconType: 'eighth_offbeat', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5 }] },
  // 4. Eighth Note Triplet
  { name: 'Eighth Note Triplet', iconType: 'eighth_triplet', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }, { timeOffset: 2/3 }] },
  // 5. Triplet (rest-note-note)
  { name: 'Triplet (rest-note-note)', iconType: 'triplet_rest_note_note', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }, { timeOffset: 2/3 }] },
  // 6. Triplet (note-rest-note)
  { name: 'Triplet (note-rest-note)', iconType: 'triplet_note_rest_note', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 2/3 }] },
  // 7. Triplet (note-note-rest)
  { name: 'Triplet (note-note-rest)', iconType: 'triplet_note_note_rest', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }] },
  // 8. Four Sixteenth Notes
  { name: 'Four Sixteenth Notes', iconType: 'sixteenth', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.25 }, { timeOffset: 0.5, isSecondary: true }, { timeOffset: 0.75 }] },
];

// Subdivisions for when the beat is a Half Note (e.g., x/2 time)
const SUBDIVISIONS_FOR_2: SubdivisionPattern[] = [
  // 1. Half Note
  { name: 'Half Note', iconType: 'sub_half_note', notes: [{ timeOffset: 0, isPrimary: true }] },
  // 2. Two Quarter Notes
  { name: 'Two Quarter Notes', iconType: 'sub_two_quarters', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5, isSecondary: true }] },
  // 3. Quarter Rest + Quarter Note ممکنه نیاز به تغییر داشته باشه
  { name: 'Quarter Rest + Note', iconType: 'sub_rest_quarter', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5, isSecondary: true }] },
  // 4. Quarter Note Triplet
  { name: 'Quarter Note Triplet', iconType: 'sub_quarter_triplet', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }, { timeOffset: 2/3 }] },
  // 5. Four Eighth Notes
  { name: 'Four Eighth Notes', iconType: 'sub_four_eighths', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.25 }, { timeOffset: 0.5, isSecondary: true }, { timeOffset: 0.75 }] },
  // 6. Eighth Note Triplet (x2)
  { name: 'Eighth Note Triplet', iconType: 'sub_eighth_triplets', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/6 }, { timeOffset: 2/6 }, { timeOffset: 0.5, isSecondary: true }, { timeOffset: 0.5 + 1/6 }, { timeOffset: 0.5 + 2/6 }] },
  // 7. Sextuplet (note-note-note-rest-note-note) ممکنه نیاز به تغییر داشته باشه
  { name: 'Sextuplet (NNN-NN)', iconType: 'sub_triplet_middle_note', notes: [{timeOffset: 0, isPrimary: true}, {timeOffset: 1/6}, {timeOffset: 2/6}, {timeOffset: 4/6}, {timeOffset: 5/6}] },
  // 8. Sextuplet (note-rest-note) x2
  { name: 'Sextuplet (note-rest-note)', iconType: 'sub_triplet_swing', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 2/6 }, { timeOffset: 3/6, isSecondary: true }, { timeOffset: 5/6 }] },
];

// Subdivisions for when the beat is an Eighth Note (e.g., x/8 time)
const SUBDIVISIONS_FOR_8: SubdivisionPattern[] = [
  // 1. Eighth Note
  { name: 'Eighth Note', iconType: 'eighth1', notes: [{ timeOffset: 0, isPrimary: true }] },
  // 2. Two Sixteenth Notes
  { name: 'Two Sixteenth Notes', iconType: 'sixteenth1', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5 }] },
  // 3. Sixteenth Rest + Sixteenth Note ممکنه نیاز به تغییر داشته باشه
  { name: 'Sixteenth Rest + Note', iconType: 'sixteenth_offbeat', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5 }] },
  // 4. Sixteenth Note Triplet
  { name: 'Sixteenth Note Triplet', iconType: 'sixteenth_triplet', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }, { timeOffset: 2/3 }] },
  // 5. Triplet (rest-note-note) ممکنه نیاز به تغییر داشته باشه
  { name: 'Triplet (rest-note-note)', iconType: 'sixteenth_triplet_rest_note_note', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }, { timeOffset: 2/3 }] },
  // 6. Triplet (note-rest-note)
  { name: 'Triplet (note-rest-note)', iconType: 'sixteenth_triplet_note_rest_note', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 2/3 }] },
  // 7. Triplet (note-note-rest)
  { name: 'Triplet (note-note-rest)', iconType: 'sixteenth_triplet_note_note_rest', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }] },
  // 8. Four Thirty-second Notes
  { name: 'Four Thirty-second Notes', iconType: 'thirty_second', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.25 }, { timeOffset: 0.5, isSecondary: true }, { timeOffset: 0.75 }] },
];

// Subdivisions for when the beat is a Sixteenth Note (e.g., x/16 time)
const SUBDIVISIONS_FOR_16: SubdivisionPattern[] = [
    // 1. Sixteenth Note
    { name: 'Sixteenth Note', iconType: 'sixteenth2', notes: [{ timeOffset: 0, isPrimary: true }] },
    // 2. Two Thirty-second Notes
    { name: 'Two Thirty-second Notes', iconType: 'thirty_second1', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5 }] },
    // 3. Thirty-second Rest + Note
    { name: 'Thirty-second Rest + Note', iconType: 'thirty_second_offbeat', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 0.5 }] },
    // 4. Thirty-second Note Triplet
    { name: 'Thirty-second Note Triplet', iconType: 'thirty_second_triplet1', notes: [{ timeOffset: 0, isPrimary: true }, { timeOffset: 1/3 }, { timeOffset: 2/3 }] },
];

// Subdivisions for when the beat is a Thirty-second Note (e.g., x/32 time)
const SUBDIVISIONS_FOR_32: SubdivisionPattern[] = [
    // 1. Thirty-second Note
    { name: 'Thirty-second Note', iconType: 'thirty_second2', notes: [{ timeOffset: 0, isPrimary: true }] },
];


export const getSubdivisionPatterns = (beatValue: number): SubdivisionPattern[] => {
  if (beatValue === 1) {
    return SUBDIVISIONS_FOR_1;
  }
  if (beatValue === 2) {
    return SUBDIVISIONS_FOR_2;
  }
  if (beatValue === 8) {
    return SUBDIVISIONS_FOR_8;
  }
  if (beatValue === 16) {
    return SUBDIVISIONS_FOR_16;
  }
  if (beatValue === 32) {
      return SUBDIVISIONS_FOR_32;
  }
  return SUBDIVISIONS_FOR_4;
};
