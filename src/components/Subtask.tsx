import { useState, type ReactNode } from 'react';
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

function SubtaskContent({
  subtask,
  taskId,
  dragControl,
}: {
  subtask: SubtaskType;
  taskId: string;
  dragControl: ReactNode;
}) {
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
    <div className="min-w-0">
      <div
        className="grid min-w-0 items-center"
        style={{
          columnGap: 'var(--gap-sm, 0.5rem)',
          gridTemplateColumns: 'auto auto minmax(0, 1fr) auto',
          minHeight: '1.75em',
        }}
      >
        {dragControl}

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

        <div className="min-w-0">
          <EditableTitle
            value={subtask.title}
            onSave={(title) => renameSubtask(taskId, subtask.id, title)}
            className={`text-[0.9em] ${subtask.completed ? 'line-through' : ''}`}
            style={{ color: subtask.completed ? 'var(--text-completed)' : 'var(--text-primary)' }}
            inputClassName="text-[0.9em] w-full"
            renderMode="markdown"
          />
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: '0.1em' }}>
          <button
            onClick={() => setIsNoteVisible((visible) => !visible)}
            className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              width: '1.75em',
              height: '1.75em',
              color: (hasNote || isNoteVisible) ? 'var(--accent-success)' : 'var(--text-muted)',
            }}
            title={noteButtonLabel}
            aria-label={noteButtonLabel}
          >
            <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>

          <button
            onClick={() => deleteSubtask(taskId, subtask.id)}
            className="flex items-center justify-center rounded p-0.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)]"
            title="Delete subtask"
          >
            <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <ItemActionsMenu
            priority={subtask.priority}
            onPriorityChange={(priority) => setSubtaskPriority(taskId, subtask.id, priority)}
          />
        </div>
      </div>

      {isNoteVisible && (
        <div
          style={{
            marginTop: '0.5rem',
            minWidth: 0,
          }}
        >
          <div
            className="note-surface flex items-start rounded-md border"
            style={{
              gap: 'var(--gap-sm, 0.5rem)',
              padding: '0.45rem 0.55rem',
            }}
          >
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
              renderMode="markdown"
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
      className="rounded border min-w-0 overflow-visible"
      style={{
        ...style,
        backgroundColor: subtask.completed ? 'var(--bg-subtask-completed)' : 'var(--bg-subtask)',
        borderColor: getPriorityBorderColor(
          subtask.priority,
          subtask.completed ? 'var(--border-completed)' : 'var(--border-card)'
        ),
        marginLeft: '0.375rem',
      }}
    >
      <div
        className="min-w-0"
        style={{
          padding: 'var(--gap-sm, 0.5rem)',
        }}
      >
        <SubtaskContent
          subtask={subtask}
          taskId={taskId}
          dragControl={
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
          }
        />
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
        marginLeft: '0.375rem',
      }}
      className="rounded border min-w-0 overflow-visible"
    >
      <div
        className="min-w-0"
        style={{
          padding: 'var(--gap-sm, 0.5rem)',
        }}
      >
        <SubtaskContent
          subtask={subtask}
          taskId={taskId}
          dragControl={
            <div
              className="flex-shrink-0"
              style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', width: '1em', height: '1em' }}
            >
              <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          }
        />
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
