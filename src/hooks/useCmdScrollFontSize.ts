import { useEffect, useRef } from 'react';
import type { FontSize } from '../types';
import { useUIStore } from '../store/uiStore';

const FONT_SIZE_ORDER: FontSize[] = ['xs', 'sm', 'md', 'lg', 'xl'];

/** Cmd+scroll (or Ctrl+scroll on Windows/Linux) to change app font size. */
export function useCmdScrollFontSize() {
  const fontSize = useUIStore((s) => s.fontSize);
  const setFontSize = useUIStore((s) => s.setFontSize);
  const fontSizeRef = useRef(fontSize);

  useEffect(() => {
    fontSizeRef.current = fontSize;
  }, [fontSize]);

  useEffect(() => {
    const STEP_COOLDOWN_MS = 120;
    let lastStepTime = 0;

    const onWheel = (e: WheelEvent) => {
      if ((!e.metaKey && !e.ctrlKey) || e.shiftKey) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastStepTime < STEP_COOLDOWN_MS) {
        return;
      }

      const idx = FONT_SIZE_ORDER.indexOf(fontSizeRef.current);
      if (idx === -1) {
        return;
      }

      // Scroll up (negative deltaY) -> larger text; scroll down -> smaller
      const delta = e.deltaY;
      if (delta === 0) {
        return;
      }

      const direction = delta < 0 ? 1 : -1;
      const nextIdx = Math.min(FONT_SIZE_ORDER.length - 1, Math.max(0, idx + direction));
      if (nextIdx !== idx) {
        lastStepTime = now;
        setFontSize(FONT_SIZE_ORDER[nextIdx]);
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [setFontSize]);
}
