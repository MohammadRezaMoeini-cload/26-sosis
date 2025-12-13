
import React, { useState } from 'react';
// import type { TimeSignature } from '../types';
import SubdivisionSelector from './SubdivisionSelector';

// interface TimeSignatureModalProps {
//     currentTimeSignature: TimeSignature;
//     currentSubdivision: number;
//     onClose: () => void;
//     onSave: (newTimeSignature: TimeSignature, newSubdivision: number) => void;
// }

const TimeSignatureModal = ({ currentTimeSignature, currentSubdivision, onClose, onSave }) => {
    const [beatsPerMeasure, setBeatsPerMeasure] = useState(currentTimeSignature.beatsPerMeasure);
    const [beatValue, setBeatValue] = useState(currentTimeSignature.beatValue);
    const [subdivision, setSubdivision] = useState(currentSubdivision);

    const handleSave = () => {
        onSave({ beatsPerMeasure, beatValue }, subdivision);
    };

    const numerators = Array.from({ length: 16 }, (_, i) => i + 1);
    const denominators = [1, 2, 4, 8, 16, 32];

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 sm:w-full md:w-full lg:w-1/2 border border-gray-700 flex md:flex-row sm:flex-row lg:flex-col space-x-6">
                <h2 className="text-xl font-bold text-white mb-0 text-center">Settings</h2>
                
                <div>
                  <h3 className="text-gray-400 mb-2 text-center">TIME SIGNATURE</h3>
                  <div className="flex justify-center items-center space-x-4 p-4 bg-black/30 rounded-lg">
                      {/* Numerator */}
                      <div className="flex flex-col items-center">
                          <select
                              value={beatsPerMeasure}
                              onChange={(e) => setBeatsPerMeasure(Number(e.target.value))}
                              className="bg-gray-700 text-white p-3 rounded-md text-2xl w-24 text-center appearance-none"
                          >
                              {numerators.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                      </div>

                      <span className="text-white text-4xl">/</span>
                      
                      {/* Denominator */}
                      <div className="flex flex-col items-center">
                           <select
                              value={beatValue}
                              onChange={(e) => {
                                // Reset subdivision when beat value changes to avoid index out of bounds
                                if (Number(e.target.value) !== beatValue) {
                                  setSubdivision(0);
                                }
                                setBeatValue(Number(e.target.value));
                              }}
                              className="bg-gray-700 text-white p-3 rounded-md text-2xl w-24 text-center appearance-none"
                          >
                              {denominators.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                      </div>
                  </div>
                </div>

                <SubdivisionSelector beatValue={beatValue} selected={subdivision} onSelect={setSubdivision} />

                <div className="flex justify-between space-x-4 pt-4">
                    <button onClick={onClose} className="w-full h-1/2 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="w-full h-1/2 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors">Save</button>
                </div>
            </div>
        </div>
    );
};

export default TimeSignatureModal;
