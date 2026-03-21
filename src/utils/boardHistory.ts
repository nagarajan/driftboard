import type { Board, Swimlane, Task } from '../types';

export const MAX_HISTORY = 10;

/** Board data only (includes per-board theme on each Board). Font size is global, not in snapshot. */
export type HistorySnapshot = {
  boards: Record<string, Board>;
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  boardOrderIds: string[];
  activeBoardId: string | null;
};

export type HistoryEntry = {
  snapshot: HistorySnapshot;
  label: string;
};

export type HistoryStateFields = {
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
};

/** Fields included in undo/redo snapshots (not history stacks). */
export type HistorySnapshotFields = {
  boards: Record<string, Board>;
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  boardOrderIds: string[];
  activeBoardId: string | null;
};

export function takeSnapshot(state: HistorySnapshotFields): HistorySnapshot {
  return {
    boards: structuredClone(state.boards),
    swimlanes: structuredClone(state.swimlanes),
    tasks: structuredClone(state.tasks),
    boardOrderIds: [...state.boardOrderIds],
    activeBoardId: state.activeBoardId,
  };
}

/**
 * Append one undo step and clear redo stack.
 * Must run before any code that mutates nested objects reachable from `state`
 * (e.g. shallow copies of swimlanes/boards still share inner references with `state`).
 */
export function mergeHistory(
  state: HistorySnapshotFields & HistoryStateFields,
  label: string
): HistoryStateFields {
  return {
    historyPast: [...state.historyPast, { snapshot: takeSnapshot(state), label }].slice(
      -MAX_HISTORY
    ),
    historyFuture: [],
  };
}

export function restoreSnapshot(snapshot: HistorySnapshot): {
  boards: Record<string, Board>;
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  boardOrderIds: string[];
  activeBoardId: string | null;
} {
  return {
    boards: structuredClone(snapshot.boards),
    swimlanes: structuredClone(snapshot.swimlanes),
    tasks: structuredClone(snapshot.tasks),
    boardOrderIds: [...snapshot.boardOrderIds],
    activeBoardId: snapshot.activeBoardId,
  };
}

export const emptyHistoryState: HistoryStateFields = {
  historyPast: [],
  historyFuture: [],
};
