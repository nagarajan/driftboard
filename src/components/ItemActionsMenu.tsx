import { useEffect, useRef, useState } from 'react';
import type { Priority } from '../types';
import { PrioritySelect } from './PrioritySelect';

export interface ItemMenuAction {
  label: string;
  onSelect?: () => void;
  highlighted?: boolean;
  tone?: 'default' | 'success' | 'warning';
  children?: ItemMenuAction[];
}

interface ItemActionsMenuProps {
  priority: Priority;
  onPriorityChange: (priority: Priority) => void;
  noteButtonLabel: string;
  onToggleNote: () => void;
  noteHighlighted?: boolean;
  actions?: ItemMenuAction[];
}

export function ItemActionsMenu({
  priority,
  onPriorityChange,
  noteButtonLabel,
  onToggleNote,
  noteHighlighted = false,
  actions = [],
}: ItemActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSubmenuLabel, setOpenSubmenuLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setOpenSubmenuLabel(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const getActionColor = (action: ItemMenuAction) =>
    action.tone === 'success'
      ? 'var(--accent-success)'
      : action.tone === 'warning'
        ? 'var(--accent-primary)'
        : action.highlighted
          ? 'var(--accent-primary)'
          : 'var(--text-primary)';

  return (
    <div
      ref={containerRef}
      className="relative flex-shrink-0"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() =>
          setIsOpen((open) => {
            const nextOpen = !open;
            if (!nextOpen) {
              setOpenSubmenuLabel(null);
            }
            return nextOpen;
          })
        }
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
          className="absolute right-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border p-2 shadow-lg"
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
              setOpenSubmenuLabel(null);
            }}
            className="w-full rounded px-2 py-1.5 text-left text-[0.85em] transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              color: noteHighlighted ? 'var(--accent-success)' : 'var(--text-primary)',
            }}
          >
            {noteButtonLabel}
          </button>

          {actions.length > 0 && (
            <div className="mt-2 space-y-1">
              {actions.map((action) => {
                const color = getActionColor(action);
                const hasChildren = Boolean(action.children && action.children.length > 0);
                const isSubmenuOpen = openSubmenuLabel === action.label;

                return (
                  <div key={action.label}>
                    <button
                      type="button"
                      onClick={() => {
                        if (hasChildren) {
                          setOpenSubmenuLabel(isSubmenuOpen ? null : action.label);
                          return;
                        }
                        action.onSelect?.();
                        setIsOpen(false);
                        setOpenSubmenuLabel(null);
                      }}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[0.85em] transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color }}
                    >
                      <span>{action.label}</span>
                      {hasChildren && (
                        <svg
                          style={{ width: '0.9em', height: '0.9em' }}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d={isSubmenuOpen ? 'M19 14l-7-7-7 7' : 'M9 5l7 7-7 7'}
                          />
                        </svg>
                      )}
                    </button>

                    {hasChildren && isSubmenuOpen && (
                      <div
                        className="ml-2 mt-1 space-y-1 rounded-md border-l pl-2"
                        style={{ borderColor: 'var(--border-default)' }}
                      >
                        {action.children!.map((childAction) => (
                          <button
                            key={`${action.label}-${childAction.label}`}
                            type="button"
                            onClick={() => {
                              childAction.onSelect?.();
                              setIsOpen(false);
                              setOpenSubmenuLabel(null);
                            }}
                            className="w-full rounded px-2 py-1.5 text-left text-[0.85em] transition-colors hover:bg-[var(--bg-hover)]"
                            style={{ color: getActionColor(childAction) }}
                          >
                            {childAction.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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
                setOpenSubmenuLabel(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
