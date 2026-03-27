import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBoardStore } from '../store/boardStore';
import { getOrderedBoardIds } from '../utils/boardOrder';
import { getAwaitingAckCount } from '../utils/taskSnooze';
import type { Board, Swimlane, Task } from '../types';

type BoardListRowProps = {
  board: Board;
  activeBoardId: string | null;
  boardToDelete: string | null;
  boardToEdit: string | null;
  editBoardName: string;
  setEditBoardName: (v: string) => void;
  dragDisabled: boolean;
  awaitingAckCount: number;
  onRowClick: () => void;
  onConfirmDelete: (e: React.MouseEvent) => void;
  onCancelDelete: (e: React.MouseEvent) => void;
  onConfirmEdit: (e: React.MouseEvent) => void;
  onCancelEdit: (e: React.MouseEvent) => void;
  onEditClick: (boardId: string, boardName: string, e: React.MouseEvent) => void;
  onDeleteClick: (boardId: string, e: React.MouseEvent) => void;
};

function BoardListRow({
  board,
  activeBoardId,
  boardToDelete,
  boardToEdit,
  editBoardName,
  setEditBoardName,
  dragDisabled,
  awaitingAckCount,
  onRowClick,
  onConfirmDelete,
  onCancelDelete,
  onConfirmEdit,
  onCancelEdit,
  onEditClick,
  onDeleteClick,
}: BoardListRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: board.id,
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2 transition-colors ${board.id === activeBoardId ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'} ${dragDisabled ? '' : 'cursor-pointer'}`}
      onClick={() => {
        if (boardToDelete !== board.id && boardToEdit !== board.id) {
          onRowClick();
        }
      }}
    >
      {boardToDelete === board.id ? (
        <div className="flex items-center gap-2 w-full">
          <span className="text-[0.85em] flex-1" style={{ color: 'var(--text-secondary)' }}>
            Delete "{board.name}"?
          </span>
          <button
            onClick={onConfirmDelete}
            className="px-2 py-0.5 text-[0.8em] rounded"
            style={{ backgroundColor: 'var(--bg-error, #fee2e2)', color: 'var(--text-error, #991b1b)' }}
            title="Confirm delete"
          >
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            className="px-2 py-0.5 text-[0.8em] rounded border"
            style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            title="Cancel"
          >
            Cancel
          </button>
        </div>
      ) : boardToEdit === board.id ? (
        <div className="flex items-center gap-2 w-full">
          <input
            type="text"
            value={editBoardName}
            onChange={(e) => setEditBoardName(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') onConfirmEdit(e as unknown as React.MouseEvent);
              if (e.key === 'Escape') onCancelEdit(e as unknown as React.MouseEvent);
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 border rounded px-2 py-0.5 text-[0.85em] focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
            autoFocus
          />
          <button
            onClick={onConfirmEdit}
            className="p-1"
            style={{ color: 'var(--accent-primary)' }}
            title="Save"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button onClick={onCancelEdit} className="p-1" style={{ color: 'var(--text-muted)' }} title="Cancel">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="shrink-0 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-muted)', touchAction: 'none' }}
            title="Drag to reorder"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
            onPointerDown={(e) => {
              listeners?.onPointerDown?.(e);
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="9" cy="8" r="1.5" />
              <circle cx="15" cy="8" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="16" r="1.5" />
              <circle cx="15" cy="16" r="1.5" />
            </svg>
          </button>

          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: board.id === activeBoardId ? 'var(--accent-primary)' : 'var(--text-muted)' }}
          />

          <span className="flex-1 text-[0.9em]" style={{ color: 'var(--text-primary)' }}>
            {board.name}
          </span>

          {awaitingAckCount > 0 && (
            <div
              className="badge-glow flex items-center justify-center rounded-full font-bold shrink-0"
              style={{
                minWidth: '1.4em',
                height: '1.4em',
                padding: '0 0.35em',
                fontSize: '0.75em',
                backgroundColor: 'var(--accent-primary)',
                color: '#ffffff',
              }}
              title={`${awaitingAckCount} task${awaitingAckCount === 1 ? '' : 's'} ready to acknowledge`}
            >
              {awaitingAckCount}
            </div>
          )}

          <button
            onClick={(e) => onEditClick(board.id, board.name, e)}
            className="rounded-md p-1.5 text-[var(--text-muted)] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:opacity-100 hover:scale-105 hover:bg-[var(--bg-active)] hover:text-[var(--accent-primary)] hover:shadow-md hover:ring-2 hover:ring-[var(--accent-primary)]/45"
            title="Rename board"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
          <button
            onClick={(e) => onDeleteClick(board.id, e)}
            className="rounded p-1 text-[var(--text-muted)] opacity-0 transition-colors transition-opacity group-hover:opacity-100 hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)] hover:opacity-100"
            title="Delete board"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

export function BoardSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingBoard, setIsAddingBoard] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [boardToDelete, setBoardToDelete] = useState<string | null>(null);
  const [boardToEdit, setBoardToEdit] = useState<string | null>(null);
  const [editBoardName, setEditBoardName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    boards,
    boardOrderIds,
    activeBoardId,
    setActiveBoard,
    addBoard,
    renameBoard,
    deleteBoard,
    reorderBoardsByDrag,
    swimlanes,
    tasks,
  } = useBoardStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeBoard = activeBoardId ? boards[activeBoardId] : null;
  const orderedIds = getOrderedBoardIds(boards, boardOrderIds);
  const boardList = orderedIds
    .map((id) => boards[id])
    .filter((b): b is NonNullable<typeof b> => b != null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderBoardsByDrag(String(active.id), String(over.id));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAddingBoard(false);
        setBoardToDelete(null);
        setBoardToEdit(null);
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

  const handleEditClick = (boardId: string, boardName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBoardToEdit(boardId);
    setEditBoardName(boardName);
  };

  const handleConfirmEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (boardToEdit && editBoardName.trim()) {
      renameBoard(boardToEdit, editBoardName.trim());
      setBoardToEdit(null);
      setEditBoardName('');
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setBoardToEdit(null);
    setEditBoardName('');
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
            <p className="text-[0.65em] px-2 pt-0.5" style={{ color: 'var(--text-muted)' }}>
              Drag the grip to reorder
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                {boardList.map((board) => (
                  <BoardListRow
                    key={board.id}
                    board={board}
                    activeBoardId={activeBoardId}
                    boardToDelete={boardToDelete}
                    boardToEdit={boardToEdit}
                    editBoardName={editBoardName}
                    setEditBoardName={setEditBoardName}
                    dragDisabled={boardToDelete === board.id || boardToEdit === board.id}
                    awaitingAckCount={getAwaitingAckCount(board, swimlanes as Record<string, Swimlane>, tasks as Record<string, Task>)}
                    onRowClick={() => {
                      setActiveBoard(board.id);
                      setIsOpen(false);
                    }}
                    onConfirmDelete={handleConfirmDelete}
                    onCancelDelete={handleCancelDelete}
                    onConfirmEdit={handleConfirmEdit}
                    onCancelEdit={handleCancelEdit}
                    onEditClick={handleEditClick}
                    onDeleteClick={handleDeleteClick}
                  />
                ))}
              </SortableContext>
            </DndContext>
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
                <button onClick={handleAddBoard} style={{ color: 'var(--accent-primary)' }}>
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
