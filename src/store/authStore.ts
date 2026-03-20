import { create } from 'zustand';
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
}

interface AuthStore extends AuthState {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  error: null,
  initialized: false,

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      await signInWithPopup(auth, googleProvider);
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
      await firebaseSignOut(auth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign out failed';
      set({ error: message });
      console.error('Sign out error:', error);
    } finally {
      set({ loading: false });
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
    useAuthStore.setState({ user, initialized: true, loading: false });
    onUserChange(user);
  });
  return unsubscribe;
}
