import type { Task, TaskSnooze, Board, Swimlane } from '../types';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

export function normalizeTaskSnooze(snooze: Task['snooze']): TaskSnooze | undefined {
  if (!snooze || typeof snooze.until !== 'number' || !Number.isFinite(snooze.until)) {
    return undefined;
  }

  return {
    until: snooze.until,
    awaitingAck: Boolean(snooze.awaitingAck),
  };
}

export function isTaskAwaitingAck(task: Task, now: number = Date.now()): boolean {
  return Boolean(task.snooze && (task.snooze.awaitingAck || task.snooze.until <= now));
}

export function isTaskSnoozed(task: Task, now: number = Date.now()): boolean {
  return Boolean(task.snooze && !isTaskAwaitingAck(task, now));
}

export function getTaskSortGroup(task: Task, now: number = Date.now()): number {
  if (isTaskAwaitingAck(task, now)) {
    return 0;
  }
  if (isTaskSnoozed(task, now)) {
    return 2;
  }
  return 1;
}

export function addMinutes(baseMs: number, minutes: number): number {
  return baseMs + minutes * MINUTE_MS;
}

export function addHours(baseMs: number, hours: number): number {
  return baseMs + hours * HOUR_MS;
}

export function getDaysFromNowAtHour(days: number, hour: number, baseMs: number = Date.now()): number {
  const target = new Date(baseMs);
  target.setDate(target.getDate() + days);
  target.setHours(hour, 0, 0, 0);
  return target.getTime();
}

/** Always at least one day ahead; on a Monday this returns the following Monday. */
export function getNextMondayAtHour(hour: number, baseMs: number = Date.now()): number {
  const next = new Date(baseMs);
  const daysUntilMonday = ((8 - next.getDay()) % 7) || 7;
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(hour, 0, 0, 0);
  return next.getTime();
}

export function formatSnoozeUntil(until: number, now: number = Date.now()): string {
  const target = new Date(until);
  const current = new Date(now);
  const startOfToday = new Date(current);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const startOfDayAfterTomorrow = new Date(startOfTomorrow);
  startOfDayAfterTomorrow.setDate(startOfDayAfterTomorrow.getDate() + 1);

  const timeLabel = target.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (target >= startOfToday && target < startOfTomorrow) {
    return `today at ${timeLabel}`;
  }

  if (target >= startOfTomorrow && target < startOfDayAfterTomorrow) {
    return `tomorrow at ${timeLabel}`;
  }

  return target.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getAwaitingAckCount(
  board: Board,
  swimlanes: Record<string, Swimlane>,
  tasks: Record<string, Task>,
  now: number = Date.now()
): number {
  let count = 0;
  for (const swimlaneId of board.swimlaneIds) {
    const swimlane = swimlanes[swimlaneId];
    if (!swimlane) continue;
    for (const taskId of swimlane.taskIds) {
      const task = tasks[taskId];
      if (task && isTaskAwaitingAck(task, now)) count++;
    }
  }
  return count;
}

export function toDateTimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * MINUTE_MS);
  return localDate.toISOString().slice(0, 16);
}

export interface SnoozePreset {
  label: string;
  getUntil: () => number;
}

export interface SnoozeCategory {
  label: string;
  presets: SnoozePreset[];
}

export type SnoozeMenuEntry = SnoozePreset | SnoozeCategory;

export function isSnoozeCategory(entry: SnoozeMenuEntry): entry is SnoozeCategory {
  return 'presets' in entry;
}

const SNOOZE_DAY_HOUR = 6;

const minutesPreset = (minutes: number): SnoozePreset => ({
  label: `${minutes} minutes`,
  getUntil: () => addMinutes(Date.now(), minutes),
});

const hoursPreset = (hours: number): SnoozePreset => ({
  label: hours === 1 ? '1 hour' : `${hours} hours`,
  getUntil: () => addHours(Date.now(), hours),
});

const daysPreset = (days: number): SnoozePreset => ({
  label: `${days} days`,
  getUntil: () => getDaysFromNowAtHour(days, SNOOZE_DAY_HOUR),
});

export const SNOOZE_MENU: SnoozeMenuEntry[] = [
  { label: '2 seconds', getUntil: () => Date.now() + 2_000 },
  { label: 'Minutes', presets: [10, 20, 30].map(minutesPreset) },
  { label: 'Hours', presets: [1, 2, 4, 6, 8].map(hoursPreset) },
  {
    label: 'Days',
    presets: [
      { label: 'Tomorrow morning', getUntil: () => getDaysFromNowAtHour(1, SNOOZE_DAY_HOUR) },
      { label: 'Next Monday', getUntil: () => getNextMondayAtHour(SNOOZE_DAY_HOUR) },
      ...[2, 3, 4].map(daysPreset),
    ],
  },
];
