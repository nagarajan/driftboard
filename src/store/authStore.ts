import { create } from 'zustand';
import {
  signInWithPopup,
  signInWithCredential,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { recordKnownAccount, removeKnownAccountByUid } from './knownAccounts';
import { requestGoogleTokensSilent } from '../utils/googleIdentitySilentToken';
import { getDriveAccessToken } from '../utils/driveAuth';

const GOOGLE_OAUTH_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined) ?? '';

function googleProviderWithLoginHint(email: string) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: email });
  return provider;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

interface AuthStore extends AuthState {
  signInWithGoogle: () => Promise<void>;
  /** Google account picker (add or pick another account). */
  signInWithGoogleSelectAccount: () => Promise<void>;
  /** Sign out then account picker (add a different Google account to this tab). */
  addAnotherGoogleAccount: () => Promise<void>;
  /** Switch this tab to a previously used account (silent token when possible). */
  signInAsKnownAccount: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Request incremental Drive appdata scope consent (returns true if granted). */
  requestDriveAccess: () => Promise<boolean>;
  clearError: () => void;
}

function popupWithGoogleParams(params: Record<string, string>) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters(params);
  return signInWithPopup(auth, provider);
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ error: message });
      console.error('Sign in error:', error);
    } finally {
      set({ loading: false });
    }
  },

  signInWithGoogleSelectAccount: async () => {
    set({ loading: true, error: null });
    try {
      await popupWithGoogleParams({ prompt: 'select_account' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ error: message });
      console.error('Sign in error:', error);
    } finally {
      set({ loading: false });
    }
  },

  addAnotherGoogleAccount: async () => {
    set({ loading: true, error: null });
    try {
      await firebaseSignOut(auth);
      await popupWithGoogleParams({ prompt: 'select_account' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ error: message });
      console.error('Sign in error:', error);
    } finally {
      set({ loading: false });
    }
  },

  signInAsKnownAccount: async (email: string) => {
    set({ loading: true, error: null });
    try {
      const trimmed = email.trim();
      const normalized = trimmed.toLowerCase();
      const current = auth.currentUser;
      if (current?.email?.toLowerCase() === normalized) {
        return;
      }

      // Silent path: sign out of Firebase first so GIS can issue a token for the
      // hinted account without a "replace session" conflict. Prefer id_token when
      // Google returns it (openid scope).
      if (GOOGLE_OAUTH_CLIENT_ID) {
        if (current) {
          await firebaseSignOut(auth);
        }
        const tokens = await requestGoogleTokensSilent(GOOGLE_OAUTH_CLIENT_ID, trimmed);
        if (tokens?.idToken) {
          await signInWithCredential(auth, GoogleAuthProvider.credential(tokens.idToken));
          return;
        }
        if (tokens?.accessToken) {
          await signInWithCredential(
            auth,
            GoogleAuthProvider.credential(null, tokens.accessToken)
          );
          return;
        }
        if (import.meta.env.DEV) {
          console.debug(
            'Silent Google sign-in unavailable (consent or account switch required). Using popup.'
          );
        }
      }

      await signInWithPopup(auth, googleProviderWithLoginHint(trimmed));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign in failed';
      set({ error: message });
      console.error('Sign in error:', error);
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true, error: null });
    try {
      const previousUser = auth.currentUser;
      await firebaseSignOut(auth);
      if (previousUser?.uid) {
        removeKnownAccountByUid(previousUser.uid);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      set({ error: message });
      console.error('Sign out error:', error);
    } finally {
      set({ loading: false });
    }
  },

  requestDriveAccess: async () => {
    const user = auth.currentUser;
    if (!user?.uid || !user?.email) return false;
    try {
      const token = await getDriveAccessToken(user.uid, user.email, true);
      return token !== null;
    } catch {
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

// Helper function to sanitize email for use as Firestore document path
export function sanitizeEmail(email: string): string {
  return email.replace(/@/g, '_at_').replace(/\./g, '_dot_');
}

// Subscribe to auth state changes
export function initializeAuthListener(
  onUserChange: (user: User | null) => void
): () => void {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      recordKnownAccount(user);
    }
    useAuthStore.setState({ user, initialized: true, loading: false });
    onUserChange(user);
  });
  return unsubscribe;
}
