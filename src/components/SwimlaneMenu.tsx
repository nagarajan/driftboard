import { useState, useRef, useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';

interface SwimlaneMenuProps {
  swimlaneId: string;
  currentBoardId: string;
}

export function SwimlaneMenu({ swimlaneId, currentBoardId }: SwimlaneMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { boards, moveSwimlaneToBoard, deleteSwimlane, addSwimlane } = useBoardStore();

  const otherBoards = Object.values(boards).filter((b) => b.id !== currentBoardId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowMoveMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMoveToBoard = (targetBoardId: string) => {
    moveSwimlaneToBoard(swimlaneId, targetBoardId);
    setIsOpen(false);
    setShowMoveMenu(false);
  };

  const handleDelete = () => {
    deleteSwimlane(swimlaneId);
    setIsOpen(false);
  };

  const handleDuplicate = () => {
    const swimlane = useBoardStore.getState().swimlanes[swimlaneId];
    if (swimlane) {
      addSwimlane(currentBoardId, `${swimlane.title} (copy)`);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded"
        style={{ color: 'var(--text-secondary)' }}
        title="Swimlane options"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 border rounded-lg shadow-lg z-20 min-w-[160px]" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          {otherBoards.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                className="w-full px-4 py-2 text-left text-[0.9em] flex items-center justify-between transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-primary)' }}
              >
                Move to board
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {showMoveMenu && (
                <div className="absolute left-full top-0 ml-1 border rounded-lg shadow-lg min-w-[140px]" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                  {otherBoards.map((board) => (
                    <button
                      key={board.id}
                      onClick={() => handleMoveToBoard(board.id)}
                      className="w-full px-4 py-2 text-left text-[0.9em] transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {board.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleDuplicate}
            className="w-full px-4 py-2 text-left text-[0.9em] transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-primary)' }}
          >
            Duplicate
          </button>

          <hr className="my-1" style={{ borderColor: 'var(--border-default)' }} />

          <button
            onClick={handleDelete}
            className="w-full px-4 py-2 text-left text-[0.9em] transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--accent-danger)' }}
          >
            Delete swimlane
          </button>
        </div>
      )}
    </div>
  );
}
