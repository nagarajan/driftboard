import { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';
import { EditableTitle } from './EditableTitle';

export function BoardSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingBoard, setIsAddingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [boardToDelete, setBoardToDelete] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const { boards, activeBoardId, setActiveBoard, addBoard, renameBoard, deleteBoard } =
    useBoardStore();

  const activeBoard = activeBoardId ? boards[activeBoardId] : null;
  const boardList = Object.values(boards);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingBoard(false);
        setBoardToDelete(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddBoard = () => {
    if (newBoardName.trim()) {
      addBoard(newBoardName.trim());
      setNewBoardName('');
      setIsAddingBoard(false);
    }
  };

  const handleDeleteClick = (boardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBoardToDelete(boardId);
  };

  const handleConfirmDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (boardToDelete) {
      deleteBoard(boardToDelete);
      setBoardToDelete(null);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBoardToDelete(null);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[0.85em] border rounded transition-colors hover:opacity-80"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span className="font-medium">{activeBoard?.name || 'Select Board'}</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 border rounded-lg shadow-lg z-30 min-w-[240px]" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div className="p-2" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <p className="text-[0.75em] font-semibold uppercase px-2 py-1" style={{ color: 'var(--text-secondary)' }}>
              Your Boards
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {boardList.map((board) => (
              <div
                key={board.id}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${board.id === activeBoardId ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'}`}
                onClick={() => {
                  if (boardToDelete !== board.id) {
                    setActiveBoard(board.id);
                    setIsOpen(false);
                  }
                }}
              >
                {boardToDelete === board.id ? (
                  <div className="flex items-center gap-2 w-full">
                    <span className="text-[0.85em] flex-1" style={{ color: 'var(--text-secondary)' }}>
                      Delete "{board.name}"?
                    </span>
                    <button
                      onClick={handleConfirmDelete}
                      className="px-2 py-0.5 text-[0.8em] rounded"
                      style={{ backgroundColor: 'var(--bg-error, #fee2e2)', color: 'var(--text-error, #991b1b)' }}
                      title="Confirm delete"
                    >
                      Delete
                    </button>
                    <button
                      onClick={handleCancelDelete}
                      className="px-2 py-0.5 text-[0.8em] rounded border"
                      style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: board.id === activeBoardId ? 'var(--accent-primary)' : 'var(--text-muted)' }}
                    />

                    <EditableTitle
                      value={board.name}
                      onSave={(name) => renameBoard(board.id, name)}
                      className="flex-1"
                      inputClassName="w-full"
                    />

                    <button
                      onClick={(e) => handleDeleteClick(board.id, e)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete board"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="p-2" style={{ borderTop: '1px solid var(--border-default)' }}>
            {isAddingBoard ? (
              <div className="flex items-center gap-2 px-2">
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBoard();
                    if (e.key === 'Escape') {
                      setIsAddingBoard(false);
                      setNewBoardName('');
                    }
                  }}
                  placeholder="Board name..."
                  className="flex-1 border rounded px-2 py-1 text-[0.9em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  autoFocus
                />
                <button
                  onClick={handleAddBoard}
                  style={{ color: 'var(--accent-primary)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => {
                    setIsAddingBoard(false);
                    setNewBoardName('');
                  }}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingBoard(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[0.9em] rounded transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new board
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
