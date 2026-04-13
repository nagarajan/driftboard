/**
 * Manages Google OAuth access tokens with the drive.appdata scope for
 * Google Drive backup/restore. Caches tokens in localStorage per Firebase UID.
 *
 * Two paths for obtaining tokens:
 *   1. GIS (Google Identity Services) -- used when VITE_GOOGLE_OAUTH_CLIENT_ID
 *      is configured. Supports silent (prompt=none) and consent (popup) flows.
 *   2. Firebase reauthenticateWithPopup -- used as fallback when no GIS client
 *      ID is set. Always shows a popup but does not require extra config.
 */

import {
  reauthenticateWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from '../config/firebase';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FULL_SCOPE = `openid email profile ${DRIVE_SCOPE}`;
const STORAGE_KEY_PREFIX = 'driftboard-drive-token-';
const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

const GOOGLE_OAUTH_CLIENT_ID =
  ((import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string | undefined) ?? '').trim();

// --- Cached token helpers ---

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

function getCachedToken(uid: string): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + uid);
    if (!raw) return null;
    const cached: CachedToken = JSON.parse(raw);
    if (Date.now() >= cached.expiresAt - EXPIRY_BUFFER_MS) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + uid);
      return null;
    }
    return cached.accessToken;
  } catch {
    return null;
  }
}

function setCachedToken(uid: string, accessToken: string, expiresInSec: number): void {
  try {
    const entry: CachedToken = {
      accessToken,
      expiresAt: Date.now() + expiresInSec * 1000,
    };
    localStorage.setItem(STORAGE_KEY_PREFIX + uid, JSON.stringify(entry));
  } catch {
    // localStorage unavailable or full
  }
}

export function clearCachedDriveToken(uid: string): void {
  localStorage.removeItem(STORAGE_KEY_PREFIX + uid);
}

export function hasDriveToken(uid: string): boolean {
  return getCachedToken(uid) !== null;
}

// --- GIS script loading ---

function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  const w = window as Window & { google?: { accounts?: { oauth2?: unknown } } };
  if (w.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      const win = window as Window & { google?: { accounts?: { oauth2?: unknown } } };
      if (win.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Google script failed')));
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });
}

// --- GIS token request ---

interface GisTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
}

type GisOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (r: GisTokenResponse) => void;
    error_callback?: (e: { type: string }) => void;
  }) => { requestAccessToken: (o?: { prompt?: string; hint?: string }) => void };
};

function getGisOAuth2(): GisOAuth2 | null {
  const w = window as Window & { google?: { accounts: { oauth2: GisOAuth2 } } };
  return w.google?.accounts?.oauth2 ?? null;
}

function requestGisToken(
  emailHint: string,
  prompt: 'none' | 'consent',
): Promise<GisTokenResponse | null> {
  const oauth2 = getGisOAuth2();
  if (!oauth2) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: GisTokenResponse | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const client = oauth2.initTokenClient({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      scope: FULL_SCOPE,
      callback: (response) => finish(response.error ? null : response),
      error_callback: () => finish(null),
    });

    try {
      client.requestAccessToken({ prompt, hint: emailHint.trim() });
    } catch {
      finish(null);
    }

    window.setTimeout(() => finish(null), 30000);
  });
}

// --- Firebase popup fallback ---

async function requestDriveTokenViaFirebasePopup(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);

  try {
    const result = await reauthenticateWithPopup(user, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return credential?.accessToken ?? null;
  } catch {
    return null;
  }
}

// --- Public API ---

/**
 * Returns a Drive-scoped access token. Checks cache first, then tries silent
 * GIS request (if client ID configured), then (if interactive=true) shows a
 * consent popup via GIS or Firebase reauthentication.
 */
export async function getDriveAccessToken(
  uid: string,
  emailHint: string,
  interactive: boolean = false,
): Promise<string | null> {
  const cached = getCachedToken(uid);
  if (cached) return cached;

  if (GOOGLE_OAUTH_CLIENT_ID) {
    try {
      await loadGsiScript();

      const silent = await requestGisToken(emailHint, 'none');
      if (silent?.access_token) {
        setCachedToken(uid, silent.access_token, silent.expires_in ?? 3600);
        return silent.access_token;
      }

      if (interactive) {
        const consent = await requestGisToken(emailHint, 'consent');
        if (consent?.access_token) {
          setCachedToken(uid, consent.access_token, consent.expires_in ?? 3600);
          return consent.access_token;
        }
      }
    } catch {
      // Fall through to Firebase popup fallback
    }
  }

  if (interactive) {
    const token = await requestDriveTokenViaFirebasePopup();
    if (token) {
      setCachedToken(uid, token, 3600);
      return token;
    }
  }

  return null;
}
