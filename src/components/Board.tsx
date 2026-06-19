import { useState, useCallback, useRef, useEffect, type WheelEvent as ReactWheelEvent } from 'react';
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
  searchQuery?: string;
}

export function Board({ board, searchQuery = '' }: BoardProps) {
  const {
    swimlanes,
    tasks,
    reorderSwimlanes,
    moveTask,
    reorderTasks,
    reorderSubtasks,
    moveSubtaskToTask,
    convertTaskToSubtask,
    convertSubtaskToTask,
    addSwimlane,
    pushHistory,
  } = useBoardStore();
  const { fontSize } = useUIStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [isShiftDragging, setIsShiftDragging] = useState(false);
  const taskDragStartSwimlaneId = useRef<string | null>(null);
  const isShiftDownRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftDownRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftDownRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Custom collision detection that filters based on what's being dragged
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const { active } = args;
    const dragType = active.data.current?.type;

    // Get all collisions using closestCorners
    const collisions = closestCorners(args);

    if (!dragType || collisions.length === 0) {
      return collisions;
    }

    // When shift-dragging a task, only allow dropping onto other tasks (not subtasks or swimlanes)
    if (dragType === 'task' && isShiftDownRef.current) {
      const activeTaskId = active.data.current?.task?.id;
      const filtered = collisions.filter((collision) => {
        const overData = collision.data?.droppableContainer?.data?.current;
        if (overData?.type !== 'task') return false;
        // Cannot drop onto itself
        if (overData?.task?.id === activeTaskId) return false;
        return true;
      });
      // Return empty list if no valid targets - this means no drop will be registered
      return filtered;
    }

    // When dragging a task, only consider collisions with tasks, swimlanes, or swimlane-drop zones
    if (dragType === 'task') {
      const filtered = collisions.filter((collision) => {
        const overType = collision.data?.droppableContainer?.data?.current?.type;
        return overType === 'task' || overType === 'swimlane' || overType === 'swimlane-drop';
      });
      return filtered.length > 0 ? filtered : collisions;
    }

    // When shift-dragging a subtask, only allow dropping onto tasks or swimlane-drop zones
    // (to convert the subtask into a task at that position)
    if (dragType === 'subtask' && isShiftDownRef.current) {
      const filtered = collisions.filter((collision) => {
        const overType = collision.data?.droppableContainer?.data?.current?.type;
        return overType === 'task' || overType === 'swimlane-drop';
      });
      return filtered.length > 0 ? filtered : [];
    }

    // When dragging a subtask normally, allow dropping onto subtasks or tasks
    // (subtask-to-subtask = reorder within same task or move to other task,
    //  subtask-to-task = move subtask to that task)
    if (dragType === 'subtask') {
      const filtered = collisions.filter((collision) => {
        const overType = collision.data?.droppableContainer?.data?.current?.type;
        return overType === 'subtask' || overType === 'task';
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
    const activeData = active.data.current;

    if (activeData?.type === 'task' && isShiftDownRef.current) {
      const task: TaskType = activeData.task;
      if (task.subtasks && task.subtasks.length > 0) {
        showToast('Cannot shift-drag a task that has subtasks', 'error');
        // Cancel the drag by not setting activeId - dnd-kit will still start the drag
        // but we mark it as a cancelled shift drag so handleDragEnd is a no-op
        setActiveId(active.id as string);
        setActiveType('task-shift-cancelled');
        setIsShiftDragging(false);
        return;
      }
      setIsShiftDragging(true);
      setActiveId(active.id as string);
      setActiveType(activeData.type);
      taskDragStartSwimlaneId.current = activeData.swimlaneId as string;
      pushHistory('Convert task to subtask');
      return;
    }

    setActiveId(active.id as string);
    setActiveType(activeData?.type || null);
    if (activeData?.type === 'task') {
      taskDragStartSwimlaneId.current = activeData.swimlaneId as string;
      pushHistory('Move or reorder task');
    } else if (activeData?.type === 'subtask') {
      taskDragStartSwimlaneId.current = null;
      if (isShiftDownRef.current) {
        setIsShiftDragging(true);
        pushHistory('Convert subtask to task');
      } else {
        pushHistory('Move subtask');
      }
    } else {
      taskDragStartSwimlaneId.current = null;
      if (activeData?.type === 'swimlane') {
        pushHistory('Reorder columns');
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (!activeData || !overData) return;

    // During shift-drag, do not move tasks across swimlanes - tasks stay in place
    if (isShiftDownRef.current && activeData.type === 'task') return;

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
    const wasShiftDragging = isShiftDragging;
    setActiveId(null);
    setActiveType(null);
    setIsShiftDragging(false);

    // Cancelled shift drag (task had subtasks) - do nothing
    if (activeType === 'task-shift-cancelled') {
      taskDragStartSwimlaneId.current = null;
      return;
    }

    // Handle shift-drag drop
    if (wasShiftDragging) {
      const activeData = active.data.current;
      const overData = over?.data.current;

      if (activeData?.type === 'task') {
        // Task shift-drag: convert task to subtask of the hovered task
        if (
          over &&
          overData?.type === 'task' &&
          activeData.task.id !== overData.task.id
        ) {
          const draggedTaskId = activeData.task.id;
          const targetTaskId = overData.task.id;
          convertTaskToSubtask(draggedTaskId, targetTaskId);
        }
        // Dropped anywhere else - no-op
      }
      // Subtask shift-drag is handled further down in the subtask block below
      taskDragStartSwimlaneId.current = null;
      if (activeData?.type !== 'subtask') return;
      // For subtask shift-drag with no valid drop target, fall through to subtask section
      // which will handle the no-op case
    }

    if (!over && !(wasShiftDragging && active.data.current?.type === 'subtask')) return;

    const activeData = active.data.current;
    const overData = over?.data.current;

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

    // Handle subtask dragging
    if (activeData.type === 'subtask') {
      const subtaskId = activeData.subtask.id;
      const fromTaskId = activeData.taskId;

      // Shift-drag: convert subtask to a task at the dropped position
      if (wasShiftDragging) {
        if (over && overData) {
          if (overData.type === 'task') {
            // Dropped onto a task - insert the new task at that task's index
            const targetTaskId = overData.task.id;
            const targetSwimlaneId = overData.swimlaneId;
            const swimlane = swimlanes[targetSwimlaneId];
            if (swimlane) {
              const sortedTaskIds = sortTaskIdsByPriority(swimlane.taskIds, tasks);
              const targetIndex = sortedTaskIds.indexOf(targetTaskId);
              convertSubtaskToTask(subtaskId, fromTaskId, targetSwimlaneId, targetIndex !== -1 ? targetIndex : undefined, { skipHistory: true });
            }
          } else if (overData.type === 'swimlane-drop') {
            // Dropped on empty swimlane area - append to end
            convertSubtaskToTask(subtaskId, fromTaskId, overData.swimlaneId, undefined, { skipHistory: true });
          }
        }
        // Dropped anywhere else (no over, or invalid target) - no-op
        return;
      }

      // Normal drag: move subtask to another task, or reorder within same task
      if (overData?.type === 'subtask') {
        const toTaskId = overData.taskId;

        if (fromTaskId === toTaskId) {
          // Reorder within the same task
          const task = tasks[fromTaskId];
          if (task) {
            const subtaskIds = sortSubtasksByPriority(task.subtasks).map((st) => st.id);
            const oldIndex = subtaskIds.indexOf(subtaskId);
            const newIndex = subtaskIds.indexOf(overData.subtask.id);

            if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
              const newOrder = arrayMove(subtaskIds, oldIndex, newIndex);
              reorderSubtasks(fromTaskId, newOrder, { skipHistory: true });
              showToast('Subtasks reordered', 'move');
            }
          }
        } else {
          // Move to a different task
          moveSubtaskToTask(subtaskId, fromTaskId, toTaskId, { skipHistory: true });
        }
      } else if (overData?.type === 'task') {
        // Dropped directly onto a task card - move subtask to that task
        const toTaskId = overData.task.id;
        if (toTaskId !== fromTaskId) {
          moveSubtaskToTask(subtaskId, fromTaskId, toTaskId, { skipHistory: true });
        }
      }
    }
  };

  const handleBoardWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.metaKey || event.ctrlKey || !event.shiftKey) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) {
      return;
    }

    const primaryDelta = Math.abs(event.deltaX) > 0 ? event.deltaX : event.deltaY;
    if (primaryDelta === 0) {
      return;
    }

    event.preventDefault();
    container.scrollLeft += primaryDelta;
  }, []);

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
      <div
        ref={scrollContainerRef}
        onWheelCapture={handleBoardWheel}
        className={`flex-1 overflow-x-auto ${containerPaddingClasses[fontSize]}`}
      >
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
                  isTaskDragging={activeType === 'task' || activeType === 'task-shift-cancelled'}
                  isShiftDragging={isShiftDragging}
                  isSubtaskDragging={activeType === 'subtask' && !isShiftDragging}
                  searchQuery={searchQuery}
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
