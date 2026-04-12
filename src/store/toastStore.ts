import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export type ToastKind = 'add' | 'delete' | 'edit' | 'move' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

/** Cap visible toasts; newest are kept (oldest dropped when over limit). */
const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 3200;

interface ToastStore {
  items: ToastItem[];
  push: (message: string, kind: ToastKind) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set, get) => ({
  items: [],
  push: (message, kind) => {
    const id = uuidv4();
    set((s) => ({
      items: [...s.items.slice(-(MAX_TOASTS - 1)), { id, message, kind }],
    }));
    window.setTimeout(() => {
      get().remove(id);
    }, AUTO_DISMISS_MS);
  },
  remove: (id) =>
    set((s) => ({
      items: s.items.filter((t) => t.id !== id),
    })),
}));

export function showToast(message: string, kind: ToastKind) {
  useToastStore.getState().push(message, kind);
}
