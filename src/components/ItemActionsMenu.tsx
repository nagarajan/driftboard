import { useEffect, useRef, useState } from 'react';
import type { Priority } from '../types';
import { PrioritySelect } from './PrioritySelect';

interface ItemActionsMenuProps {
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
  noteButtonLabel: string;
  onToggleNote: () => void;
  noteHighlighted?: boolean;
}

export function ItemActionsMenu({
  priority,
  onPriorityChange,
  noteButtonLabel,
  onToggleNote,
  noteHighlighted = false,
}: ItemActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center justify-center rounded p-0.5 transition-colors hover:bg-[var(--bg-hover)]"
        style={{
          color: isOpen ? 'var(--text-primary)' : 'var(--text-muted)',
          width: '1.75em',
          height: '1.75em',
        }}
        title={isOpen ? 'Close menu' : 'More options'}
        aria-label={isOpen ? 'Close menu' : 'More options'}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg style={{ width: '1em', height: '1em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg style={{ width: '1em', height: '1em' }} fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[180px] rounded-lg border p-2 shadow-lg z-30"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onToggleNote();
              setIsOpen(false);
            }}
            className="w-full rounded px-2 py-1.5 text-left text-[0.85em] transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              color: noteHighlighted ? 'var(--accent-success)' : 'var(--text-primary)',
            }}
          >
            {noteButtonLabel}
          </button>

          <div
            className="mt-2 flex items-center justify-between gap-3 rounded px-2 py-1.5"
            style={{ backgroundColor: 'var(--bg-hover)' }}
          >
            <span className="text-[0.8em]" style={{ color: 'var(--text-secondary)' }}>
              Priority
            </span>
            <PrioritySelect
              value={priority}
              onChange={(nextPriority) => {
                onPriorityChange(nextPriority);
                setIsOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
