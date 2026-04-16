export type Priority = 'high' | 'medium' | 'low' | 'none';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  note?: string;
}

export interface TaskSnooze {
  until: number;
  awaitingAck: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: Priority;
  note?: string;
  subtasks: Subtask[];
  snooze?: TaskSnooze;
}

export interface Swimlane {
  id: string;
  title: string;
  taskIds: string[];
}

export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SwimlaneWidth = 75 | 100 | 125 | 150 | 175 | 200;

// Pastel themes: rose, lavender, mint, peach
// Saturated themes: ocean, forest, sunset, grape
// Dark themes: dark, midnight, charcoal, crimson, slate, amber
// Niche themes: steampunk, futuristic
export type Theme =
  | 'dark'
  | 'rose'
  | 'lavender'
  | 'mint'
  | 'peach'
  | 'sky'
  | 'lemon'
  | 'lilac'
  | 'coral'
  | 'sage'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'grape'
  | 'midnight'
  | 'charcoal'
  | 'crimson'
  | 'slate'
  | 'amber'
  | 'steampunk'
  | 'futuristic';

/** Default / fallback theme (new boards, missing theme, UI when no board selected). */
export const DEFAULT_BOARD_THEME: Theme = 'ocean';

export interface Board {
  id: string;
  name: string;
  swimlaneIds: string[];
  /** UTC ms when the board was created (default list order is oldest first). */
  createdAt?: number;
  /** Color theme for this board (synced with Firestore). */
  theme?: Theme;
  /** Workspace this board belongs to (null = no workspace / uncategorized). */
  workspaceId?: string | null;
}

export interface Workspace {
  id: string;
  name: string;
  /** Ordered board ids within this workspace. */
  boardOrderIds: string[];
  /** UTC ms when the workspace was created. */
  createdAt?: number;
}

export interface AppState {
  boards: Record<string, Board>;
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  /** Top-level ordered board ids (boards with no workspace). */
  boardOrderIds: string[];
  activeBoardId: string | null;
  fontSize: FontSize;
  /** All workspaces by id. */
  workspaces: Record<string, Workspace>;
  /** Ordered workspace ids. */
  workspaceOrderIds: string[];
  /** Currently active workspace id (null = no workspace filter). */
  activeWorkspaceId: string | null;
}
