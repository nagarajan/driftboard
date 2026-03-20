import { useEffect, useRef } from 'react';
import { useBoardStore } from '../store/boardStore';
import { getFirstBoardId } from '../utils/boardOrder';

// Get base path from Vite config (e.g., '/tasks/' in production, '/' in development)
const BASE_PATH = import.meta.env.BASE_URL.replace(/\/$/, ''); // Remove trailing slash

function getBoardIdFromUrl(): string | null {
  const path = window.location.pathname;
  // Match /board/uuid or /tasks/board/uuid depending on base path
  const pattern = new RegExp(`^${BASE_PATH}/board/([^/]+)$`);
  const match = path.match(pattern);
  return match ? match[1] : null;
}

function getBoardUrl(boardId: string): string {
  return `${BASE_PATH}/board/${boardId}`;
}

function getBaseUrl(): string {
  return BASE_PATH || '/';
}

export function useBoardRouting() {
  const boards = useBoardStore((state) => state.boards);
  const boardOrderIds = useBoardStore((state) => state.boardOrderIds);
  const activeBoardId = useBoardStore((state) => state.activeBoardId);
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);
  
  const hasInitialized = useRef(false);
  const skipNextUrlUpdate = useRef(false);

  // Initial URL -> State sync (runs once when boards are available)
  useEffect(() => {
    if (hasInitialized.current) return;
    
    const boardIds = Object.keys(boards);
    if (boardIds.length === 0) return;

    const firstBoardId = getFirstBoardId(boards, boardOrderIds);
    if (!firstBoardId) return;
    
    hasInitialized.current = true;
    const urlBoardId = getBoardIdFromUrl();

    if (urlBoardId) {
      if (boards[urlBoardId]) {
        // Valid board in URL - select it
        if (activeBoardId !== urlBoardId) {
          skipNextUrlUpdate.current = true;
          setActiveBoard(urlBoardId);
        }
      } else {
        // Invalid board ID - go to first board
        skipNextUrlUpdate.current = true;
        setActiveBoard(firstBoardId);
        window.history.replaceState({ boardId: firstBoardId }, '', getBoardUrl(firstBoardId));
      }
    } else {
      // Base URL - redirect to active or first board
      const targetId = activeBoardId && boards[activeBoardId] ? activeBoardId : firstBoardId;
      if (activeBoardId !== targetId) {
        skipNextUrlUpdate.current = true;
        setActiveBoard(targetId);
      }
      window.history.replaceState({ boardId: targetId }, '', getBoardUrl(targetId));
    }
  }, [boards, boardOrderIds, activeBoardId, setActiveBoard]);

  // State -> URL sync (runs when activeBoardId changes)
  useEffect(() => {
    if (!hasInitialized.current) return;
    
    if (skipNextUrlUpdate.current) {
      skipNextUrlUpdate.current = false;
      return;
    }

    const boardIds = Object.keys(boards);
    
    if (activeBoardId && boards[activeBoardId]) {
      // Valid board - update URL
      const urlBoardId = getBoardIdFromUrl();
      if (urlBoardId !== activeBoardId) {
        window.history.pushState({ boardId: activeBoardId }, '', getBoardUrl(activeBoardId));
      }
    } else if (boardIds.length === 0) {
      // All boards deleted - go to base URL
      window.history.replaceState({}, '', getBaseUrl());
    }
  }, [activeBoardId, boards]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlBoardId = getBoardIdFromUrl();
      const st = useBoardStore.getState();
      const currentBoards = st.boards;
      const boardIds = Object.keys(currentBoards);
      const firstId = getFirstBoardId(currentBoards, st.boardOrderIds);

      if (urlBoardId && currentBoards[urlBoardId]) {
        skipNextUrlUpdate.current = true;
        setActiveBoard(urlBoardId);
      } else if (boardIds.length > 0 && firstId) {
        // Invalid or missing board - go to first board
        skipNextUrlUpdate.current = true;
        setActiveBoard(firstId);
        window.history.replaceState({ boardId: firstId }, '', getBoardUrl(firstId));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveBoard]);
}
