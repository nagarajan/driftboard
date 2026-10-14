import { useEffect } from 'react';

const CYCLE_MS = 5 * 60 * 1000;
const BURST_MS = 5000;
const BURST_CLASS = 'glow-burst';

/**
 * Pulses the "ready to acknowledge" glows for five seconds on each wall-clock
 * five minute boundary, leaving them as a steady glow in between. Aligning to
 * the clock rather than to mount time keeps every glow on screen in phase, so
 * the compositor has one short burst to animate per cycle instead of a
 * staggered burst per card.
 */
export function useGlowPulseSchedule() {
  useEffect(() => {
    const root = document.documentElement;
    let startTimer = 0;
    let endTimer = 0;

    // Clamped so that a timer firing a hair early can't immediately re-fire.
    const msUntilNextBoundary = () => Math.max(CYCLE_MS - (Date.now() % CYCLE_MS), 1000);

    const runBurst = () => {
      window.clearTimeout(endTimer);
      root.classList.add(BURST_CLASS);
      endTimer = window.setTimeout(() => root.classList.remove(BURST_CLASS), BURST_MS);
      startTimer = window.setTimeout(runBurst, msUntilNextBoundary());
    };

    startTimer = window.setTimeout(runBurst, msUntilNextBoundary());

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(endTimer);
      root.classList.remove(BURST_CLASS);
    };
  }, []);
}
