import { useEffect, useRef } from 'react';
import { useBoardStore } from '../store/boardStore';
import { isTaskAwaitingAck } from '../utils/taskSnooze';
import type { Task, Board } from '../types/index';

interface ReadyTask {
  task: Task;
  boardName: string;
}

interface ReadyTasksPopupProps {
  onClose: () => void;
}

export function ReadyTasksPopup({ onClose }: ReadyTasksPopupProps) {
  const { boards, swimlanes, tasks, acknowledgeTask } = useBoardStore();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Collect all awaiting-ack tasks across all boards
  const readyTasks: ReadyTask[] = [];
  for (const board of Object.values(boards) as Board[]) {
    for (const swimlaneId of board.swimlaneIds) {
      const swimlane = swimlanes[swimlaneId];
      if (!swimlane) continue;
      for (const taskId of swimlane.taskIds) {
        const task = tasks[taskId];
        if (task && isTaskAwaitingAck(task)) {
          readyTasks.push({ task, boardName: board.name });
        }
      }
    }
  }

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Auto-close when all tasks have been acknowledged
  useEffect(() => {
    if (readyTasks.length === 0) onClose();
  }, [readyTasks.length, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', paddingTop: '5rem' }}
    >
      <div
        className="rounded-xl shadow-2xl flex flex-col"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          width: 'min(480px, 90vw)',
          maxHeight: '70vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border-default)',
          }}
        >
          <div className="flex items-center" style={{ gap: '0.5rem' }}>
            <svg
              style={{ width: '1.1em', height: '1.1em', color: 'var(--accent-primary)' }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="font-semibold" style={{ color: 'var(--text-primary)', fontSize: '1em' }}>
              Ready to acknowledge
            </span>
            <span
              className="badge-glow flex items-center justify-center rounded-full font-bold"
              style={{
                minWidth: '1.4em',
                height: '1.4em',
                padding: '0 0.35em',
                fontSize: '0.75em',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
              }}
            >
              {readyTasks.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded p-1 transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-muted)' }}
            title="Close"
            aria-label="Close"
          >
            <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '0.5rem' }}>
          {readyTasks.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{ padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9em' }}
            >
              No tasks are ready to acknowledge.
            </div>
          ) : (
            <div className="flex flex-col" style={{ gap: '0.375rem' }}>
              {readyTasks.map(({ task, boardName }) => (
                <div
                  key={task.id}
                  className="flex items-center rounded-lg"
                  style={{
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    backgroundColor: 'var(--bg-subtask)',
                    border: '1px solid var(--border-card)',
                  }}
                >
                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-medium truncate"
                      style={{ color: 'var(--text-primary)', fontSize: '0.95em', lineHeight: '1.3' }}
                    >
                      {task.title}
                    </p>
                    <p
                      className="truncate"
                      style={{ color: 'var(--text-muted)', fontSize: '0.78em', marginTop: '0.15rem' }}
                    >
                      {boardName}
                    </p>
                  </div>

                  {/* Acknowledge button */}
                  <button
                    onClick={() => acknowledgeTask(task.id)}
                    className="badge-glow flex items-center justify-center rounded flex-shrink-0 transition-colors hover:bg-[var(--bg-hover)]"
                    style={{
                      width: '2em',
                      height: '2em',
                      color: 'var(--accent-primary)',
                    }}
                    title="Acknowledge"
                    aria-label="Acknowledge"
                  >
                    <svg style={{ width: '1.1em', height: '1.1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer: ack all */}
        {readyTasks.length > 1 && (
          <div
            className="flex-shrink-0 flex justify-end"
            style={{
              padding: '0.625rem 0.75rem',
              borderTop: '1px solid var(--border-default)',
            }}
          >
            <button
              onClick={() => {
                readyTasks.forEach(({ task }) => acknowledgeTask(task.id));
                onClose();
              }}
              className="flex items-center rounded-lg transition-colors hover:opacity-80"
              style={{
                gap: '0.4rem',
                padding: '0.35rem 0.75rem',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
                fontSize: '0.85em',
                fontWeight: 600,
              }}
            >
              <svg style={{ width: '0.95em', height: '0.95em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Acknowledge all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
