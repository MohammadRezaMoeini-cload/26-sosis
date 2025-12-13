
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMetronome } from './useMetronome';
import { MIN_TEMPO, MAX_TEMPO, getTempoName } from './constants';
import Display from './Display';
import Dial from './Dial';
import TimeSignatureModal from './TimeSignatureModal';
import TempoInputModal from './TempoInputModal';
import VolumeControl from './VolumeControl';
import { SettingsIcon, ListIcon, SpeakerIcon, SpeakerMutedIcon, SpeakerHalfIcon } from './icons';
import Auth from '/imports/ui/services/auth';
import MetronomeBroker from '/imports/ui/services/bbb-webrtc-sfu/metronome-broker';
import logger from '/imports/startup/client/logger';
import useDeduplicatedSubscription from '/imports/ui/core/hooks/useDeduplicatedSubscription';
import { USER_LIST_SUBSCRIPTION } from '/imports/ui/core/graphql/queries/users';
import { AnimatePresence, motion } from "framer-motion";
import blueCharm from '../assets/blueCharm.jpg';
import { useIntl } from 'react-intl';
import { intlMessages } from "../metronome/metronomeData&constants.jsx";

const canVibrate = () => 'vibrate' in navigator;

const App = ({ showModal, onClose, id, zIndex }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [timeSignature, setTimeSignature] = useState({ beatsPerMeasure: 4, beatValue: 4 });
  const [accentLevels, setAccentLevels] = useState([2, 2, 2, 2]);
  const [subdivision, setSubdivision] = useState(0);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTempoInputOpen, setIsTempoInputOpen] = useState(false);
  const [isVolumeControlOpen, setIsVolumeControlOpen] = useState(false);
  const [soundType, setSoundType] = useState('sine');
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [metronomeBroker, setMetronomeBroker] = useState(null);
  const [isPresenter, setIsPresenter] = useState(false);
  const [presenterInfo, setPresenterInfo] = useState({ userId: null, userName: null, timestamp: null });
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [mode, setMode] = useState('solo');
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [step, setStep] = useState('select');
  const [isVibrationEnabled, setIsVibrationEnabled] = useState(false);

  const intl = useIntl();
  const lastTapRef = useRef(0);
  const tapIntervalsRef = useRef([]);

  const handleTick = useCallback((beat) => {
    setCurrentBeat(beat);
    console.log(isPresenter, isBroadcasting, metronomeBroker)
    if (isPresenter && isBroadcasting && metronomeBroker) {
      const payload = {
        tempo,
        timeSignature,
        subdivision,
        accentLevels,
        currentBeat: beat,
        isPlaying,
        soundType,
        timestamp: Date.now()
      };
      metronomeBroker.sendMetronomeData(payload);
    }
  }, [tempo, timeSignature, subdivision, accentLevels, isPlaying, soundType, isPresenter, isBroadcasting, metronomeBroker]);
  const { audioContext } = useMetronome(
    tempo,
    timeSignature,
    subdivision,
    isPlaying,
    accentLevels,
    soundType,
    masterVolume,
    handleTick
  );

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

  const {
    data,
    loading,
    error
  } = useDeduplicatedSubscription(USER_LIST_SUBSCRIPTION, {
    variables: {
      offset: 0,
      limit: 100
    }
  });

  useEffect(() => {
    if (data?.user && Array.isArray(data.user)) {
      const formattedUsers = data.user.map(user => ({
        userId: user.userId,
        userName: user.name,
        role: user.role,
        isPresenter: user.presenter,
        isModerator: user.isModerator
      }));

      setConnectedUsers(formattedUsers);
    }
  }, [data, error, loading]);

  // Broadcast current tempo, time signature, and subdivision to host app for ruler/grid sync
  useEffect(() => {
    try {
      const evt = new CustomEvent('mix:metronomeGrid', { detail: { tempo, timeSignature, subdivision } });
      window.dispatchEvent(evt);
    } catch (e) {}
  }, [tempo, timeSignature, subdivision]);


  useEffect(() => {
    if (!Auth.sessionToken) {
      logger.error({
        logCode: 'metronome_websocket_auth_error',
        extraInfo: { error: 'No session token available' }
      }, 'Authentication failed - No session token');
      return;
    }

    const broker = new MetronomeBroker(
      Auth.userID,
      Auth.meetingID,
      { debug: true, signalCandidates: true }
    );

    broker.openWSConnection()
      .then(() => {
        setMetronomeBroker(broker);
        logger.info({
          logCode: 'metronome_websocket_opened',
          extraInfo: { meetingId: Auth.meetingID, userId: Auth.userID }
        }, 'Metronome WebSocket connection opened');
      })
      .catch(error => {
        logger.error({
          logCode: 'metronome_websocket_connection_failed',
          extraInfo: { error: error.message }
        }, 'Failed to open WebSocket connection');
      });

    return () => {
      if (broker) broker.stop();
    };
  }, []);

  useEffect(() => {
    if (metronomeBroker) {
      metronomeBroker.onPresenterUpdate = (data) => {
        setPresenterInfo(data);
        setIsPresenter(data.userId === Auth.userID);
      };

      metronomeBroker.onBroadcastStart = () => {
        setIsBroadcasting(true);
        if (!isPresenter) setMode('broadcast');
      };

      metronomeBroker.onBroadcastStop = () => {
        setIsBroadcasting(false);
        if (!isPresenter) setMode('solo');
      };

      metronomeBroker.onMetronomeData = (message) => {
        if (!isPresenter && mode === 'broadcast') {
          const { tempo, timeSignature, subdivision, accentLevels, currentBeat, isPlaying, soundType } = message.payload;
          setTempo(tempo);
          setTimeSignature(timeSignature);
          setSubdivision(subdivision);
          setAccentLevels(accentLevels);
          setCurrentBeat(currentBeat);
          setIsPlaying(isPlaying);
          setSoundType(soundType);
        }
      };
    }
  }, [metronomeBroker, isPresenter, mode]);
  const togglePlay = async () => {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    if (isPresenter && metronomeBroker) {
      if (!isPlaying && !isBroadcasting) {
        await metronomeBroker.startBroadcasting();
        setIsBroadcasting(true);
      } else if (isPlaying && isBroadcasting) {
        await metronomeBroker.stopBroadcasting();
        setIsBroadcasting(false);
      }
    }
    setIsPlaying(prev => !prev);
  };
  const sendMetronomeData = useCallback(() => {
    if (!metronomeBroker || !isPresenter || mode !== 'broadcast' || !isBroadcasting) {
      console.log("Cannot send metronome data:", {
        hasBroker: !!metronomeBroker,
        isPresenter,
        mode,
        isBroadcasting
      });
      return;
    }

    const payload = {
      tempo,
      timeSignature,
      subdivision,
      accentLevels,
      currentBeat,
      isPlaying,
      soundType,
      timestamp: Date.now()
    };

    try {
      console.log('Sending metronome data:', payload);
      metronomeBroker.sendMetronomeData(payload);
    } catch (error) {
      console.error('Error sending metronome data:', error);
      // If we get an error, we might need to reset the broadcasting state
      if (error.message.includes('not connected') || error.message.includes('failed')) {
        setIsBroadcasting(false);
      }
    }
  }, [
    metronomeBroker,
    isPresenter,
    mode,
    isBroadcasting,
    tempo,
    timeSignature,
    subdivision,
    accentLevels,
    currentBeat,
    isPlaying,
    soundType
  ]);


  const handleTickVibrate = useCallback((beat) => {
    setCurrentBeat(beat);

    // Vibrate on beats if enabled
    if (isVibrationEnabled && canVibrate()) {
      // Vibrate differently for accented beats
      const accentLevel = accentLevels[beat];
      if (accentLevel > 0) {
        // Stronger vibration for accented beats (100ms)
        // Light vibration for regular beats (50ms)
        navigator.vibrate(accentLevel > 2 ? 100 : 50);
      }
    }
  }, [isVibrationEnabled, accentLevels]);


  const handleTempoChange = (newTempo) => {
    const clampedTempo = Math.max(MIN_TEMPO, Math.min(MAX_TEMPO, newTempo));
    setTempo(clampedTempo);
  };

  const handleAccentChange = (beatIndex) => {
    setAccentLevels(current => {
      const newLevels = [...current];
      newLevels[beatIndex] = (newLevels[beatIndex] + 1) % 5;
      return newLevels;
    });
  };

  const handleSettingsSave = (newTimeSignature, newSubdivision) => {
    setTimeSignature(newTimeSignature);
    setSubdivision(newSubdivision);
    setIsSettingsModalOpen(false);
  };

  const handleTempoSave = (newTempo) => {
    setTempo(newTempo);
    setIsTempoInputOpen(false);
  };

  const handleTap = () => {
    const now = Date.now();
    const interval = now - lastTapRef.current;
    lastTapRef.current = now;

    if (interval > 2000) {
      tapIntervalsRef.current = [];
    } else {
      tapIntervalsRef.current.push(interval);
      if (tapIntervalsRef.current.length > 4) {
        tapIntervalsRef.current.shift();
      }
      const avgInterval = tapIntervalsRef.current.reduce((a, b) => a + b, 0) / tapIntervalsRef.current.length;
      const newTempo = Math.round(60000 / avgInterval);
      handleTempoChange(newTempo);
    }
  };

  const getVolumeIcon = () => {
    const props = { className: "w-6 h-6" };
    if (masterVolume === 0) return <SpeakerMutedIcon {...props} />;
    if (masterVolume < 0.5) return <SpeakerHalfIcon {...props} />;
    return <SpeakerIcon {...props} />;
  };

  const StepSelector = () => {
    return (
      <motion.section
        key="lobby"
        className="flex flex-col justify-center items-center h-full w-full p-2"
        style={{ backgroundImage: `${blueCharm}` }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <div className="bg-white/10 backdrop-blur-md rounded-2xl shadow-xl w-[90%] max-w-lg p-8 flex flex-col gap-8">
          <p className="text-lg">
            {presenterInfo.userId ? (
              <>
                🎙️ Current Presenter:{' '}
                <span className="font-semibold text-amber-300">
                  {presenterInfo.userName}
                </span>
                {isBroadcasting && (
                  <span className="ml-2 text-green-400">(Broadcasting)</span>
                )}
              </>
            ) : (
              <>Nobody is presenting yet</>
            )}
          </p>

          {isPresenter && (
            <motion.div
              key="presenter-assign"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="w-full max-w-md bg-white/10 backdrop-blur-md text-white rounded-2xl shadow-xl mt-6"
              style={{ padding: '20px' }}
            >
              <h3 className="text-lg font-semibold mb-3 text-amber-300"> {intl.formatMessage(intlMessages.presenterTitle)}</h3>

              <div className="relative w-full select-wrapper" >
                <select
                  className="select-with-arrow"
                  value={selectedUser || ''}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">{intl.formatMessage(intlMessages.presenterSelect)}</option>
                  {connectedUsers
                    .filter(user => user.userId !== Auth.userID)
                    .map(user => (
                      <option key={user.userId} value={user.userId}>
                        {user.userName}
                      </option>
                    ))}
                </select>

                <div className="arrow-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              <div className="w-full flex justify-center space-x-4">
                <button
                  style={{ width: '100%' }}
                  className="m-none w-full mt-4 py-2 rounded-lg bg-amber-400 text-indigo-900 font-semibold hover:bg-amber-300 active:scale-95 transition-all duration-200"
                  onClick={() => {
                    const user = connectedUsers.find(u => u.userId === selectedUser);
                    if (user && window.confirm(`Make ${user.userName} the next presenter?`)) {
                      metronomeBroker?.assignPresenter(user.userId, user.userName);
                    }
                  }}
                >
                  {intl.formatMessage(intlMessages.assignPresenter)}
                </button>
              </div>
            </motion.div>
          )}

          <div className="flex items-center justify-center">
            <label className="switch">
              <input
                type="checkbox"
                checked={mode === 'broadcast'}
                onChange={async () => {
                  setMode(mode === 'solo' ? 'broadcast' : 'solo');
                  await new Promise(resolve => setTimeout(resolve, 100));

                  if (mode === "broadcast") {
                    await metronomeBroker.startBroadcasting();
                    setIsBroadcasting(true);
                    console.log('Broadcast started successfully', isBroadcasting);

                  }
                }}
                disabled={isPlaying}
              />
              <span className="slider"></span>
            </label>
            <span className="ml-2">{mode === 'broadcast' ? 'Broadcast Mode' : 'Solo Mode'}</span>
          </div>

          <button
            onClick={() => setStep('metronome')}
            className="w-full p-2 rounded-xl bg-amber-400"
          >
            Continue
          </button>
        </div>
      </motion.section>
    );
  };

  if (!showModal) return null;
  return (
    <motion.div
      className={"modal-overlay expanded"}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      style={{
        zIndex: zIndex,
        backgroundImage: "radial-gradient(rgb(58, 58, 58) 1px, rgb(26, 26, 26) 1px)",
        backgroundSize: "20px 20px"
      }}>
      <div className="modal-header drag-handle custom-header">
        {/* عنوان سمت چپ */}
        <div className="header-title text-white  text-lg font-semibold" style={{ color: 'black' }}>
          {/* {intl.formatMessage(intlMessages.title)} */}
        </div>

        {/* آیکون‌ها سمت راست */}
        <div className="header-actions flex items-center gap-2 " style={{ width: "-webkit-fill-available" }}
        // style={{ width: window.innerWidth < 820 ? (isMinimized ? '50%' : '45%') : (isMinimized ? '50%' : '25%') }}>
        >
          <button
            className="cancel-drag back-button"
            onClick={() => {
              if (!isPlaying) {
                setStep('select');
              } else {
                alert('لطفاً ابتدا مترونوم را متوقف کنید');
              }
            }}
            title={intl.formatMessage(intlMessages.back)}
          >
            {/* آیکون برگشت */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <button
            className="cancel-drag close-button"
            onClick={onClose}
          // title={intl.formatMessage(intlMessages.close)}
          >
            {/* آیکون بستن */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {step === 'select' ? (
          <StepSelector />
        ) : (
          <div className="h-full w-full flex justify-center items-center font-sans p-2"
            style={{ zIndex: zIndex, backgroundImage: `${blueCharm}` }}>
            <div
              className="w-full  rounded-xl shadow-2xl flex flex-col overflow-hidden"
              style={{
                backgroundImage: 'radial-gradient(#3a3a3a 1px, #1a1a1a 1px)',
                backgroundSize: '20px 20px',
                aspectRatio: "23/30",
                maxWidth: "35rem"
              }}
            >
              {/* <header className="bg-gradient-to-b from-gray-700 to-gray-800 p-2 flex justify-between items-center shadow-md z-10">
                <h1 className="text-2xl font-bold text-amber-400" style={{textShadow: '1px 1px 2px #000'}}>Pro Metronome</h1>
                <div className="flex items-center space-x-2">
                <button className="text-gray-400 p-1 rounded-full bg-gray-600/50 hover:bg-gray-500/50"><SettingsIcon className="w-5 h-5"/></button>
                <button className="text-gray-400 p-1 rounded-full bg-gray-600/50 hover:bg-gray-500/50"><ListIcon className="w-5 h-5"/></button>
              </div>
               </header> */}

              <main className="flex-grow flex flex-col p-4">
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

                <div className="flex-grow flex items-center justify-center">
                  <Dial
                    tempo={tempo}
                    isPlaying={isPlaying}
                    onTempoChange={handleTempoChange}
                    onTogglePlay={togglePlay}
                    broker={metronomeBroker}
                  />
                </div>

                <div className="flex flex-col space-y-4 pt-4">
                  <div className="w-full px-4">
                    <div className="flex items-center justify-between space-x-4 bg-black/30 p-3 rounded-lg border border-gray-700">
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
                    {canVibrate() && (
                      <div className="flex items-center justify-between space-x-4 bg-black/30 p-3 rounded-lg border border-gray-700 mt-2">
                        <label className="text-gray-400 text-sm font-semibold">Vibration</label>
                        <label className="switch">
                          <input
                            type="checkbox"
                            checked={isVibrationEnabled}
                            onChange={() => setIsVibrationEnabled(prev => !prev)}
                          />
                          <span className="slider"></span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="w-full flex justify-around items-center px-4">
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
                onVolumeChange={setMasterVolume}
                onClose={() => setIsVolumeControlOpen(false)}
              />
            )}
          </div>
        )}

      </AnimatePresence>
    </motion.div >
  );
};

export default App;
