import React, { useEffect, useRef } from 'react';

type Props = {
  width?: number;
  height?: number;
  data?: Float32Array; // static waveform
};

export default function TrackWave({ width = 240, height = 36, data }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current; if (!canvas || !data || data.length === 0) return;
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0,0,width,height);
    
    // Draw waveform with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(0, 153, 255, 0.5)');  // accent color with opacity
    gradient.addColorStop(1, 'rgba(0, 153, 255, 0.2)');  // lighter variant
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    const mid = height/2;
    
    // Move to start
    const startI = Math.floor(0);
    const startV = Math.max(0, Math.min(1, data[startI] || 0));
    ctx.moveTo(0, mid + startV*mid);
    
    // Draw top curve
    for (let x=0; x<width; x++) {
      const i = Math.floor((x/width) * data.length);
      const v = Math.max(0, Math.min(1, data[i] || 0));
      const y = mid + v*mid;
      ctx.lineTo(x, y);
    }
    
    // Draw bottom curve
    for (let x=width-1; x>=0; x--) {
      const i = Math.floor((x/width) * data.length);
      const v = Math.max(0, Math.min(1, data[i] || 0));
      const y = mid - v*mid;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }, [data, width, height]);

  return <canvas ref={ref} style={{display:'block', width: `${width}px`, height: `${height}px`}} />;
}

