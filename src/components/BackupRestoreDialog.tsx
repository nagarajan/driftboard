import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useBoardStore, replaceAllData } from '../store/boardStore';
import { showToast } from '../store/toastStore';
import {
  fetchBackupList,
  triggerBackupNow,
  downloadBackupData,
  type BackupEntry,
} from '../utils/driveBackup';

interface BackupRestoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function groupBackups(
  entries: BackupEntry[],
): { label: string; entries: BackupEntry[] }[] {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const groups = [
    { label: 'Today', entries: [] as BackupEntry[] },
    { label: 'This Week', entries: [] as BackupEntry[] },
    { label: 'This Month', entries: [] as BackupEntry[] },
    { label: 'Older', entries: [] as BackupEntry[] },
  ];

  for (const entry of entries) {
    const entryDate = new Date(entry.createdAt);
    if (entry.createdAt.slice(0, 10) === today) {
      groups[0].entries.push(entry);
    } else if (entryDate >= weekAgo) {
      groups[1].entries.push(entry);
    } else if (entryDate >= monthAgo) {
      groups[2].entries.push(entry);
    } else {
      groups[3].entries.push(entry);
    }
  }

  return groups.filter((g) => g.entries.length > 0);
}

export function BackupRestoreDialog({ isOpen, onClose }: BackupRestoreDialogProps) {
  const [entries, setEntries] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const user = useAuthStore((s) => s.user);
  const { getExportData, importData } = useBoardStore();

  const loadList = useCallback(async () => {
    if (!user?.uid || !user?.email) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchBackupList(user.uid, user.email);
      setEntries(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.email]);

  useEffect(() => {
    if (isOpen) {
      loadList();
      setSelectedFileId(null);
    }
  }, [isOpen, loadList]);

  const handleBackupNow = async () => {
    if (!user?.uid || !user?.email) return;
    setBackingUp(true);
    try {
      const entry = await triggerBackupNow(user.uid, user.email, getExportData);
      setEntries((prev) => [entry, ...prev]);
      showToast('Backup created', 'add');
    } catch (e) {
      showToast(
        'Backup failed: ' + (e instanceof Error ? e.message : 'Unknown error'),
        'delete',
      );
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async (
    entry: BackupEntry,
    mode: 'replace' | 'merge',
  ) => {
    if (!user?.uid || !user?.email) return;
    setRestoring(true);
    try {
      const data = await downloadBackupData(user.uid, user.email, entry.fileId);
      if (mode === 'replace') {
        replaceAllData(data);
        showToast('Data restored (replaced all)', 'edit');
      } else {
        const result = importData(data);
        showToast('Merged ' + result.importedBoards + ' board(s)', 'add');
      }
      onClose();
    } catch (e) {
      showToast(
        'Restore failed: ' +
          (e instanceof Error ? e.message : 'Unknown error'),
        'delete',
      );
    } finally {
      setRestoring(false);
      setSelectedFileId(null);
    }
  };

  if (!isOpen) return null;

  const groups = groupBackups(entries);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !restoring) onClose();
      }}
    >
      <div
        className="rounded-lg shadow-xl flex flex-col mx-4"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          maxWidth: '32rem',
          width: '100%',
          maxHeight: '80vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--border-default)' }}
        >
          <h2
            className="font-semibold"
            style={{ fontSize: '1.1em', color: 'var(--text-primary)' }}
          >
            Drive Backups
          </h2>
          <button
            onClick={onClose}
            disabled={restoring}
            className="p-1 rounded transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4"
          style={{ minHeight: '10rem' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p style={{ color: 'var(--text-secondary)' }}>
                Loading backups...
              </p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p
                className="mb-3 text-[0.9em]"
                style={{ color: 'var(--accent-danger, #ef4444)' }}
              >
                {error}
              </p>
              <button
                onClick={loadList}
                className="px-4 py-1.5 rounded text-[0.9em] transition-colors hover:opacity-80"
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                }}
              >
                Try again
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="w-10 h-10 mx-auto mb-3"
                style={{ color: 'var(--text-muted)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
              <p style={{ color: 'var(--text-secondary)' }}>
                No backups yet. Click &quot;Backup Now&quot; to create your
                first backup.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {groups.map((group) => (
                <div key={group.label}>
                  <h3
                    className="text-xs font-semibold uppercase mb-1.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {group.label}
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    {group.entries.map((entry) => {
                      const isSelected = selectedFileId === entry.fileId;
                      return (
                        <div
                          key={entry.fileId}
                          className="rounded-md transition-colors"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--bg-hover)'
                              : 'transparent',
                          }}
                        >
                          <div className="flex items-center justify-between px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <span
                                className="text-[0.9em]"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {formatDate(entry.createdAt)}
                              </span>
                              <span
                                className="text-[0.8em] ml-2"
                                style={{ color: 'var(--text-muted)' }}
                              >
                                {formatSize(entry.sizeBytes)} --{' '}
                                {entry.boardCount} board
                                {entry.boardCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                setSelectedFileId(
                                  isSelected ? null : entry.fileId,
                                )
                              }
                              disabled={restoring}
                              className="text-[0.85em] px-2 py-1 rounded transition-colors hover:opacity-80 flex-shrink-0 ml-2"
                              style={{ color: 'var(--accent-primary)' }}
                            >
                              {isSelected ? 'Cancel' : 'Restore'}
                            </button>
                          </div>
                          {isSelected && (
                            <div className="flex gap-2 px-3 pb-2">
                              <button
                                onClick={() =>
                                  handleRestore(entry, 'replace')
                                }
                                disabled={restoring}
                                className="flex-1 px-3 py-1.5 rounded text-[0.85em] text-white transition-colors hover:opacity-80 disabled:opacity-50"
                                style={{
                                  backgroundColor:
                                    'var(--accent-danger, #ef4444)',
                                }}
                              >
                                {restoring
                                  ? 'Restoring...'
                                  : 'Replace all data'}
                              </button>
                              <button
                                onClick={() => handleRestore(entry, 'merge')}
                                disabled={restoring}
                                className="flex-1 px-3 py-1.5 rounded text-[0.85em] text-white transition-colors hover:opacity-80 disabled:opacity-50"
                                style={{
                                  backgroundColor: 'var(--accent-primary)',
                                }}
                              >
                                {restoring
                                  ? 'Restoring...'
                                  : 'Merge with current'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border-default)' }}
        >
          <button
            onClick={handleBackupNow}
            disabled={backingUp || loading || restoring}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[0.9em] text-white transition-colors hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            {backingUp ? 'Backing up...' : 'Backup Now'}
          </button>
          {entries.length > 0 && (
            <span
              className="text-[0.8em]"
              style={{ color: 'var(--text-muted)' }}
            >
              {entries.length} backup{entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
