import type { Priority } from '../types';
import { PRIORITY_LABELS, PRIORITY_OPTIONS, getPriorityBorderColor } from '../utils/priority';

interface PrioritySelectProps {
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

export function PrioritySelect({
  value,
  onChange,
  className = '',
}: PrioritySelectProps) {
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {PRIORITY_OPTIONS.map((priority) => {
        const isSelected = priority === value;
        return (
          <button
            key={priority}
            type="button"
            onClick={() => onChange(priority)}
            className="flex items-center justify-center rounded border transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              width: '1.65em',
              height: '1.65em',
              backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
              borderColor: isSelected
                ? getPriorityBorderColor(priority, 'var(--border-default)')
                : 'transparent',
              color:
                priority === 'none'
                  ? 'var(--text-muted)'
                  : getPriorityBorderColor(priority, 'var(--text-primary)'),
            }}
            title={PRIORITY_LABELS[priority]}
            aria-label={PRIORITY_LABELS[priority]}
            aria-pressed={isSelected}
          >
            <PriorityIcon priority={priority} />
          </button>
        );
      })}
    </div>
  );
}
