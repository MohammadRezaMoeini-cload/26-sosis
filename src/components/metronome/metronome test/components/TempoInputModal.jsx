
import React, { useState } from 'react';
import { MIN_TEMPO, MAX_TEMPO } from '../constants';

// interface TempoInputModalProps {
//     currentTempo: number;
//     onClose: () => void;
//     onSave: (newTempo: number) => void;
// }

const TempoInputModal = ({ currentTempo, onClose, onSave }) => {
    const [tempo, setTempo] = useState(String(currentTempo));

    const handleSave = () => {
        const newTempo = parseInt(tempo, 10);
        if (!isNaN(newTempo) && newTempo >= MIN_TEMPO && newTempo <= MAX_TEMPO) {
            onSave(newTempo);
        } else {
            // Optionally, show an error message
            setTempo(String(currentTempo)); // Reset to valid tempo
        }
    };
    
    const handleChange = (e) => {
        // Allow only numbers
        const value = e.target.value.replace(/[^0-9]/g, '');
        setTempo(value);
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-xs border border-gray-700 flex flex-col space-y-6">
                <h2 className="text-xl font-bold text-white text-center">Set Tempo</h2>
                
                <div className="flex justify-center items-center">
                    <input
                        type="number"
                        value={tempo}
                        onChange={handleChange}
                        onBlur={handleSave}
                        min={MIN_TEMPO}
                        max={MAX_TEMPO}
                        className="bg-gray-900 text-cyan-400 p-3 rounded-md text-5xl w-full text-center font-mono appearance-none border-2 border-gray-700 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                        autoFocus
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleSave();
                            }
                        }}
                    />
                </div>

                <div className="flex justify-between space-x-4 pt-4">
                    <button onClick={onClose} className="w-full py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="w-full py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors">Set</button>
                </div>
            </div>
        </div>
    );
};

export default TempoInputModal;
