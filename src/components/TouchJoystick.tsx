import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface TouchJoystickProps {
  onMove: (forward: number, strafe: number) => void;
}

const MAX_RADIUS = 40;
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

    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > MAX_RADIUS) {
      const scale = MAX_RADIUS / dist;
      dx *= scale;
      dy *= scale;
    }

    setKnobOffset({ x: dx, y: dy });

    const normX = dx / MAX_RADIUS;
    const normY = -dy / MAX_RADIUS; // Upward drag => positive forward
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
      aria-label="Joystick táctil para caminar en primera persona"
      data-testid="touch-joystick"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`relative flex h-28 w-28 touch-none items-center justify-center rounded-full border transition-colors ${
        isActive
          ? 'border-rose-300/60 bg-[#0f0c1c]/90'
          : 'border-white/15 bg-[#0f0c1c]/80'
      } shadow-xl`}
    >
      {/* Directional subtle cross guides */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 text-[10px] font-medium text-stone-400"
      >
        ▲
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-2 text-[10px] font-medium text-stone-400"
      >
        ▼
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-2.5 text-[10px] font-medium text-stone-400"
      >
        ◀
      </span>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 text-[10px] font-medium text-stone-400"
      >
        ▶
      </span>

      {/* Thumb Knob */}
      <div
        aria-hidden="true"
        style={{
          transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
        }}
        className={`pointer-events-none h-11 w-11 rounded-full border shadow-md transition-colors ${
          isActive
            ? 'border-rose-200 bg-rose-500/85'
            : 'border-white/25 bg-white/20'
        }`}
      />
    </div>
  );
}
