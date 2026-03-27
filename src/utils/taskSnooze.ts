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

export function getTomorrowMorningNine(baseMs: number = Date.now()): number {
  const nextMorning = new Date(baseMs);
  nextMorning.setDate(nextMorning.getDate() + 1);
  nextMorning.setHours(9, 0, 0, 0);
  return nextMorning.getTime();
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
