import { useEffect, useRef, useState } from 'react';
import type { Priority } from '../types';
import { PRIORITY_LABELS, PRIORITY_OPTIONS, getPriorityBorderColor } from '../utils/priority';

interface PriorityDropdownProps {
  value: Priority;
  onChange: (priority: Priority) => void;
  className?: string;
}

function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 'none') {
    return (
      <svg
        style={{ width: '0.95em', height: '0.95em' }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="6" strokeWidth={2} opacity={0.9} />
      </svg>
    );
  }

  return (
    <svg
      style={{ width: '0.95em', height: '0.95em' }}
      fill="none"
      stroke="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="6" fill={getPriorityBorderColor(priority, 'var(--border-default)')} />
    </svg>
  );
}

export function PriorityDropdown({ value, onChange, className = '' }: PriorityDropdownProps) {
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const triggerColor =
    value === 'none'
      ? 'var(--text-muted)'
      : getPriorityBorderColor(value, 'var(--text-primary)');

  return (
    <div
      ref={containerRef}
      className={`relative flex-shrink-0 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center justify-center rounded border transition-colors hover:bg-[var(--bg-hover)]"
        style={{
          width: '1.75em',
          height: '1.75em',
          backgroundColor: isOpen ? 'var(--bg-hover)' : 'transparent',
          borderColor: value === 'none'
            ? 'var(--border-default)'
            : getPriorityBorderColor(value, 'var(--border-default)'),
          color: triggerColor,
        }}
        title={`Priority: ${PRIORITY_LABELS[value]}`}
        aria-label={`Priority: ${PRIORITY_LABELS[value]}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <PriorityIcon priority={value} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-lg border p-1 shadow-lg"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-default)',
          }}
          role="menu"
        >
          {PRIORITY_OPTIONS.map((priority) => {
            const isSelected = priority === value;
            return (
              <button
                key={priority}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                onClick={() => {
                  onChange(priority);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[0.85em] transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                  color:
                    priority === 'none'
                      ? 'var(--text-primary)'
                      : getPriorityBorderColor(priority, 'var(--text-primary)'),
                }}
              >
                <PriorityIcon priority={priority} />
                <span style={{ color: 'var(--text-primary)' }}>{PRIORITY_LABELS[priority]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
