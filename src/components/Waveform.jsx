import React, { useRef, useEffect, useState } from 'react';
// import type { NoteInfo, WaveformProps } from '../types';

const CENTS_RANGE = 50;
const HIT_TOLERANCE = 15; // pixels for clicking/hovering
const IN_TUNE_THRESHOLD_CENTS = 10; // The +/- range for the in-tune band

// // --- Scrubber Component ---
// interface ScrubberProps {
//   historyLength: number;
//   viewRange: [number, number];
//   onViewRangeChange: (newRange: [number, number]) => void;
//   isListening: boolean;
//   noteHistory: (NoteInfo | null)[];
// }

const Scrubber = ({ historyLength, viewRange, onViewRangeChange, isListening, noteHistory }) => {
  const scrubberRef = useRef(null);
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const dragStartRef = useRef({ x: 0, initialRange: [0, 0] });

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    if(noteHistory.length < 2) return;
    
    ctx.strokeStyle = 'rgba(22, 163, 175, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    
    let hasMovedTo = false;
    for (let i = 0; i < noteHistory.length; i++) {
        const x = (i / (noteHistory.length - 1)) * width;
        const note = noteHistory[i];
        if(note){
            const y = height/2 - (note.cents / CENTS_RANGE) * (height/2);
            if (!hasMovedTo) {
              ctx.moveTo(x, y);
              hasMovedTo = true;
            } else {
              ctx.lineTo(x, y);
            }
        } else {
          hasMovedTo = false;
        }
    }
    ctx.stroke();

  }, [noteHistory]);

  const handleMouseDown = (e, part) => {
    e.stopPropagation();
    if(isListening) return;
    setDragging(part);
    dragStartRef.current = { x: e.clientX, initialRange: viewRange };
  };

  const handleTouchStart = (e, part) => {
    e.preventDefault();
    if(isListening) return;
    setDragging(part);
    dragStartRef.current = { 
      x: e.touches[0].clientX, 
      initialRange: viewRange 
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging || !scrubberRef.current) return;
      
      const rect = scrubberRef.current.getBoundingClientRect();
      const deltaX = (e.clientX - dragStartRef.current.x) / rect.width;
      const initialRange = dragStartRef.current.initialRange;
      let [newStart, newEnd] = initialRange;

      if (dragging === 'body') {
        const width = initialRange[1] - initialRange[0];
        newStart = initialRange[0] + deltaX;
        // Clamp the start position to keep the whole range within bounds.
        newStart = Math.max(0, Math.min(1 - width, newStart));
        newEnd = newStart + width;
      } else if (dragging === 'left') {
        newStart = initialRange[0] + deltaX;
        // Clamp start and prevent it from crossing the end handle.
        newStart = Math.max(0, Math.min(newEnd - 0.01, newStart));
      } else if (dragging === 'right') {
        newEnd = initialRange[1] + deltaX;
        // Clamp end and prevent it from crossing the start handle.
        newEnd = Math.min(1, Math.max(newStart + 0.01, newEnd));
      }

      onViewRangeChange([newStart, newEnd]);
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, onViewRangeChange]);

  useEffect(() => {
    const handleTouchMove = (e) => {
      if (!dragging || !scrubberRef.current) return;
      
      const touch = e.touches[0];
      const rect = scrubberRef.current.getBoundingClientRect();
      const deltaX = (touch.clientX - dragStartRef.current.x) / rect.width;
      const initialRange = dragStartRef.current.initialRange;
      let [newStart, newEnd] = initialRange;

      if (dragging === 'body') {
        const width = initialRange[1] - initialRange[0];
        newStart = initialRange[0] + deltaX;
        // Clamp the start position to keep the whole range within bounds.
        newStart = Math.max(0, Math.min(1 - width, newStart));
        newEnd = newStart + width;
      } else if (dragging === 'left') {
        newStart = initialRange[0] + deltaX;
        // Clamp start and prevent it from crossing the end handle.
        newStart = Math.max(0, Math.min(newEnd - 0.01, newStart));
      } else if (dragging === 'right') {
        newEnd = initialRange[1] + deltaX;
        // Clamp end and prevent it from crossing the start handle.
        newEnd = Math.min(1, Math.max(newStart + 0.01, newEnd));
      }

      onViewRangeChange([newStart, newEnd]);
    };

    const handleTouchEnd = () => setDragging(null);

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dragging, onViewRangeChange]);

  if(historyLength < 2) return null;

  const left = `${viewRange[0] * 100}%`;
  const width = `${(viewRange[1] - viewRange[0]) * 100}%`;

  return (
    <div ref={scrubberRef} className="w-full h-8 bg-gray-900/70 rounded-md mt-2 relative touch-none select-none">
      <canvas ref={canvasRef} className="w-full h-full absolute top-0 left-0" width={800} height={32}/>
      <div
        className="absolute top-0 h-full bg-cyan-500/30 border-x-2 border-cyan-400 cursor-grab active:cursor-grabbing"
        style={{ left, width }}
        onMouseDown={(e) => handleMouseDown(e, 'body')}
        onTouchStart={(e) => handleTouchStart(e, 'body')}
      >
        <div 
          className="absolute left-0 top-0 h-full w-4 -ml-2 cursor-ew-resize" 
          onMouseDown={(e) => handleMouseDown(e, 'left')}
          onTouchStart={(e) => handleTouchStart(e, 'left')}
        />
        <div 
          className="absolute right-0 top-0 h-full w-4 -mr-2 cursor-ew-resize"
          onMouseDown={(e) => handleMouseDown(e, 'right')}
          onTouchStart={(e) => handleTouchStart(e, 'right')}
        />
      </div>
    </div>
  );
};

// --- Main Waveform Component ---
export const Waveform = ({ noteHistory, rmsHistory, isListening, onHistoryEdit, targetCents }) => {
  const canvasRef = useRef(null);
  const [editingPoint, setEditingPoint] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [viewRange, setViewRange] = useState([0, 1]); // [start, end] as percentage

  useEffect(() => {
    if (isListening) {
      const totalPoints = noteHistory.length;
      if (totalPoints < 2) {
        setViewRange([0, 1]);
        return;
      }
      
      const viewWindowInPoints = 150;
      const newStartPoint = Math.max(0, totalPoints - viewWindowInPoints);
      const newStartPercentage = totalPoints > 1 ? newStartPoint / (totalPoints - 1) : 0;
      const newViewRange = [newStartPercentage, 1];
      
      // Only update if there's a significant change
      const hasSignificantChange = 
        Math.abs(viewRange[0] - newViewRange[0]) > 0.001 || 
        Math.abs(viewRange[1] - newViewRange[1]) > 0.001;

      if (hasSignificantChange) {
        requestAnimationFrame(() => {
          setViewRange(newViewRange);
        });
      }
    }
  }, [noteHistory.length, isListening]); // Remove viewRange from dependencies
  
  const handleMouseDown = (e) => {
    if (isListening) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const closestIndex = findClosestPoint(mouseX, mouseY, HIT_TOLERANCE);

    if (closestIndex !== null && noteHistory[closestIndex]) {
      setEditingPoint({
        index: closestIndex,
        initialY: e.clientY - rect.top,
        initialCents: noteHistory[closestIndex].cents,
        yCenter: canvas.height * 0.75 / 2,
      });
    }
  };

  const handleTouchStart = (e) => {
    if (isListening) return;
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Convert touch coordinates to canvas space
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;
    
    const closestIndex = findClosestPoint(touchX, touchY, 50); // Increased touch area

    if (closestIndex !== null && noteHistory[closestIndex]) {
      e.preventDefault();
      const graphHeight = canvas.height * 0.75;
      const yCenter = graphHeight / 2;
      
      setEditingPoint({
        index: closestIndex,
        yCenter: yCenter,
        canvasHeight: canvas.height,
        scaleY: scaleY,
        initialCents: noteHistory[closestIndex].cents
      });
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    if (editingPoint) {
      const mouseY = e.clientY - rect.top;
      const deltaY = mouseY - editingPoint.initialY;
      const deltaCents = (-deltaY / editingPoint.yCenter) * CENTS_RANGE;
      const newCents = editingPoint.initialCents + deltaCents;
      const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, newCents));
      onHistoryEdit(editingPoint.index, clampedCents);
    } else if (!isListening) {
      // Hover detection
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      
      const closestIndex = findClosestPoint(mouseX, mouseY, HIT_TOLERANCE);
      setHoveredIndex(closestIndex);
    }
  };
  const calculateCentsFromY = (touchY, canvas, yCenter) => {
  const graphHeight = canvas.height * 0.75;
  const normalizedY = (touchY - yCenter) / (graphHeight / 2);
  return -normalizedY * CENTS_RANGE;
};

  
  const handleTouchMove = (e) => {
    if (!editingPoint || !canvasRef.current) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Convert touch coordinates to canvas space
    const touchY = (touch.clientY - rect.top) * editingPoint.scaleY;
    
    // Calculate new cents value based on touch position
    const newCents = calculateCentsFromY(touchY, canvas, editingPoint.yCenter);
    
    // Clamp the cents value
    const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, newCents));
    onHistoryEdit(editingPoint.index, clampedCents);
  };

  // Helper function to find the closest point
  const findClosestPoint = (x, y, tolerance) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const totalPoints = noteHistory.length;
    const startIndex = Math.floor(viewRange[0] * (totalPoints > 0 ? totalPoints - 1 : 0));
    const endIndex = Math.ceil(viewRange[1] * (totalPoints > 0 ? totalPoints - 1 : 0));
    const visiblePoints = endIndex - startIndex;
    const pointWidth = canvas.width / visiblePoints;
    
    let closestIndex = null;
    let minDistance = tolerance;

    for(let i = startIndex; i <= endIndex; i++) {
      const note = noteHistory[i];
      if(note) {
        const pointX = (i - startIndex) * pointWidth;
        const graphHeight = canvas.height * 0.75;
        const yCenter = graphHeight / 2;
        const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, note.cents));
        const pointY = yCenter - (clampedCents / CENTS_RANGE) * yCenter;
        
        const distance = Math.hypot(pointX - x, pointY - y);
        if(distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
    }
    return closestIndex;
  };

  const handleMouseUpOrLeave = () => {
    setEditingPoint(null);
  };
  
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const { width, height } = ctx.canvas;
    ctx.clearRect(0, 0, width, height);
    
    const totalPoints = noteHistory.length;
    if (totalPoints < 1) return;

    const startIndex = Math.floor(viewRange[0] * (totalPoints > 1 ? totalPoints - 1 : 0));
    const endIndex = Math.ceil(viewRange[1] * (totalPoints > 1 ? totalPoints - 1 : 0));
    const visiblePoints = endIndex - startIndex;
    if (visiblePoints <= 0) return;

    const pointWidth = width / visiblePoints;
    const graphHeight = height * 0.75;
    const volumeHeight = height * 0.25;
    const yCenter = graphHeight / 2;

    // --- Grid and Labels ---
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    ctx.font = '10px sans-serif';

    const yLabels = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];
    yLabels.forEach(label => {
        const y = yCenter - (label / CENTS_RANGE) * yCenter;
        
        const isZeroLine = label === 0;
        ctx.strokeStyle = isZeroLine ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillStyle = '#9CA3AF';

        // This block fixes the label positioning by using the correct textBaseline.
        if (label === CENTS_RANGE) {
            ctx.textBaseline = 'top';
        } else if (label === -CENTS_RANGE) {
            ctx.textBaseline = 'bottom';
        } else {
            ctx.textBaseline = 'middle';
        }
        ctx.fillText(label.toString(), 25, y);
    });
    ctx.textBaseline = 'alphabetic'; // Reset to default

    // --- In-tune background (Dynamic based on targetCents) ---
    const bandHeightInCents = IN_TUNE_THRESHOLD_CENTS * 2;
    const bandHeightInPixels = (bandHeightInCents / (CENTS_RANGE * 2)) * graphHeight;
    const yTargetCenter = yCenter - (targetCents / CENTS_RANGE) * yCenter;
    
    // 1. Draw the wider, lighter band
    ctx.fillStyle = 'rgba(22, 163, 175, 0.1)';
    ctx.fillRect(0, yTargetCenter - bandHeightInPixels / 2, width, bandHeightInPixels);
    
    // 2. Draw the narrower, darker band in the center for a professional look
    const innerBandHeight = bandHeightInPixels / 2.5;
    ctx.fillStyle = 'rgba(22, 163, 175, 0.2)';
    ctx.fillRect(0, yTargetCenter - innerBandHeight / 2, width, innerBandHeight);

    // --- Pitch line, Volume Bars, Note Labels ---
    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.fillStyle = 'rgba(22, 163, 175, 0.6)';
    
    let lastNoteName = null; let lastLabelX = -100; let hasMovedTo = false;

    for (let i = startIndex; i <= endIndex; i++) {
        const x = (i - startIndex) * pointWidth;
        const note = noteHistory[i];
        if (note) {
            const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, note.cents));
            const y = yCenter - (clampedCents / CENTS_RANGE) * yCenter;
            
            if (!hasMovedTo) { ctx.moveTo(x, y); hasMovedTo = true; } 
            else { ctx.lineTo(x, y); }

            if (note.name !== lastNoteName && Math.abs(x - lastLabelX) > 50) {
                ctx.save();
                ctx.shadowColor = "black"; ctx.shadowBlur = 6; ctx.fillStyle = 'white';
                ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
                const yPos = y < 20 ? y + 20 : y - 10;
                ctx.fillText(note.name, x, yPos);
                ctx.restore();
                lastNoteName = note.name; lastLabelX = x;
            } else if (note.name !== lastNoteName) { lastNoteName = note.name; }
        } else { hasMovedTo = false; }
        
        const rms = rmsHistory[i] || 0;
        const barHeight = Math.min(volumeHeight, (rms / 0.15) * volumeHeight);
        if (barHeight > 1) {
          ctx.fillRect(x, height - barHeight, Math.max(1, pointWidth * 0.8), barHeight);
        }
    }
    ctx.stroke();

    // --- Hovered point highlight ---
    if (hoveredIndex !== null && hoveredIndex >= startIndex && hoveredIndex <= endIndex) {
        const note = noteHistory[hoveredIndex];
        if (note) {
          const x = (hoveredIndex - startIndex) * pointWidth;
          const clampedCents = Math.max(-CENTS_RANGE, Math.min(CENTS_RANGE, note.cents));
          const y = yCenter - (clampedCents / CENTS_RANGE) * yCenter;
          
          ctx.beginPath(); ctx.arc(x, y, 6, 0, 2 * Math.PI);
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)"; ctx.fill();
          ctx.strokeStyle = "#06b6d4"; ctx.lineWidth = 2; ctx.stroke();
        }
    }
    
  }, [noteHistory, rmsHistory, isListening, viewRange, hoveredIndex, targetCents, onHistoryEdit]);
  
  return (
    <div className="bg-gray-800/50 rounded-2xl p-4 sm:p-6 backdrop-blur-sm border border-gray-700/50 shadow-lg relative">
      <h3 className="text-lg font-bold text-cyan-400 mb-2">تاریخچه کوک</h3>
      <canvas
        ref={canvasRef}
        width="800"
        height="200"
        className={`w-full h-40 sm:h-52 rounded-md bg-gray-900/50 border border-gray-700/30 
          ${!isListening && noteHistory.length > 1 ? 'cursor-crosshair' : ''} 
          touch-none select-none`}
        style={{
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
        onTouchCancel={handleMouseUpOrLeave}
      />
      <Scrubber 
        historyLength={noteHistory.length}
        viewRange={viewRange}
        onViewRangeChange={setViewRange}
        isListening={isListening}
        noteHistory={noteHistory}
      />
    </div>
  );
};