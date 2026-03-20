import type { Board } from '../types';

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
