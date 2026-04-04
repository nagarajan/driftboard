interface NotificationFailureDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  onDontShowAgain: () => void;
}

export function NotificationFailureDialog({
  isOpen,
  onDismiss,
  onDontShowAgain,
}: NotificationFailureDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
        style={{ backgroundColor: 'var(--bg-card)' }}
      >
        <h3
          className="text-[1.1em] font-semibold mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          Notification could not be sent
        </h3>
        <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
          A snoozed task became ready, but the system notification could not be
          delivered. This usually means notifications are blocked.
        </p>
        <p className="mb-6 text-[0.9em]" style={{ color: 'var(--text-muted)' }}>
          To fix this, check two places:
        </p>
        <ol
          className="mb-6 text-[0.9em] list-decimal list-inside flex flex-col"
          style={{ color: 'var(--text-secondary)', gap: '0.4em' }}
        >
          <li>
            <strong>Browser settings</strong> &mdash; make sure notifications are
            allowed for this site.
          </li>
          <li>
            <strong>macOS / OS settings</strong> &mdash; System Settings &gt;
            Notifications &gt; your browser &gt; Allow Notifications.
          </li>
        </ol>
        <div className="flex items-center justify-between" style={{ gap: '0.75em' }}>
          <button
            onClick={onDontShowAgain}
            className="text-[0.85em] transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Don't tell me about this again
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 rounded-md transition-colors"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
