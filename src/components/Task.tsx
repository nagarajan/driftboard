import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task as TaskType } from '../types';
import { EditableTitle } from './EditableTitle';
import { ItemActionsMenu, type ItemMenuAction } from './ItemActionsMenu';
import { Subtask } from './Subtask';
import { ConfirmDialog } from './ConfirmDialog';
import { SnoozeDialog } from './SnoozeDialog';
import { useBoardStore } from '../store/boardStore';
import { getPriorityBorderColor, sortSubtasksByPriority } from '../utils/priority';
import {
  addHours,
  addMinutes,
  formatSnoozeUntil,
  getTomorrowMorningNine,
  isTaskAwaitingAck,
  isTaskSnoozed,
} from '../utils/taskSnooze';

interface TaskProps {
  task: TaskType;
  swimlaneId: string;
  isTaskDragging?: boolean;
}

const SNOOZE_PRESETS = [
  { label: '1 minute', getUntil: () => addMinutes(Date.now(), 1) },
  { label: '5 minutes', getUntil: () => addMinutes(Date.now(), 5) },
  { label: '10 minutes', getUntil: () => addMinutes(Date.now(), 10) },
  { label: '15 minutes', getUntil: () => addMinutes(Date.now(), 15) },
  { label: '30 minutes', getUntil: () => addMinutes(Date.now(), 30) },
  { label: '1 hour', getUntil: () => addHours(Date.now(), 1) },
  { label: 'Tomorrow 9am', getUntil: () => getTomorrowMorningNine() },
];

export function Task({ task, swimlaneId, isTaskDragging = false }: TaskProps) {
  const {
    renameTask,
    setTaskPriority,
    setTaskNote,
    deleteTaskNote,
    deleteTask,
    toggleTaskComplete,
    addSubtask,
    snoozeTask,
    cancelTaskSnooze,
    acknowledgeTask,
  } = useBoardStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSnoozeDialog, setShowSnoozeDialog] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isNoteVisible, setIsNoteVisible] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task,
      swimlaneId,
    },
  });

  const sortedSubtasks = sortSubtasksByPriority(task.subtasks);
  const subtaskIds = sortedSubtasks.map((st) => `subtask-${st.id}`);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const hasNote = Boolean(task.note?.trim());
  const noteButtonLabel = isNoteVisible ? 'Hide note' : hasNote ? 'Show note' : 'Add note';
  const awaitingAck = isTaskAwaitingAck(task);
  const snoozed = isTaskSnoozed(task);
  const snoozeLabel = awaitingAck
    ? 'Ready now - use Snooze -> Ack to clear the glow'
    : task.snooze
      ? `Snoozed until ${formatSnoozeUntil(task.snooze.until)}`
      : '';

  const menuActions: ItemMenuAction[] = [
    {
      label: 'Snooze',
      highlighted: snoozed || awaitingAck,
      tone: awaitingAck ? 'success' as const : 'warning' as const,
      children: [
        ...(awaitingAck
          ? [
              {
                label: 'Ack',
                onSelect: () => acknowledgeTask(task.id),
                highlighted: true,
                tone: 'success' as const,
              },
            ]
          : []),
        ...(snoozed
          ? [
              {
                label: 'Cancel snooze',
                onSelect: () => cancelTaskSnooze(task.id),
                highlighted: true,
                tone: 'warning' as const,
              },
            ]
          : []),
        ...SNOOZE_PRESETS.map((preset) => ({
          label: preset.label,
          onSelect: () => snoozeTask(task.id, preset.getUntil()),
          highlighted: snoozed,
          tone: 'warning' as const,
        })),
        {
          label: 'Custom...',
          onSelect: () => setShowSnoozeDialog(true),
          highlighted: snoozed,
          tone: 'warning' as const,
        },
      ],
    },
  ];

  const handleDelete = () => {
    if (task.subtasks.length > 0) {
      setShowDeleteConfirm(true);
    } else {
      deleteTask(task.id);
    }
  };

  const confirmDelete = () => {
    deleteTask(task.id);
    setShowDeleteConfirm(false);
  };

  const handleAddSubtask = (keepOpen: boolean = false) => {
    if (newSubtaskTitle.trim()) {
      addSubtask(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle('');
      if (!keepOpen) {
        setIsAddingSubtask(false);
      }
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={{
          ...style,
          backgroundColor: task.completed ? 'var(--bg-card-completed)' : 'var(--bg-card)',
          borderColor: awaitingAck
            ? 'var(--accent-primary)'
            : getPriorityBorderColor(
                task.priority,
                task.completed ? 'var(--border-completed)' : 'var(--border-card)'
              ),
        }}
        className={`min-w-0 overflow-visible rounded-lg border shadow-sm ${
          awaitingAck ? 'task-ready-glow' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
          <div
            className="flex items-start min-w-0"
            style={{
              padding: 'var(--padding-card-sm, 0.25rem) var(--padding-card, 0.75rem)',
              gap: 'var(--gap-sm, 0.5rem)',
              minHeight: '1.75em',
            }}
          >
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab flex-shrink-0"
              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', touchAction: 'none' }}
              title="Drag to move"
            >
              <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </button>

            <button
              onClick={() => toggleTaskComplete(task.id)}
              className="rounded border flex-shrink-0"
              style={{
                width: '1em',
                height: '1em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: task.completed ? 'var(--accent-success)' : 'transparent',
                borderColor: task.completed ? 'var(--accent-success)' : 'var(--text-muted)',
                color: task.completed ? 'white' : 'var(--text-muted)',
              }}
              title={task.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              {task.completed && (
                <svg style={{ width: '0.7em', height: '0.7em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            <div className="min-w-0 flex-1">
              <EditableTitle
                value={task.title}
                onSave={(title) => renameTask(task.id, title)}
                className={`font-medium ${task.completed ? 'line-through' : ''}`}
                style={{
                  color: task.completed ? 'var(--text-completed)' : 'var(--text-primary)',
                  lineHeight: '1.2',
                }}
                inputClassName="w-full"
              />

              {snoozeLabel && (
                <p
                  className="mt-1 text-[0.8em]"
                  style={{
                    color: awaitingAck ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {snoozeLabel}
                </p>
              )}
            </div>

            <ItemActionsMenu
              priority={task.priority}
              onPriorityChange={(priority) => setTaskPriority(task.id, priority)}
              noteButtonLabel={noteButtonLabel}
              onToggleNote={() => setIsNoteVisible((visible) => !visible)}
              noteHighlighted={hasNote || isNoteVisible}
              actions={menuActions}
            />

            <button
              onClick={handleDelete}
              className="flex flex-shrink-0 items-center justify-center rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)]"
              title="Delete task"
            >
              <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {isNoteVisible && (
            <div
              className="flex items-start"
              style={{
                padding: '0 var(--padding-card, 0.75rem) var(--gap-sm, 0.5rem)',
                gap: 'var(--gap-sm, 0.5rem)',
              }}
            >
              <EditableTitle
                value={task.note ?? ''}
                onSave={(note) => setTaskNote(task.id, note)}
                placeholder="Add a note..."
                className="flex-1 text-[0.9em]"
                style={{
                  color: task.completed ? 'var(--text-completed)' : 'var(--text-secondary)',
                  lineHeight: '1.35',
                }}
                inputClassName="w-full text-[0.9em]"
              />
              <button
                onClick={() => {
                  deleteTaskNote(task.id);
                  setIsNoteVisible(false);
                }}
                className="flex flex-shrink-0 items-center justify-center rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)]"
                style={{
                  width: '1.75em',
                  height: '1.75em',
                }}
                title="Delete note"
                aria-label="Delete note"
              >
                <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}

          {(task.subtasks.length > 0 || isAddingSubtask || isHovered) && (
            <div className="flex flex-col" style={{ padding: '0 var(--padding-card, 0.75rem) var(--gap-sm, 0.5rem)', gap: 'var(--gap-sm, 0.5rem)' }}>
              {isTaskDragging ? (
                sortedSubtasks.map((subtask) => (
                  <Subtask key={subtask.id} subtask={subtask} taskId={task.id} disabled />
                ))
              ) : (
                <SortableContext items={subtaskIds} strategy={verticalListSortingStrategy}>
                  {sortedSubtasks.map((subtask) => (
                    <Subtask key={subtask.id} subtask={subtask} taskId={task.id} />
                  ))}
                </SortableContext>
              )}

              {isAddingSubtask ? (
                <div className="ml-4 flex items-center" style={{ gap: 'var(--gap-sm, 0.5rem)', minWidth: 0 }}>
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddSubtask(true);
                      if (e.key === 'Escape') {
                        setIsAddingSubtask(false);
                        setNewSubtaskTitle('');
                      }
                    }}
                    onBlur={() => {
                      if (!newSubtaskTitle.trim()) {
                        setIsAddingSubtask(false);
                        setNewSubtaskTitle('');
                      }
                    }}
                    placeholder="Subtask title..."
                    className="rounded border px-2 py-1 text-[0.9em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', flex: '1 1 0', minWidth: 0 }}
                    autoFocus
                  />
                  <button
                    onClick={() => handleAddSubtask(false)}
                    className="flex-shrink-0 rounded p-0.5 transition-all duration-150 hover:bg-[var(--bg-hover)] hover:opacity-70 active:scale-90 active:opacity-50"
                    style={{ color: 'var(--accent-primary)' }}
                  >
                    <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setIsAddingSubtask(false);
                      setNewSubtaskTitle('');
                    }}
                    className="flex-shrink-0 rounded p-0.5 transition-all duration-150 hover:bg-[var(--bg-hover)] hover:opacity-70 active:scale-90 active:opacity-50"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                isHovered && (
                  <button
                    onClick={() => setIsAddingSubtask(true)}
                    className="ml-4 flex items-center gap-1 rounded py-1 text-[0.9em] transition-all duration-150 hover:opacity-70 active:scale-[0.98] active:opacity-50"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add subtask
                  </button>
                )
              )}
            </div>
          )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}" and its ${task.subtasks.length} subtask${task.subtasks.length > 1 ? 's' : ''}?`}
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      {showSnoozeDialog && (
        <SnoozeDialog
          isOpen={showSnoozeDialog}
          taskTitle={task.title}
          onConfirm={(until) => {
            snoozeTask(task.id, until);
            setShowSnoozeDialog(false);
          }}
          onCancel={() => setShowSnoozeDialog(false)}
        />
      )}
    </>
  );
}
