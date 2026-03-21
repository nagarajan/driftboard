import { useEffect, useState, useRef } from 'react';
import { useBoardStore, initializeForUser } from './store/boardStore';
import { useAuthStore, initializeAuthListener } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { DEFAULT_BOARD_THEME } from './types';
import { useBoardRouting } from './hooks/useBoardRouting';
import { useCmdScrollFontSize } from './hooks/useCmdScrollFontSize';
import { useUndoRedoKeyboard } from './hooks/useUndoRedoKeyboard';
import { Board } from './components/Board';
import { BoardSwitcher } from './components/BoardSwitcher';
import { FontSizeSelector } from './components/FontSizeSelector';
import { ColorThemeSelector } from './components/ColorThemeSelector';
import { ImportExportButtons } from './components/ImportExportButtons';
import { GoogleAccountWidget } from './components/GoogleAccountWidget';
import { ToastContainer } from './components/ToastContainer';

const scaleClasses = {
  xs: 'scale-xs',
  sm: 'scale-sm',
  md: 'scale-md',
  lg: 'scale-lg',
  xl: 'scale-xl',
};

const themeClasses: Record<string, string> = {
  // Pastel themes
  rose: 'theme-rose',
  lavender: 'theme-lavender',
  mint: 'theme-mint',
  peach: 'theme-peach',
  // Saturated themes
  ocean: 'theme-ocean',
  forest: 'theme-forest',
  sunset: 'theme-sunset',
  grape: 'theme-grape',
  // Dark theme
  dark: 'theme-dark',
};

const getThemeClass = (theme: string) => themeClasses[theme] || 'theme-ocean';

function App() {
  const { boards, activeBoardId } = useBoardStore();
  const { initialized } = useAuthStore();
  const { fontSize } = useUIStore();
  const activeBoard = activeBoardId ? boards[activeBoardId] : null;
  const theme = activeBoard?.theme ?? DEFAULT_BOARD_THEME;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Initialize auth listener on mount
  useEffect(() => {
    const unsubscribe = initializeAuthListener((user) => {
      // When auth state changes, initialize board store for that user
      initializeForUser(user?.email || null);
    });
    return unsubscribe;
  }, []);

  // Sync URL with active board (only after initialization)
  useBoardRouting();

  // Cmd+scroll (Ctrl+scroll on Windows/Linux) to change font size
  useCmdScrollFontSize();

  useUndoRedoKeyboard();

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Show loading while auth is initializing
  if (!initialized) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${getThemeClass(theme)}`}>
        <div className="text-center" style={{ color: 'var(--text-secondary)' }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${scaleClasses[fontSize]} ${getThemeClass(theme)}`}>
      {/* Header */}
      <header style={{ padding: '1em 1.5em', backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '1em' }}>
            <h1 className="font-bold" style={{ fontSize: '1.5em', color: 'var(--text-header)' }}>Task Board</h1>
            <BoardSwitcher />
          </div>

          {/* Desktop controls */}
          <div className="hidden min-[840px]:flex items-center" style={{ gap: '1em' }}>
            <ImportExportButtons />
            <ColorThemeSelector />
            <FontSizeSelector />
            <GoogleAccountWidget />
          </div>

          {/* Mobile hamburger menu */}
          <div className="min-[840px]:hidden relative" ref={menuRef}>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded transition-colors hover:bg-[var(--bg-hover)]"
              style={{ color: 'var(--text-header)' }}
              title="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {mobileMenuOpen && (
              <div
                className="absolute right-0 top-full mt-2 p-4 rounded-lg shadow-lg z-50 min-w-[200px]"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
              >
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Data</p>
                    <ImportExportButtons />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Theme</p>
                    <ColorThemeSelector />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Size</p>
                    <FontSizeSelector />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Account</p>
                    <GoogleAccountWidget />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {activeBoard ? (
          <Board board={activeBoard} />
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                style={{ color: 'var(--text-muted)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <p className="text-[1.1em]" style={{ color: 'var(--text-primary)' }}>No board selected</p>
              <p className="text-[0.9em] mt-2">Create a board to get started</p>
            </div>
          </div>
        )}
      </main>
      <ToastContainer />
    </div>
  );
}

export default App;
