import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { doc, setDoc, onSnapshot, type DocumentReference } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AppState, Board, Swimlane, Task, Subtask, FontSize, Theme } from '../types';
import { sanitizeEmail } from './authStore';
import { getFirstBoardId, getOrderedBoardIds, reorderIds } from '../utils/boardOrder';

export interface ExportData {
  version: number;
  exportedAt: string;
  boards: Record<string, Board>;
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  /** Present in v2+ exports; ordered board ids (empty means sort by createdAt). */
  boardOrderIds?: string[];
}

interface BoardStore extends AppState {
  // Board actions
  addBoard: (name: string) => void;
  renameBoard: (boardId: string, name: string) => void;
  deleteBoard: (boardId: string) => void;
  setActiveBoard: (boardId: string) => void;
  reorderBoardsByDrag: (activeId: string, overId: string) => void;

  // Swimlane actions
  addSwimlane: (boardId: string, title: string) => void;
  renameSwimlane: (swimlaneId: string, title: string) => void;
  deleteSwimlane: (swimlaneId: string) => void;
  moveSwimlaneToBoard: (swimlaneId: string, targetBoardId: string) => void;
  reorderSwimlanes: (boardId: string, swimlaneIds: string[]) => void;

  // Task actions
  addTask: (swimlaneId: string, title: string) => void;
  renameTask: (taskId: string, title: string) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskComplete: (taskId: string) => void;
  moveTask: (taskId: string, fromSwimlaneId: string, toSwimlaneId: string, newIndex?: number) => void;
  reorderTasks: (swimlaneId: string, taskIds: string[]) => void;

  // Subtask actions
  addSubtask: (taskId: string, title: string) => void;
  renameSubtask: (taskId: string, subtaskId: string, title: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  toggleSubtaskComplete: (taskId: string, subtaskId: string) => void;
  reorderSubtasks: (taskId: string, subtaskIds: string[]) => void;

  // Settings
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;

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
    // Only save task data to Firestore, not UI settings
    setDoc(docRef, {
      boards: state.boards,
      swimlanes: state.swimlanes,
      tasks: state.tasks,
      boardOrderIds: state.boardOrderIds,
      updatedAt: Date.now(),
    })
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
      theme: 'lavender' as Theme,
      _isRemoteUpdate: false,

      _setIsRemoteUpdate: (value: boolean) => {
        set({ _isRemoteUpdate: value });
      },

      // Board actions
      addBoard: (name: string) => {
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

          return {
            boards: { ...state.boards, [board.id]: board },
            swimlanes: newSwimlanes,
            boardOrderIds,
            activeBoardId: state.activeBoardId || board.id,
          };
        });
      },

      renameBoard: (boardId: string, name: string) => {
        set((state) => ({
          boards: {
            ...state.boards,
            [boardId]: { ...state.boards[boardId], name },
          },
        }));
      },

      deleteBoard: (boardId: string) => {
        set((state) => {
          const board = state.boards[boardId];
          if (!board) return state;

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

          return {
            boards: newBoards,
            swimlanes: newSwimlanes,
            tasks: newTasks,
            boardOrderIds: newBoardOrderIds,
            activeBoardId: newActiveBoardId,
          };
        });
      },

      setActiveBoard: (boardId: string) => {
        set({ activeBoardId: boardId });
      },

      reorderBoardsByDrag: (activeId: string, overId: string) => {
        set((state) => {
          const ids = getOrderedBoardIds(state.boards, state.boardOrderIds);
          const oldIndex = ids.indexOf(activeId);
          const newIndex = ids.indexOf(overId);
          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return {};
          }
          return { boardOrderIds: reorderIds(ids, oldIndex, newIndex) };
        });
      },

      // Swimlane actions
      addSwimlane: (boardId: string, title: string) => {
        const swimlane: Swimlane = {
          id: uuidv4(),
          title,
          taskIds: [],
        };

        set((state) => ({
          swimlanes: { ...state.swimlanes, [swimlane.id]: swimlane },
          boards: {
            ...state.boards,
            [boardId]: {
              ...state.boards[boardId],
              swimlaneIds: [...state.boards[boardId].swimlaneIds, swimlane.id],
            },
          },
        }));
      },

      renameSwimlane: (swimlaneId: string, title: string) => {
        set((state) => ({
          swimlanes: {
            ...state.swimlanes,
            [swimlaneId]: { ...state.swimlanes[swimlaneId], title },
          },
        }));
      },

      deleteSwimlane: (swimlaneId: string) => {
        set((state) => {
          const swimlane = state.swimlanes[swimlaneId];
          if (!swimlane) return state;

          const newSwimlanes = { ...state.swimlanes };
          delete newSwimlanes[swimlaneId];

          const newTasks = { ...state.tasks };
          swimlane.taskIds.forEach((taskId) => {
            delete newTasks[taskId];
          });

          const newBoards = { ...state.boards };
          Object.values(newBoards).forEach((board) => {
            if (board.swimlaneIds.includes(swimlaneId)) {
              board.swimlaneIds = board.swimlaneIds.filter((id) => id !== swimlaneId);
            }
          });

          return { swimlanes: newSwimlanes, tasks: newTasks, boards: newBoards };
        });
      },

      moveSwimlaneToBoard: (swimlaneId: string, targetBoardId: string) => {
        set((state) => {
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

          return { boards: newBoards };
        });
      },

      reorderSwimlanes: (boardId: string, swimlaneIds: string[]) => {
        set((state) => ({
          boards: {
            ...state.boards,
            [boardId]: { ...state.boards[boardId], swimlaneIds },
          },
        }));
      },

      // Task actions
      addTask: (swimlaneId: string, title: string) => {
        const task: Task = {
          id: uuidv4(),
          title,
          completed: false,
          subtasks: [],
        };

        set((state) => ({
          tasks: { ...state.tasks, [task.id]: task },
          swimlanes: {
            ...state.swimlanes,
            [swimlaneId]: {
              ...state.swimlanes[swimlaneId],
              taskIds: [...state.swimlanes[swimlaneId].taskIds, task.id],
            },
          },
        }));
      },

      renameTask: (taskId: string, title: string) => {
        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskId]: { ...state.tasks[taskId], title },
          },
        }));
      },

      deleteTask: (taskId: string) => {
        set((state) => {
          const newTasks = { ...state.tasks };
          delete newTasks[taskId];

          const newSwimlanes = { ...state.swimlanes };
          Object.values(newSwimlanes).forEach((swimlane) => {
            if (swimlane.taskIds.includes(taskId)) {
              swimlane.taskIds = swimlane.taskIds.filter((id) => id !== taskId);
            }
          });

          return { tasks: newTasks, swimlanes: newSwimlanes };
        });
      },

      toggleTaskComplete: (taskId: string) => {
        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...state.tasks[taskId],
              completed: !state.tasks[taskId].completed,
            },
          },
        }));
      },

      moveTask: (taskId: string, fromSwimlaneId: string, toSwimlaneId: string, newIndex?: number) => {
        set((state) => {
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
              taskIds: newTaskIds,
            };
          }

          return { swimlanes: newSwimlanes };
        });
      },

      reorderTasks: (swimlaneId: string, taskIds: string[]) => {
        set((state) => ({
          swimlanes: {
            ...state.swimlanes,
            [swimlaneId]: { ...state.swimlanes[swimlaneId], taskIds },
          },
        }));
      },

      // Subtask actions
      addSubtask: (taskId: string, title: string) => {
        const subtask: Subtask = {
          id: uuidv4(),
          title,
          completed: false,
        };

        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...state.tasks[taskId],
              subtasks: [...state.tasks[taskId].subtasks, subtask],
            },
          },
        }));
      },

      renameSubtask: (taskId: string, subtaskId: string, title: string) => {
        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...state.tasks[taskId],
              subtasks: state.tasks[taskId].subtasks.map((st) =>
                st.id === subtaskId ? { ...st, title } : st
              ),
            },
          },
        }));
      },

      deleteSubtask: (taskId: string, subtaskId: string) => {
        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...state.tasks[taskId],
              subtasks: state.tasks[taskId].subtasks.filter((st) => st.id !== subtaskId),
            },
          },
        }));
      },

      toggleSubtaskComplete: (taskId: string, subtaskId: string) => {
        set((state) => ({
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...state.tasks[taskId],
              subtasks: state.tasks[taskId].subtasks.map((st) =>
                st.id === subtaskId ? { ...st, completed: !st.completed } : st
              ),
            },
          },
        }));
      },

      reorderSubtasks: (taskId: string, subtaskIds: string[]) => {
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;

          const subtaskMap = new Map(task.subtasks.map((st) => [st.id, st]));
          const reorderedSubtasks = subtaskIds
            .map((id) => subtaskMap.get(id))
            .filter(Boolean) as typeof task.subtasks;

          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                subtasks: reorderedSubtasks,
              },
            },
          };
        });
      },

      // Settings
      setFontSize: (size: FontSize) => {
        set({ fontSize: size });
      },

      setTheme: (theme: Theme) => {
        set({ theme });
      },

      // Import/Export
      getExportData: (): ExportData => {
        const state = get();
        return {
          version: 2,
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
                  const newTaskId = uuidv4();
                  newTaskIds.push(newTaskId);

                  const newSubtasks = importedTask.subtasks.map((subtask) => ({
                    ...subtask,
                    id: uuidv4(),
                  }));

                  newTasks[newTaskId] = {
                    ...importedTask,
                    id: newTaskId,
                    subtasks: newSubtasks,
                  };
                }
              });

              newSwimlanes[newSwimlaneId] = {
                ...importedSwimlane,
                id: newSwimlaneId,
                taskIds: newTaskIds,
              };
            }
          });

          newBoards[newBoardId] = {
            id: newBoardId,
            name: uniqueName,
            swimlaneIds: newSwimlaneIds,
            createdAt: importedBoard.createdAt ?? importCreatedAt++,
          };
        });

        const nextBoardOrderIds =
          state.boardOrderIds.length > 0
            ? [...state.boardOrderIds, ...importedOrderIds]
            : state.boardOrderIds;

        set({
          boards: newBoards,
          swimlanes: newSwimlanes,
          tasks: newTasks,
          boardOrderIds: nextBoardOrderIds,
        });

        return {
          importedBoards: Object.keys(data.boards).length,
          renamedBoards,
        };
      },
    }),
    {
      name: 'kanban-board-storage',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2) {
          const s = persistedState as Record<string, unknown>;
          let t = Date.now();
          const boards = { ...(s.boards as Record<string, Board>) };
          for (const id of Object.keys(boards)) {
            const b = boards[id];
            if (b && b.createdAt == null) {
              boards[id] = { ...b, createdAt: t++ };
            }
          }
          return {
            ...s,
            boards,
            boardOrderIds: Array.isArray(s.boardOrderIds)
              ? (s.boardOrderIds as string[])
              : [],
          };
        }
        return persistedState;
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
      
      // Only sync if task data changed (not UI settings like fontSize, theme, activeBoardId)
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
      
      if (taskDataChanged) {
        prevTaskData = currentTaskData;
        saveToFirestore({
          boards: state.boards,
          swimlanes: state.swimlanes,
          tasks: state.tasks,
          boardOrderIds: state.boardOrderIds,
          activeBoardId: state.activeBoardId,
          fontSize: state.fontSize,
          theme: state.theme,
        });
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

          // Only update if task data is different (not UI settings)
          const remoteOrderIds = Array.isArray(data.boardOrderIds)
            ? data.boardOrderIds
            : [];
          const hasChanges =
            JSON.stringify(data.boards) !== JSON.stringify(currentState.boards) ||
            JSON.stringify(data.swimlanes) !== JSON.stringify(currentState.swimlanes) ||
            JSON.stringify(data.tasks) !== JSON.stringify(currentState.tasks) ||
            JSON.stringify(remoteOrderIds) !== JSON.stringify(currentState.boardOrderIds);

          if (hasChanges) {
            console.log('Applying remote Firestore update');
            currentState._setIsRemoteUpdate(true);
            // Only update task data, preserve local UI settings
            useBoardStore.setState({
              boards: data.boards || {},
              swimlanes: data.swimlanes || {},
              tasks: data.tasks || {},
              boardOrderIds: remoteOrderIds,
            });
            // Update activeBoardId if current one doesn't exist
            const newBoards = data.boards || {};
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
        state.addBoard('My Board');
      }
    }, 100);
  }
}

// Initialize with a default board if empty (guest mode on first load)
const initializeStore = () => {
  const state = useBoardStore.getState();
  if (Object.keys(state.boards).length === 0) {
    state.addBoard('My Board');
  }
};

// Only initialize default board, don't start Firebase sync
// Firebase sync will be started when user signs in
initializeStore();
