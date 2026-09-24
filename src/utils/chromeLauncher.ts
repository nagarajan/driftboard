/**
 * Hands external links to the local `tools/open-in-chrome.py` helper so they
 * open in Chrome rather than a new Firefox tab.
 *
 * Availability is probed up front and cached, because the click handler has to
 * decide synchronously: awaiting a round trip before calling window.open would
 * lose the user gesture and trip the popup blocker.
 */

const HELPER_ORIGIN = 'http://127.0.0.1:17324';
const PROBE_TIMEOUT_MS = 1500;
const OPEN_TIMEOUT_MS = 5000;
const PROBE_STALE_MS = 60_000;

let helperAvailable = false;
let lastProbeAt = 0;

async function probe(): Promise<void> {
  lastProbeAt = Date.now();
  try {
    const response = await fetch(`${HELPER_ORIGIN}/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    helperAvailable = response.ok;
  } catch {
    helperAvailable = false;
  }
}

export function initChromeLauncher(): void {
  if (!/Mac/i.test(navigator.userAgent)) return;

  void probe();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - lastProbeAt < PROBE_STALE_MS) return;
    void probe();
  });
}

function resolveExternalUrl(href: string | undefined): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.origin === window.location.origin) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Returns true when the link was handed to Chrome and the caller should
 * suppress the browser's own navigation.
 */
export function tryOpenInChrome(href: string | undefined): boolean {
  if (!helperAvailable) return false;

  const url = resolveExternalUrl(href);
  if (!url) return false;

  void fetch(`${HELPER_ORIGIN}/open`, {
    method: 'POST',
    // text/plain keeps this a CORS-simple request, so there is no preflight.
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(OPEN_TIMEOUT_MS),
  }).then(
    (response) => {
      if (response.ok) return;
      helperAvailable = false;
      window.open(url, '_blank', 'noreferrer');
    },
    () => {
      helperAvailable = false;
      window.open(url, '_blank', 'noreferrer');
    },
  );

  return true;
}
