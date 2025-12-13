import React from "react";

type Props = {
  label?: string;
  value: number;              // controlled value
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;

  size?: number;              // px (outer diameter)
  showValue?: boolean;
  formatValue?: (v: number) => string;

  // rotation arc (default like common audio knobs)
  sweepDeg?: number;          // total degrees, default 270
  startDeg?: number;          // CCW end, default -135 (so arc is -135..+135)
  defaultValue?: number;      // double-click to reset
  disabled?: boolean;
  labelPosition?: "top" | "bottom";
  className?: string;
};

export default function RotaryKnob({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  size = 40,
  showValue = true,
  formatValue = (v) => (Math.round(v * 100) / 100).toString(),
  sweepDeg = 270,
  startDeg = -135,
  defaultValue,
  disabled = false,
  labelPosition = "bottom",
  className = "",
}: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  // Helpers
  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
  const snap = (v: number) => {
    const k = Math.round(v / step) * step;
    return clamp(k, min, max);
  };

  // Map value <-> angle
  const frac = clamp((value - min) / (max - min), 0, 1);
  const angle = startDeg + frac * sweepDeg;

  // Pointer angle with 0° at TOP and range [-180..180]
  const degFromPointer = (clientX: number, clientY: number) => {
    const r = ref.current!.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let deg = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI; // 0°=right
    deg += 90; // make 0°=top
    // normalize into [-180..180]
    while (deg > 180) deg -= 360;
    while (deg < -180) deg += 360;
    return deg;
  };

  const setFromAngle = (deg: number) => {
    const end = startDeg + sweepDeg;
    const clamped = clamp(deg, startDeg, end);
    const f = (clamped - startDeg) / sweepDeg;
    onChange(snap(min + f * (max - min)));
  };

  // Pointer handlers
  // const onPointerDown = (e: React.PointerEvent) => {
  //   if (disabled) return;
  //   dragging.current = true;
  //   (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  //   setFromAngle(degFromPointer(e.clientX, e.clientY));
  // };
  // const onPointerMove = (e: React.PointerEvent) => {
  //   if (!dragging.current || disabled) return;
  //   setFromAngle(degFromPointer(e.clientX, e.clientY));
  // };
  // const onPointerUp = () => (dragging.current = false);

  // // Wheel + keyboard
  // const onWheel = (e: React.WheelEvent) => {
  //   if (disabled) return;
  //   e.preventDefault();
  //   const mult = e.shiftKey ? 5 : 1;
  //   const delta = -Math.sign(e.deltaY || e.deltaX || 0) * step * mult;
  //   onChange(snap(value + delta));
  // };
  // const onKeyDown = (e: React.KeyboardEvent) => {
  //   if (disabled) return;
  //   const coarse = step * 10;
  //   let d = 0;
  //   if (e.key === "ArrowUp" || e.key === "ArrowRight") d = step;
  //   if (e.key === "ArrowDown" || e.key === "ArrowLeft") d = -step;
  //   if (e.key === "PageUp") d = coarse;
  //   if (e.key === "PageDown") d = -coarse;
  //   if (e.key === "Home") return onChange(min);
  //   if (e.key === "End") return onChange(max);
  //   if (d !== 0) {
  //     e.preventDefault();
  //     onChange(snap(value + d));
  //   }
  // };
  // const onDoubleClick = () => {
  //   if (defaultValue == null || disabled) return;
  //   onChange(snap(defaultValue));
  // };

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    e.stopPropagation();          // keep playhead from seeking
    e.preventDefault();           // avoid text selection/scroll
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setFromAngle(degFromPointer(e.clientX, e.clientY));
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || disabled) return;
    e.stopPropagation();          // keep drag local
    setFromAngle(degFromPointer(e.clientX, e.clientY));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    e.stopPropagation();
    dragging.current = false;
  };

  // Wheel + keyboard
  const onWheel = (e: React.WheelEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const mult = e.shiftKey ? 5 : 1;
    const delta = -Math.sign(e.deltaY || e.deltaX || 0) * step * mult;
    onChange(snap(value + delta));
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    e.stopPropagation();
    const coarse = step * 10;
    let d = 0;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") d = step;
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") d = -step;
    if (e.key === "PageUp") d = coarse;
    if (e.key === "PageDown") d = -coarse;
    if (e.key === "Home") return onChange(min);
    if (e.key === "End") return onChange(max);
    if (d !== 0) {
      e.preventDefault();
      onChange(snap(value + d));
    }
  };
  const onDoubleClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (defaultValue == null || disabled) return;
    onChange(snap(defaultValue));
  };
  const diameter = size;
  const radius = diameter / 2;
  const needleLen = radius - 6; // keep inside ring
  const fontSize = Math.max(9, Math.round(size * 0.26));

  return (
    <div className={`inline-flex flex-col items-center ${className}`} style={{ minWidth: diameter }} onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}>
      {label && labelPosition === "top" && (
        <div className="text-[10px] text-slate-200 leading-tight mb-1 truncate max-w-full" title={label}>
          {label}
        </div>
      )}

      <div
        ref={ref}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        tabIndex={0}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`relative grid place-items-center rounded-full outline-none ${disabled ? "opacity-40" : "cursor-grab active:cursor-grabbing"
          }`}
        style={{
          width: diameter,
          height: diameter,
          aspectRatio: "1 / 1",          // keep perfect circle even if parent flexes
          boxSizing: "border-box",
          background: "radial-gradient(circle at 30% 30%, #1f2937 0%, #0f172a 65%, #0b1220 100%)",
          boxShadow:
            "inset 0 2px 3px rgba(255,255,255,0.06), inset 0 -2px 4px rgba(0,0,0,0.6), 0 0 0 1px rgba(71,85,105,0.9)",
        }}
      >
        {/* inner ring */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ inset: 4, boxShadow: "0 0 0 1px rgba(148,163,184,0.35) inset" }}
        />

        {/* needle: wrapper rotates; stem moves upward -> perfect circle path */}
        <div
          className="absolute left-1/2 top-1/2 pointer-events-none"
          style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
        >
          <div
            style={{
              width: 2,
              height: needleLen,
              background: "#facc15",
              borderRadius: 9999,
              transform: "translateY(-100%)",
              boxShadow: "0 0 0 1px rgba(2,6,23,0.5)",
            }}
          />
        </div>
      </div>

      {showValue && (
        <div className="mt-1 text-center leading-tight" style={{ fontSize }}>
          <div className="text-slate-100 tabular-nums">{formatValue(value)}</div>
        </div>
      )}
      {label && labelPosition === "bottom" && (
        <div className="text-[10px] text-slate-300 leading-tight mt-0.5 truncate max-w-full">{label}</div>
      )}
    </div>
  );
}
