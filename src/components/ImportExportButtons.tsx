import { useRef, useState } from 'react';
import { useBoardStore } from '../store/boardStore';
import type { ExportData } from '../store/boardStore';

export function ImportExportButtons() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const { getExportData, importData } = useBoardStore();

  const handleExport = () => {
    const data = getExportData();
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.download = `taskboard-export-${date}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as ExportData;

        if (!data.boards || !data.swimlanes || !data.tasks) {
          throw new Error('Invalid file format: missing required fields');
        }

        const result = importData(data);

        let message = `Successfully imported ${result.importedBoards} board(s).`;
        if (result.renamedBoards.length > 0) {
          message += ` Renamed: ${result.renamedBoards.join(', ')}`;
        }

        setImportStatus({ type: 'success', message });
        setTimeout(() => setImportStatus(null), 5000);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        setImportStatus({
          type: 'error',
          message: `Import failed: ${errorMessage}`,
        });
        setTimeout(() => setImportStatus(null), 5000);
      }
    };

    reader.onerror = () => {
      setImportStatus({ type: 'error', message: 'Failed to read file' });
      setTimeout(() => setImportStatus(null), 5000);
    };

    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center">
      <button
        onClick={handleExport}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[0.85em] border border-r-0 rounded-l transition-colors hover:opacity-80"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-secondary)',
        }}
        title="Export all data"
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export
      </button>

      <button
        onClick={handleImportClick}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[0.85em] border rounded-r transition-colors hover:opacity-80"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-secondary)',
        }}
        title="Import data"
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
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        Import
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {importStatus && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg max-w-md"
          style={{
            backgroundColor:
              importStatus.type === 'success'
                ? 'var(--bg-success, #dcfce7)'
                : 'var(--bg-error, #fee2e2)',
            color:
              importStatus.type === 'success'
                ? 'var(--text-success, #166534)'
                : 'var(--text-error, #991b1b)',
          }}
        >
          <div className="flex items-start gap-2">
            {importStatus.type === 'success' ? (
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
            <p className="text-[0.9em]">{importStatus.message}</p>
            <button
              onClick={() => setImportStatus(null)}
              className="ml-2 flex-shrink-0"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
