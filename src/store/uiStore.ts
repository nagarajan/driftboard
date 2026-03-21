import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FontSize } from '../types';

interface UIStore {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      fontSize: 'md',

      setFontSize: (size: FontSize) => {
        set({ fontSize: size });
      },
    }),
    {
      name: 'taskboard-ui-settings',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ fontSize: state.fontSize }),
    }
  )
);
