import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FontSize, Theme } from '../types';

interface UIStore {
  fontSize: FontSize;
  theme: Theme;
  setFontSize: (size: FontSize) => void;
  setTheme: (theme: Theme) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      fontSize: 'md',
      theme: 'ocean',

      setFontSize: (size: FontSize) => {
        set({ fontSize: size });
      },

      setTheme: (theme: Theme) => {
        set({ theme });
      },
    }),
    {
      name: 'taskboard-ui-settings',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
