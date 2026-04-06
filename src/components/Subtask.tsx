import { useState, useRef, useCallback, type ReactNode } from 'react';
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
  searchQuery?: string;
}

function SubtaskContent({
  subtask,
  taskId,
  dragControl,
  onDelete,
}: {
  subtask: SubtaskType;
  taskId: string;
  dragControl: ReactNode;
  onDelete: () => void;
}) {
  const {
    renameSubtask,
    setSubtaskPriority,
    setSubtaskNote,
    deleteSubtaskNote,
    toggleSubtaskComplete,
  } = useBoardStore();
  const [isNoteVisible, setIsNoteVisible] = useState(false);
  const hasNote = Boolean(subtask.note?.trim());
  const noteButtonLabel = isNoteVisible ? 'Hide note' : 'Show note';
  const subtaskMenuActions = !hasNote && !isNoteVisible
    ? [{ label: 'Add note', onSelect: () => setIsNoteVisible(true) }]
    : [];

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
            style={{ color: 'var(--text-primary)' }}
            inputClassName="text-[0.9em] w-full"
            renderMode="markdown"
          />
        </div>

        <div className="flex items-center flex-shrink-0" style={{ gap: '0.1em' }}>
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
            onClick={onDelete}
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
            actions={subtaskMenuActions}
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
                color: 'var(--text-secondary)',
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

function useDeleteAnimation(onConfirmedDelete: () => void) {
  const collapseRef = useRef<HTMLDivElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const triggerDelete = useCallback(() => {
    const el = collapseRef.current;
    if (!el) {
      onConfirmedDelete();
      return;
    }
    setIsDeleting(true);
    el.style.maxHeight = `${el.scrollHeight}px`;
    el.style.overflow = 'hidden';
    void el.offsetHeight;
    el.style.transition = 'max-height 0.2s ease, opacity 0.16s ease, margin-bottom 0.2s ease';
    el.style.maxHeight = '0';
    el.style.opacity = '0';
    el.style.marginBottom = '0';
    const onEnd = () => {
      el.removeEventListener('transitionend', onEnd);
      onConfirmedDelete();
    };
    el.addEventListener('transitionend', onEnd);
    setTimeout(onConfirmedDelete, 320);
  }, [onConfirmedDelete]);

  return { collapseRef, isDeleting, triggerDelete };
}

function SortableSubtask({ subtask, taskId, searchQuery = '' }: { subtask: SubtaskType; taskId: string; searchQuery?: string }) {
  const { deleteSubtask } = useBoardStore();
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

  const { collapseRef, isDeleting, triggerDelete } = useDeleteAnimation(
    useCallback(() => deleteSubtask(taskId, subtask.id), [deleteSubtask, taskId, subtask.id])
  );

  const needle = searchQuery.toLowerCase();
  const matches = needle ? subtask.title.toLowerCase().includes(needle) : true;
  const isSearchActive = needle.length > 0;

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : isSearchActive && !matches ? 0.3 : 1,
    filter: isSearchActive && !matches ? 'grayscale(0.85)' : 'none',
  };

  const hasPriority = subtask.priority !== 'none';
  return (
    <div ref={collapseRef} style={isDeleting ? { pointerEvents: 'none' } : undefined}>
    <div
      ref={setNodeRef}
      className="rounded min-w-0 overflow-visible"
      style={{
        ...dndStyle,
        backgroundColor: 'var(--bg-subtask)',
        borderColor: getPriorityBorderColor(
          subtask.priority,
          subtask.completed ? 'var(--border-completed)' : 'var(--border-card)'
        ),
        borderStyle: 'solid',
        borderWidth: hasPriority ? '3px' : subtask.completed ? '2px' : '1px',
        marginLeft: '0.375rem',
        transition: 'opacity 0.15s, filter 0.15s',
      }}
    >
      <div
        className="min-w-0"
        style={{
          padding: hasPriority
            ? 'calc(var(--gap-sm, 0.5rem) - 2px)'
            : subtask.completed
              ? 'calc(var(--gap-sm, 0.5rem) - 1px)'
              : 'var(--gap-sm, 0.5rem)',
        }}
      >
        <SubtaskContent
          subtask={subtask}
          taskId={taskId}
          onDelete={triggerDelete}
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
    </div>
  );
}

function StaticSubtask({ subtask, taskId, searchQuery = '' }: { subtask: SubtaskType; taskId: string; searchQuery?: string }) {
  const { deleteSubtask } = useBoardStore();
  const { collapseRef, isDeleting, triggerDelete } = useDeleteAnimation(
    useCallback(() => deleteSubtask(taskId, subtask.id), [deleteSubtask, taskId, subtask.id])
  );

  const needle = searchQuery.toLowerCase();
  const matches = needle ? subtask.title.toLowerCase().includes(needle) : true;
  const isSearchActive = needle.length > 0;

  const hasPriority = subtask.priority !== 'none';
  return (
    <div ref={collapseRef} style={isDeleting ? { pointerEvents: 'none' } : undefined}>
    <div
      style={{
        backgroundColor: 'var(--bg-subtask)',
        borderColor: getPriorityBorderColor(
          subtask.priority,
          subtask.completed ? 'var(--border-completed)' : 'var(--border-card)'
        ),
        borderStyle: 'solid',
        borderWidth: hasPriority ? '3px' : subtask.completed ? '2px' : '1px',
        marginLeft: '0.375rem',
        opacity: isSearchActive && !matches ? 0.3 : 1,
        filter: isSearchActive && !matches ? 'grayscale(0.85)' : 'none',
        transition: 'opacity 0.15s, filter 0.15s',
      }}
      className="rounded min-w-0 overflow-visible"
    >
      <div
        className="min-w-0"
        style={{
          padding: hasPriority
            ? 'calc(var(--gap-sm, 0.5rem) - 2px)'
            : subtask.completed
              ? 'calc(var(--gap-sm, 0.5rem) - 1px)'
              : 'var(--gap-sm, 0.5rem)',
        }}
      >
        <SubtaskContent
          subtask={subtask}
          taskId={taskId}
          onDelete={triggerDelete}
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
    </div>
  );
}

export function Subtask({ subtask, taskId, disabled = false, searchQuery = '' }: SubtaskProps) {
  if (disabled) {
    return <StaticSubtask subtask={subtask} taskId={taskId} searchQuery={searchQuery} />;
  }
  return <SortableSubtask subtask={subtask} taskId={taskId} searchQuery={searchQuery} />;
}
