import type { User } from 'firebase/auth';

export interface KnownAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

const STORAGE_KEY = 'taskboard-known-accounts';

function readAccounts(): KnownAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is KnownAccount =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as KnownAccount).uid === 'string' &&
        typeof (a as KnownAccount).email === 'string'
    );
  } catch {
    return [];
  }
}

function writeAccounts(accounts: KnownAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // ignore quota errors
  }
}

/** Upsert by uid, move to front (most recently used). */
export function recordKnownAccount(user: User): void {
  const email = user.email ?? '';
  if (!email) return;

  const entry: KnownAccount = {
    uid: user.uid,
    email,
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
  };

  const list = readAccounts().filter((a) => a.uid !== entry.uid);
  list.unshift(entry);
  writeAccounts(list);
}

export function getKnownAccounts(): KnownAccount[] {
  return readAccounts();
}

/** First account in MRU order (e.g. suggest for new tab). */
export function getFirstKnownAccount(): KnownAccount | null {
  const list = readAccounts();
  return list[0] ?? null;
}

export function getKnownAccountByEmail(email: string): KnownAccount | null {
  const lower = email.toLowerCase();
  return readAccounts().find((a) => a.email.toLowerCase() === lower) ?? null;
}
