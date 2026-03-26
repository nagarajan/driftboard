import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Subtask as SubtaskType } from '../types';
import { EditableTitle } from './EditableTitle';
import { ItemActionsMenu } from './ItemActionsMenu';
import { useBoardStore } from '../store/boardStore';
import { getPriorityBorderColor } from '../utils/priority';

interface SubtaskProps {
  subtask: SubtaskType;
  taskId: string;
  disabled?: boolean;
}

function SubtaskContent({ subtask, taskId }: { subtask: SubtaskType; taskId: string }) {
  const {
    renameSubtask,
    setSubtaskPriority,
    setSubtaskNote,
    deleteSubtaskNote,
    deleteSubtask,
    toggleSubtaskComplete,
  } = useBoardStore();
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const hasNote = Boolean(subtask.note?.trim());
  const noteButtonLabel = isNoteVisible ? 'Hide note' : hasNote ? 'Show note' : 'Add note';

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center min-w-0" style={{ gap: 'var(--gap-sm, 0.5rem)' }}>
        <button
          onClick={() => toggleSubtaskComplete(taskId, subtask.id)}
          className="rounded border flex-shrink-0 flex items-center justify-center"
          style={{
            width: '1em',
            height: '1em',
            backgroundColor: subtask.completed ? 'var(--accent-success)' : 'transparent',
            borderColor: subtask.completed ? 'var(--accent-success)' : 'var(--text-muted)',
            color: subtask.completed ? 'white' : 'var(--text-muted)',
          }}
          title={subtask.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {subtask.completed && (
            <svg style={{ width: '0.7em', height: '0.7em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <EditableTitle
          value={subtask.title}
          onSave={(title) => renameSubtask(taskId, subtask.id, title)}
          className={`flex-1 text-[0.9em] ${subtask.completed ? 'line-through' : ''}`}
          style={{ color: subtask.completed ? 'var(--text-completed)' : 'var(--text-primary)' }}
          inputClassName="text-[0.9em] w-full"
        />

        <ItemActionsMenu
          priority={subtask.priority}
          onPriorityChange={(priority) => setSubtaskPriority(taskId, subtask.id, priority)}
          noteButtonLabel={noteButtonLabel}
          onToggleNote={() => setIsNoteVisible((visible) => !visible)}
          noteHighlighted={hasNote || isNoteVisible}
        />

        <button
          onClick={() => deleteSubtask(taskId, subtask.id)}
          className="flex flex-shrink-0 items-center justify-center rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)]"
          title="Delete subtask"
        >
          <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {isNoteVisible && (
        <div className="mt-2 flex items-start" style={{ gap: 'var(--gap-sm, 0.5rem)' }}>
          <EditableTitle
            value={subtask.note ?? ''}
            onSave={(note) => setSubtaskNote(taskId, subtask.id, note)}
            placeholder="Add a note..."
            className="flex-1 text-[0.85em]"
            style={{
              color: subtask.completed ? 'var(--text-completed)' : 'var(--text-secondary)',
              lineHeight: '1.35',
            }}
            inputClassName="w-full text-[0.85em]"
          />
          <button
            onClick={() => {
              deleteSubtaskNote(taskId, subtask.id);
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
    </div>
  );
}

function SortableSubtask({ subtask, taskId }: { subtask: SubtaskType; taskId: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `subtask-${subtask.id}`,
    data: {
      type: 'subtask',
      subtask,
      taskId,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        backgroundColor: subtask.completed ? 'var(--bg-subtask-completed)' : 'var(--bg-subtask)',
        borderColor: getPriorityBorderColor(
          subtask.priority,
          subtask.completed ? 'var(--border-completed)' : 'var(--border-card)'
        ),
      }}
      className="rounded border ml-4 min-w-0 overflow-visible"
    >
      <div
        className="flex items-start min-w-0"
        style={{
          padding: 'var(--gap-sm, 0.5rem)',
          gap: 'var(--gap-sm, 0.5rem)',
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
        <SubtaskContent subtask={subtask} taskId={taskId} />
      </div>
    </div>
  );
}

function StaticSubtask({ subtask, taskId }: { subtask: SubtaskType; taskId: string }) {
  return (
    <div
      style={{
        backgroundColor: subtask.completed ? 'var(--bg-subtask-completed)' : 'var(--bg-subtask)',
        borderColor: getPriorityBorderColor(
          subtask.priority,
          subtask.completed ? 'var(--border-completed)' : 'var(--border-card)'
        ),
      }}
      className="rounded border ml-4 min-w-0 overflow-visible"
    >
      <div
        className="flex items-start min-w-0"
        style={{
          padding: 'var(--gap-sm, 0.5rem)',
          gap: 'var(--gap-sm, 0.5rem)',
        }}
      >
        <div className="flex-shrink-0" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', width: '1em', height: '1em' }}>
          <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>
        <SubtaskContent subtask={subtask} taskId={taskId} />
      </div>
    </div>
  );
}

export function Subtask({ subtask, taskId, disabled = false }: SubtaskProps) {
  if (disabled) {
    return <StaticSubtask subtask={subtask} taskId={taskId} />;
  }
  return <SortableSubtask subtask={subtask} taskId={taskId} />;
}
