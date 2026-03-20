interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="rounded-lg shadow-xl p-6 max-w-md w-full mx-4" style={{ backgroundColor: 'var(--bg-card)' }}>
        <h3 className="text-[1.1em] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md transition-colors"
            style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-hover)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-white rounded-md transition-colors"
            style={{ backgroundColor: 'var(--accent-danger)' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
