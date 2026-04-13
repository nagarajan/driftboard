import { getDriveAccessToken, hasDriveToken } from './driveAuth';
import type { ExportData } from '../store/boardStore';

// --- Types ---

export interface BackupEntry {
  fileId: string;
  createdAt: string;
  sizeBytes: number;
  boardCount: number;
  label: string;
}

export interface BackupManifest {
  version: number;
  entries: BackupEntry[];
}

// --- Constants ---

const MANIFEST_FILENAME = 'driftboard-backup-manifest.json';
const BACKUP_PREFIX = 'driftboard-backup-';
const ONE_HOUR = 60 * 60 * 1000;
const LAST_BACKUP_KEY = 'driftboard-last-backup-';

const DAILY_SLOTS = 7;
const WEEKLY_SLOTS = 4;
const MONTHLY_SLOTS = 12;
const YEARLY_SLOTS = 3;

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

// --- Timestamp tracking ---

function getLastBackupTimestamp(uid: string): number {
  try {
    return parseInt(localStorage.getItem(LAST_BACKUP_KEY + uid) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function setLastBackupTimestamp(uid: string, ts: number): void {
  try {
    localStorage.setItem(LAST_BACKUP_KEY + uid, String(ts));
  } catch {
    // storage unavailable
  }
}

// --- Formatting helpers ---

function formatBackupLabel(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${d} ${h}:${min}`;
}

function getISOWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// --- Drive API primitives ---

async function driveDelete(fileId: string, token: string): Promise<void> {
  await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function driveGetContent(fileId: string, token: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed: ${res.status}`);
  return res.text();
}

async function driveUpload(
  filename: string,
  content: string,
  token: string,
  existingId?: string,
): Promise<{ id: string; size: number }> {
  const metadata: Record<string, unknown> = { name: filename };
  if (!existingId) metadata.parents = ['appDataFolder'];

  const boundary = 'driftboard_boundary_' + Date.now();
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    content +
    `\r\n--${boundary}--`;

  const url = existingId
    ? `${DRIVE_UPLOAD}/files/${existingId}?uploadType=multipart`
    : `${DRIVE_UPLOAD}/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) throw new Error(`Drive upload failed: ${res.status}`);
  const data = await res.json();
  return { id: data.id, size: new Blob([content]).size };
}

// --- Manifest CRUD ---

async function findManifestId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${MANIFEST_FILENAME}'`);
  const res = await fetch(
    `${DRIVE_API}/files?spaces=appDataFolder&q=${q}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function loadManifest(
  token: string,
): Promise<{ manifest: BackupManifest; fileId: string | null }> {
  const fileId = await findManifestId(token);
  if (!fileId) return { manifest: { version: 1, entries: [] }, fileId: null };
  try {
    const content = await driveGetContent(fileId, token);
    return { manifest: JSON.parse(content) as BackupManifest, fileId };
  } catch {
    return { manifest: { version: 1, entries: [] }, fileId };
  }
}

async function saveManifest(
  manifest: BackupManifest,
  token: string,
  existingId: string | null,
): Promise<string> {
  const content = JSON.stringify(manifest, null, 2);
  const result = await driveUpload(
    MANIFEST_FILENAME,
    content,
    token,
    existingId ?? undefined,
  );
  return result.id;
}

// --- Retention algorithm (grandfather-father-son) ---

/**
 * Determines which backups to keep and which to prune using cascading buckets:
 * daily (7) -> weekly (4) -> monthly (12) -> yearly (3). Entries are processed
 * newest-first; the first entry for each bucket key wins.
 */
export function computeBackupsToKeep(
  entries: BackupEntry[],
): { keep: BackupEntry[]; remove: BackupEntry[] } {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const daily = new Set<string>();
  const weekly = new Set<string>();
  const monthly = new Set<string>();
  const yearly = new Set<string>();

  const keep: BackupEntry[] = [];
  const remove: BackupEntry[] = [];

  for (const entry of sorted) {
    const d = new Date(entry.createdAt);
    const dayKey = entry.createdAt.slice(0, 10);
    const weekKey = getISOWeekKey(d);
    const monthKey = entry.createdAt.slice(0, 7);
    const yearKey = entry.createdAt.slice(0, 4);

    if (daily.size < DAILY_SLOTS && !daily.has(dayKey)) {
      daily.add(dayKey);
      keep.push(entry);
    } else if (weekly.size < WEEKLY_SLOTS && !weekly.has(weekKey)) {
      weekly.add(weekKey);
      keep.push(entry);
    } else if (monthly.size < MONTHLY_SLOTS && !monthly.has(monthKey)) {
      monthly.add(monthKey);
      keep.push(entry);
    } else if (yearly.size < YEARLY_SLOTS && !yearly.has(yearKey)) {
      yearly.add(yearKey);
      keep.push(entry);
    } else {
      remove.push(entry);
    }
  }

  return { keep, remove };
}

// --- Core backup operation ---

async function performBackup(
  token: string,
  exportData: ExportData,
): Promise<BackupEntry> {
  const content = JSON.stringify(exportData);
  const boardCount = Object.keys(exportData.boards).length;
  const now = new Date();
  const filename = `${BACKUP_PREFIX}${now.toISOString().replace(/[:.]/g, '-')}.json`;

  const { id: fileId, size } = await driveUpload(filename, content, token);

  const entry: BackupEntry = {
    fileId,
    createdAt: now.toISOString(),
    sizeBytes: size,
    boardCount,
    label: formatBackupLabel(now),
  };

  const { manifest, fileId: manifestId } = await loadManifest(token);
  manifest.entries.push(entry);

  const { keep, remove } = computeBackupsToKeep(manifest.entries);
  manifest.entries = keep;
  await saveManifest(manifest, token, manifestId);

  for (const old of remove) {
    try {
      await driveDelete(old.fileId, token);
    } catch (err) {
      console.error('Failed to prune old backup:', err);
    }
  }

  return entry;
}

// --- Public API ---

export async function fetchBackupList(
  uid: string,
  email: string,
): Promise<BackupEntry[]> {
  const token = await getDriveAccessToken(uid, email, true);
  if (!token) throw new Error('Drive access not available');
  const { manifest } = await loadManifest(token);
  return [...manifest.entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function triggerBackupNow(
  uid: string,
  email: string,
  getExportData: () => ExportData,
): Promise<BackupEntry> {
  const token = await getDriveAccessToken(uid, email, true);
  if (!token) throw new Error('Drive access not available');
  const entry = await performBackup(token, getExportData());
  setLastBackupTimestamp(uid, Date.now());
  return entry;
}

export async function downloadBackupData(
  uid: string,
  email: string,
  fileId: string,
): Promise<ExportData> {
  const token = await getDriveAccessToken(uid, email, true);
  if (!token) throw new Error('Drive access not available');
  const content = await driveGetContent(fileId, token);
  return JSON.parse(content) as ExportData;
}

/**
 * Checks whether a Drive backup is due (>1 hour since last) and performs one
 * if so. Only uses cached tokens -- never triggers interactive consent.
 * Called from the Firestore store subscriber on each data change.
 */
export async function maybeTriggerBackup(
  uid: string,
  email: string,
  getExportData: () => ExportData,
): Promise<void> {
  if (!hasDriveToken(uid)) return;

  const last = getLastBackupTimestamp(uid);
  if (Date.now() - last < ONE_HOUR) return;

  setLastBackupTimestamp(uid, Date.now());

  const token = await getDriveAccessToken(uid, email, false);
  if (!token) return;

  try {
    await performBackup(token, getExportData());
    console.log('Drive backup completed automatically');
  } catch (err) {
    console.error('Automatic Drive backup failed:', err);
  }
}
