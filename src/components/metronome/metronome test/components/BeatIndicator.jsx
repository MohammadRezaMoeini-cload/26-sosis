
import React from 'react';

// interface BeatIndicatorProps {
//   isActive: boolean;
//   accentLevel: number;
//   onClick: () => void;
// }

const BeatIndicator = ({ isActive, accentLevel, onClick }) => {
  const accentHeight = `${accentLevel * 25}%`; // 0 -> 0%, 4 -> 100%

  return (
    <div
      className="w-10 h-full bg-gray-800 border border-gray-700 rounded-md cursor-pointer relative overflow-hidden"
      style={{ touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
      onPointerDown={(e) => { e.preventDefault(); onClick?.(); }}
      onTouchStart={(e) => {
        try {
          if (e.touches && e.touches.length >= 2) {
            // Two-finger tap: jump to strong (4) from any level, or to 0 if already max
            e.preventDefault();
            e.stopPropagation();
            const target = accentLevel < 4 ? 4 : 0;
            let steps = target - accentLevel;
            if (steps < 0) steps += 5; // wrap around modulo 5
            for (let i = 0; i < steps; i++) onClick?.();
          } else {
            e.preventDefault();
            onClick?.();
          }
        } catch {
          onClick?.();
        }
      }}
    >
      <div 
        className={`absolute bottom-0 left-0 w-full transition-all duration-100`}
        style={{ 
          height: '100%',
          backgroundColor: isActive ? '#fdb813' : '#8b6307',
          boxShadow: isActive ? '0 0 15px rgba(253, 184, 19, 0.8)' : 'none'
        }}
      ></div>
      <div 
        className={`absolute bottom-0 left-0 w-full transition-all duration-100`}
        style={{ 
          height: accentHeight,
          backgroundColor: isActive ? '#d4940b' : '#634705'
        }}
      ></div>
    </div>
  );
};

export default BeatIndicator;
