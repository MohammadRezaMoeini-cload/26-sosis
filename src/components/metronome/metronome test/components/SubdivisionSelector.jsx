import React from 'react';
import { getSubdivisionPatterns } from '../constants';
import {
  SubdivisionQuarterIcon,
  SubdivisionEighthIcon,
  SubdivisionEighthOffbeatIcon,
  SubdivisionEighthTripletIcon,
  SubdivisionSixteenthIcon,
  SubdivisionTripletRestNoteNoteIcon,
  SubdivisionTripletNoteRestNoteIcon,
  SubdivisionTripletNoteNoteRestIcon,
  SubHalfNoteIcon,
  SubTwoQuartersIcon,
  SubRestQuarterIcon,
  SubQuarterTripletIcon,
  SubFourEighthsIcon,
  SubEighthTripletsIcon,
  SubTripletMiddleNoteIcon,
  SubTripletSwingIcon,
  SubdivisionSixteenthOffbeatIcon,
  SubdivisionSixteenthTripletIcon,
  SubdivisionSixteenthTripletRestNoteNoteIcon,
  SubdivisionSixteenthTripletNoteRestNoteIcon,
  SubdivisionSixteenthTripletNoteNoteRestIcon,
  SubdivisionThirtySecondIcon,
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
  SubWholeNoteIcon,
  SubTwoHalvesIcon,
  SubRestHalfIcon,
  SubHalfTripletIcon,
  SubFourQuartersWholeIcon,
  SubQuarterTripletsWholeIcon,
  SubSextupletRnnIcon,
  SubSextupletNrnIcon,
} from './icons';
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
// interface SubdivisionSelectorProps {
//   selected: number;
//   onSelect: (index: number) => void;
//   beatValue: number;
// }


const iconMap= {
  'quarter': note21,
  'eighth': note22,
  'eighth1':note29,
  'eighth_offbeat':note23,
  'eighth_triplet': note24,
  'sixteenth': note28,
  'sixteenth1':note30,
  'sixteenth2':note161,
  'thirty_second1':note162,
  'triplet_rest_note_note': note25,
  'triplet_note_rest_note': note26,
  'triplet_note_note_rest': note27,
  'whole': SubWholeNoteIcon,
  'sub_two_halves': twoHalfIcon,
  'sub_rest_half': SubRestHalfIcon,
  'sub_half_triplet': SubHalfTripletIcon,
  'sub_four_quarters_whole': SubFourQuartersWholeIcon,
  'sub_quarter_triplets_whole': SubQuarterTripletsWholeIcon,
  'sub_sextuplet_rnn': SubSextupletRnnIcon,
  'sub_sextuplet_nrn': SubSextupletNrnIcon,
  'sub_half_note': note11,
  'sub_two_quarters': note12,
  'sub_rest_quarter': note13,
  'sub_quarter_triplet': note14,
  'sub_four_eighths': note15,
  'sub_eighth_triplets': note16,
  'sub_triplet_middle_note': note17,
  'sub_triplet_swing': note18,
  'sixteenth_offbeat': note31,
  'sixteenth_triplet': note32,
  'sixteenth_triplet_rest_note_note': note33,
  'sixteenth_triplet_note_rest_note': note34,
  'sixteenth_triplet_note_note_rest': note35,
  'thirty_second': note36,
  'thirty_second2':noteT1,
  'thirty_second_triplet1':note164,
  'thirty_second_offbeat': SubdivisionThirtySecondOffbeatIcon,
  'thirty_second_triplet': SubdivisionThirtySecondTripletIcon,
  'thirty_second_triplet_rest_note_note': SubdivisionThirtySecondTripletRestNoteNoteIcon,
  'thirty_second_triplet_note_rest_note': SubdivisionThirtySecondTripletNoteRestNoteIcon,
  'thirty_second_triplet_note_note_rest': SubdivisionThirtySecondTripletNoteNoteRestIcon,
  'sixty_fourth': SubdivisionSixtyFourthIcon,
  'sixty_fourth_offbeat': SubdivisionSixtyFourthOffbeatIcon,
  'sixty_fourth_triplet': SubdivisionSixtyFourthTripletIcon,
  'sixty_fourth_triplet_rest_note_note': SubdivisionSixtyFourthTripletRestNoteNoteIcon,
  'sixty_fourth_triplet_note_rest_note': SubdivisionSixtyFourthTripletNoteRestNoteIcon,
  'sixty_fourth_triplet_note_note_rest': SubdivisionSixtyFourthTripletNoteNoteRestIcon,
  'one_twenty_eighth': SubdivisionOneTwentyEighthIcon,
};


const SubdivisionSelector = ({ selected, onSelect, beatValue }) => {
  const patterns = getSubdivisionPatterns(beatValue);

  return (
    <div>
      <h3 className="text-gray-400 mb-2 text-center">SUBDIVISIONS</h3>
      <div className="grid grid-cols-4 gap-2 bg-black/30 p-2 rounded-lg border border-gray-700">
        {patterns.map((pattern, index) => {
          const Icon = iconMap[pattern.iconType];
          return (
            <button
              key={`${beatValue}-${index}`}
              onClick={() => onSelect(index)}
              className={`aspect-video rounded-md transition-all duration-150 flex items-center justify-center
                ${
                  selected === index
                    ? 'bg-cyan-500 shadow-[0_0_15px_rgba(56,189,248,0.7)] scale-105'
                    : 'bg-gray-900/50 hover:bg-gray-700/80'
                }
                `
              }
              style={{padding:`${window.innerWidth < 600 ? '5px !important' : ''}`}}
              aria-label={`Select subdivision pattern ${pattern.name}`}
            >
              {Icon ? <Icon className="w-auto h-6 text-white" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SubdivisionSelector;
