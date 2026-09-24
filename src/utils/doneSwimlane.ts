import type { Board, Swimlane, Task } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Completed tasks sitting in a "Done" swimlane are deleted this long after completion. */
export const AUTO_CLEAR_DONE_AFTER_MS = 7 * DAY_MS;

/** Human-readable retention window, for tooltips and toasts. */
export const AUTO_CLEAR_DONE_LABEL = '1 week';

/** How often the app re-checks for completed tasks that outlived the retention window. */
export const AUTO_CLEAR_SWEEP_INTERVAL_MS = 10 * 60 * 1000;

export function isDoneSwimlaneTitle(title: string): boolean {
  return title.trim().toLowerCase() === 'done';
}

/** Done swimlane of the board that owns `swimlaneId`, or null if that board has none. */
export function findDoneSwimlaneIdForSwimlane(
  swimlaneId: string,
  boards: Record<string, Board>,
  swimlanes: Record<string, Swimlane>
): string | null {
  const board = Object.values(boards).find((b) => b.swimlaneIds.includes(swimlaneId));
  if (!board) return null;

  for (const id of board.swimlaneIds) {
    const swimlane = swimlanes[id];
    if (swimlane && isDoneSwimlaneTitle(swimlane.title)) return id;
  }
  return null;
}

export interface DoneSweepPlan {
  /** Completed longer than the retention window ago; safe to delete. */
  expiredTaskIds: string[];
  /**
   * Completed but without a `completedAt` (completed before this feature existed, or
   * promoted from an already-completed subtask). Stamped with the sweep time so the
   * retention window starts now instead of deleting them immediately.
   */
  unstampedTaskIds: string[];
}

export function planDoneSweep(
  swimlanes: Record<string, Swimlane>,
  tasks: Record<string, Task>,
  now: number = Date.now()
): DoneSweepPlan {
  const expiredTaskIds: string[] = [];
  const unstampedTaskIds: string[] = [];

  for (const swimlane of Object.values(swimlanes)) {
    if (!isDoneSwimlaneTitle(swimlane.title)) continue;

    for (const taskId of swimlane.taskIds) {
      const task = tasks[taskId];
      if (!task?.completed) continue;

      if (typeof task.completedAt !== 'number') {
        unstampedTaskIds.push(taskId);
      } else if (now - task.completedAt >= AUTO_CLEAR_DONE_AFTER_MS) {
        expiredTaskIds.push(taskId);
      }
    }
  }

  return { expiredTaskIds, unstampedTaskIds };
}
