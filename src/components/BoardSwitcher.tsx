import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import {
  getOrderedBoardIds,
  getOrderedBoardIdsForWorkspace,
  getOrderedWorkspaceIds,
} from '../utils/boardOrder';
import { getAwaitingAckCount } from '../utils/taskSnooze';
import type { Board, Swimlane, Task, Workspace } from '../types';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function GripIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="8" r="1.5" />
      <circle cx="15" cy="8" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="16" r="1.5" />
      <circle cx="15" cy="16" r="1.5" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

function XIcon({ size = 4 }: { size?: number }) {
  return (
    <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

/** Arrow icon used to show submenu expand/collapse state */
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

/** Arrow-right-into-box icon for "Move to" action */
function MoveToIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Inline helpers
// ---------------------------------------------------------------------------

type EditState = { id: string; name: string } | null;
type DeleteState = string | null;

interface InlineEditProps {
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function InlineEditInput({ value, onChange, onConfirm, onCancel }: InlineEditProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') onConfirm();
          if (e.key === 'Escape') onCancel();
        }}
        onClick={(e) => e.stopPropagation()}
        className="flex-1 border rounded px-2 py-0.5 text-[0.85em] focus:outline-none focus:ring-2 focus:ring-blue-500"
        style={{
          backgroundColor: 'var(--bg-input)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-primary)',
        }}
        autoFocus
      />
      <button
        onClick={(e) => { e.stopPropagation(); onConfirm(); }}
        className="p-1"
        style={{ color: 'var(--accent-primary)' }}
        title="Save"
      >
        <CheckIcon />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        className="p-1"
        style={{ color: 'var(--text-muted)' }}
        title="Cancel"
      >
        <XIcon />
      </button>
    </div>
  );
}

interface InlineDeleteProps {
  label: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function InlineDeleteConfirm({ label, onConfirm, onCancel }: InlineDeleteProps) {
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[0.85em] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
        Delete "{label}"?
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); onConfirm(); }}
        className="px-2 py-0.5 text-[0.8em] rounded shrink-0"
        style={{ backgroundColor: 'var(--bg-error, #fee2e2)', color: 'var(--text-error, #991b1b)' }}
        title="Confirm delete"
      >
        Delete
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onCancel(); }}
        className="px-2 py-0.5 text-[0.8em] rounded border shrink-0"
        style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
        title="Cancel"
      >
        Cancel
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "Move to" popup — shown anchored to the move button
// ---------------------------------------------------------------------------

interface MoveToPanelProps {
  board: Board;
  workspaces: Record<string, Workspace>;
  workspaceOrderIds: string[];
  /** Bounding rect of the trigger button, used to position the portal panel */
  anchorRect: DOMRect;
  onMove: (boardId: string, targetWorkspaceId: string | null) => void;
  onClose: () => void;
}

function MoveToPanel({ board, workspaces, workspaceOrderIds, anchorRect, onMove, onClose }: MoveToPanelProps) {
  const orderedWsIds = getOrderedWorkspaceIds(workspaces, workspaceOrderIds);
  const currentWsId = board.workspaceId ?? null;
  const panelRef = useRef<HTMLDivElement>(null);

  // Position: align top with the button, open to the left of it.
  // If too close to the left edge, open to the right instead.
  const panelWidth = 180;
  const spaceLeft = anchorRect.left;
  const openLeft = spaceLeft >= panelWidth + 8;
  const left = openLeft
    ? anchorRect.left - panelWidth - 4
    : anchorRect.right + 4;
  const top = anchorRect.top + window.scrollY;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className="fixed z-[200] rounded-lg shadow-xl border"
      style={{
        top,
        left,
        width: panelWidth,
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-default)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ borderBottom: '1px solid var(--border-default)' }}
      >
        <span className="text-[0.75em] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Move to
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-0.5 rounded hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-muted)' }}
          title="Close"
        >
          <XIcon size={3} />
        </button>
      </div>

      <div className="py-1 max-h-48 overflow-y-auto">
        {/* No workspace option */}
        <button
          onClick={(e) => { e.stopPropagation(); onMove(board.id, null); onClose(); }}
          disabled={currentWsId === null}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-[0.85em] text-left transition-colors ${
            currentWsId === null
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-[var(--bg-hover)] cursor-pointer'
          }`}
          style={{ color: 'var(--text-primary)' }}
        >
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <span className="truncate">No workspace</span>
          {currentWsId === null && <CheckIcon />}
        </button>

        {orderedWsIds.map((wsId) => {
          const ws = workspaces[wsId];
          if (!ws) return null;
          const isCurrent = currentWsId === wsId;
          return (
            <button
              key={wsId}
              onClick={(e) => { e.stopPropagation(); onMove(board.id, wsId); onClose(); }}
              disabled={isCurrent}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[0.85em] text-left transition-colors ${
                isCurrent
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-[var(--bg-hover)] cursor-pointer'
              }`}
              style={{ color: 'var(--text-primary)' }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--accent-primary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="truncate flex-1">{ws.name}</span>
              {isCurrent && <CheckIcon />}
            </button>
          );
        })}

        {orderedWsIds.length === 0 && (
          <p className="px-3 py-2 text-[0.8em]" style={{ color: 'var(--text-muted)' }}>
            No workspaces yet
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Board row (sortable) — used both inside workspaces and at top level
// ---------------------------------------------------------------------------

type BoardRowProps = {
  board: Board;
  activeBoardId: string | null;
  editState: EditState;
  deleteState: DeleteState;
  movingBoardId: string | null;
  setEditState: (s: EditState) => void;
  setDeleteState: (s: DeleteState) => void;
  setMovingBoardId: (id: string | null) => void;
  workspaces: Record<string, Workspace>;
  workspaceOrderIds: string[];
  awaitingAckCount: number;
  /** True when the board is nested inside a workspace submenu */
  nested?: boolean;
  onRowClick: () => void;
  onConfirmEdit: (name: string) => void;
  onDeleteBoard: (boardId: string) => void;
  onMoveBoardToWorkspace: (boardId: string, workspaceId: string | null) => void;
};

function BoardRow({
  board,
  activeBoardId,
  editState,
  deleteState,
  movingBoardId,
  setEditState,
  setDeleteState,
  setMovingBoardId,
  workspaces,
  workspaceOrderIds,
  awaitingAckCount,
  nested = false,
  onRowClick,
  onConfirmEdit,
  onDeleteBoard,
  onMoveBoardToWorkspace,
}: BoardRowProps) {
  const isEditing = editState?.id === board.id;
  const isDeleting = deleteState === board.id;
  const isMoving = movingBoardId === board.id;
  const isDragDisabled = isEditing || isDeleting || isMoving;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: board.id,
    disabled: isDragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 2 : undefined,
  };

  // Ref + state for the "Move to" portal panel anchor
  const moveButtonRef = useRef<HTMLButtonElement>(null);
  const [moveAnchorRect, setMoveAnchorRect] = useState<DOMRect | null>(null);

  // Nested boards get a deeper left indent so they visually sit under the workspace header
  const rowPadding = nested ? 'pl-14 pr-2' : 'pl-10 pr-2';
  const gripLeft = nested ? 'left-6' : 'left-2';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center gap-2 ${rowPadding} py-2 transition-colors ${board.id === activeBoardId ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'} ${isDragDisabled ? '' : 'cursor-pointer'}`}
      onClick={() => {
        if (!isDeleting && !isEditing && !isMoving) onRowClick();
      }}
    >
      {isDeleting ? (
        <InlineDeleteConfirm
          label={board.name}
          onConfirm={() => { onDeleteBoard(board.id); setDeleteState(null); }}
          onCancel={() => setDeleteState(null)}
        />
      ) : isEditing ? (
        <InlineEditInput
          value={editState!.name}
          onChange={(v) => setEditState({ id: board.id, name: v })}
          onConfirm={() => {
            if (editState!.name.trim()) onConfirmEdit(editState!.name.trim());
            setEditState(null);
          }}
          onCancel={() => setEditState(null)}
        />
      ) : (
        <>
          {/* Drag grip — sits in the left padding area */}
          <button
            type="button"
            className={`absolute ${gripLeft} shrink-0 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-[var(--bg-hover)]`}
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
            <GripIcon />
          </button>

          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor:
                board.id === activeBoardId ? 'var(--accent-primary)' : 'var(--text-muted)',
            }}
          />

          <span className="flex-1 text-[0.9em] truncate" style={{ color: 'var(--text-primary)' }}>
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

          {/* Move to workspace button + portal panel */}
          <button
            ref={moveButtonRef}
            onClick={(e) => {
              e.stopPropagation();
              if (isMoving) {
                setMovingBoardId(null);
              } else {
                if (moveButtonRef.current) {
                  setMoveAnchorRect(moveButtonRef.current.getBoundingClientRect());
                }
                setMovingBoardId(board.id);
                setEditState(null);
                setDeleteState(null);
              }
            }}
            className={`rounded p-1.5 transition-all duration-150 ${
              isMoving
                ? 'opacity-100 bg-[var(--bg-active)] text-[var(--accent-primary)]'
                : 'text-[var(--text-muted)] opacity-0 group-hover:opacity-100 hover:opacity-100 hover:bg-[var(--bg-active)] hover:text-[var(--accent-primary)]'
            }`}
            title="Move to workspace"
          >
            <MoveToIcon />
          </button>
          {isMoving && moveAnchorRect && (
            <MoveToPanel
              board={board}
              workspaces={workspaces}
              workspaceOrderIds={workspaceOrderIds}
              anchorRect={moveAnchorRect}
              onMove={onMoveBoardToWorkspace}
              onClose={() => setMovingBoardId(null)}
            />
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditState({ id: board.id, name: board.name });
              setDeleteState(null);
              setMovingBoardId(null);
            }}
            className="rounded-md p-1.5 text-[var(--text-muted)] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:opacity-100 hover:scale-105 hover:bg-[var(--bg-active)] hover:text-[var(--accent-primary)] hover:shadow-md hover:ring-2 hover:ring-[var(--accent-primary)]/45"
            title="Rename board"
          >
            <PencilIcon />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteState(board.id);
              setEditState(null);
              setMovingBoardId(null);
            }}
            className="rounded p-1 text-[var(--text-muted)] opacity-0 transition-colors transition-opacity group-hover:opacity-100 hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)] hover:opacity-100"
            title="Delete board"
          >
            <XIcon />
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace row (sortable header with collapsible board submenu)
// ---------------------------------------------------------------------------

type WorkspaceSectionProps = {
  workspace: Workspace;
  boards: Record<string, Board>;
  activeBoardId: string | null;
  editState: EditState;
  deleteState: DeleteState;
  movingBoardId: string | null;
  wsEditState: EditState;
  wsDeleteState: DeleteState;
  setEditState: (s: EditState) => void;
  setDeleteState: (s: DeleteState) => void;
  setMovingBoardId: (id: string | null) => void;
  setWsEditState: (s: EditState) => void;
  setWsDeleteState: (s: DeleteState) => void;
  workspaces: Record<string, Workspace>;
  workspaceOrderIds: string[];
  swimlanes: Record<string, Swimlane>;
  tasks: Record<string, Task>;
  isAddingBoardInWorkspace: string | null;
  newBoardName: string;
  setNewBoardName: (v: string) => void;
  setIsAddingBoardInWorkspace: (v: string | null) => void;
  onSelectBoard: (boardId: string) => void;
  onRenameBoard: (boardId: string, name: string) => void;
  onDeleteBoard: (boardId: string) => void;
  onMoveBoardToWorkspace: (boardId: string, workspaceId: string | null) => void;
  onRenameWorkspace: (workspaceId: string, name: string) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onReorderBoardsInWorkspace: (workspaceId: string, activeId: string, overId: string) => void;
  onAddBoardInWorkspace: (workspaceId: string, name: string) => void;
};

function WorkspaceSection({
  workspace,
  boards,
  activeBoardId,
  editState,
  deleteState,
  movingBoardId,
  wsEditState,
  wsDeleteState,
  setEditState,
  setDeleteState,
  setMovingBoardId,
  setWsEditState,
  setWsDeleteState,
  workspaces,
  workspaceOrderIds,
  swimlanes,
  tasks,
  isAddingBoardInWorkspace,
  newBoardName,
  setNewBoardName,
  setIsAddingBoardInWorkspace,
  onSelectBoard,
  onRenameBoard,
  onDeleteBoard,
  onMoveBoardToWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onReorderBoardsInWorkspace,
  onAddBoardInWorkspace,
}: WorkspaceSectionProps) {
  const isWsEditing = wsEditState?.id === workspace.id;
  const isWsDeleting = wsDeleteState === workspace.id;
  const isAddingHere = isAddingBoardInWorkspace === workspace.id;

  // Check if the active board lives in this workspace — if so, start expanded
  const hasActiveBoard = activeBoardId ? boards[activeBoardId]?.workspaceId === workspace.id : false;
  const [expanded, setExpanded] = useState(hasActiveBoard);

  const orderedBoardIds = getOrderedBoardIdsForWorkspace(boards, workspace);
  const boardList = orderedBoardIds
    .map((id) => boards[id])
    .filter((b): b is NonNullable<typeof b> => b != null);

  const boardSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workspace.id,
    disabled: isWsEditing || isWsDeleting,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleBoardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorderBoardsInWorkspace(workspace.id, String(active.id), String(over.id));
  };

  const handleAddBoardHere = () => {
    if (newBoardName.trim()) {
      onAddBoardInWorkspace(workspace.id, newBoardName.trim());
      setNewBoardName('');
      setIsAddingBoardInWorkspace(null);
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* Workspace header row */}
      <div className="group flex items-center gap-1.5 px-2 py-1.5">
        {isWsDeleting ? (
          <InlineDeleteConfirm
            label={workspace.name}
            onConfirm={() => { onDeleteWorkspace(workspace.id); setWsDeleteState(null); }}
            onCancel={() => setWsDeleteState(null)}
          />
        ) : isWsEditing ? (
          <InlineEditInput
            value={wsEditState!.name}
            onChange={(v) => setWsEditState({ id: workspace.id, name: v })}
            onConfirm={() => {
              if (wsEditState!.name.trim()) onRenameWorkspace(workspace.id, wsEditState!.name.trim());
              setWsEditState(null);
            }}
            onCancel={() => setWsEditState(null)}
          />
        ) : (
          <>
            {/* Workspace drag grip */}
            <button
              type="button"
              className="shrink-0 p-1 rounded cursor-grab active:cursor-grabbing hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-muted)', touchAction: 'none' }}
              title="Drag to reorder workspace"
              aria-label="Drag to reorder workspace"
              {...attributes}
              {...listeners}
              onPointerDown={(e) => {
                listeners?.onPointerDown?.(e);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <GripIcon />
            </button>

            {/* Expand/collapse toggle — clicking workspace name or chevron toggles */}
            <button
              className="flex items-center gap-1.5 flex-1 min-w-0 rounded py-0.5 px-1 transition-colors hover:bg-[var(--bg-hover)] text-left"
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              title={expanded ? 'Collapse workspace' : 'Expand workspace'}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: 'var(--accent-primary)' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span
                className="text-[0.8em] font-semibold uppercase tracking-wide truncate flex-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                {workspace.name}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                <ChevronIcon expanded={expanded} />
              </span>
            </button>

            {/* Add board inside workspace */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsAddingBoardInWorkspace(workspace.id);
                setExpanded(true);
                setWsEditState(null);
                setWsDeleteState(null);
              }}
              className="rounded p-1 text-[var(--text-muted)] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:opacity-100 hover:bg-[var(--bg-active)] hover:text-[var(--accent-primary)]"
              title="Add board in workspace"
            >
              <PlusIcon />
            </button>

            {/* Rename workspace */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setWsEditState({ id: workspace.id, name: workspace.name });
                setWsDeleteState(null);
              }}
              className="rounded-md p-1.5 text-[var(--text-muted)] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:opacity-100 hover:scale-105 hover:bg-[var(--bg-active)] hover:text-[var(--accent-primary)] hover:shadow-md hover:ring-2 hover:ring-[var(--accent-primary)]/45"
              title="Rename workspace"
            >
              <PencilIcon />
            </button>

            {/* Delete workspace */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setWsDeleteState(workspace.id);
                setWsEditState(null);
              }}
              className="rounded p-1 text-[var(--text-muted)] opacity-0 transition-colors transition-opacity group-hover:opacity-100 hover:bg-[var(--bg-hover)] hover:text-[var(--text-error,#b91c1c)] hover:opacity-100"
              title="Delete workspace"
            >
              <XIcon />
            </button>
          </>
        )}
      </div>

      {/* Submenu: boards within workspace (collapsible) */}
      {expanded && (
        <div>
          {/* Left indent line — aligned with the workspace folder icon (~1.85rem from left) */}
          <div className="relative">
            <div
              className="absolute left-[1.85rem] top-0 bottom-0 w-px"
              style={{ backgroundColor: 'var(--border-default)' }}
            />
            <DndContext sensors={boardSensors} collisionDetection={closestCenter} onDragEnd={handleBoardDragEnd}>
              <SortableContext items={orderedBoardIds} strategy={verticalListSortingStrategy}>
                {boardList.map((board) => (
                  <BoardRow
                    key={board.id}
                    board={board}
                    activeBoardId={activeBoardId}
                    editState={editState}
                    deleteState={deleteState}
                    movingBoardId={movingBoardId}
                    setEditState={setEditState}
                    setDeleteState={setDeleteState}
                    setMovingBoardId={setMovingBoardId}
                    workspaces={workspaces}
                    workspaceOrderIds={workspaceOrderIds}
                    awaitingAckCount={getAwaitingAckCount(
                      board,
                      swimlanes as Record<string, Swimlane>,
                      tasks as Record<string, Task>
                    )}
                    nested
                    onRowClick={() => onSelectBoard(board.id)}
                    onConfirmEdit={(name) => onRenameBoard(board.id, name)}
                    onDeleteBoard={onDeleteBoard}
                    onMoveBoardToWorkspace={onMoveBoardToWorkspace}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* "Add board" inline input inside workspace submenu */}
            {isAddingHere && (
              <div className="flex items-center gap-2 pl-14 pr-2 py-1.5">
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddBoardHere();
                    if (e.key === 'Escape') {
                      setIsAddingBoardInWorkspace(null);
                      setNewBoardName('');
                    }
                  }}
                  placeholder="Board name..."
                  className="flex-1 border rounded px-2 py-1 text-[0.85em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                  }}
                  autoFocus
                />
                <button onClick={handleAddBoardHere} style={{ color: 'var(--accent-primary)' }}>
                  <CheckIcon />
                </button>
                <button
                  onClick={() => { setIsAddingBoardInWorkspace(null); setNewBoardName(''); }}
                  style={{ color: 'var(--text-muted)' }}
                >
                  <XIcon />
                </button>
              </div>
            )}

            {boardList.length === 0 && !isAddingHere && (
              <p className="pl-14 py-1.5 text-[0.8em]" style={{ color: 'var(--text-muted)' }}>
                No boards
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main BoardSwitcher component
// ---------------------------------------------------------------------------

export function BoardSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAddingBoard, setIsAddingBoard] = useState(false);
  const [isAddingWorkspace, setIsAddingWorkspace] = useState(false);
  const [isAddingBoardInWorkspace, setIsAddingBoardInWorkspace] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState('');
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // Shared state for board rows
  const [boardEditState, setBoardEditState] = useState<EditState>(null);
  const [boardDeleteState, setBoardDeleteState] = useState<DeleteState>(null);
  const [movingBoardId, setMovingBoardId] = useState<string | null>(null);
  // Shared state for workspace rows
  const [wsEditState, setWsEditState] = useState<EditState>(null);
  const [wsDeleteState, setWsDeleteState] = useState<DeleteState>(null);

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
    workspaces,
    workspaceOrderIds,
    addWorkspace,
    renameWorkspace,
    deleteWorkspace,
    reorderWorkspacesByDrag,
    reorderBoardsInWorkspaceByDrag,
    moveBoardToWorkspace,
    swimlanes,
    tasks,
  } = useBoardStore();

  const wsSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const topLevelSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activeBoard = activeBoardId ? boards[activeBoardId] : null;
  const activeWorkspaceId = activeBoard?.workspaceId;
  const activeWorkspaceName = activeWorkspaceId ? workspaces[activeWorkspaceId]?.name : null;

  // Top-level boards (no workspace)
  const topLevelBoardIds = getOrderedBoardIds(
    Object.fromEntries(
      Object.entries(boards).filter(([, b]) => !b.workspaceId)
    ),
    boardOrderIds
  );
  const topLevelBoards = topLevelBoardIds
    .map((id) => boards[id])
    .filter((b): b is NonNullable<typeof b> => b != null);

  // Ordered workspaces
  const orderedWorkspaceIds = getOrderedWorkspaceIds(workspaces, workspaceOrderIds);
  const orderedWorkspaces = orderedWorkspaceIds
    .map((id) => workspaces[id])
    .filter((w): w is NonNullable<typeof w> => w != null);

  const handleWsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderWorkspacesByDrag(String(active.id), String(over.id));
  };

  const handleTopLevelBoardDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    reorderBoardsByDrag(String(active.id), String(over.id));
  };

  const resetTransientState = () => {
    setIsAddingBoard(false);
    setIsAddingWorkspace(false);
    setIsAddingBoardInWorkspace(null);
    setBoardEditState(null);
    setBoardDeleteState(null);
    setMovingBoardId(null);
    setWsEditState(null);
    setWsDeleteState(null);
    setNewBoardName('');
    setNewWorkspaceName('');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        resetTransientState();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTopLevelBoard = () => {
    if (newBoardName.trim()) {
      addBoard(newBoardName.trim(), false, null);
      setNewBoardName('');
      setIsAddingBoard(false);
    }
  };

  const handleAddWorkspace = () => {
    if (newWorkspaceName.trim()) {
      addWorkspace(newWorkspaceName.trim());
      setNewWorkspaceName('');
      setIsAddingWorkspace(false);
    }
  };

  const handleSelectBoard = (boardId: string) => {
    setActiveBoard(boardId);
    setIsOpen(false);
    resetTransientState();
  };

  const dropdownLabel = activeBoard
    ? activeWorkspaceName
      ? `${activeWorkspaceName} / ${activeBoard.name}`
      : activeBoard.name
    : 'Select Board';

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[0.85em] border rounded transition-colors hover:opacity-80"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-default)',
          color: 'var(--text-secondary)',
        }}
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span className="font-medium max-w-[200px] truncate">{dropdownLabel}</span>
        <svg
          className={`w-3 h-3 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 border rounded-lg shadow-lg z-30 min-w-[270px]"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
        >
          {/* Header hint */}
          <div className="px-4 py-2" style={{ borderBottom: '1px solid var(--border-default)' }}>
            <p className="text-[0.65em]" style={{ color: 'var(--text-muted)' }}>
              Drag the grip to reorder. Click a workspace to expand.
            </p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto py-1">
            {/* Workspaces (sortable) with nested boards in collapsible submenus */}
            {orderedWorkspaces.length > 0 && (
              <DndContext sensors={wsSensors} collisionDetection={closestCenter} onDragEnd={handleWsDragEnd}>
                <SortableContext items={orderedWorkspaceIds} strategy={verticalListSortingStrategy}>
                  {orderedWorkspaces.map((ws) => (
                    <WorkspaceSection
                      key={ws.id}
                      workspace={ws}
                      boards={boards}
                      activeBoardId={activeBoardId}
                      editState={boardEditState}
                      deleteState={boardDeleteState}
                      movingBoardId={movingBoardId}
                      wsEditState={wsEditState}
                      wsDeleteState={wsDeleteState}
                      setEditState={setBoardEditState}
                      setDeleteState={setBoardDeleteState}
                      setMovingBoardId={setMovingBoardId}
                      setWsEditState={setWsEditState}
                      setWsDeleteState={setWsDeleteState}
                      workspaces={workspaces}
                      workspaceOrderIds={workspaceOrderIds}
                      swimlanes={swimlanes}
                      tasks={tasks}
                      isAddingBoardInWorkspace={isAddingBoardInWorkspace}
                      newBoardName={newBoardName}
                      setNewBoardName={setNewBoardName}
                      setIsAddingBoardInWorkspace={setIsAddingBoardInWorkspace}
                      onSelectBoard={handleSelectBoard}
                      onRenameBoard={renameBoard}
                      onDeleteBoard={deleteBoard}
                      onMoveBoardToWorkspace={moveBoardToWorkspace}
                      onRenameWorkspace={renameWorkspace}
                      onDeleteWorkspace={deleteWorkspace}
                      onReorderBoardsInWorkspace={reorderBoardsInWorkspaceByDrag}
                      onAddBoardInWorkspace={(wsId, name) => addBoard(name, false, wsId)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            {/* Top-level boards (no workspace) */}
            {topLevelBoards.length > 0 && (
              <>
                {orderedWorkspaces.length > 0 && (
                  <div
                    className="px-3 pt-2 pb-1 mt-1"
                    style={{ borderTop: '1px solid var(--border-default)' }}
                  >
                    <span
                      className="text-[0.72em] font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Other Boards
                    </span>
                  </div>
                )}
                <DndContext
                  sensors={topLevelSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleTopLevelBoardDragEnd}
                >
                  <SortableContext items={topLevelBoardIds} strategy={verticalListSortingStrategy}>
                    {topLevelBoards.map((board) => (
                      <BoardRow
                        key={board.id}
                        board={board}
                        activeBoardId={activeBoardId}
                        editState={boardEditState}
                        deleteState={boardDeleteState}
                        movingBoardId={movingBoardId}
                        setEditState={setBoardEditState}
                        setDeleteState={setBoardDeleteState}
                        setMovingBoardId={setMovingBoardId}
                        workspaces={workspaces}
                        workspaceOrderIds={workspaceOrderIds}
                        awaitingAckCount={getAwaitingAckCount(
                          board,
                          swimlanes as Record<string, Swimlane>,
                          tasks as Record<string, Task>
                        )}
                        onRowClick={() => handleSelectBoard(board.id)}
                        onConfirmEdit={(name) => renameBoard(board.id, name)}
                        onDeleteBoard={deleteBoard}
                        onMoveBoardToWorkspace={moveBoardToWorkspace}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </>
            )}

            {orderedWorkspaces.length === 0 && topLevelBoards.length === 0 && (
              <p
                className="text-[0.85em] text-center py-4"
                style={{ color: 'var(--text-muted)' }}
              >
                No boards yet
              </p>
            )}
          </div>

          {/* Footer: add workspace / add board buttons */}
          <div className="p-2" style={{ borderTop: '1px solid var(--border-default)' }}>
            {/* Add workspace */}
            {isAddingWorkspace ? (
              <div className="flex items-center gap-2 px-2 mb-1">
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddWorkspace();
                    if (e.key === 'Escape') { setIsAddingWorkspace(false); setNewWorkspaceName(''); }
                  }}
                  placeholder="Workspace name..."
                  className="flex-1 border rounded px-2 py-1 text-[0.9em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  autoFocus
                />
                <button onClick={handleAddWorkspace} style={{ color: 'var(--accent-primary)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button onClick={() => { setIsAddingWorkspace(false); setNewWorkspaceName(''); }} style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setIsAddingWorkspace(true); setIsAddingBoard(false); setIsAddingBoardInWorkspace(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.85em] rounded transition-colors hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new workspace
              </button>
            )}

            {/* Add board (top-level) */}
            {isAddingBoard ? (
              <div className="flex items-center gap-2 px-2 mt-1">
                <input
                  type="text"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTopLevelBoard();
                    if (e.key === 'Escape') { setIsAddingBoard(false); setNewBoardName(''); }
                  }}
                  placeholder="Board name..."
                  className="flex-1 border rounded px-2 py-1 text-[0.9em] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                  autoFocus
                />
                <button onClick={handleAddTopLevelBoard} style={{ color: 'var(--accent-primary)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button onClick={() => { setIsAddingBoard(false); setNewBoardName(''); }} style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setIsAddingBoard(true); setIsAddingWorkspace(false); setIsAddingBoardInWorkspace(null); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[0.85em] rounded transition-colors hover:bg-[var(--bg-hover)]"
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
