import { useEffect, useRef } from 'react';
import { SWIMLANE_WIDTH_ORDER } from '../constants/swimlaneWidth';
import { useUIStore } from '../store/uiStore';

/** Cmd+Shift+scroll (or Ctrl+Shift+scroll on Windows/Linux) to change swimlane width. */
export function useCmdShiftScrollSwimlaneWidth() {
  const swimlaneWidth = useUIStore((s) => s.swimlaneWidth);
  const setSwimlaneWidth = useUIStore((s) => s.setSwimlaneWidth);
  const swimlaneWidthRef = useRef(swimlaneWidth);

  useEffect(() => {
    swimlaneWidthRef.current = swimlaneWidth;
  }, [swimlaneWidth]);

  useEffect(() => {
    const STEP_COOLDOWN_MS = 120;
    let lastStepTime = 0;

    const onWheel = (e: WheelEvent) => {
      if ((!e.metaKey && !e.ctrlKey) || !e.shiftKey) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastStepTime < STEP_COOLDOWN_MS) {
        return;
      }

      const idx = SWIMLANE_WIDTH_ORDER.indexOf(swimlaneWidthRef.current);
      if (idx === -1) {
        return;
      }

      // Shift+wheel is often emitted as horizontal scroll (deltaX), so use
      // whichever axis has movement for the step direction.
      const delta =
        Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (delta === 0) {
        return;
      }

      const direction = delta < 0 ? 1 : -1;
      const nextIdx = Math.min(
        SWIMLANE_WIDTH_ORDER.length - 1,
        Math.max(0, idx + direction)
      );

      if (nextIdx !== idx) {
        lastStepTime = now;
        setSwimlaneWidth(SWIMLANE_WIDTH_ORDER[nextIdx]);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [setSwimlaneWidth]);
}
