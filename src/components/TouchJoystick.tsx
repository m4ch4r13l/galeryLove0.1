import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface TouchJoystickProps {
  onMove: (forward: number, strafe: number) => void;
}

const DEADZONE = 0.12;

export function TouchJoystick({ onMove }: TouchJoystickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    return () => {
      onMove(0, 0);
    };
  }, [onMove]);

  const updateFromClientPos = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = Math.max(24, rect.width / 2 - 18);

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      const scale = maxRadius / dist;
      dx *= scale;
      dy *= scale;
    }

    setKnobOffset({ x: dx, y: dy });

    const normX = dx / maxRadius;
    const normY = -dy / maxRadius; // Upward drag => positive forward
    const mag = Math.hypot(normX, normY);

    if (mag < DEADZONE) {
      onMove(0, 0);
    } else {
      onMove(normY, normX);
    }
  };

  const resetStick = () => {
    activePointerId.current = null;
    setIsActive(false);
    setKnobOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    e.stopPropagation();
    activePointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsActive(true);
    updateFromClientPos(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateFromClientPos(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    resetStick();
  };

  return (
    <div
      ref={baseRef}
      role="application"
      aria-label="Cruceta táctil para caminar en primera persona"
      data-testid="touch-joystick"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative flex h-24 w-24 sm:h-28 sm:w-28 [@media(max-height:460px)]:h-24 [@media(max-height:460px)]:w-24 touch-none items-center justify-center rounded-full border transition-colors ${
        isActive
          ? 'border-rose-300/60 bg-[#0f0c1c]/90'
          : 'border-white/15 bg-[#0f0c1c]/82'
      } shadow-xl`}
    >
      {/* Subtle cruceta axis lines */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 h-px bg-white/8"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-4 w-px bg-white/8"
      />

      {/* Directional subtle cross guides */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1.5 text-[9px] font-medium text-stone-400"
      >
        ▲
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-1.5 text-[9px] font-medium text-stone-400"
      >
        ▼
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2 text-[9px] font-medium text-stone-400"
      >
        ◀
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 text-[9px] font-medium text-stone-400"
      >
        ▶
      </span>

      {/* Thumb Knob */}
      <div
        aria-hidden="true"
        style={{
          transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
        }}
        className={`pointer-events-none h-10 w-10 sm:h-11 sm:w-11 [@media(max-height:460px)]:h-10 [@media(max-height:460px)]:w-10 rounded-full border shadow-md transition-colors ${
          isActive
            ? 'border-rose-200 bg-rose-500/85'
            : 'border-white/25 bg-white/20'
        }`}
      />
    </div>
  );
}
