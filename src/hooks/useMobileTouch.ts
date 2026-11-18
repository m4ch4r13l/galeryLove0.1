import { useEffect, useState } from 'react';
import { detectMobileTouchDevice } from '../utils/galleryLogic';

function evaluateIsTouchMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return detectMobileTouchDevice({
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    hasOnTouchStart: 'ontouchstart' in window,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    anyCoarsePointer: window.matchMedia?.('(any-pointer: coarse)').matches ?? false,
    userAgent: navigator.userAgent ?? '',
    viewportWidth: window.innerWidth,
  });
}

export function useMobileTouch(): boolean {
  const [isMobileTouch, setIsMobileTouch] = useState<boolean>(evaluateIsTouchMobile);

  useEffect(() => {
    const update = () => setIsMobileTouch(evaluateIsTouchMobile());
    const coarseMq = window.matchMedia?.('(pointer: coarse)');
    const anyCoarseMq = window.matchMedia?.('(any-pointer: coarse)');

    window.addEventListener('resize', update);
    coarseMq?.addEventListener?.('change', update);
    anyCoarseMq?.addEventListener?.('change', update);

    return () => {
      window.removeEventListener('resize', update);
      coarseMq?.removeEventListener?.('change', update);
      anyCoarseMq?.removeEventListener?.('change', update);
    };
  }, []);

  return isMobileTouch;
}
