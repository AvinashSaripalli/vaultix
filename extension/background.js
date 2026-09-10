const DEFAULT_URL = 'https://knbitrix.duckdns.org';
const DEFAULT_LOCK_MS = 15 * 60 * 1000;

async function lockMs() {
  try {
    const { user } = await chrome.storage.local.get('user');
    const minutes = Number(user?.vaultTimeoutMinutes) || 15;
    return minutes * 60 * 1000;
  } catch {
    return DEFAULT_LOCK_MS;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  // Content scripts (untrusted contexts) can no longer read the decrypted
  // chrome.storage.session cache directly. The background worker — the only
  // trusted context with access — filters the cache down to credentials that
  // belong to the requesting tab's host before ever returning them. A page
  // cannot enumerate items, and only host-matched secrets leave the worker.
  if (msg.type === 'VAULTIX_GET_CREDS') {
    (async () => {
      try {
        const data = await chrome.storage.session.get('cache');
        const cache = data.cache;

        if (!cache || Date.now() - cache.ts >= (await lockMs())) {
          sendResponse({ ok: true, creds: [] });
          return;
        }

        const tabHost = hostOf(sender.tab?.url || '');
        const creds = (cache.creds || []).filter(
          (c) => tabHost && hostMatches(tabHost, c.url)
        );

        sendResponse({ ok: true, creds });
      } catch {
        sendResponse({ ok: true, creds: [] });
      }
    })();
    return true;
  }

  if (msg.type !== 'VAULTIX_LOG' || !msg.passwordId) return;

  (async () => {
    try {
      const sync = await chrome.storage.sync.get('baseUrl');
      const local = await chrome.storage.local.get('token');
      const baseUrl = (sync.baseUrl || DEFAULT_URL).replace(/\/+$/, '');

      if (!local.token) {
        sendResponse({ ok: false, reason: 'not-signed-in' });
        return;
      }

      const res = await fetch(
        `${baseUrl}/api/v1/passwords/${msg.passwordId}/copy-log`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${local.token}` },
        }
      );
      sendResponse({ ok: res.ok });
    } catch {
      sendResponse({ ok: false });
    }
  })();

  return true;
});

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function urlHost(entryUrl) {
  if (!entryUrl) return '';
  try {
    return new URL(
      entryUrl.includes('://') ? entryUrl : `https://${entryUrl}`
    ).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Exact host-based matching only — no fuzzy name-keyword guessing that could
// surface unrelated items on a site.
function hostMatches(tabHost, entryUrl) {
  const credHost = urlHost(entryUrl);
  if (!credHost) return false;
  return (
    credHost === tabHost ||
    credHost.endsWith(`.${tabHost}`) ||
    tabHost.endsWith(`.${credHost}`)
  );
}