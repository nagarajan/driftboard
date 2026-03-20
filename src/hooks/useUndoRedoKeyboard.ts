import { useEffect } from 'react';
import { useBoardStore } from '../store/boardStore';

/**
 * Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z or Ctrl+Y redo. Ignored while typing in inputs.
 */
export function useUndoRedoKeyboard() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      ) {
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useBoardStore.getState().undo();
        return;
      }

      if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        useBoardStore.getState().redo();
        return;
      }

      if (key === 'y' && e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        useBoardStore.getState().redo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
