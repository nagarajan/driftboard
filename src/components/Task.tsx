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
  getNextWorkingDayMorningNine,
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
  { label: 'Next working day 9am', getUntil: () => getNextWorkingDayMorningNine() },
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
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);

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
  const completedSubtaskCount = task.subtasks.filter((st) => st.completed).length;
  const totalSubtaskCount = task.subtasks.length;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const hasNote = Boolean(task.note?.trim());
  const noteButtonLabel = isNoteVisible ? 'Hide note' : 'Show note';
  const awaitingAck = isTaskAwaitingAck(task);
  const snoozed = isTaskSnoozed(task);
  const snoozeLabel = awaitingAck
    ? 'Ready - click the bell to acknowledge'
    : task.snooze
      ? `Snoozed until ${formatSnoozeUntil(task.snooze.until)}`
      : '';

  const menuActions: ItemMenuAction[] = [
    ...(!hasNote && !isNoteVisible
      ? [{ label: 'Add note', onSelect: () => setIsNoteVisible(true) }]
      : []),
    {
      label: 'Snooze',
      highlighted: snoozed || awaitingAck,
      tone: awaitingAck ? 'success' as const : 'warning' as const,
      children: [
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
          backgroundColor: 'var(--bg-card)',
          borderColor: awaitingAck
            ? 'var(--accent-primary)'
            : getPriorityBorderColor(
                task.priority,
                task.completed ? 'var(--border-completed)' : 'var(--border-card)'
              ),
          opacity: snoozed ? 0.45 : 1,
        }}
        className={`min-w-0 overflow-visible rounded-lg border shadow-sm ${
          awaitingAck ? 'task-ready-glow' : ''
        }`}
      >
          <div
            className="min-w-0"
            style={{
              padding: 'var(--padding-card-sm, 0.25rem) var(--padding-card, 0.75rem)',
            }}
          >
            <div
              className="grid min-w-0 items-center"
              style={{
                columnGap: 'var(--gap-sm, 0.5rem)',
                gridTemplateColumns: 'auto auto minmax(0, 1fr) auto',
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

            <div className="min-w-0">
              <EditableTitle
                value={task.title}
                onSave={(title) => renameTask(task.id, title)}
                className={`font-medium ${task.completed ? 'line-through' : ''}`}
                style={{
                  color: 'var(--text-primary)',
                  lineHeight: '1.2',
                }}
                inputClassName="w-full"
                renderMode="markdown"
              />
            </div>

            <div className="flex items-center flex-shrink-0" style={{ gap: '0.1em' }}>
              {awaitingAck && (
                <button
                  onClick={() => acknowledgeTask(task.id)}
                  className="badge-glow flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    width: '1.75em',
                    height: '1.75em',
                    color: 'var(--accent-primary)',
                  }}
                  title="Acknowledge - clear the snooze notification"
                  aria-label="Acknowledge"
                >
                  <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
              )}
              {(hasNote || isNoteVisible) && (
                <button
                  onClick={() => setIsNoteVisible((visible) => !visible)}
                  className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    width: '1.75em',
                    height: '1.75em',
                    color: 'var(--accent-success)',
                  }}
                  title={noteButtonLabel}
                  aria-label={noteButtonLabel}
                >
                  {isNoteVisible ? (
                    <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              )}

              <button
                onClick={() => {
                  setIsAddingSubtask(true);
                  setIsSubtasksExpanded(true);
                }}
                className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  width: '1.75em',
                  height: '1.75em',
                  color: 'var(--text-muted)',
                }}
                title="Add subtask"
                aria-label="Add subtask"
              >
                <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              <button
                onClick={handleDelete}
                className="flex items-center justify-center rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)]"
                title="Delete task"
              >
                <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              <ItemActionsMenu
                priority={task.priority}
                onPriorityChange={(priority) => setTaskPriority(task.id, priority)}
                actions={menuActions}
              />
            </div>
            </div>

            {snoozeLabel && (
              <div
                style={{
                  marginTop: '0.25rem',
                  marginLeft: 'calc(2em + (2 * var(--gap-sm, 0.5rem)))',
                  minWidth: 0,
                }}
              >
                <p
                  className="text-[0.8em]"
                  style={{
                    color: awaitingAck ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {snoozeLabel}
                </p>
              </div>
            )}
          </div>

          {isNoteVisible && (
            <div
              style={{
                padding: '0 var(--padding-card, 0.75rem) var(--gap-sm, 0.5rem)',
              }}
            >
              <div
                className="note-surface flex items-start rounded-md border"
                style={{
                  gap: 'var(--gap-sm, 0.5rem)',
                  padding: '0.5rem 0.625rem',
                }}
              >
                <EditableTitle
                  value={task.note ?? ''}
                  onSave={(note) => setTaskNote(task.id, note)}
                  placeholder="Add a note..."
                  className="flex-1 text-[0.9em]"
                  style={{
                    color: 'var(--text-secondary)',
                    lineHeight: '1.35',
                  }}
                  inputClassName="w-full text-[0.9em]"
                  renderMode="markdown"
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
            </div>
          )}

          {(totalSubtaskCount > 0 || isAddingSubtask) && (
            <div className="flex flex-col" style={{ padding: '0 var(--padding-card, 0.75rem) var(--gap-sm, 0.5rem)', gap: 'var(--gap-sm, 0.5rem)' }}>
              {totalSubtaskCount > 0 && (
                <button
                  onClick={() => setIsSubtasksExpanded((e) => !e)}
                  className="flex items-center gap-1 rounded py-0.5 text-[0.8em] transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: 'var(--text-muted)', marginLeft: '0.25rem', alignSelf: 'flex-start' }}
                  title={isSubtasksExpanded ? 'Collapse subtasks' : 'Expand subtasks'}
                >
                  <svg
                    style={{
                      width: '0.85em',
                      height: '0.85em',
                      flexShrink: 0,
                      transition: 'transform 150ms',
                      transform: isSubtasksExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {totalSubtaskCount} subtask{totalSubtaskCount !== 1 ? 's' : ''}
                  {completedSubtaskCount > 0 && (
                    <span style={{ color: 'var(--accent-success)' }}>
                      ({completedSubtaskCount} done)
                    </span>
                  )}
                </button>
              )}

              {isSubtasksExpanded && (
                <>
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
                </>
              )}

              {isAddingSubtask && (
                <div style={{ marginLeft: '0.375rem', display: 'flex', alignItems: 'center', gap: 'var(--gap-sm, 0.5rem)', minWidth: 0 }}>
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
