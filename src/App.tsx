import { useEffect, useState, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useBoardStore, initializeForUser, clearAllData } from './store/boardStore';
import { useAuthStore, initializeAuthListener } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { DEFAULT_BOARD_THEME } from './types';
import { useBoardRouting } from './hooks/useBoardRouting';
import { useCmdScrollFontSize } from './hooks/useCmdScrollFontSize';
import { useCmdShiftScrollSwimlaneWidth } from './hooks/useCmdShiftScrollSwimlaneWidth';
import { useUndoRedoKeyboard } from './hooks/useUndoRedoKeyboard';
import { Board } from './components/Board';
import { BoardSwitcher } from './components/BoardSwitcher';
import { FontSizeSelector } from './components/FontSizeSelector';
import { SwimlaneWidthSelector } from './components/SwimlaneWidthSelector';
import { ColorThemeSelector } from './components/ColorThemeSelector';
import { ImportExportButtons } from './components/ImportExportButtons';
import { GoogleAccountWidget } from './components/GoogleAccountWidget';
import { ToastContainer } from './components/ToastContainer';
import { ReadyTasksPopup } from './components/ReadyTasksPopup';
import { NotificationFailureDialog } from './components/NotificationFailureDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { getAwaitingAckCount } from './utils/taskSnooze';
import {
  isNotificationFailureSuppressed,
  suppressNotificationFailureWarning,
  getNotificationsEnabled,
  setNotificationsEnabled,
} from './utils/systemNotifications';

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
  sky: 'theme-sky',
  lemon: 'theme-lemon',
  lilac: 'theme-lilac',
  coral: 'theme-coral',
  sage: 'theme-sage',
  // Saturated themes
  ocean: 'theme-ocean',
  forest: 'theme-forest',
  sunset: 'theme-sunset',
  grape: 'theme-grape',
  // Dark themes
  dark: 'theme-dark',
  midnight: 'theme-midnight',
  charcoal: 'theme-charcoal',
  crimson: 'theme-crimson',
  slate: 'theme-slate',
  amber: 'theme-amber',
};

const getThemeClass = (theme: string) => themeClasses[theme] || 'theme-ocean';

function App() {
  const { boards, activeBoardId, activateDueSnoozedTasks, swimlanes, tasks } = useBoardStore();
  const { initialized, user } = useAuthStore();
  const { fontSize, swimlaneWidth } = useUIStore();
  const activeBoard = activeBoardId ? boards[activeBoardId] : null;
  const activeBoardAckCount = activeBoard
    ? getAwaitingAckCount(activeBoard, swimlanes, tasks)
    : 0;
  const totalAckCount = Object.values(boards).reduce(
    (sum, board) => sum + getAwaitingAckCount(board, swimlanes, tasks),
    0
  );
  const theme = activeBoard?.theme ?? DEFAULT_BOARD_THEME;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [readyPopupOpen, setReadyPopupOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifFailureOpen, setNotifFailureOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(getNotificationsEnabled);
  const [clearDataConfirmOpen, setClearDataConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const appStyle: CSSProperties = {
    ['--swimlane-width-scale' as string]: swimlaneWidth / 100,
  };

  useEffect(() => {
    document.title = activeBoard ? `DriftBoard - ${activeBoard.name}` : 'DriftBoard';
  }, [activeBoard?.name]);

  // Clear search when switching boards
  useEffect(() => {
    setSearchQuery('');
  }, [activeBoardId]);

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
  useCmdShiftScrollSwimlaneWidth();

  useUndoRedoKeyboard();

  useEffect(() => {
    const checkAndNotify = () => {
      const result = activateDueSnoozedTasks();
      if (result === 'failed' && !isNotificationFailureSuppressed()) {
        setNotifFailureOpen(true);
      }
    };

    checkAndNotify();
    const intervalId = window.setInterval(checkAndNotify, 10000);
    return () => window.clearInterval(intervalId);
  }, [activateDueSnoozedTasks]);

  async function handleClearAllData() {
    setClearDataConfirmOpen(false);
    setMobileMenuOpen(false);
    await clearAllData();
  }

  function handleToggleNotifications() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    setNotificationsEnabledState(next);
  }

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
    <div id="app-root" className={`min-h-screen flex flex-col ${scaleClasses[fontSize]} ${getThemeClass(theme)}`} style={appStyle}>
      {/* Header */}
      <header style={{ padding: '0.8em 1.5em', backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: '1em' }}>
            <h1 className="font-bold" style={{ fontSize: '1.5em', color: 'var(--text-header)' }}>Drift Board</h1>
            <BoardSwitcher />
            {activeBoardAckCount > 0 && (
              <button
                onClick={() => setReadyPopupOpen(true)}
                className="badge-glow flex items-center justify-center rounded-full font-bold transition-opacity hover:opacity-80"
                style={{
                  minWidth: '1.6em',
                  height: '1.6em',
                  padding: '0 0.4em',
                  fontSize: '0.8em',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
                title={`${activeBoardAckCount} task${activeBoardAckCount === 1 ? '' : 's'} ready to acknowledge in this board - click to review`}
              >
                {activeBoardAckCount}
              </button>
            )}
            {totalAckCount > activeBoardAckCount && (
              <button
                onClick={() => setReadyPopupOpen(true)}
                className="badge-glow flex items-center justify-center rounded-full font-bold transition-opacity hover:opacity-80"
                style={{
                  minWidth: '1.6em',
                  height: '1.6em',
                  padding: '0 0.4em',
                  fontSize: '0.8em',
                  backgroundColor: 'var(--accent-success)',
                  color: '#ffffff',
                  opacity: 0.9,
                  cursor: 'pointer',
                }}
                title={`${totalAckCount} task${totalAckCount === 1 ? '' : 's'} ready to acknowledge across all boards - click to review`}
              >
                {totalAckCount}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="flex items-center relative" style={{ marginLeft: 'auto', marginRight: '0.75em' }}>
            <svg
              style={{
                position: 'absolute',
                left: '0.5em',
                width: '0.95em',
                height: '0.95em',
                color: searchQuery ? 'var(--text-header)' : 'rgba(255,255,255,0.5)',
                pointerEvents: 'none',
              }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setSearchQuery(''); }}
              placeholder="Search tasks..."
              aria-label="Search tasks"
              style={{
                paddingLeft: '1.75em',
                paddingRight: searchQuery ? '1.75em' : '0.65em',
                paddingTop: '0.3em',
                paddingBottom: '0.3em',
                fontSize: '0.85em',
                borderRadius: '0.4em',
                border: '1px solid rgba(255,255,255,0.25)',
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: 'var(--text-header)',
                outline: 'none',
                width: '11em',
                transition: 'width 0.15s, background-color 0.15s',
              }}
              onFocus={(e) => { e.currentTarget.style.width = '16em'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; }}
              onBlur={(e) => { e.currentTarget.style.width = searchQuery ? '16em' : '11em'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                style={{
                  position: 'absolute',
                  right: '0.4em',
                  color: 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search"
                aria-label="Clear search"
              >
                <svg style={{ width: '0.85em', height: '0.85em' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="relative" ref={menuRef}>
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
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Font Size</p>
                    <FontSizeSelector />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Swimlane Size</p>
                    <SwimlaneWidthSelector />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Theme</p>
                    <ColorThemeSelector />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Notifications</p>
                    <button
                      onClick={handleToggleNotifications}
                      className="flex items-center justify-between w-full rounded-md px-3 py-2 transition-colors hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <span className="text-[0.9em]">Notify on task ready</span>
                      <span
                        className="relative inline-flex items-center flex-shrink-0"
                        style={{
                          width: '2.2em',
                          height: '1.2em',
                          borderRadius: '9999px',
                          backgroundColor: notificationsEnabled ? 'var(--accent-primary)' : 'var(--bg-hover)',
                          border: '1px solid var(--border-default)',
                          transition: 'background-color 0.2s',
                        }}
                      >
                        <span
                          style={{
                            position: 'absolute',
                            width: '0.9em',
                            height: '0.9em',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            left: notificationsEnabled ? 'calc(100% - 1em)' : '0.1em',
                            transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                        />
                      </span>
                    </button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Data</p>
                    <ImportExportButtons />
                    {user && (
                      <button
                        onClick={() => setClearDataConfirmOpen(true)}
                        className="flex items-center w-full rounded-md px-3 py-2 mt-1 transition-colors hover:bg-[var(--bg-hover)] text-[0.9em]"
                        style={{ color: 'var(--accent-danger)' }}
                      >
                        Clear all data...
                      </button>
                    )}
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
          <Board board={activeBoard} searchQuery={searchQuery} />
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
      {readyPopupOpen && (
        <ReadyTasksPopup onClose={() => setReadyPopupOpen(false)} />
      )}
      <NotificationFailureDialog
        isOpen={notifFailureOpen}
        onDismiss={() => setNotifFailureOpen(false)}
        onDontShowAgain={() => {
          suppressNotificationFailureWarning();
          setNotifFailureOpen(false);
        }}
      />
      <ConfirmDialog
        isOpen={clearDataConfirmOpen}
        title="Clear all data"
        message="This will permanently delete all boards, swimlanes, tasks, and workspaces from Firebase. This cannot be undone. Are you sure?"
        confirmLabel="Clear all data"
        onConfirm={handleClearAllData}
        onCancel={() => setClearDataConfirmOpen(false)}
      />
    </div>
  );
}

export default App;
