export type TimeSignature = { beatsPerMeasure: number; beatValue: number };

export type SubdivisionNote = {
  timeOffset: number; // 0..1 within the beat
  isPrimary?: boolean;
  isSecondary?: boolean;
};

export type SubdivisionPattern = {
  name: string;
  iconType: string;
  notes: SubdivisionNote[];
};

export type SoundType = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'woodblock' | 'tabla';

