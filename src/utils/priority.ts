import type { Priority, Task, Subtask, Swimlane } from '../types';

export const PRIORITY_OPTIONS: Priority[] = ['high', 'medium', 'low', 'none'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  none: 'None',
};

const PRIORITY_RANK: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

export function normalizePriority(priority: unknown): Priority {
  if (priority === 'high' || priority === 'medium' || priority === 'low' || priority === 'none') {
    return priority;
  }
  return 'none';
}

export function getPriorityBorderColor(priority: unknown, fallbackColor: string): string {
  switch (normalizePriority(priority)) {
    case 'high':
      return 'var(--border-priority-high)';
    case 'medium':
      return 'var(--border-priority-medium)';
    case 'low':
      return 'var(--border-priority-low)';
    default:
      return fallbackColor;
  }
}

export function normalizeSubtask(subtask: Subtask): Subtask {
  return {
    ...subtask,
    priority: normalizePriority(subtask.priority),
  };
}

export function normalizeTask(task: Task): Task {
  return {
    ...task,
    priority: normalizePriority(task.priority),
    subtasks: task.subtasks.map(normalizeSubtask),
  };
}

export function normalizeTasksRecord(tasks: Record<string, Task>): Record<string, Task> {
  return Object.fromEntries(
    Object.entries(tasks).map(([taskId, task]) => [taskId, normalizeTask(task)])
  );
}

export function sortTaskIdsByPriority(
  taskIds: string[],
  tasks: Record<string, Task>
): string[] {
  return taskIds
    .map((taskId, index) => ({ taskId, index, task: tasks[taskId] }))
    .filter((entry) => Boolean(entry.task))
    .sort((a, b) => {
      const rankDiff =
        PRIORITY_RANK[normalizePriority(a.task?.priority)] -
        PRIORITY_RANK[normalizePriority(b.task?.priority)];
      return rankDiff !== 0 ? rankDiff : a.index - b.index;
    })
    .map((entry) => entry.taskId);
}

export function sortSubtasksByPriority(subtasks: Subtask[]): Subtask[] {
  return subtasks
    .map((subtask, index) => ({ subtask: normalizeSubtask(subtask), index }))
    .sort((a, b) => {
      const rankDiff =
        PRIORITY_RANK[a.subtask.priority] - PRIORITY_RANK[b.subtask.priority];
      return rankDiff !== 0 ? rankDiff : a.index - b.index;
    })
    .map((entry) => entry.subtask);
}

export function sortSwimlanesTaskIdsByPriority(
  swimlanes: Record<string, Swimlane>,
  tasks: Record<string, Task>
): Record<string, Swimlane> {
  return Object.fromEntries(
    Object.entries(swimlanes).map(([swimlaneId, swimlane]) => [
      swimlaneId,
      {
        ...swimlane,
        taskIds: sortTaskIdsByPriority(swimlane.taskIds, tasks),
      },
    ])
  );
}
