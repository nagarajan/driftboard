import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FontSize, SwimlaneWidth } from '../types';
import { showToast } from './toastStore';

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  xs: 'XS',
  sm: 'S',
  md: 'M',
  lg: 'L',
  xl: 'XL',
};

interface UIStore {
  fontSize: FontSize;
  swimlaneWidth: SwimlaneWidth;
  setFontSize: (size: FontSize) => void;
  setSwimlaneWidth: (width: SwimlaneWidth) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      fontSize: 'md',
      swimlaneWidth: 100,

      setFontSize: (size: FontSize) => {
        let changed = false;
        set((state) => {
          if (state.fontSize === size) {
            return state;
          }
          changed = true;
          return { fontSize: size };
        });
        if (changed) {
          showToast(`Font size set to ${FONT_SIZE_LABELS[size]}`, 'edit');
        }
      },
      setSwimlaneWidth: (width: SwimlaneWidth) => {
        let changed = false;
        set((state) => {
          if (state.swimlaneWidth === width) {
            return state;
          }
          changed = true;
          return { swimlaneWidth: width };
        });
        if (changed) {
          showToast(`Swimlane width set to ${width}%`, 'edit');
        }
      },
    }),
    {
      name: 'taskboard-ui-settings',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        fontSize: state.fontSize,
        swimlaneWidth: state.swimlaneWidth,
      }),
    }
  )
);
