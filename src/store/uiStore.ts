import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FontSize, SwimlaneWidth } from '../types';
import { SWIMLANE_WIDTH_ORDER } from '../constants/swimlaneWidth';
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state): UISettings => pickUISettings(state),
    }
  )
);

export interface UISettings {
  fontSize: FontSize;
  swimlaneWidth: SwimlaneWidth;
}

export function pickUISettings(state: UISettings): UISettings {
  return { fontSize: state.fontSize, swimlaneWidth: state.swimlaneWidth };
}

export function uiSettingsEqual(a: UISettings, b: UISettings): boolean {
  return a.fontSize === b.fontSize && a.swimlaneWidth === b.swimlaneWidth;
}

/** Applies synced settings without toasts; ignores missing or unrecognised values. */
export function applyRemoteUISettings(raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const { fontSize, swimlaneWidth } = raw as Record<string, unknown>;
  const next: Partial<UISettings> = {};
  if (typeof fontSize === 'string' && fontSize in FONT_SIZE_LABELS) {
    next.fontSize = fontSize as FontSize;
  }
  if (SWIMLANE_WIDTH_ORDER.includes(swimlaneWidth as SwimlaneWidth)) {
    next.swimlaneWidth = swimlaneWidth as SwimlaneWidth;
  }
  const current = pickUISettings(useUIStore.getState());
  if (!uiSettingsEqual(current, { ...current, ...next })) {
    useUIStore.setState(next);
  }
}
