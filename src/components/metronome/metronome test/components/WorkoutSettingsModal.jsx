import React, { useState } from 'react';

const WorkoutSettingsModal = ({ onClose, onSave, currentSettings }) => {
    const [startTempo, setStartTempo] = useState(currentSettings?.startTempo ?? 120);
    const [endTempo, setEndTempo] = useState(currentSettings?.endTempo ?? 140);
    const [duration, setDuration] = useState(currentSettings?.duration ?? 5);

    const handleSave = () => {
        onSave({
            startTempo: Math.min(Math.max(30, startTempo), 250),
            endTempo: Math.min(Math.max(30, endTempo), 250),
            duration: Math.min(Math.max(1, duration), 60)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-700 flex flex-col space-y-6">
                <h2 className="text-xl font-bold text-white mb-0 text-center">Workout Settings</h2>

                <div>
                    <h3 className="text-gray-400 mb-2 text-center">TEMPO RANGE</h3>
                    <div className="flex flex-col space-y-4 p-4 bg-black/30 rounded-lg">
                        <div className="flex justify-center items-center space-x-4">
                            <input
                                type="number"
                                value={startTempo}
                                onChange={(e) => setStartTempo(Number(e.target.value))}
                                className="bg-gray-700 text-white p-3 rounded-md text-2xl w-24 text-center appearance-none"
                                min="30"
                                max="250"
                            />
                            <span className="text-white text-2xl">→</span>
                            <input
                                type="number"
                                value={endTempo}
                                onChange={(e) => setEndTempo(Number(e.target.value))}
                                className="bg-gray-700 text-white p-3 rounded-md text-2xl w-24 text-center appearance-none"
                                min="30"
                                max="250"
                            />
                        </div>
                        <div className="flex flex-col items-center">
                            <label className="text-gray-400 mb-2">Duration (minutes)</label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(Number(e.target.value))}
                                className="bg-gray-700 text-white p-3 rounded-md text-2xl w-24 text-center appearance-none"
                                min="1"
                                max="60"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-between space-x-4 pt-4">
                    <button 
                        onClick={onClose}
                        className="w-full py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        className="w-full py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-500 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkoutSettingsModal;