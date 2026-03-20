/**
 * Uses Google Identity Services OAuth2 token client with prompt=none + login_hint.
 * When consent and a Google session exist for the hinted account, Google may return
 * tokens without opening the OAuth popup. If interaction is required, returns null.
 *
 * Note: Switching between two different Google accounts in one browser often still
 * requires user interaction per Google policy; this path helps when it does not.
 */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const OAUTH_SCOPE =
  'openid email profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

function loadGsiScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  const w = window as Window & {
    google?: { accounts?: { oauth2?: unknown } };
  };
  if (w.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      const win = window as Window & {
        google?: { accounts?: { oauth2?: unknown } };
      };
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

export interface TokenResponseLike {
  access_token?: string;
  /** Present when openid scope is granted; preferred for Firebase signInWithCredential */
  id_token?: string;
  error?: string;
  error_description?: string;
}

export interface SilentGoogleTokens {
  idToken?: string;
  accessToken?: string;
}

/**
 * Returns Google OAuth tokens without showing the consent popup when possible.
 * Prefer id_token for Firebase when present.
 */
export async function requestGoogleTokensSilent(
  clientId: string,
  emailHint: string
): Promise<SilentGoogleTokens | null> {
  if (!clientId.trim()) {
    return null;
  }
  try {
    await loadGsiScript();
  } catch {
    return null;
  }

  const w = window as Window & {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (r: TokenResponseLike) => void;
          }) => { requestAccessToken: (o?: { prompt?: string; hint?: string }) => void };
        };
      };
    };
  };

  const oauth2 = w.google?.accounts?.oauth2;
  if (!oauth2) {
    return null;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: SilentGoogleTokens | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: OAUTH_SCOPE,
      callback: (response: TokenResponseLike) => {
        if (response.error) {
          finish(null);
          return;
        }
        if (response.id_token) {
          finish({ idToken: response.id_token, accessToken: response.access_token });
          return;
        }
        if (response.access_token) {
          finish({ accessToken: response.access_token });
          return;
        }
        finish(null);
      },
    });

    try {
      tokenClient.requestAccessToken({ prompt: 'none', hint: emailHint.trim() });
    } catch {
      finish(null);
    }

    window.setTimeout(() => finish(null), 20000);
  });
}
