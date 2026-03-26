import { useState, useCallback, useRef } from 'react';
import type { DragEndEvent, DragOverEvent, DragStartEvent, CollisionDetection } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Board as BoardType, Swimlane as SwimlaneType, Task as TaskType, Subtask as SubtaskType } from '../types';
import { Swimlane } from './Swimlane';
import { useBoardStore } from '../store/boardStore';
import { useUIStore } from '../store/uiStore';
import { showToast } from '../store/toastStore';
import {
  getPriorityBorderColor,
  sortSubtasksByPriority,
  sortTaskIdsByPriority,
} from '../utils/priority';

function findSwimlaneIdForTask(
  swimlanes: Record<string, SwimlaneType>,
  taskId: string
): string | null {
  for (const sl of Object.values(swimlanes)) {
    if (sl.taskIds.includes(taskId)) return sl.id;
  }
  return null;
}

const containerPaddingClasses = {
  xs: 'p-3',       // 12px
  sm: 'p-[14px]',  // 14px
  md: 'p-4',       // 16px
  lg: 'p-[18px]',  // 18px
  xl: 'p-5',       // 20px
};

const swimlaneGapClasses = {
  xs: 'gap-2',       // 8px
  sm: 'gap-[10px]',  // 10px
  md: 'gap-3',       // 12px
  lg: 'gap-[14px]',  // 14px
  xl: 'gap-4',       // 16px
};

interface BoardProps {
  board: BoardType;
}

export function Board({ board }: BoardProps) {
  const {
    swimlanes,
    tasks,
    reorderSwimlanes,
    moveTask,
    reorderTasks,
    reorderSubtasks,
    addSwimlane,
    pushHistory,
  } = useBoardStore();
  const { fontSize } = useUIStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const taskDragStartSwimlaneId = useRef<string | null>(null);

  // Custom collision detection that filters based on what's being dragged
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const { active } = args;
    const dragType = active.data.current?.type;

    // Get all collisions using closestCorners
    const collisions = closestCorners(args);

    if (!dragType || collisions.length === 0) {
      return collisions;
    }

    // When dragging a task, only consider collisions with tasks, swimlanes, or swimlane-drop zones
    if (dragType === 'task') {
      const filtered = collisions.filter((collision) => {
        const overType = collision.data?.droppableContainer?.data?.current?.type;
        return overType === 'task' || overType === 'swimlane' || overType === 'swimlane-drop';
      });
      return filtered.length > 0 ? filtered : collisions;
    }

    // When dragging a subtask, only consider collisions with subtasks
    if (dragType === 'subtask') {
      const filtered = collisions.filter((collision) => {
        const overType = collision.data?.droppableContainer?.data?.current?.type;
        return overType === 'subtask';
      });
      return filtered.length > 0 ? filtered : collisions;
    }

    // When dragging a swimlane, only consider collisions with other swimlanes
    if (dragType === 'swimlane') {
      const filtered = collisions.filter((collision) => {
        const overType = collision.data?.droppableContainer?.data?.current?.type;
        return overType === 'swimlane';
      });
      return filtered.length > 0 ? filtered : collisions;
    }

    return collisions;
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

  const boardSwimlanes = board.swimlaneIds
    .map((id) => swimlanes[id])
    .filter(Boolean);

  const swimlaneIds = boardSwimlanes.map((sl) => `swimlane-${sl.id}`);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const activeData = active.data.current;
    setActiveType(activeData?.type || null);
    if (activeData?.type === 'task') {
      taskDragStartSwimlaneId.current = activeData.swimlaneId as string;
      pushHistory('Move or reorder task');
    } else {
      taskDragStartSwimlaneId.current = null;
      if (activeData?.type === 'swimlane') {
        pushHistory('Reorder columns');
      } else if (activeData?.type === 'subtask') {
        pushHistory('Reorder subtasks');
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) return;

    // Handle task being dragged over a different swimlane
    if (activeData.type === 'task') {
      const taskId = activeData.task.id;
      const fromSwimlaneId = activeData.swimlaneId;

      let toSwimlaneId: string | null = null;

      if (overData.type === 'swimlane-drop') {
        toSwimlaneId = overData.swimlaneId;
      } else if (overData.type === 'task' && overData.swimlaneId !== fromSwimlaneId) {
        toSwimlaneId = overData.swimlaneId;
      } else if (overData.type === 'subtask') {
        // Find which swimlane contains this subtask's parent task
        const parentTaskId = overData.taskId;
        for (const sl of Object.values(swimlanes)) {
          if (sl.taskIds.includes(parentTaskId)) {
            if (sl.id !== fromSwimlaneId) {
              toSwimlaneId = sl.id;
            }
            break;
          }
        }
      }

      // Move task to different swimlane during drag for visual feedback
      if (toSwimlaneId && toSwimlaneId !== fromSwimlaneId) {
        moveTask(taskId, fromSwimlaneId, toSwimlaneId, undefined, { skipHistory: true });
        // Update the active data to reflect new swimlane
        activeData.swimlaneId = toSwimlaneId;
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveType(null);

    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData) return;

    // Handle swimlane reordering
    if (activeData.type === 'swimlane') {
      let targetSwimlaneId: string | null = null;

      // Check if dropped on another swimlane (sortable)
      if (overData?.type === 'swimlane') {
        targetSwimlaneId = overData.swimlane.id;
      }
      // Check if dropped on the swimlane's drop zone
      else if (overData?.type === 'swimlane-drop') {
        targetSwimlaneId = overData.swimlaneId;
      }
      // Check if dropped on a task inside a swimlane
      else if (overData?.type === 'task') {
        targetSwimlaneId = overData.swimlaneId;
      }

      if (targetSwimlaneId) {
        const oldIndex = board.swimlaneIds.indexOf(activeData.swimlane.id);
        const newIndex = board.swimlaneIds.indexOf(targetSwimlaneId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const newOrder = arrayMove(board.swimlaneIds, oldIndex, newIndex);
          reorderSwimlanes(board.id, newOrder, { skipHistory: true });
          showToast('Columns reordered', 'move');
        }
      }
      return;
    }

    // Handle task reordering within same swimlane
    if (activeData.type === 'task') {
      const taskId = activeData.task.id;
      const startSl = taskDragStartSwimlaneId.current;
      let overTaskId: string | null = null;
      let swimlaneId: string | null = null;

      // Dropped directly on a task
      if (overData?.type === 'task') {
        overTaskId = overData.task.id;
        swimlaneId = overData.swimlaneId;
      }
      // Dropped on a subtask - use the parent task
      else if (overData?.type === 'subtask') {
        overTaskId = overData.taskId;
        // Find which swimlane contains this task
        if (overTaskId) {
          for (const sl of Object.values(swimlanes)) {
            if (sl.taskIds.includes(overTaskId)) {
              swimlaneId = sl.id;
              break;
            }
          }
        }
      }

      let didReorder = false;
      if (overTaskId && swimlaneId && taskId !== overTaskId) {
        const swimlane = swimlanes[swimlaneId];
        if (swimlane) {
          const sortedTaskIds = sortTaskIdsByPriority(swimlane.taskIds, tasks);
          const oldIndex = sortedTaskIds.indexOf(taskId);
          const newIndex = sortedTaskIds.indexOf(overTaskId);

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const newOrder = arrayMove(sortedTaskIds, oldIndex, newIndex);
            reorderTasks(swimlaneId, newOrder, { skipHistory: true });
            didReorder = true;
            const crossedLane = Boolean(startSl && startSl !== swimlaneId);
            showToast(crossedLane ? 'Task moved' : 'Task order updated', 'move');
          }
        }
      }

      if (!didReorder && startSl) {
        const endSl = findSwimlaneIdForTask(useBoardStore.getState().swimlanes, taskId);
        if (endSl && startSl !== endSl) {
          showToast('Task moved', 'move');
        }
      }

      taskDragStartSwimlaneId.current = null;
      return;
    }

    // Handle subtask reordering within the same task
    if (activeData.type === 'subtask') {
      if (overData?.type === 'subtask') {
        const taskId = activeData.taskId;
        const overTaskId = overData.taskId;

        // Only allow reordering within the same task
        if (taskId === overTaskId) {
          const task = tasks[taskId];
          if (task) {
            const subtaskIds = sortSubtasksByPriority(task.subtasks).map((st) => st.id);
            const oldIndex = subtaskIds.indexOf(activeData.subtask.id);
            const newIndex = subtaskIds.indexOf(overData.subtask.id);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              const newOrder = arrayMove(subtaskIds, oldIndex, newIndex);
              reorderSubtasks(taskId, newOrder, { skipHistory: true });
              showToast('Subtasks reordered', 'move');
            }
          }
        }
      }
    }
  };

  const getActiveTask = (): TaskType | null => {
    if (!activeId || activeType !== 'task') return null;
    const taskId = activeId.replace('task-', '');
    return tasks[taskId] || null;
  };

  const getActiveSubtask = (): { subtask: SubtaskType; taskId: string } | null => {
    if (!activeId || activeType !== 'subtask') return null;
    const subtaskId = activeId.replace('subtask-', '');

    for (const task of Object.values(tasks)) {
      const subtask = task.subtasks.find((st) => st.id === subtaskId);
      if (subtask) {
        return { subtask, taskId: task.id };
      }
    }
    return null;
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className={`flex-1 overflow-x-auto ${containerPaddingClasses[fontSize]}`}>
        <div className={`flex h-full ${swimlaneGapClasses[fontSize]}`}>
          <SortableContext
            items={swimlaneIds}
            strategy={horizontalListSortingStrategy}
          >
            {boardSwimlanes.map((swimlane) => {
              const swimlaneTasks = sortTaskIdsByPriority(swimlane.taskIds, tasks)
                .map((id) => tasks[id])
                .filter(Boolean);

              return (
                <Swimlane
                  key={swimlane.id}
                  swimlane={swimlane}
                  tasks={swimlaneTasks}
                  boardId={board.id}
                  isTaskDragging={activeType === 'task'}
                />
              );
            })}
          </SortableContext>

          {/* Add Swimlane button */}
          <button
            onClick={() => addSwimlane(board.id, 'New Swimlane')}
            className="flex-shrink-0 swimlane-width h-fit border-2 border-dashed rounded-lg p-6 flex items-center justify-center gap-2 transition-all duration-150 hover:opacity-80 hover:shadow-md hover:border-solid active:scale-[0.98] active:opacity-60 active:shadow-none"
            style={{ backgroundColor: 'var(--bg-swimlane)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Swimlane
          </button>

          {/* Spacer for right padding when scrolling */}
          <div className="flex-shrink-0 w-2" aria-hidden="true" />
        </div>
      </div>

      <DragOverlay>
        {activeType === 'task' && getActiveTask() && (
          <div
            className="rounded-lg border shadow-lg p-3 w-72 opacity-90"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: getPriorityBorderColor(
                getActiveTask()?.priority,
                'var(--border-card)'
              ),
            }}
          >
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{getActiveTask()?.title}</p>
          </div>
        )}
        {activeType === 'subtask' && getActiveSubtask() && (
          <div
            className="rounded border shadow-lg p-2 ml-4 opacity-90"
            style={{
              backgroundColor: 'var(--bg-subtask)',
              borderColor: getPriorityBorderColor(
                getActiveSubtask()?.subtask.priority,
                'var(--border-card)'
              ),
            }}
          >
            <p className="text-[0.9em]" style={{ color: 'var(--text-primary)' }}>{getActiveSubtask()?.subtask.title}</p>
          </div>
        )}
        {activeType === 'swimlane' && (
          <div className="rounded-lg shadow-lg p-4 swimlane-width opacity-90" style={{ backgroundColor: 'var(--bg-swimlane)' }}>
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Moving swimlane...</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
