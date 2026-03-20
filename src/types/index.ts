export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  subtasks: Subtask[];
}

export interface Swimlane {
  id: string;
  title: string;
  taskIds: string[];
}

export interface Board {
  id: string;
  name: string;
  swimlaneIds: string[];
}

export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Pastel themes: rose, lavender, mint, peach
// Saturated themes: ocean, forest, sunset, grape
// Plus dark theme
export type Theme = 
  | 'dark'
  | 'rose'
  | 'lavender'
  | 'mint'
  | 'peach'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'grape';

export interface AppState {
  boards: Record<string, Board>;
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  activeBoardId: string | null;
  fontSize: FontSize;
  theme: Theme;
}
