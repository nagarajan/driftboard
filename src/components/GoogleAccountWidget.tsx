import { useMemo, useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { getKnownAccounts } from '../store/knownAccounts';

export function GoogleAccountWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithGoogleSelectAccount,
    addAnotherGoogleAccount,
    signInAsKnownAccount,
    signOut,
  } = useAuthStore();

  const knownAccounts = useMemo(() => getKnownAccounts(), [isOpen, user]);

  const otherKnownAccounts = useMemo(() => {
    if (!user?.email) return knownAccounts;
    const lower = user.email.toLowerCase();
    return knownAccounts.filter((a) => a.email.toLowerCase() !== lower);
  }, [knownAccounts, user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignIn = async () => {
    setIsOpen(false);
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  const handleSwitchToAccount = async (email: string) => {
    setIsOpen(false);
    await signInAsKnownAccount(email);
  };

  const handleChooseGoogleAccount = async () => {
    setIsOpen(false);
    await signInWithGoogleSelectAccount();
  };

  const handleAddAnotherGoogleAccount = async () => {
    setIsOpen(false);
    await addAnotherGoogleAccount();
  };

  if (loading) {
    return (
      <div className="flex items-center" style={{ gap: '0.5em' }}>
        <div
          className="rounded-lg animate-pulse"
          style={{
            width: '2em',
            height: '2em',
            backgroundColor: 'var(--bg-hover)',
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center rounded-lg transition-opacity hover:opacity-80"
        style={{ gap: '0.5em' }}
      >
        {/* Colorful border wrapper - theme colors when logged in, grey shades when guest */}
        <div
          className="rounded-lg flex items-center justify-center"
          style={{
            background: user
              ? 'conic-gradient(from 0deg, #ec4899 0deg 90deg, #8b5cf6 90deg 180deg, #10b981 180deg 270deg, #f97316 270deg 360deg)'
              : 'conic-gradient(from 0deg, #9ca3af 0deg 90deg, #6b7280 90deg 180deg, #4b5563 180deg 270deg, #374151 270deg 360deg)',
            padding: '3px',
          }}
        >
          {user ? (
            <img
              src={user.photoURL || ''}
              alt={user.displayName || 'User'}
              className="rounded-md"
              style={{ width: '2em', height: '2em' }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-md"
              style={{
                width: '2em',
                height: '2em',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg
                style={{ width: '1.25em', height: '1.25em' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
          )}
        </div>
        {!user && <span style={{ fontSize: '0.9em', color: 'var(--text-header)' }}>Guest</span>}
      </button>

      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 rounded-lg shadow-lg z-50 max-h-[min(24rem,70vh)] overflow-y-auto"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            minWidth: '220px',
          }}
        >
          <p
            className="text-[0.75em] px-3 pt-2 pb-1"
            style={{ color: 'var(--text-muted)' }}
          >
            Each browser tab can be a different user. Closing this tab signs out this tab only.
          </p>

          {user ? (
            <>
              <div
                className="flex items-center"
                style={{
                  padding: '0.75em',
                  borderBottom: '1px solid var(--border-default)',
                  gap: '0.75em',
                }}
              >
                <img
                  src={user.photoURL || ''}
                  alt={user.displayName || 'User'}
                  className="rounded-full"
                  style={{ width: '2.5em', height: '2.5em' }}
                  referrerPolicy="no-referrer"
                />
                <div style={{ minWidth: 0 }}>
                  <p
                    className="font-medium truncate"
                    style={{ color: 'var(--text-primary)', fontSize: '0.9em' }}
                  >
                    {user.displayName}
                  </p>
                  <p
                    className="truncate"
                    style={{ color: 'var(--text-secondary)', fontSize: '0.8em' }}
                  >
                    {user.email}
                  </p>
                </div>
              </div>

              {otherKnownAccounts.length > 0 && (
                <div style={{ padding: '0.5em', borderBottom: '1px solid var(--border-default)' }}>
                  <p
                    className="text-[0.75em] uppercase px-1 pb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Other accounts on this device
                  </p>
                  {otherKnownAccounts.map((acc) => (
                    <button
                      key={acc.uid}
                      type="button"
                      onClick={() => handleSwitchToAccount(acc.email)}
                      className="w-full text-left rounded transition-colors hover:bg-[var(--bg-hover)] truncate"
                      style={{
                        padding: '0.5em 0.75em',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9em',
                      }}
                    >
                      {acc.displayName || acc.email}
                      <span className="block truncate text-[0.85em]" style={{ color: 'var(--text-muted)' }}>
                        {acc.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ padding: '0.5em' }}>
                <button
                  type="button"
                  onClick={handleAddAnotherGoogleAccount}
                  className="w-full flex items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    padding: '0.5em 0.75em',
                    color: 'var(--text-secondary)',
                    gap: '0.5em',
                  }}
                >
                  <svg
                    style={{ width: '1em', height: '1em' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span style={{ fontSize: '0.9em' }}>Add another Google account</span>
                </button>

                <button
                  type="button"
                  onClick={handleChooseGoogleAccount}
                  className="w-full flex items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    padding: '0.5em 0.75em',
                    color: 'var(--text-secondary)',
                    gap: '0.5em',
                  }}
                >
                  <svg
                    style={{ width: '1em', height: '1em' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                  <span style={{ fontSize: '0.9em' }}>Choose Google account</span>
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
                  style={{
                    padding: '0.5em 0.75em',
                    color: 'var(--text-secondary)',
                    gap: '0.5em',
                  }}
                >
                  <svg
                    style={{ width: '1em', height: '1em' }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span style={{ fontSize: '0.9em' }}>Sign out</span>
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: '0.5em' }}>
              {knownAccounts.length > 0 && (
                <div style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: '0.5em', marginBottom: '0.5em' }}>
                  <p
                    className="text-[0.75em] uppercase px-1 pb-1"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Sign in as (this device)
                  </p>
                  {knownAccounts.map((acc) => (
                    <button
                      key={acc.uid}
                      type="button"
                      onClick={() => handleSwitchToAccount(acc.email)}
                      className="w-full text-left rounded transition-colors hover:bg-[var(--bg-hover)] truncate mb-1"
                      style={{
                        padding: '0.5em 0.75em',
                        color: 'var(--text-secondary)',
                        fontSize: '0.9em',
                      }}
                    >
                      {acc.displayName || acc.email}
                      <span className="block truncate text-[0.85em]" style={{ color: 'var(--text-muted)' }}>
                        {acc.email}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleSignIn}
                className="w-full flex items-center rounded transition-colors hover:bg-[var(--bg-hover)]"
                style={{
                  padding: '0.5em 0.75em',
                  color: 'var(--text-secondary)',
                  gap: '0.5em',
                }}
              >
                <svg style={{ width: '1em', height: '1em' }} viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span style={{ fontSize: '0.9em' }}>Sign in with Google</span>
              </button>

              <button
                type="button"
                onClick={handleChooseGoogleAccount}
                className="w-full flex items-center rounded transition-colors hover:bg-[var(--bg-hover)] mt-1"
                style={{
                  padding: '0.5em 0.75em',
                  color: 'var(--text-secondary)',
                  gap: '0.5em',
                }}
              >
                <svg
                  style={{ width: '1em', height: '1em' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span style={{ fontSize: '0.9em' }}>New or other Google account</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
