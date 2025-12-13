import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMetronome } from './hooks/useMetronome';
// import type { TimeSignature, SoundType } from './types';
import { MIN_TEMPO, MAX_TEMPO, getTempoName } from './constants';
import Display from './components/Display';
import Dial from './components/Dial';
import TimeSignatureModal from './components/TimeSignatureModal';
import TempoInputModal from './components/TempoInputModal';
import VolumeControl from './components/VolumeControl';
import { SettingsIcon, ListIcon, SpeakerIcon, SpeakerMutedIcon, SpeakerHalfIcon } from './components/icons';
import WorkoutSettingsModal from './components/WorkoutSettingsModal';
import "./MetronomeModal.css";

const App = ({ onPlayingChange, stopSignal }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);//bpm
  const [timeSignature, setTimeSignature] = useState({ beatsPerMeasure: 4, beatValue: 4 });
  const [accentLevels, setAccentLevels] = useState([2, 2, 2, 2]);//frequency
  const [subdivision, setSubdivision] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTempoInputOpen, setIsTempoInputOpen] = useState(false);
  const [isVolumeControlOpen, setIsVolumeControlOpen] = useState(false);
  const [isWorkoutSettingsOpen, setIsWorkoutSettingsOpen] = useState(false);

  const [soundType, setSoundType] = useState('sine');
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [workoutMode, setWorkoutMode] = useState('steady');
  const [workoutSettings, setWorkoutSettings] = useState(null);
  const workoutStartTimeRef = useRef(null);

  const workoutModes = [
    { value: 'steady', label: 'Steady' },
    { value: 'increase', label: 'Increase' },
    { value: 'decrease', label: 'Decrease' },
  ];

  const RAMP_EVERY_MEASURES = 1;   // change every 1 measure
  const RAMP_STEP_BPM = 1;         // change 1 BPM per ramp

  const lastTapRef = useRef(0);
  const measureCounterRef = useRef(0);
  const tapIntervalsRef = useRef([]);
  const pendingTempoChangeRef = useRef(null);

  // Add these refs near the other refs
  const nextTempoRef = useRef(null);
  const measureStartTimeRef = useRef(null);
  const currentMeasureTempoRef = useRef(null);

  // Modify the handleTick function to remove setTimeout and use a more precise approach
  const handleTick = useCallback((beat) => {
    // Only update currentBeat if we're not changing tempo
    if (nextTempoRef.current === null || beat !== 0) {
      setCurrentBeat(beat);
    }

    // Move tempo change to beat 0 (start of measure)
    if (beat === 0) {
      if (nextTempoRef.current !== null && nextTempoRef.current !== currentMeasureTempoRef.current) {
        const newTempo = nextTempoRef.current;
        currentMeasureTempoRef.current = newTempo;
        handleTempoChange(newTempo);
        nextTempoRef.current = null;
      }
    }
  }, [timeSignature.beatsPerMeasure]);



  // Self-contained scheduler (modal owns settings)
  const { audioContext } = useMetronome(tempo, timeSignature, subdivision, isPlaying, accentLevels, soundType, masterVolume, handleTick);

  // Allow external button (footer) to start/stop this exact metronome
  useEffect(() => {
    const onSet = (e) => {
      try {
        const val = (e && e.detail != null) ? (e.detail.playing ?? e.detail) : false;
        const want = !!val;
        if (want && audioContext && audioContext.state === 'suspended') {
          try { audioContext.resume(); } catch { }
        }
        setIsPlaying(want);
        if (!want) setCurrentBeat(-1);
      } catch { }
    };
    window.addEventListener('mix:setMetronomePlaying', onSet);
    return () => window.removeEventListener('mix:setMetronomePlaying', onSet);
  }, [audioContext]);
  useEffect(() => {
    setAccentLevels(currentLevels => {
      const newLevels = new Array(timeSignature.beatsPerMeasure).fill(2);
      if (newLevels.length > 0) newLevels[0] = 4;
      const limit = Math.min(currentLevels.length, newLevels.length);
      for (let i = 0; i < limit; i++) {
        newLevels[i] = currentLevels[i];
      }
      return newLevels;
    });
    setCurrentBeat(-1);
  }, [timeSignature]);

  const togglePlay = () => {
    if (audioContext && audioContext.state === 'suspended') {
      try { audioContext.resume(); } catch { }
    }
    setIsPlaying(prev => !prev);
    if (isPlaying) setCurrentBeat(-1);
  };

  // Force stop when parent indicates a close/back action
  const lastStopRef = useRef(stopSignal);
  useEffect(() => {
    if (stopSignal !== lastStopRef.current) {
      lastStopRef.current = stopSignal;
      setIsPlaying(false);
      setCurrentBeat(-1);
      try { if (audioContext && audioContext.state === 'running') audioContext.suspend(); } catch { }
    }
  }, [stopSignal, audioContext]);

  // Notify parent about playing state changes (to start/stop host transport if desired)
  useEffect(() => {
    try { if (typeof onPlayingChange === 'function') onPlayingChange(isPlaying); } catch { }
    // Broadcast for footer button to reflect state
    try { window.dispatchEvent(new CustomEvent('mix:metronomePlaying', { detail: { playing: isPlaying } })); } catch { }
  }, [isPlaying, onPlayingChange]);

  // Publish tempo changes for host integration
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('mix:metronomeTempo', { detail: { tempo } })); } catch {}
  }, [tempo]);

  const handleTempoChange = (newTempo) => {
    const t = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, newTempo));
    setTempo(t);
    try { window.dispatchEvent(new CustomEvent('mix:metronomeTempo', { detail: { tempo: t } })); } catch {}
  };

  const handleAccentChange = (beatIndex) => {
    setAccentLevels(prev => {
      const newLevels = [...prev];
      newLevels[beatIndex] = (newLevels[beatIndex] + 1) % 5;
      return newLevels;
    });
  };

  const handleTap = () => {
    const now = performance.now();
    if (lastTapRef.current > 0) {
      const interval = now - lastTapRef.current;
      if (interval > 2000) {
        tapIntervalsRef.current = [];
      } else {
        tapIntervalsRef.current.push(interval);
        if (tapIntervalsRef.current.length > 2) {
          tapIntervalsRef.current.shift();
        }
        if (tapIntervalsRef.current.length >= 1) {
          const avgInterval = tapIntervalsRef.current.reduce((a, b) => a + b, 0) / tapIntervalsRef.current.length;
          const newTempo = Math.round(60000 / avgInterval);
          handleTempoChange(newTempo);
        }
      }
    }
    lastTapRef.current = now;
  };

  const handleSettingsSave = (newTimeSignature, newSubdivision) => {
    setTimeSignature(newTimeSignature);
    setSubdivision(newSubdivision);
    setIsSettingsModalOpen(false);
  }

  const handleTempoSave = (newTempo) => {
    handleTempoChange(newTempo);
    setIsTempoInputOpen(false);
  };

  const getVolumeIcon = () => {
    const iconProps = { className: "w-7 h-7" };
    if (masterVolume === 0) return <SpeakerMutedIcon {...iconProps} />;
    if (masterVolume <= 0.5) return <SpeakerHalfIcon {...iconProps} />;
    return <SpeakerIcon {...iconProps} />;
  };

  // Workout effect
  useEffect(() => {
    if (!isPlaying || workoutMode === 'steady' || !workoutSettings) return;

    if (workoutStartTimeRef.current === null) {
      workoutStartTimeRef.current = performance.now();
      currentMeasureTempoRef.current = workoutSettings.startTempo;
      handleTempoChange(workoutSettings.startTempo);
    }

    const calculateTargetTempo = () => {
      const elapsed = performance.now() - workoutStartTimeRef.current;
      const durationMs = workoutSettings.duration * 60 * 1000;

      if (elapsed >= durationMs) {
        return workoutSettings.endTempo;
      }

      const progress = elapsed / durationMs;
      const tempoDiff = workoutSettings.endTempo - workoutSettings.startTempo;

      // Change tempo in steps of 3 BPM
      const rawTempo = workoutSettings.startTempo + (tempoDiff * progress);
      return Math.round(rawTempo / 3) * 3;
    };

    let lastScheduledTempo = currentMeasureTempoRef.current;
    const intervalId = setInterval(() => {
      const targetTempo = calculateTargetTempo();
      // Only schedule tempo change if it's different by at least 3 BPM
      if (Math.abs(targetTempo - lastScheduledTempo) >= 3) {
        nextTempoRef.current = targetTempo;
        lastScheduledTempo = targetTempo;
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPlaying, workoutMode, workoutSettings]);

  // Reset workout timer when stopping
  useEffect(() => {
    if (!isPlaying) {
      workoutStartTimeRef.current = null;
      nextTempoRef.current = null;
      measureStartTimeRef.current = null;
      currentMeasureTempoRef.current = null;
    }
  }, [isPlaying]);

  return (
    <div className="h-full w-full flex justify-center items-center font-sans scroll-class">
      <div
        className="w-full h-full rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(#3a3a3a 1px, #1a1a1a 1px)', backgroundSize: '20px 20px' }}
      >


        <main className="flex-grow flex flex-row p-4 overflow-scroll scroll-class justify-between ">
          <Display
            tempo={tempo}
            tempoName={getTempoName(tempo)}
            timeSignature={timeSignature}
            currentBeat={currentBeat}
            accentLevels={accentLevels}
            onAccentChange={handleAccentChange}
            subdivision={subdivision}
            onTempoClick={() => setIsTempoInputOpen(true)}
            onTimeSignatureClick={() => setIsSettingsModalOpen(true)}
          />



          <div className="flex flex-row space-x-4 pt-4">
            <div className="w-full px-4 space-y-4">
              {/* <div className="flex flex-col space-y-2 bg-black/30 p-3 rounded-lg border border-gray-700 mt-2">
                <label className="text-gray-400 text-sm font-semibold">
                  Workout Mode
                </label>
                <div className="flex space-x-2">
                  <select
                    value={workoutMode}
                    onChange={(e) => {
                      setWorkoutMode(e.target.value);
                      if (e.target.value !== 'steady' && !workoutSettings) {
                        setWorkoutSettings({
                          startTempo: tempo,
                          endTempo: e.target.value === 'increase' ? tempo + 20 : tempo - 20,
                          duration: 5
                        });
                      }
                    }}
                    className="bg-gray-700 text-white p-2 rounded-md text-sm flex-grow text-center appearance-none border border-gray-600 focus:border-cyan-500 focus:outline-none"
                  >
                    {workoutModes.map(mode => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                  {workoutMode !== 'steady' && (
                    <button
                      onClick={() => setIsWorkoutSettingsOpen(true)}
                      className="px-4 py-2 bg-gray-700 text-white rounded-md border border-gray-600 hover:bg-gray-600"
                    >
                      Settings
                    </button>
                  )}
                </div>
              </div> */}
              <div className="w-full flex justify-around items-center px-4 flex-row space-x-4">
                <button onClick={() => setIsSettingsModalOpen(true)} className="px-6 py-3 bg-gray-700/80 text-white rounded-lg shadow-md border border-gray-600 hover:bg-gray-600/80 transition-colors text-xl font-semibold">
                  {timeSignature.beatsPerMeasure}/{timeSignature.beatValue}
                </button>
                <button onClick={() => setIsVolumeControlOpen(true)} className="p-3 bg-gray-700/80 text-white rounded-full shadow-md border border-gray-600 hover:bg-gray-600/80 transition-colors">
                  {getVolumeIcon()}
                </button>
                <button onClick={handleTap} className="px-8 py-3 bg-gray-700/80 text-white rounded-lg shadow-md border border-gray-600 hover:bg-gray-600/80 transition-colors text-xl font-semibold">
                  TAP
                </button>
              </div>
              <div className="flex over items-center justify-between space-x-4 bg-black/30 p-3 rounded-lg border border-gray-700">
                <label htmlFor="sound-type" className="text-gray-400 text-sm font-semibold">Sound</label>
                <select
                  id="sound-type"
                  value={soundType}
                  onChange={(e) => setSoundType(e.target.value)}
                  className="bg-gray-700 text-white p-2 rounded-md text-sm w-40 text-center appearance-none border border-gray-600 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="sine">Sine Wave</option>
                  <option value="square">Square Wave</option>
                  <option value="sawtooth">Sawtooth Wave</option>
                  <option value="triangle">Triangle Wave</option>
                  <option value="woodblock">Wood Block Pro</option>
                  <option value="tabla">Tabla Kit (Demo)</option>
                </select>
              </div>

            </div>


          </div>
          <div className=" flex items-center justify-center">
            <Dial
              tempo={tempo}
              isPlaying={isPlaying}
              onTempoChange={handleTempoChange}
              onTogglePlay={togglePlay}
            />
          </div>
        </main>
      </div>
      {isSettingsModalOpen && (
        <TimeSignatureModal
          currentTimeSignature={timeSignature}
          currentSubdivision={subdivision}
          onClose={() => setIsSettingsModalOpen(false)}
          onSave={handleSettingsSave}
        />
      )}
      {isTempoInputOpen && (
        <TempoInputModal
          currentTempo={tempo}
          onClose={() => setIsTempoInputOpen(false)}
          onSave={handleTempoSave}
        />
      )}
      {isVolumeControlOpen && (
        <VolumeControl
          volume={masterVolume}
          onVolumeChange={(v) => setMasterVolume(v)}
          onClose={() => setIsVolumeControlOpen(false)}
        />
      )}
      {isWorkoutSettingsOpen && (
        <WorkoutSettingsModal
          currentSettings={workoutSettings}
          onClose={() => setIsWorkoutSettingsOpen(false)}
          onSave={(settings) => {
            setWorkoutSettings(settings);
            setIsWorkoutSettingsOpen(false);
            if (isPlaying) {
              workoutStartTimeRef.current = performance.now();
            }
          }}
        />
      )}
    </div>
  );
};

export default App;
