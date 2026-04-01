import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Swimlane as SwimlaneType, Task as TaskType } from '../types';
import { EditableTitle } from './EditableTitle';
import { Task } from './Task';
import { SwimlaneMenu } from './SwimlaneMenu';
import { useBoardStore } from '../store/boardStore';
import { isTaskSnoozed } from '../utils/taskSnooze';

function AddTaskWidget({
  value,
  onChange,
  onAdd,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onAdd: (keepOpen: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onAdd(true);
          if (e.key === 'Escape') onClose();
        }}
        onBlur={() => { if (!value.trim()) onClose(); }}
        placeholder="Task title..."
        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => onAdd(false)}
          className="flex-1 text-white py-2 rounded transition-all duration-150 hover:brightness-110 hover:shadow-md active:scale-[0.97] active:brightness-90 active:shadow-none"
          style={{ backgroundColor: 'var(--accent-primary)' }}
        >
          Add Task
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded border transition-all duration-150 hover:brightness-95 hover:shadow-sm active:scale-[0.97] active:brightness-90"
          style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-hover)', borderColor: 'var(--border-default)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface SwimlaneProps {
  swimlane: SwimlaneType;
  tasks: TaskType[];
  boardId: string;
  isTaskDragging?: boolean;
  searchQuery?: string;
}

export function Swimlane({ swimlane, tasks, boardId, isTaskDragging = false, searchQuery = '' }: SwimlaneProps) {
  const { renameSwimlane, addTask } = useBoardStore();
  const [addTaskPosition, setAddTaskPosition] = useState<'top' | 'bottom' | null>(null);
  const isAddingTask = addTaskPosition !== null;
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const openAddTask = (position: 'top' | 'bottom') => setAddTaskPosition(position);
  const closeAddTask = () => { setAddTaskPosition(null); setNewTaskTitle(''); };
  const firstSnoozedTaskIndex = tasks.findIndex((task) => isTaskSnoozed(task));

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `swimlane-${swimlane.id}`,
    data: {
      type: 'swimlane',
      swimlane,
    },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `swimlane-drop-${swimlane.id}`,
    data: {
      type: 'swimlane-drop',
      swimlaneId: swimlane.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleAddTask = (keepOpen: boolean = false) => {
    if (newTaskTitle.trim()) {
      addTask(swimlane.id, newTaskTitle.trim(), addTaskPosition ?? 'bottom');
      setNewTaskTitle('');
      if (!keepOpen) {
        closeAddTask();
      }
    }
  };

  const taskIds = tasks.map((t) => `task-${t.id}`);

  return (
    <div
      ref={setSortableRef}
      style={{ ...style, backgroundColor: 'var(--bg-swimlane)' }}
      className="flex-shrink-0 swimlane-width rounded-lg flex flex-col h-fit"
    >
      {/* Header */}
      <div className="flex items-center" style={{ padding: 'var(--padding-section, 0.75rem)', gap: 'var(--gap-sm, 0.5rem)', borderBottom: '1px solid var(--border-default)' }}>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab"
          style={{ color: 'var(--text-muted)', touchAction: 'none' }}
          title="Drag to reorder"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        <EditableTitle
          value={swimlane.title}
          onSave={(title) => renameSwimlane(swimlane.id, title)}
          className="flex-1 font-semibold"
          inputClassName="font-semibold"
        />

        <span className="px-2 py-0.5 rounded-full text-[0.85em]" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-hover)' }}>
          {tasks.length}
        </span>

        <button
          onClick={() => openAddTask('top')}
          className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-muted)', width: '1.75em', height: '1.75em' }}
          title="Add task"
          aria-label="Add task"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        <SwimlaneMenu swimlaneId={swimlane.id} currentBoardId={boardId} />
      </div>

      {/* Tasks area - droppable */}
      <div
        ref={setDroppableRef}
        className="flex flex-col"
        style={{ padding: 'var(--padding-section, 0.75rem)', gap: 'var(--gap-md, 0.75rem)', backgroundColor: isOver ? 'var(--bg-active)' : 'transparent' }}
      >
        {/* Add task widget - shown at top when triggered from header + button */}
        {addTaskPosition === 'top' && <AddTaskWidget
          value={newTaskTitle}
          onChange={setNewTaskTitle}
          onAdd={handleAddTask}
          onClose={closeAddTask}
        />}

        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task, index) => (
            <div key={task.id} className="contents">
              {index === firstSnoozedTaskIndex && (
                <div className="flex items-center" style={{ gap: 'var(--gap-sm, 0.5rem)' }}>
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: 'var(--border-default)' }}
                    aria-hidden="true"
                  />
                  <span
                    className="text-[0.75em] font-medium uppercase tracking-[0.12em]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    snoozed
                  </span>
                  <div
                    className="h-px flex-1"
                    style={{ backgroundColor: 'var(--border-default)' }}
                    aria-hidden="true"
                  />
                </div>
              )}
              <Task task={task} swimlaneId={swimlane.id} isTaskDragging={isTaskDragging} searchQuery={searchQuery} />
            </div>
          ))}
        </SortableContext>

        {tasks.length === 0 && !isAddingTask && (
          <p className="text-center py-4" style={{ color: 'var(--text-muted)' }}>No tasks yet</p>
        )}
      </div>

      {/* Bottom add task area */}
      <div style={{ padding: '0 var(--padding-section, 0.75rem) var(--padding-section, 0.75rem)' }}>
        {addTaskPosition === 'bottom' ? (
          <AddTaskWidget
            value={newTaskTitle}
            onChange={setNewTaskTitle}
            onAdd={handleAddTask}
            onClose={closeAddTask}
          />
        ) : addTaskPosition === null && (
          <button
            onClick={() => openAddTask('bottom')}
            className="w-full flex items-center justify-center gap-2 py-2 rounded transition-all duration-150 hover:opacity-70 hover:bg-[var(--bg-hover)] active:scale-[0.98] active:opacity-50"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Task
          </button>
        )}
      </div>
    </div>
  );
}
