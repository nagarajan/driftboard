import type { SwimlaneWidth } from '../types';

export const SWIMLANE_WIDTH_OPTIONS: { value: SwimlaneWidth; label: string }[] = [
  { value: 75, label: '75%' },
  { value: 100, label: '100%' },
  { value: 125, label: '125%' },
  { value: 150, label: '150%' },
  { value: 175, label: '175%' },
  { value: 200, label: '200%' },
];

export const SWIMLANE_WIDTH_ORDER = SWIMLANE_WIDTH_OPTIONS.map((option) => option.value);
