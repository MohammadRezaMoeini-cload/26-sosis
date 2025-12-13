
import React, { useEffect, useRef } from 'react';

// interface VolumeControlProps {
//   volume: number;
//   onVolumeChange: (volume: number) => void;
//   onClose: () => void;
// }

const VolumeControl = ({ volume, onVolumeChange, onClose }) => {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/70 z-40 flex justify-center items-end" onClick={onClose}>
      <div 
        ref={panelRef}
        className="bg-gray-800/90 backdrop-blur-sm w-full max-w-sm rounded-t-2xl p-6 border-t border-gray-700 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slide-up {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .animate-slide-up {
            animation: slide-up 0.3s ease-out forwards;
          }
          input[type=range].volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 1.25rem; /* h-5 */
            width: 1.25rem; /* w-5 */
            border-radius: 9999px;
            background: #06b6d4; /* bg-cyan-500 */
            cursor: pointer;
            margin-top: -4px; /* Adjust thumb position for Chrome */
            box-shadow: 0 0 5px rgba(6, 182, 212, 0.5);
          }
           input[type=range].volume-slider::-moz-range-thumb {
            height: 1.25rem;
            width: 1.25rem;
            border-radius: 9999px;
            background: #06b6d4;
            cursor: pointer;
            border: none;
            box-shadow: 0 0 5px rgba(6, 182, 212, 0.5);
          }
        `}</style>
        <h3 className="text-center text-white font-bold mb-4">Master Volume</h3>
        <div className="w-full flex justify-center items-center py-4">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="volume-slider w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            aria-label="Master Volume"
          />
        </div>
      </div>
    </div>
  );
};

export default VolumeControl;
