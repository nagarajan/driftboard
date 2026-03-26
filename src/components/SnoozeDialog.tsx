import { useMemo, useState } from 'react';
import { addHours, addMinutes, formatSnoozeUntil, toDateTimeLocalValue } from '../utils/taskSnooze';

type CustomSnoozeMode = 'minutes' | 'hours' | 'datetime';

interface SnoozeDialogProps {
  isOpen: boolean;
  taskTitle: string;
  onConfirm: (until: number) => void;
  onCancel: () => void;
}

function getInitialDateTimeValue(baseMs: number): string {
  return toDateTimeLocalValue(addHours(baseMs, 1));
}

export function SnoozeDialog({ isOpen, taskTitle, onConfirm, onCancel }: SnoozeDialogProps) {
  const [mode, setMode] = useState<CustomSnoozeMode>('minutes');
  const [minutesValue, setMinutesValue] = useState('20');
  const [hoursValue, setHoursValue] = useState('2');
  const [previewBaseMs] = useState(() => Date.now());
  const [dateTimeValue, setDateTimeValue] = useState(() => getInitialDateTimeValue(previewBaseMs));

  const validationMessage = useMemo(() => {
    if (mode === 'minutes') {
      const minutes = Number(minutesValue);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return 'Enter a positive number of minutes.';
      }
      return '';
    }

    if (mode === 'hours') {
      const hours = Number(hoursValue);
      if (!Number.isFinite(hours) || hours <= 0) {
        return 'Enter a positive number of hours.';
      }
      return '';
    }

    const timestamp = new Date(dateTimeValue).getTime();
    if (!dateTimeValue || Number.isNaN(timestamp)) {
      return 'Choose a valid date and time.';
    }
    if (previewBaseMs > 0 && timestamp <= previewBaseMs) {
      return 'Choose a future date and time.';
    }
    return '';
  }, [dateTimeValue, hoursValue, minutesValue, mode, previewBaseMs]);

  const previewUntil = useMemo(() => {
    if (validationMessage || previewBaseMs === 0) {
      return null;
    }

    if (mode === 'minutes') {
      return addMinutes(previewBaseMs, Number(minutesValue));
    }

    if (mode === 'hours') {
      return addHours(previewBaseMs, Number(hoursValue));
    }

    return new Date(dateTimeValue).getTime();
  }, [dateTimeValue, hoursValue, minutesValue, mode, previewBaseMs, validationMessage]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="mx-4 w-full max-w-md rounded-lg p-6 shadow-xl"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <h3 className="mb-2 text-[1.1em] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Custom Snooze
        </h3>
        <p className="mb-4 text-[0.95em]" style={{ color: 'var(--text-secondary)' }}>
          Choose when "{taskTitle}" should return to the top of the lane.
        </p>

        <div className="mb-4 flex gap-2">
          {(['minutes', 'hours', 'datetime'] as const).map((option) => {
            const active = mode === option;
            const label =
              option === 'minutes' ? 'Minutes' : option === 'hours' ? 'Hours' : 'Date and time';

            return (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className="flex-1 rounded-md px-3 py-2 text-[0.9em] transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-hover)',
                  color: active ? 'var(--text-header)' : 'var(--text-primary)',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {mode === 'minutes' && (
          <label className="mb-4 block text-[0.9em]" style={{ color: 'var(--text-secondary)' }}>
            Minutes
            <input
              type="number"
              min="1"
              step="1"
              value={minutesValue}
              onChange={(event) => setMinutesValue(event.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
        )}

        {mode === 'hours' && (
          <label className="mb-4 block text-[0.9em]" style={{ color: 'var(--text-secondary)' }}>
            Hours
            <input
              type="number"
              min="1"
              step="1"
              value={hoursValue}
              onChange={(event) => setHoursValue(event.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
        )}

        {mode === 'datetime' && (
          <label className="mb-4 block text-[0.9em]" style={{ color: 'var(--text-secondary)' }}>
            Date and time
            <input
              type="datetime-local"
              value={dateTimeValue}
              onChange={(event) => setDateTimeValue(event.target.value)}
              className="mt-2 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--bg-input)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
              }}
            />
          </label>
        )}

        <div
          className="mb-6 rounded-md px-3 py-2 text-[0.9em]"
          style={{ backgroundColor: 'var(--bg-hover)', color: validationMessage ? 'var(--accent-danger)' : 'var(--text-secondary)' }}
        >
          {validationMessage || (previewUntil ? `Task will return ${formatSnoozeUntil(previewUntil)}.` : '')}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 transition-colors"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-hover)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={Boolean(validationMessage) || previewUntil == null}
            onClick={() => {
              if (previewUntil != null && !validationMessage) {
                onConfirm(previewUntil);
              }
            }}
            className="rounded-md px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            Snooze task
          </button>
        </div>
      </div>
    </div>
  );
}
