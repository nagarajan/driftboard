import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, onSnapshot, type DocumentReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AppState, Board, Swimlane, Task, Subtask, FontSize, Theme, Priority } from '../types';
import { DEFAULT_BOARD_THEME } from '../types';
import { sanitizeEmail } from './authStore';
import { getFirstBoardId, getOrderedBoardIds, reorderIds } from '../utils/boardOrder';
import {
  PRIORITY_LABELS,
  normalizeTask,
  normalizeTasksRecord,
  sortSubtasksByPriority,
  sortSwimlanesTaskIdsByPriority,
  sortTaskIdsByPriority,
} from '../utils/priority';
import { formatSnoozeUntil, isTaskAwaitingAck } from '../utils/taskSnooze';
import {
  mergeHistory,
  takeSnapshot,
  restoreSnapshot,
  emptyHistoryState,
  MAX_HISTORY,
  type HistoryEntry,
} from '../utils/boardHistory';
import { showToast } from './toastStore';

export type { HistoryEntry } from '../utils/boardHistory';

export type HistoryOptions = { skipHistory?: boolean };

export interface ExportData {
  /** v5+ includes per-board theme, task/subtask priority, and task snooze state. */
  version: number;
  exportedAt: string;
  boards: Record<string, Board>;
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  /** Present in v2+ exports; ordered board ids (empty means sort by createdAt). */
  boardOrderIds?: string[];
}

interface BoardStore extends AppState {
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];

  pushHistory: (label: string) => void;
  undo: () => void;
  redo: () => void;

  // Board actions
  addBoard: (name: string, silent?: boolean) => void;
  renameBoard: (boardId: string, name: string) => void;
  deleteBoard: (boardId: string) => void;
  setActiveBoard: (boardId: string) => void;
  reorderBoardsByDrag: (activeId: string, overId: string, options?: HistoryOptions) => void;

  // Swimlane actions
  addSwimlane: (boardId: string, title: string) => void;
  renameSwimlane: (swimlaneId: string, title: string) => void;
  deleteSwimlane: (swimlaneId: string) => void;
  moveSwimlaneToBoard: (swimlaneId: string, targetBoardId: string) => void;
  reorderSwimlanes: (boardId: string, swimlaneIds: string[], options?: HistoryOptions) => void;

  // Task actions
  addTask: (swimlaneId: string, title: string) => void;
  renameTask: (taskId: string, title: string) => void;
  setTaskPriority: (taskId: string, priority: Priority) => void;
  setTaskNote: (taskId: string, note: string) => void;
  deleteTaskNote: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskComplete: (taskId: string) => void;
  snoozeTask: (taskId: string, until: number) => void;
  acknowledgeTask: (taskId: string) => void;
  activateDueSnoozedTasks: (now?: number) => void;
  moveTask: (
    taskId: string,
    fromSwimlaneId: string,
    toSwimlaneId: string,
    newIndex?: number,
    options?: HistoryOptions
  ) => void;
  reorderTasks: (swimlaneId: string, taskIds: string[], options?: HistoryOptions) => void;

  // Subtask actions
  addSubtask: (taskId: string, title: string) => void;
  renameSubtask: (taskId: string, subtaskId: string, title: string) => void;
  setSubtaskPriority: (taskId: string, subtaskId: string, priority: Priority) => void;
  setSubtaskNote: (taskId: string, subtaskId: string, note: string) => void;
  deleteSubtaskNote: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  toggleSubtaskComplete: (taskId: string, subtaskId: string) => void;
  reorderSubtasks: (taskId: string, subtaskIds: string[], options?: HistoryOptions) => void;

  // Settings
  setFontSize: (size: FontSize) => void;
  setBoardTheme: (boardId: string, theme: Theme) => void;

  // Import/Export
  getExportData: () => ExportData;
  importData: (data: ExportData) => { importedBoards: number; renamedBoards: string[] };

  // Firestore sync
  _isRemoteUpdate: boolean;
  _setIsRemoteUpdate: (value: boolean) => void;
}

// Current user's Firestore document (null = guest mode, no Firebase sync)
let currentUserEmail: string | null = null;
let firestoreDoc: DocumentReference | null = null;

// Track when we should block Firestore updates
let blockUntil = 0;
let pendingSaveTimeout: ReturnType<typeof setTimeout> | null = null;

// Check if we should block Firestore updates
const shouldBlockFirestoreUpdates = () => Date.now() < blockUntil;

// Extend the block period (called on every local change)
const extendBlockPeriod = (ms: number) => {
  const newBlockUntil = Date.now() + ms;
  if (newBlockUntil > blockUntil) {
    blockUntil = newBlockUntil;
  }
};

const findSwimlaneIdForTask = (
  swimlanes: Record<string, Swimlane>,
  taskId: string
): string | null => {
  for (const swimlane of Object.values(swimlanes)) {
    if (swimlane.taskIds.includes(taskId)) {
      return swimlane.id;
    }
  }
  return null;
};

const moveTaskIdToFront = (taskIds: string[], taskId: string): string[] => [
  taskId,
  ...taskIds.filter((id) => id !== taskId),
];

const firestorePayload = (state: AppState) => ({
  boards: state.boards,
  swimlanes: state.swimlanes,
  tasks: state.tasks,
  boardOrderIds: state.boardOrderIds,
  updatedAt: Date.now(),
});

/** Writes board data immediately (no debounce). Use when boardOrderIds changes so refresh does not lose order. */
const saveToFirestoreImmediate = (state: AppState) => {
  if (!firestoreDoc) {
    return;
  }
  extendBlockPeriod(3000);
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
    pendingSaveTimeout = null;
  }
  const docRef = firestoreDoc;
  console.log('Saving to Firestore (immediate)');
  setDoc(docRef, firestorePayload(state))
    .then(() => {
      console.log('Successfully saved to Firestore (immediate)');
      extendBlockPeriod(2000);
    })
    .catch((error) => {
      console.error('Failed to save to Firestore (immediate):', error);
    });
};

// Save to Firestore (debounced to avoid too many writes)
const saveToFirestore = (state: AppState) => {
  // Only save if we have a Firestore document (signed in)
  if (!firestoreDoc) {
    return;
  }
  
  // Block Firestore updates for 3 seconds from now
  // This gets extended with each new local change
  extendBlockPeriod(3000);
  
  // Clear any pending save
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
  }
  
  const docRef = firestoreDoc;
  pendingSaveTimeout = setTimeout(() => {
    console.log('Saving to Firestore...');
    setDoc(docRef, firestorePayload(state))
      .then(() => {
        console.log('Successfully saved to Firestore');
        // Extend block a bit more after save completes
        extendBlockPeriod(2000);
      })
      .catch((error) => {
        console.error('Failed to save to Firestore:', error);
      });
  }, 200);
};

const createDefaultBoard = (): { board: Board; swimlanes: Swimlane[] } => {
  const todoId = uuidv4();
  const inProgressId = uuidv4();
  const doneId = uuidv4();

  return {
    board: {
      id: uuidv4(),
      name: 'My Board',
      swimlaneIds: [todoId, inProgressId, doneId],
      createdAt: Date.now(),
      theme: DEFAULT_BOARD_THEME,
    },
    swimlanes: [
      { id: todoId, title: 'To Do', taskIds: [] },
      { id: inProgressId, title: 'In Progress', taskIds: [] },
      { id: doneId, title: 'Done', taskIds: [] },
    ],
  };
};

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      boards: {},
      swimlanes: {},
      tasks: {},
      boardOrderIds: [] as string[],
      activeBoardId: null,
      fontSize: 'md' as FontSize,
      _isRemoteUpdate: false,
      historyPast: [] as HistoryEntry[],
      historyFuture: [] as HistoryEntry[],

      _setIsRemoteUpdate: (value: boolean) => {
        set({ _isRemoteUpdate: value });
      },

      pushHistory: (label: string) => {
        set((state) => ({ ...mergeHistory(state, label) }));
      },

      undo: () => {
        const state = get();
        if (state.historyPast.length === 0) {
          showToast('Undo is not available', 'delete');
          return;
        }
        const past = [...state.historyPast];
        const last = past.pop()!;
        const currentSnapshot = takeSnapshot(state);
        set({
          ...restoreSnapshot(last.snapshot),
          historyPast: past,
          historyFuture: [{ snapshot: currentSnapshot, label: last.label }, ...state.historyFuture],
        });
        showToast(`Undid: ${last.label}`, 'edit');
      },

      redo: () => {
        const state = get();
        if (state.historyFuture.length === 0) {
          showToast('Redo is not available', 'delete');
          return;
        }
        const future = [...state.historyFuture];
        const next = future.shift()!;
        const currentSnapshot = takeSnapshot(state);
        set({
          ...restoreSnapshot(next.snapshot),
          historyPast: [...state.historyPast, { snapshot: currentSnapshot, label: next.label }].slice(
            -MAX_HISTORY
          ),
          historyFuture: future,
        });
        showToast(`Redid: ${next.label}`, 'edit');
      },

      // Board actions
      addBoard: (name: string, silent?: boolean) => {
        const { board, swimlanes } = createDefaultBoard();
        board.name = name;
        board.createdAt = Date.now();

        set((state) => {
          const newSwimlanes = { ...state.swimlanes };
          swimlanes.forEach((sl) => {
            newSwimlanes[sl.id] = sl;
          });

          const boardOrderIds =
            state.boardOrderIds.length > 0
              ? [...state.boardOrderIds, board.id]
              : state.boardOrderIds;

          const h = mergeHistory(state, `Add board "${name}"`);

          return {
            boards: { ...state.boards, [board.id]: board },
            swimlanes: newSwimlanes,
            boardOrderIds,
            activeBoardId: state.activeBoardId || board.id,
            ...h,
          };
        });
        if (!silent) {
          showToast(`Board "${name}" added`, 'add');
        }
      },

      renameBoard: (boardId: string, name: string) => {
        set((state) => {
          const h = mergeHistory(state, `Rename board to "${name}"`);
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...state.boards[boardId], name },
            },
            ...h,
          };
        });
        showToast(`Board renamed to "${name}"`, 'edit');
      },

      deleteBoard: (boardId: string) => {
        let deletedName = '';
        set((state) => {
          const board = state.boards[boardId];
          if (!board) return state;
          deletedName = board.name;

          const newBoards = { ...state.boards };
          delete newBoards[boardId];

          const newSwimlanes = { ...state.swimlanes };
          const newTasks = { ...state.tasks };

          board.swimlaneIds.forEach((slId) => {
            const swimlane = state.swimlanes[slId];
            if (swimlane) {
              swimlane.taskIds.forEach((taskId) => {
                delete newTasks[taskId];
              });
              delete newSwimlanes[slId];
            }
          });

          const newBoardOrderIds = state.boardOrderIds.filter((id) => id !== boardId);

          const newActiveBoardId =
            state.activeBoardId === boardId
              ? getFirstBoardId(newBoards, newBoardOrderIds)
              : state.activeBoardId;

          const h = mergeHistory(state, `Delete board "${board.name}"`);

          return {
            boards: newBoards,
            swimlanes: newSwimlanes,
            tasks: newTasks,
            boardOrderIds: newBoardOrderIds,
            activeBoardId: newActiveBoardId,
            ...h,
          };
        });
        if (deletedName) {
          showToast(`Board "${deletedName}" deleted`, 'delete');
        }
      },

      setActiveBoard: (boardId: string) => {
        set({ activeBoardId: boardId });
      },

      reorderBoardsByDrag: (activeId: string, overId: string, options?: HistoryOptions) => {
        let changed = false;
        set((state) => {
          const ids = getOrderedBoardIds(state.boards, state.boardOrderIds);
          const oldIndex = ids.indexOf(activeId);
          const newIndex = ids.indexOf(overId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return {};
          }
          changed = true;
          const h = options?.skipHistory ? {} : mergeHistory(state, 'Reorder boards');
          return { boardOrderIds: reorderIds(ids, oldIndex, newIndex), ...h };
        });
        if (changed) {
          showToast('Board order updated', 'move');
        }
      },

      // Swimlane actions
      addSwimlane: (boardId: string, title: string) => {
        const swimlane: Swimlane = {
          id: uuidv4(),
          title,
          taskIds: [],
        };

        set((state) => {
          const h = mergeHistory(state, `Add column "${title}"`);
          return {
            swimlanes: { ...state.swimlanes, [swimlane.id]: swimlane },
            boards: {
              ...state.boards,
              [boardId]: {
                ...state.boards[boardId],
                swimlaneIds: [...state.boards[boardId].swimlaneIds, swimlane.id],
              },
            },
            ...h,
          };
        });
        showToast(`Column "${title}" added`, 'add');
      },

      renameSwimlane: (swimlaneId: string, title: string) => {
        set((state) => {
          const h = mergeHistory(state, `Rename column to "${title}"`);
          return {
            swimlanes: {
              ...state.swimlanes,
              [swimlaneId]: { ...state.swimlanes[swimlaneId], title },
            },
            ...h,
          };
        });
        showToast(`Column renamed to "${title}"`, 'edit');
      },

      deleteSwimlane: (swimlaneId: string) => {
        let removedTitle = '';
        set((state) => {
          const swimlane = state.swimlanes[swimlaneId];
          if (!swimlane) return state;
          removedTitle = swimlane.title;

          const h = mergeHistory(state, `Delete column "${swimlane.title}"`);

          const newSwimlanes = { ...state.swimlanes };
          delete newSwimlanes[swimlaneId];

          const newTasks = { ...state.tasks };
          swimlane.taskIds.forEach((taskId) => {
            delete newTasks[taskId];
          });

          const newBoards = { ...state.boards };
          for (const bid of Object.keys(newBoards)) {
            const b = newBoards[bid];
            if (b.swimlaneIds.includes(swimlaneId)) {
              newBoards[bid] = {
                ...b,
                swimlaneIds: b.swimlaneIds.filter((id) => id !== swimlaneId),
              };
            }
          }

          return { swimlanes: newSwimlanes, tasks: newTasks, boards: newBoards, ...h };
        });
        if (removedTitle) {
          showToast(`Column "${removedTitle}" deleted`, 'delete');
        }
      },

      moveSwimlaneToBoard: (swimlaneId: string, targetBoardId: string) => {
        let title = '';
        set((state) => {
          const sl = state.swimlanes[swimlaneId];
          if (!sl) return state;
          title = sl.title;
          const h = mergeHistory(state, `Move column "${sl.title}" to another board`);
          const newBoards = { ...state.boards };

          // Remove from current board
          Object.values(newBoards).forEach((board) => {
            if (board.swimlaneIds.includes(swimlaneId)) {
              board.swimlaneIds = board.swimlaneIds.filter((id) => id !== swimlaneId);
            }
          });

          // Add to target board
          if (newBoards[targetBoardId]) {
            newBoards[targetBoardId] = {
              ...newBoards[targetBoardId],
              swimlaneIds: [...newBoards[targetBoardId].swimlaneIds, swimlaneId],
            };
          }

          return { boards: newBoards, ...h };
        });
        const targetName = get().boards[targetBoardId]?.name ?? 'board';
        if (title) {
          showToast(`Column "${title}" moved to "${targetName}"`, 'move');
        }
      },

      reorderSwimlanes: (boardId: string, swimlaneIds: string[], options?: HistoryOptions) => {
        set((state) => {
          const h = options?.skipHistory ? {} : mergeHistory(state, 'Reorder columns');
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...state.boards[boardId], swimlaneIds },
            },
            ...h,
          };
        });
      },

      // Task actions
      addTask: (swimlaneId: string, title: string) => {
        const task: Task = {
          id: uuidv4(),
          title,
          completed: false,
          priority: 'none',
          subtasks: [],
        };

        set((state) => {
          const h = mergeHistory(state, `Add task "${title}"`);
          const nextTasks = { ...state.tasks, [task.id]: task };
          return {
            tasks: nextTasks,
            swimlanes: {
              ...state.swimlanes,
              [swimlaneId]: {
                ...state.swimlanes[swimlaneId],
                taskIds: sortTaskIdsByPriority(
                  [...state.swimlanes[swimlaneId].taskIds, task.id],
                  nextTasks
                ),
              },
            },
            ...h,
          };
        });
        showToast(`Task "${title}" added`, 'add');
      },

      renameTask: (taskId: string, title: string) => {
        set((state) => {
          const h = mergeHistory(state, `Rename task to "${title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: { ...state.tasks[taskId], title },
            },
            ...h,
          };
        });
        showToast(`Task renamed to "${title}"`, 'edit');
      },

      setTaskPriority: (taskId: string, priority: Priority) => {
        let taskTitle = '';
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || task.priority === priority) {
            return state;
          }

          taskTitle = task.title;
          const nextTasks = {
            ...state.tasks,
            [taskId]: { ...task, priority },
          };
          const swimlaneId = findSwimlaneIdForTask(state.swimlanes, taskId);
          const nextSwimlanes =
            swimlaneId && state.swimlanes[swimlaneId]
              ? {
                  ...state.swimlanes,
                  [swimlaneId]: {
                    ...state.swimlanes[swimlaneId],
                    taskIds: sortTaskIdsByPriority(state.swimlanes[swimlaneId].taskIds, nextTasks),
                  },
                }
              : state.swimlanes;
          const h = mergeHistory(
            state,
            `Set task "${task.title}" priority to ${PRIORITY_LABELS[priority].toLowerCase()}`
          );

          return {
            tasks: nextTasks,
            swimlanes: nextSwimlanes,
            ...h,
          };
        });

        if (taskTitle) {
          showToast(
            `Task "${taskTitle}" priority set to ${PRIORITY_LABELS[priority].toLowerCase()}`,
            'edit'
          );
        }
      },

      setTaskNote: (taskId: string, note: string) => {
        const trimmedNote = note.trim();
        let taskTitle = '';
        let saved = false;
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || !trimmedNote || task.note === trimmedNote) {
            return state;
          }
          taskTitle = task.title;
          saved = true;
          const actionLabel = task.note ? 'Update' : 'Add';
          const h = mergeHistory(state, `${actionLabel} note for task "${task.title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: { ...task, note: trimmedNote },
            },
            ...h,
          };
        });
        if (saved) {
          showToast(`Note saved for "${taskTitle}"`, 'edit');
        }
      },

      deleteTaskNote: (taskId: string) => {
        let taskTitle = '';
        let deleted = false;
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || !task.note) {
            return state;
          }
          taskTitle = task.title;
          deleted = true;
          const h = mergeHistory(state, `Delete note for task "${task.title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: { ...task, note: undefined },
            },
            ...h,
          };
        });
        if (deleted) {
          showToast(`Note deleted for "${taskTitle}"`, 'delete');
        }
      },

      deleteTask: (taskId: string) => {
        let removedTitle = '';
        set((state) => {
          const t = state.tasks[taskId];
          if (!t) return state;
          removedTitle = t.title;

          const h = mergeHistory(state, `Delete task "${t.title}"`);

          const newTasks = { ...state.tasks };
          delete newTasks[taskId];

          const newSwimlanes = { ...state.swimlanes };
          for (const sl of Object.values(state.swimlanes)) {
            if (sl.taskIds.includes(taskId)) {
              newSwimlanes[sl.id] = {
                ...sl,
                taskIds: sl.taskIds.filter((id) => id !== taskId),
              };
            }
          }

          return { tasks: newTasks, swimlanes: newSwimlanes, ...h };
        });
        if (removedTitle) {
          showToast(`Task "${removedTitle}" deleted`, 'delete');
        }
      },

      toggleTaskComplete: (taskId: string) => {
        let nowComplete = false;
        let taskTitle = '';
        set((state) => {
          const t = state.tasks[taskId];
          if (!t) return state;
          taskTitle = t.title;
          nowComplete = !t.completed;
          const h = mergeHistory(
            state,
            nowComplete ? `Mark task "${t.title}" complete` : `Mark task "${t.title}" incomplete`
          );
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...t,
                completed: !t.completed,
              },
            },
            ...h,
          };
        });
        if (taskTitle) {
          showToast(
            nowComplete ? `Task "${taskTitle}" marked complete` : `Task "${taskTitle}" marked incomplete`,
            'edit'
          );
        }
      },

      snoozeTask: (taskId: string, until: number) => {
        if (!Number.isFinite(until) || until <= Date.now()) {
          return;
        }

        let taskTitle = '';
        let saved = false;
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) {
            return state;
          }

          taskTitle = task.title;
          saved = true;
          const nextTasks = {
            ...state.tasks,
            [taskId]: {
              ...task,
              snooze: {
                until,
                awaitingAck: false,
              },
            },
          };
          const swimlaneId = findSwimlaneIdForTask(state.swimlanes, taskId);
          const nextSwimlanes =
            swimlaneId && state.swimlanes[swimlaneId]
              ? {
                  ...state.swimlanes,
                  [swimlaneId]: {
                    ...state.swimlanes[swimlaneId],
                    taskIds: sortTaskIdsByPriority(state.swimlanes[swimlaneId].taskIds, nextTasks),
                  },
                }
              : state.swimlanes;
          const h = mergeHistory(state, `Snooze task "${task.title}"`);

          return {
            tasks: nextTasks,
            swimlanes: nextSwimlanes,
            ...h,
          };
        });

        if (saved) {
          showToast(`Task "${taskTitle}" snoozed until ${formatSnoozeUntil(until)}`, 'edit');
        }
      },

      acknowledgeTask: (taskId: string) => {
        let taskTitle = '';
        let acknowledged = false;
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || !task.snooze || !isTaskAwaitingAck(task)) {
            return state;
          }

          taskTitle = task.title;
          acknowledged = true;
          const nextTasks = {
            ...state.tasks,
            [taskId]: {
              ...task,
              snooze: undefined,
            },
          };
          const swimlaneId = findSwimlaneIdForTask(state.swimlanes, taskId);
          const nextSwimlanes =
            swimlaneId && state.swimlanes[swimlaneId]
              ? {
                  ...state.swimlanes,
                  [swimlaneId]: {
                    ...state.swimlanes[swimlaneId],
                    taskIds: sortTaskIdsByPriority(
                      moveTaskIdToFront(state.swimlanes[swimlaneId].taskIds, taskId),
                      nextTasks
                    ),
                  },
                }
              : state.swimlanes;
          const h = mergeHistory(state, `Acknowledge task "${task.title}"`);

          return {
            tasks: nextTasks,
            swimlanes: nextSwimlanes,
            ...h,
          };
        });

        if (acknowledged) {
          showToast(`Task "${taskTitle}" acknowledged`, 'edit');
        }
      },

      activateDueSnoozedTasks: (now: number = Date.now()) => {
        let activatedCount = 0;
        set((state) => {
          const dueTaskIds = Object.values(state.tasks)
            .filter((task) => task.snooze && !task.snooze.awaitingAck && task.snooze.until <= now)
            .sort((a, b) => a.snooze!.until - b.snooze!.until)
            .map((task) => task.id);

          if (dueTaskIds.length === 0) {
            return state;
          }

          activatedCount = dueTaskIds.length;
          const dueTaskIdSet = new Set(dueTaskIds);
          const nextTasks = { ...state.tasks };
          dueTaskIds.forEach((taskId) => {
            const task = nextTasks[taskId];
            if (task?.snooze) {
              nextTasks[taskId] = {
                ...task,
                snooze: {
                  ...task.snooze,
                  awaitingAck: true,
                },
              };
            }
          });

          const nextSwimlanes = { ...state.swimlanes };
          for (const swimlane of Object.values(state.swimlanes)) {
            const readyInLane = swimlane.taskIds.filter((taskId) => dueTaskIdSet.has(taskId));
            if (readyInLane.length === 0) {
              continue;
            }

            nextSwimlanes[swimlane.id] = {
              ...swimlane,
              taskIds: sortTaskIdsByPriority(
                [...readyInLane, ...swimlane.taskIds.filter((taskId) => !dueTaskIdSet.has(taskId))],
                nextTasks
              ),
            };
          }

          return {
            tasks: nextTasks,
            swimlanes: nextSwimlanes,
          };
        });

        if (activatedCount > 0) {
          showToast(
            activatedCount === 1 ? '1 snoozed task is ready' : `${activatedCount} snoozed tasks are ready`,
            'move'
          );
        }
      },

      moveTask: (
        taskId: string,
        fromSwimlaneId: string,
        toSwimlaneId: string,
        newIndex?: number,
        options?: HistoryOptions
      ) => {
        set((state) => {
          const h = options?.skipHistory ? {} : mergeHistory(state, 'Move task');
          const newSwimlanes = { ...state.swimlanes };

          // Remove from source
          if (newSwimlanes[fromSwimlaneId]) {
            newSwimlanes[fromSwimlaneId] = {
              ...newSwimlanes[fromSwimlaneId],
              taskIds: newSwimlanes[fromSwimlaneId].taskIds.filter((id) => id !== taskId),
            };
          }

          // Add to destination
          if (newSwimlanes[toSwimlaneId]) {
            const newTaskIds = [...newSwimlanes[toSwimlaneId].taskIds];
            if (newIndex !== undefined) {
              newTaskIds.splice(newIndex, 0, taskId);
            } else {
              newTaskIds.push(taskId);
            }
            newSwimlanes[toSwimlaneId] = {
              ...newSwimlanes[toSwimlaneId],
              taskIds: sortTaskIdsByPriority(newTaskIds, state.tasks),
            };
          }

          return { swimlanes: newSwimlanes, ...h };
        });
      },

      reorderTasks: (swimlaneId: string, taskIds: string[], options?: HistoryOptions) => {
        set((state) => {
          const h = options?.skipHistory ? {} : mergeHistory(state, 'Reorder tasks');
          return {
            swimlanes: {
              ...state.swimlanes,
              [swimlaneId]: {
                ...state.swimlanes[swimlaneId],
                taskIds: sortTaskIdsByPriority(taskIds, state.tasks),
              },
            },
            ...h,
          };
        });
      },

      // Subtask actions
      addSubtask: (taskId: string, title: string) => {
        const subtask: Subtask = {
          id: uuidv4(),
          title,
          completed: false,
          priority: 'none',
        };

        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          const h = mergeHistory(state, `Add subtask "${title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: sortSubtasksByPriority([...task.subtasks, subtask]),
              },
            },
            ...h,
          };
        });
        showToast(`Subtask "${title}" added`, 'add');
      },

      renameSubtask: (taskId: string, subtaskId: string, title: string) => {
        set((state) => {
          const h = mergeHistory(state, `Rename subtask to "${title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...state.tasks[taskId],
                subtasks: state.tasks[taskId].subtasks.map((st) =>
                  st.id === subtaskId ? { ...st, title } : st
                ),
              },
            },
            ...h,
          };
        });
        showToast(`Subtask renamed to "${title}"`, 'edit');
      },

      setSubtaskPriority: (taskId: string, subtaskId: string, priority: Priority) => {
        let subtaskTitle = '';
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) {
            return state;
          }

          const subtask = task.subtasks.find((item) => item.id === subtaskId);
          if (!subtask || subtask.priority === priority) {
            return state;
          }

          subtaskTitle = subtask.title;
          const h = mergeHistory(
            state,
            `Set subtask "${subtask.title}" priority to ${PRIORITY_LABELS[priority].toLowerCase()}`
          );

          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: sortSubtasksByPriority(
                  task.subtasks.map((item) =>
                    item.id === subtaskId ? { ...item, priority } : item
                  )
                ),
              },
            },
            ...h,
          };
        });

        if (subtaskTitle) {
          showToast(
            `Subtask "${subtaskTitle}" priority set to ${PRIORITY_LABELS[priority].toLowerCase()}`,
            'edit'
          );
        }
      },

      setSubtaskNote: (taskId: string, subtaskId: string, note: string) => {
        const trimmedNote = note.trim();
        let subtaskTitle = '';
        let saved = false;
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || !trimmedNote) return state;
          const subtask = task.subtasks.find((st) => st.id === subtaskId);
          if (!subtask || subtask.note === trimmedNote) {
            return state;
          }
          subtaskTitle = subtask.title;
          saved = true;
          const actionLabel = subtask.note ? 'Update' : 'Add';
          const h = mergeHistory(state, `${actionLabel} note for subtask "${subtask.title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: task.subtasks.map((st) =>
                  st.id === subtaskId ? { ...st, note: trimmedNote } : st
                ),
              },
            },
            ...h,
          };
        });
        if (saved) {
          showToast(`Note saved for "${subtaskTitle}"`, 'edit');
        }
      },

      deleteSubtaskNote: (taskId: string, subtaskId: string) => {
        let subtaskTitle = '';
        let deleted = false;
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          const subtask = task.subtasks.find((st) => st.id === subtaskId);
          if (!subtask || !subtask.note) {
            return state;
          }
          subtaskTitle = subtask.title;
          deleted = true;
          const h = mergeHistory(state, `Delete note for subtask "${subtask.title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: task.subtasks.map((st) =>
                  st.id === subtaskId ? { ...st, note: undefined } : st
                ),
              },
            },
            ...h,
          };
        });
        if (deleted) {
          showToast(`Note deleted for "${subtaskTitle}"`, 'delete');
        }
      },

      deleteSubtask: (taskId: string, subtaskId: string) => {
        let removedTitle = '';
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          const st = task.subtasks.find((s) => s.id === subtaskId);
          if (!st) return state;
          removedTitle = st.title;
          const h = mergeHistory(state, `Delete subtask "${st.title}"`);
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
              },
            },
            ...h,
          };
        });
        if (removedTitle) {
          showToast(`Subtask "${removedTitle}" deleted`, 'delete');
        }
      },

      toggleSubtaskComplete: (taskId: string, subtaskId: string) => {
        let subTitle = '';
        let nowComplete = false;
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          const st = task.subtasks.find((s) => s.id === subtaskId);
          if (!st) return state;
          subTitle = st.title;
          nowComplete = !st.completed;
          const h = mergeHistory(
            state,
            nowComplete
              ? `Mark subtask "${st.title}" complete`
              : `Mark subtask "${st.title}" incomplete`
          );
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: task.subtasks.map((s) =>
                  s.id === subtaskId ? { ...s, completed: !s.completed } : s
                ),
              },
            },
            ...h,
          };
        });
        if (subTitle) {
          showToast(
            nowComplete ? `Subtask "${subTitle}" marked complete` : `Subtask "${subTitle}" marked incomplete`,
            'edit'
          );
        }
      },

      reorderSubtasks: (taskId: string, subtaskIds: string[], options?: HistoryOptions) => {
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;

          const subtaskMap = new Map(task.subtasks.map((st) => [st.id, st]));
          const reorderedSubtasks = subtaskIds
            .map((id) => subtaskMap.get(id))
            .filter(Boolean) as typeof task.subtasks;

          const h = options?.skipHistory ? {} : mergeHistory(state, 'Reorder subtasks');

          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: sortSubtasksByPriority(reorderedSubtasks),
              },
            },
            ...h,
          };
        });
      },

      // Settings (font size global; theme is per-board in boards[].theme, synced via Firestore)
      setFontSize: (size: FontSize) => {
        set({ fontSize: size });
      },

      setBoardTheme: (boardId: string, theme: Theme) => {
        set((state) => {
          const b = state.boards[boardId];
          if (!b) return state;
          const h = mergeHistory(state, `Set board theme to ${theme}`);
          return {
            boards: {
              ...state.boards,
              [boardId]: { ...b, theme },
            },
            ...h,
          };
        });
        showToast(`Theme set to ${theme}`, 'edit');
      },

      // Import/Export
      getExportData: (): ExportData => {
        const state = get();
        return {
          version: 5,
          exportedAt: new Date().toISOString(),
          boards: state.boards,
          swimlanes: state.swimlanes,
          tasks: state.tasks,
          boardOrderIds: state.boardOrderIds,
        };
      },

      importData: (data: ExportData) => {
        const state = get();
        const existingBoardNames = new Set(
          Object.values(state.boards).map((b) => b.name.toLowerCase())
        );

        const renamedBoards: string[] = [];
        const newBoards: Record<string, Board> = { ...state.boards };
        const newSwimlanes: Record<string, Swimlane> = { ...state.swimlanes };
        const newTasks: Record<string, Task> = { ...state.tasks };
        const importedOrderIds: string[] = [];
        let importCreatedAt = Date.now();

        const getUniqueBoardName = (originalName: string): string => {
          const lowerName = originalName.toLowerCase();
          if (!existingBoardNames.has(lowerName)) {
            existingBoardNames.add(lowerName);
            return originalName;
          }

          let counter = 1;
          let newName = `${originalName} (${counter})`;
          while (existingBoardNames.has(newName.toLowerCase())) {
            counter++;
            newName = `${originalName} (${counter})`;
          }
          existingBoardNames.add(newName.toLowerCase());
          return newName;
        };

        Object.values(data.boards).forEach((importedBoard) => {
          const newBoardId = uuidv4();
          importedOrderIds.push(newBoardId);

          const originalName = importedBoard.name;
          const uniqueName = getUniqueBoardName(originalName);
          if (uniqueName !== originalName) {
            renamedBoards.push(`"${originalName}" -> "${uniqueName}"`);
          }

          const newSwimlaneIds: string[] = [];
          importedBoard.swimlaneIds.forEach((oldSwimlaneId) => {
            const importedSwimlane = data.swimlanes[oldSwimlaneId];
            if (importedSwimlane) {
              const newSwimlaneId = uuidv4();
              newSwimlaneIds.push(newSwimlaneId);

              const newTaskIds: string[] = [];
              importedSwimlane.taskIds.forEach((oldTaskId) => {
                const importedTask = data.tasks[oldTaskId];
                if (importedTask) {
                  const normalizedImportedTask = normalizeTask(importedTask);
                  const newTaskId = uuidv4();
                  newTaskIds.push(newTaskId);

                  const newSubtasks = sortSubtasksByPriority(
                    normalizedImportedTask.subtasks.map((subtask) => ({
                      ...subtask,
                      id: uuidv4(),
                    }))
                  );

                  newTasks[newTaskId] = {
                    ...normalizedImportedTask,
                    id: newTaskId,
                    subtasks: newSubtasks,
                  };
                }
              });

              newSwimlanes[newSwimlaneId] = {
                ...importedSwimlane,
                id: newSwimlaneId,
                taskIds: sortTaskIdsByPriority(newTaskIds, newTasks),
              };
            }
          });

          newBoards[newBoardId] = {
            id: newBoardId,
            name: uniqueName,
            swimlaneIds: newSwimlaneIds,
            createdAt: importedBoard.createdAt ?? importCreatedAt++,
            theme: importedBoard.theme ?? DEFAULT_BOARD_THEME,
          };
        });

        const nextBoardOrderIds =
          state.boardOrderIds.length > 0
            ? [...state.boardOrderIds, ...importedOrderIds]
            : state.boardOrderIds;

        const h = mergeHistory(state, 'Import data');

        set({
          boards: newBoards,
          swimlanes: newSwimlanes,
          tasks: newTasks,
          boardOrderIds: nextBoardOrderIds,
          ...h,
        });

        return {
          importedBoards: Object.keys(data.boards).length,
          renamedBoards,
        };
      },
    }),
    {
      name: 'kanban-board-storage',
      version: 5,
      /** Persist data fields only; boardOrderIds must be included so board order survives refresh. */
      partialize: (state) => ({
        boards: state.boards,
        swimlanes: state.swimlanes,
        tasks: state.tasks,
        boardOrderIds: state.boardOrderIds,
        activeBoardId: state.activeBoardId,
        fontSize: state.fontSize,
      }),
      migrate: (persistedState: unknown, version: number) => {
        let state = persistedState as Record<string, unknown>;
        if (version < 2) {
          const s = state;
          let t = Date.now();
          const boards = { ...(s.boards as Record<string, Board>) };
          for (const id of Object.keys(boards)) {
            const b = boards[id];
            if (b && b.createdAt == null) {
              boards[id] = { ...b, createdAt: t++ };
            }
          }
          state = {
            ...s,
            boards,
            boardOrderIds: Array.isArray(s.boardOrderIds)
              ? (s.boardOrderIds as string[])
              : [],
          };
        }
        if (version < 3) {
          const s = state as Record<string, unknown>;
          const legacyGlobalTheme = (s.theme as Theme) || DEFAULT_BOARD_THEME;
          const boards = { ...(s.boards as Record<string, Board>) };
          for (const id of Object.keys(boards)) {
            const b = boards[id];
            if (b && b.theme == null) {
              boards[id] = { ...b, theme: legacyGlobalTheme };
            }
          }
          const rest = { ...s };
          delete rest.theme;
          state = { ...rest, boards };
        }
        if (version < 4) {
          const s = state as Record<string, unknown>;
          const tasks = normalizeTasksRecord((s.tasks as Record<string, Task>) || {});
          const swimlanes = sortSwimlanesTaskIdsByPriority(
            ((s.swimlanes as Record<string, Swimlane>) || {}),
            tasks
          );
          state = { ...s, tasks, swimlanes };
        }
        if (version < 5) {
          const s = state as Record<string, unknown>;
          const tasks = normalizeTasksRecord((s.tasks as Record<string, Task>) || {});
          const swimlanes = sortSwimlanesTaskIdsByPriority(
            ((s.swimlanes as Record<string, Swimlane>) || {}),
            tasks
          );
          state = { ...s, tasks, swimlanes };
        }
        return state;
      },
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.error('Persist rehydrate error:', error);
          return;
        }
        queueMicrotask(() => {
          const st = useBoardStore.getState();
          if (Object.keys(st.boards).length === 0) {
            st.addBoard('My Board', true);
          }
        });
      },
      // Per-tab guest data; signed-in users use Firestore (see initializeForUser).
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

// Subscribe to state changes and sync to Firestore
let unsubscribeFromStore: (() => void) | null = null;
let unsubscribeFromFirestore: (() => void) | null = null;

// Track previous state to detect task data changes
let prevTaskData: {
  boards: string;
  swimlanes: string;
  tasks: string;
  boardOrderIds: string;
} | null = null;

function stopFirestoreSync() {
  console.log('Stopping Firestore sync...');
  if (unsubscribeFromStore) {
    unsubscribeFromStore();
    unsubscribeFromStore = null;
  }
  if (unsubscribeFromFirestore) {
    unsubscribeFromFirestore();
    unsubscribeFromFirestore = null;
  }
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
    pendingSaveTimeout = null;
  }
  prevTaskData = null;
  blockUntil = 0;
}

function startFirestoreSync() {
  if (!firestoreDoc) {
    console.log('No Firestore document set, skipping sync');
    return;
  }
  
  console.log('Starting Firestore sync for user:', currentUserEmail);
  
  // Subscribe to local state changes and push to Firestore
  if (!unsubscribeFromStore) {
    unsubscribeFromStore = useBoardStore.subscribe((state) => {
      // Don't sync if this was a remote update (to avoid loops)
      if (state._isRemoteUpdate) {
        return;
      }
      
      // Only sync if task data changed (not UI settings like fontSize, activeBoardId; board themes are inside boards)
      const currentTaskData = {
        boards: JSON.stringify(state.boards),
        swimlanes: JSON.stringify(state.swimlanes),
        tasks: JSON.stringify(state.tasks),
        boardOrderIds: JSON.stringify(state.boardOrderIds),
      };
      
      const taskDataChanged = !prevTaskData ||
        currentTaskData.boards !== prevTaskData.boards ||
        currentTaskData.swimlanes !== prevTaskData.swimlanes ||
        currentTaskData.tasks !== prevTaskData.tasks ||
        currentTaskData.boardOrderIds !== prevTaskData.boardOrderIds;

      const boardOrderChanged =
        prevTaskData !== null &&
        currentTaskData.boardOrderIds !== prevTaskData.boardOrderIds;
      
      if (taskDataChanged) {
        prevTaskData = currentTaskData;
        const payload: AppState = {
          boards: state.boards,
          swimlanes: state.swimlanes,
          tasks: state.tasks,
          boardOrderIds: state.boardOrderIds,
          activeBoardId: state.activeBoardId,
          fontSize: state.fontSize,
        };
        if (boardOrderChanged) {
          saveToFirestoreImmediate(payload);
        } else {
          saveToFirestore(payload);
        }
      }
    });
    console.log('Subscribed to local state changes');
  }

  // Subscribe to Firestore changes and update local state
  if (!unsubscribeFromFirestore) {
    unsubscribeFromFirestore = onSnapshot(
      firestoreDoc,
      (snapshot) => {
        const blocked = shouldBlockFirestoreUpdates();
        console.log('Firestore snapshot received, exists:', snapshot.exists(), 'blocked:', blocked);
        
        // Ignore ALL Firestore updates while we have pending local changes
        // This prevents the race condition where old data overwrites local changes
        if (blocked) {
          console.log('Ignoring Firestore update - local changes pending, block expires in', blockUntil - Date.now(), 'ms');
          return;
        }
        
        if (snapshot.exists()) {
          const data = snapshot.data();
          const currentState = useBoardStore.getState();
          const remoteBoards = (data.boards || {}) as Record<string, Board>;
          const remoteTasks = normalizeTasksRecord((data.tasks || {}) as Record<string, Task>);
          const remoteSwimlanes = sortSwimlanesTaskIdsByPriority(
            (data.swimlanes || {}) as Record<string, Swimlane>,
            remoteTasks
          );

          // Only update if task data is different (not UI settings)
          const remoteOrderIds = Array.isArray(data.boardOrderIds)
            ? data.boardOrderIds
            : [];
          const hasChanges =
            JSON.stringify(remoteBoards) !== JSON.stringify(currentState.boards) ||
            JSON.stringify(remoteSwimlanes) !== JSON.stringify(currentState.swimlanes) ||
            JSON.stringify(remoteTasks) !== JSON.stringify(currentState.tasks) ||
            JSON.stringify(remoteOrderIds) !== JSON.stringify(currentState.boardOrderIds);

          if (hasChanges) {
            console.log('Applying remote Firestore update');
            currentState._setIsRemoteUpdate(true);
            // Only update task data, preserve local UI settings
            useBoardStore.setState({
              boards: remoteBoards,
              swimlanes: remoteSwimlanes,
              tasks: remoteTasks,
              boardOrderIds: remoteOrderIds,
              ...emptyHistoryState,
            });
            // Update activeBoardId if current one doesn't exist
            const newBoards = remoteBoards;
            if (!newBoards[currentState.activeBoardId || '']) {
              const firstBoardId = getFirstBoardId(newBoards, remoteOrderIds);
              useBoardStore.setState({ activeBoardId: firstBoardId });
            }
            // Reset flag after a short delay
            setTimeout(() => {
              useBoardStore.getState()._setIsRemoteUpdate(false);
            }, 100);
          }
        }
      },
      (error) => {
        console.error('Firestore sync error:', error);
      }
    );
    console.log('Subscribed to Firestore changes');
  }
}

// Initialize or switch user
export function initializeForUser(email: string | null) {
  console.log('Initializing for user:', email);
  
  // Stop any existing sync
  stopFirestoreSync();
  
  if (email) {
    // Signed in: Clear local storage and switch to Firebase
    const sanitized = sanitizeEmail(email);
    currentUserEmail = email;
    firestoreDoc = doc(db, 'users', sanitized, 'taskboards', 'data');
    
    // Clear persisted guest data (legacy localStorage + per-tab sessionStorage)
    localStorage.removeItem('kanban-board-storage');
    sessionStorage.removeItem('kanban-board-storage');
    
    // Reset store to empty state (will be populated from Firebase)
    useBoardStore.setState({
      boards: {},
      swimlanes: {},
      tasks: {},
      boardOrderIds: [],
      activeBoardId: null,
      _isRemoteUpdate: false,
      ...emptyHistoryState,
    });
    
    // Start syncing with Firebase
    startFirestoreSync();
  } else {
    // Guest mode: No Firebase sync, use localStorage only
    currentUserEmail = null;
    firestoreDoc = null;
    
    // Rehydrate from localStorage (Zustand persist handles this)
    // Just ensure we have a default board if empty
    setTimeout(() => {
      const state = useBoardStore.getState();
      if (Object.keys(state.boards).length === 0) {
        state.addBoard('My Board', true);
      }
    }, 100);
  }
}

// Default board is created in persist onRehydrateStorage after sessionStorage loads,
// so we do not add a board before rehydration (which would race and lose boardOrderIds).
