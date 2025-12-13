
import React, { useRef, useCallback } from 'react';
import { PlayIcon, PauseIcon } from './icons';

// interface DialProps {
//   tempo: number;
//   isPlaying: boolean;
//   onTempoChange: (tempo: number) => void;
//   onTogglePlay: () => void;
// }

const Dial = ({ tempo, isPlaying, onTempoChange, onTogglePlay }) => {
  const dialRef = useRef(null);
  const startTempoRef = useRef(0);
  const lastAngleRef = useRef(0);
  const cumulativeRotationRef = useRef(0);

  const handleStart = (clientX, clientY) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = Math.atan2(clientY - centerY, clientX - centerX);
    
    startTempoRef.current = tempo;
    lastAngleRef.current = startAngle;
    cumulativeRotationRef.current = 0;
  };

  const handleMove = (clientX, clientY) => {
    if (!dialRef.current) return;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const currentAngle = Math.atan2(clientY - centerY, clientX - centerX);
    
    let angleDiff = currentAngle - lastAngleRef.current;
    
    if (angleDiff > Math.PI) {
      angleDiff -= 2 * Math.PI;
    } else if (angleDiff < -Math.PI) {
      angleDiff += 2 * Math.PI;
    }
    
    cumulativeRotationRef.current += angleDiff;
    lastAngleRef.current = currentAngle;

    const sensitivity = 120;
    const tempoChange = (cumulativeRotationRef.current / (2 * Math.PI)) * sensitivity;
    
    const newTempo = Math.round(startTempoRef.current + tempoChange);
    onTempoChange(newTempo);
  };

  // Mouse event handlers
  const handleMouseDown = (e) => {
    handleStart(e.clientX, e.clientY);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e) => {
    handleMove(e.clientX, e.clientY);
  }, []);

  const handleMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  // Touch event handlers
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
    e.preventDefault();
  };

  const handleTouchMove = useCallback((e) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
    e.preventDefault();
  }, []);

  const handleTouchEnd = useCallback(() => {
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  }, [handleTouchMove]);

  const rotation = tempo * 1.5;


  return (
    <div
      ref={dialRef}
      className="w-28 h-28 rounded-full bg-gradient-to-br from-gray-500 to-gray-800 flex items-center justify-center shadow-2xl cursor-grab active:cursor-grabbing relative p-4"
      style={{ touchAction: 'none' }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="w-full h-full rounded-full bg-gradient-to-b from-gray-700 to-gray-800 flex items-center justify-center shadow-inner relative"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Changed from bg-cyan-400 to custom golden color */}
        <div className="absolute w-2 h-4 rounded-full -top-1" style={{ backgroundColor: '#fdb813' }}></div>
      </div>

      {/* Changed from border-cyan-500/50 to custom golden color with opacity */}
      <div className="absolute w-[90%] h-[90%] rounded-full border-2 pointer-events-none" 
           style={{ borderColor: 'rgba(253, 184, 19, 0.5)' }}></div>

      <div className="absolute w-[70%] h-[70%] rounded-full bg-gradient-to-br from-gray-400 to-gray-600 shadow-lg flex items-center justify-center">
        <button
          onClick={async(e) => {
            e.stopPropagation();
            // if (broker) {
            //   await broker.startBroadcasting();
            // }
            onTogglePlay();
          }}
          className="w-[85%] h-[85%] rounded-full bg-gradient-to-br from-gray-600 to-gray-800 shadow-inner active:shadow-none flex items-center justify-center text-white"
        >
          {/* Changed from cyan/blue gradient to golden gradient */}
          <div className="w-[40%] h-[40%] rounded shadow-md flex items-center justify-center"
               style={{ background: 'linear-gradient(to bottom right, #fdb813, #d4940b)' }}>
            {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
          </div>
        </button>
      </div>
    </div>
  );
};

export default Dial;