import { useEffect, useRef } from 'react';
import { useBoardStore } from '../store/boardStore';

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
  const activeBoardId = useBoardStore((state) => state.activeBoardId);
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);
  
  const hasInitialized = useRef(false);
  const skipNextUrlUpdate = useRef(false);

  // Initial URL -> State sync (runs once when boards are available)
  useEffect(() => {
    if (hasInitialized.current) return;
    
    const boardIds = Object.keys(boards);
    if (boardIds.length === 0) return;
    
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
        setActiveBoard(boardIds[0]);
        window.history.replaceState({ boardId: boardIds[0] }, '', getBoardUrl(boardIds[0]));
      }
    } else {
      // Base URL - redirect to active or first board
      const targetId = activeBoardId && boards[activeBoardId] ? activeBoardId : boardIds[0];
      if (activeBoardId !== targetId) {
        skipNextUrlUpdate.current = true;
        setActiveBoard(targetId);
      }
      window.history.replaceState({ boardId: targetId }, '', getBoardUrl(targetId));
    }
  }, [boards, activeBoardId, setActiveBoard]);

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
      const currentBoards = useBoardStore.getState().boards;
      const boardIds = Object.keys(currentBoards);

      if (urlBoardId && currentBoards[urlBoardId]) {
        skipNextUrlUpdate.current = true;
        setActiveBoard(urlBoardId);
      } else if (boardIds.length > 0) {
        // Invalid or missing board - go to first board
        skipNextUrlUpdate.current = true;
        setActiveBoard(boardIds[0]);
        window.history.replaceState({ boardId: boardIds[0] }, '', getBoardUrl(boardIds[0]));
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setActiveBoard]);
}
