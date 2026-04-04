import type { Board, Workspace } from '../types';

/**
 * Board ids in display order. If boardOrderIds is empty, order is by createdAt ascending (oldest first).
 * Any board not listed in boardOrderIds is appended sorted by createdAt.
 */
export function getOrderedBoardIds(
  boards: Record<string, Board>,
  boardOrderIds: string[]
): string[] {
  const ids = Object.keys(boards);
  if (ids.length === 0) return [];

  if (boardOrderIds.length === 0) {
    return Object.values(boards)
      .sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity))
      .map((b) => b.id);
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of boardOrderIds) {
    if (boards[id] && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  const missing = ids.filter((id) => !seen.has(id));
  missing.sort(
    (a, b) =>
      (boards[a].createdAt ?? Infinity) - (boards[b].createdAt ?? Infinity)
  );
  return [...ordered, ...missing];
}

/**
 * Board ids belonging to a specific workspace, in display order.
 * Boards in the workspace's boardOrderIds take priority; any unlisted members are appended by createdAt.
 */
export function getOrderedBoardIdsForWorkspace(
  boards: Record<string, Board>,
  workspace: Workspace
): string[] {
  const memberIds = Object.values(boards)
    .filter((b) => b.workspaceId === workspace.id)
    .map((b) => b.id);

  if (memberIds.length === 0) return [];

  const memberSet = new Set(memberIds);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const id of workspace.boardOrderIds) {
    if (memberSet.has(id) && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  const missing = memberIds.filter((id) => !seen.has(id));
  missing.sort(
    (a, b) =>
      (boards[a]?.createdAt ?? Infinity) - (boards[b]?.createdAt ?? Infinity)
  );
  return [...ordered, ...missing];
}

/**
 * Workspace ids in display order. If workspaceOrderIds is empty, order is by createdAt ascending.
 */
export function getOrderedWorkspaceIds(
  workspaces: Record<string, Workspace>,
  workspaceOrderIds: string[]
): string[] {
  const ids = Object.keys(workspaces);
  if (ids.length === 0) return [];

  if (workspaceOrderIds.length === 0) {
    return Object.values(workspaces)
      .sort((a, b) => (a.createdAt ?? Infinity) - (b.createdAt ?? Infinity))
      .map((w) => w.id);
  }

  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of workspaceOrderIds) {
    if (workspaces[id] && !seen.has(id)) {
      ordered.push(id);
      seen.add(id);
    }
  }
  const missing = ids.filter((id) => !seen.has(id));
  missing.sort(
    (a, b) =>
      (workspaces[a]?.createdAt ?? Infinity) - (workspaces[b]?.createdAt ?? Infinity)
  );
  return [...ordered, ...missing];
}

export function getFirstBoardId(
  boards: Record<string, Board>,
  boardOrderIds: string[]
): string | null {
  const ids = getOrderedBoardIds(boards, boardOrderIds);
  return ids[0] ?? null;
}

/** Move item at fromIndex to toIndex (same length). */
export function reorderIds(ids: string[], fromIndex: number, toIndex: number): string[] {
  if (fromIndex === toIndex) return ids;
  const next = [...ids];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}
