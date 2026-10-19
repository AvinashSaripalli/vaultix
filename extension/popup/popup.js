import {
  decryptText,
  decryptFields,
  isEncryptedFormat,
  generateTOTP,
  decryptPrivateKey,
  unwrapItemKey,
  decryptValueWithAesKey,
  decryptFieldsWithAesKey,
} from '../lib/crypto.js';
import { apiLogin, apiGet, apiPost, apiRefresh } from '../lib/api.js';

const DEFAULT_URL = 'https://vaultix.knadvisors.pro';
const DEFAULT_LOCK_MS = 8 * 60 * 60 * 1000; // 8 hours (workday default)

const $ = (id) => document.getElementById(id);

let baseUrl = '';
let token = '';
let refreshToken = '';
let user = null;
let creds = [];
let tab = null;
let tabHost = '';
let lockMs = DEFAULT_LOCK_MS;
let timeoutMode = 'duration';
let lockAt = 0;
let lockTimerId = null;
let showAllSites = false;

async function getVaultTimeoutConfig() {
  try {
    const local = await chrome.storage.local.get(['vaultTimeout', 'user']);
    const sync = await chrome.storage.sync.get('vaultTimeout').catch(() => ({}));
    const setting = local.vaultTimeout || sync.vaultTimeout;

    if (setting) {
      if (setting === 'restart' || setting === 'never') {
        return { mode: setting, ms: Infinity };
      }
      const mins = Number(setting);
      if (!isNaN(mins) && mins > 0) {
        return { mode: 'duration', ms: mins * 60 * 1000, minutes: mins };
      }
    }

    return { mode: 'duration', ms: DEFAULT_LOCK_MS, minutes: 480 };
  } catch {
    return { mode: 'duration', ms: DEFAULT_LOCK_MS, minutes: 480 };
  }
}

async function updateLockTimeout() {
  const config = await getVaultTimeoutConfig();
  lockMs = config.ms;
  timeoutMode = config.mode;
}

init();

async function init() {
  try {
    // Keep chrome.storage.session at its default TRUSTED_CONTEXTS level: the
    // decrypted page cache must never be readable from content scripts, which
    // run in untrusted contexts on arbitrary websites. Content scripts receive
    // only host-matched credentials via the background worker (VAULTIX_GET_CREDS).
  } catch {
    /* Firefox may not need this */
  }

  const sync = await chrome.storage.sync.get('baseUrl');
  let rawBaseUrl = sync.baseUrl;
  if (!rawBaseUrl || rawBaseUrl === 'http://localhost:4000') {
    rawBaseUrl = DEFAULT_URL;
    chrome.storage.sync.set({ baseUrl: DEFAULT_URL }).catch(() => {});
  }
  baseUrl = rawBaseUrl.replace(/\/+$/, '');

  // Session data (cached master, decrypted cache, RSA private key) is scoped to
  // the server it was created against. If the server URL changed, drop it all —
  // otherwise stale credentials from another deployment (e.g. prod vs dev) will
  // be treated as live data.
  const sessMeta = await chrome.storage.session.get('vaultServer');
  if (sessMeta.vaultServer && sessMeta.vaultServer !== baseUrl) {
    await chrome.storage.session.remove(['master', 'cache', 'privKey']);
  }
  await chrome.storage.session.set({ vaultServer: baseUrl });

  const local = await chrome.storage.local.get(['token', 'refreshToken', 'user']);
  token = local.token || '';
  refreshToken = local.refreshToken || '';
  user = local.user || null;
  await updateLockTimeout();

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabHost = hostOf(tab?.url || '');

  $('loginServer').textContent = baseUrl;
  $('lnkSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  if ($('btnSettings')) {
    $('btnSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  }
  if ($('lnkSettingsUnlock')) {
    $('lnkSettingsUnlock').addEventListener('click', () => chrome.runtime.openOptionsPage());
  }
  $('lnkOpenVault').addEventListener('click', () => chrome.tabs.create({ url: baseUrl }));
  if ($('lnkOpenVaultLogin')) {
    $('lnkOpenVaultLogin').addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: baseUrl });
    });
  }
  $('lnkRefresh').addEventListener('click', () => loadCreds(true));
  $('btnLock').addEventListener('click', lockVault);
  $('btnLogin').addEventListener('click', onLogin);
  $('btnUnlock').addEventListener('click', onUnlock);
  $('search').addEventListener('input', () => renderList());
  $('unlockUser').textContent = user ? user.email : '';
  $('toggleLoginMaster').addEventListener('click', () => toggleField('loginMaster', 'toggleLoginMaster'));
  $('toggleUnlockMaster').addEventListener('click', () => toggleField('unlockMaster', 'toggleUnlockMaster'));

  const sess = await chrome.storage.session.get(['master', 'cache']);
  const cacheValid =
    sess.master && sess.cache && (lockMs === Infinity || Date.now() - sess.cache.ts < lockMs);

  if (token && user && cacheValid) {
    // Slide activity window timestamp when popup is actively used
    sess.cache.ts = Date.now();
    chrome.storage.session.set({ cache: sess.cache }).catch(() => {});

    creds = sess.cache.creds;
    lockAt = lockMs === Infinity ? Infinity : sess.cache.ts + lockMs;
    showList();
    startLockTimer();
    const needsFolderUpgrade = creds.length > 0 && !creds.some((c) => 'folderName' in c);
    if (creds.length === 0 || needsFolderUpgrade) {
      // Re-fetch in the background to ensure folder names are populated
      loadCreds(true);
    }
  } else if (token && user) {
    await chrome.storage.session.remove(['master', 'cache', 'privKey']);
    show('viewUnlock');
  } else {
    show('viewLogin');
  }
}

function show(view) {
  for (const v of ['viewLogin', 'viewUnlock', 'viewList']) {
    $(v).style.display = v === view ? 'block' : 'none';
  }
  const authed = view === 'viewList';
  $('btnLock').style.display = authed ? 'inline' : 'none';
  $('footerBar').style.display = authed ? 'flex' : 'none';
}

// Rotates the access token once via the long-lived refresh token. Keeps the
// user signed in past the short-lived access token; both tokens are only ever
// used from trusted contexts (never content scripts).
async function tryRefresh() {
  const local = await chrome.storage.local.get(['token', 'refreshToken', 'user']);
  const tokenToUse = local.refreshToken || refreshToken;
  if (!tokenToUse) return false;
  try {
    const ref = await apiRefresh(baseUrl, tokenToUse);
    if (ref.token && ref.refreshToken) {
      token = ref.token;
      refreshToken = ref.refreshToken;
      if (ref.user) user = ref.user;
      await updateLockTimeout();
      await chrome.storage.local.set({ token, refreshToken, user });
      return true;
    }
  } catch {
    /* refresh failed */
  }
  return false;
}

async function secureGet(path, { retried = false } = {}) {
  try {
    return await apiGet(baseUrl, path, token);
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED' && !retried && (await tryRefresh())) {
      return await apiGet(baseUrl, path, token);
    }
    throw err;
  }
}

async function securePost(path, body, { retried = false } = {}) {
  try {
    return await apiPost(baseUrl, path, token, body);
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED' && !retried && (await tryRefresh())) {
      return await apiPost(baseUrl, path, token, body);
    }
    throw err;
  }
}

async function onLogin() {
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;
  const master = $('loginMaster').value;
  $('loginError').textContent = '';
  if (!email || !password || !master) {
    $('loginError').textContent = 'All three fields are required.';
    return;
  }
  $('btnLogin').disabled = true;
  try {
    const data = await apiLogin(baseUrl, email, password);
    token = data.token;
    refreshToken = data.refreshToken || '';
    user = data.user;
    await updateLockTimeout();
    await chrome.storage.local.set({ token, refreshToken, user });

    // Validate the master password against the server first, so a stale or
    // mistyped value fails loudly instead of silently producing an empty vault.
    try {
      await securePost('/auth/verify-master-password', { masterPassword: master });
    } catch (verifyErr) {
      await chrome.storage.local.remove(['token', 'refreshToken', 'user']);
      token = '';
      refreshToken = '';
      user = null;
      $('loginError').textContent =
        verifyErr.message === 'SESSION_EXPIRED'
          ? 'Session expired — try again.'
          : verifyErr.message === 'Invalid master password'
            ? 'Invalid master password. Cannot unlock this vault.'
            : verifyErr.message;
      return;
    }

    await chrome.storage.session.set({ master });
    await chrome.storage.session.remove(['privKey', 'cache']);
    await loadCreds(false);
  } catch (err) {
    $('loginError').textContent = err.message;
  } finally {
    $('btnLogin').disabled = false;
  }
}

async function onUnlock() {
  const master = $('unlockMaster').value;
  if (!master) return;
  $('unlockError').textContent = '';
  $('btnUnlock').disabled = true;
  try {
    // Server-verify before storing, so a wrong master is never cached.
    try {
      await securePost('/auth/verify-master-password', { masterPassword: master });
    } catch (verifyErr) {
      $('unlockError').textContent =
        verifyErr.message === 'Invalid master password'
          ? 'Invalid master password.'
          : verifyErr.message === 'SESSION_EXPIRED'
            ? 'Session expired — sign out and sign in again.'
            : verifyErr.message;
      return;
    }

    await updateLockTimeout();
    await chrome.storage.session.set({ master });
    await chrome.storage.session.remove(['privKey', 'cache']);
    await loadCreds(false);
  } catch (err) {
    await chrome.storage.session.remove('master');
    $('unlockError').textContent = err.message;
  } finally {
    $('btnUnlock').disabled = false;
  }
}

async function lockVault() {
  clearInterval(lockTimerId);
  lockAt = 0;
  await chrome.storage.session.remove(['master', 'cache', 'privKey']);
  creds = [];
  $('unlockMaster').value = '';
  show('viewUnlock');
}

// Legacy envelopes carry no KDF markers, so the salt/iterations used to create
// them must be derived empirically. Try each candidate combo on a marker-less
// envelope; the first that decrypts reveals the parameters.
async function deriveLegacyKey(masterPassword, saltString, iterations, usage) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(saltString || 'vault-salt'),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage]
  );
}

async function tryDecryptCombos(encryptedText, master, combos) {
  let parsed = null;
  try {
    parsed = JSON.parse(encryptedText);
  } catch {
    return null;
  }
  if (!parsed || !Array.isArray(parsed.iv) || !Array.isArray(parsed.content)) {
    return null;
  }
  const iv = new Uint8Array(parsed.iv);
  const cipher = new Uint8Array(parsed.content);
  const decoder = new TextDecoder();
  for (const combo of combos) {
    try {
      const key = await deriveLegacyKey(master, combo.salt, combo.iterations, 'decrypt');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
      return { text: decoder.decode(plain), combo };
    } catch {
      // wrong salt/iterations — try the next candidate
    }
  }
  return null;
}

async function loadCreds(force) {
  if (!force) {
    const cached = await chrome.storage.session.get('cache');
    if (
      cached.cache &&
      cached.cache.creds.length > 0 &&
      cached.cache.creds.some((c) => 'folderName' in c) &&
      (lockMs === Infinity || Date.now() - cached.cache.ts < lockMs)
    ) {
      // Slide activity timestamp on active access
      cached.cache.ts = Date.now();
      chrome.storage.session.set({ cache: cached.cache }).catch(() => {});
      creds = cached.cache.creds;
      lockAt = lockMs === Infinity ? Infinity : cached.cache.ts + lockMs;
      showList();
      startLockTimer();
      return;
    }
    // An empty cache is never trusted: it usually means a previous fetch or
    // decrypt failed, so refetch instead of showing a false "no logins".
  }

  const sess = await chrome.storage.session.get(['master', 'privKey']);
  const master = sess.master;
  if (!master) {
    show('viewUnlock');
    return;
  }

  showList();
  const statusEl = $('listStatus');
  statusEl.style.display = 'block';
  statusEl.style.color = '';
  statusEl.textContent = 'Decrypting vault…';

  const warnings = [];

  try {
    // Salt candidates for legacy (marker-less) envelopes. The web app may
    // still hold an older user.encryptionSalt in its persisted Redux state,
    // so the extension tries every plausible (salt, iterations) combo.
    let salt = user?.encryptionSalt || '';
    const storedSalt = user?.encryptionSalt || '';
    const priorSalt = (await chrome.storage.local.get('priorSalt')).priorSalt || '';

    // The stored login blob can be stale (encryption salt may be missing or
    // changed). Fetch the fresh profile so legacy envelopes decrypt correctly.
    try {
      const me = await secureGet('/auth/me');
      if (me?.encryptionSalt) {
        salt = me.encryptionSalt;
        user = me;
        await chrome.storage.local.set({ user: me });
      }
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') throw err;
      warnings.push(`Profile: ${err.message}`);
    }

    // The master password may be stale (e.g. changed in the web app since this
    // session was cached). Validate it before trusting the cached value so a
    // wrong master is surfaced immediately instead of silently failing decrypt.
    let masterVerified = false;
    try {
      await securePost('/auth/verify-master-password', { masterPassword: master });
      masterVerified = true;
    } catch (err) {
      if (err.message === 'Invalid master password') {
        await chrome.storage.session.remove(['master', 'cache', 'privKey']);
        show('viewUnlock');
        $('unlockError').textContent =
          'Invalid master password. Enter your current master password.';
        return;
      }
      if (err.message !== 'SESSION_EXPIRED') {
        warnings.push(`Master check: ${err.message}`);
      }
    }

    // Company and shared vault items encrypt each password with its own AES key
    // that is RSA-wrapped for this user. Unwrap once and cache the private key in
    // the trusted session so reopening the popup doesn't re-run the slow KDF.
    let privKey = sess.privKey || null;
    let kpSalt = '';
    if (!privKey) {
      try {
        const kp = await secureGet('/keypair');
        if (kp?.encryptedPrivateKey) {
          kpSalt = kp.salt || '';
          privKey = await decryptPrivateKey(
            kp.encryptedPrivateKey,
            master,
            kp.salt || salt
          );
          await chrome.storage.session.set({ privKey });
        }
      } catch {
        privKey = null; // personal-vault-only mode
      }
    }

    // Candidate (salt, iterations) combos for legacy envelopes, tried in order.
    const legacyCombos = [];
    const pushCombo = (s, it) => {
      if (!s) return;
      if (!legacyCombos.some((c) => c.salt === s && c.iterations === it)) {
        legacyCombos.push({ salt: s, iterations: it });
      }
    };
    pushCombo(salt, 100000);
    pushCombo(storedSalt, 100000);
    pushCombo(kpSalt, 100000);
    pushCombo(priorSalt, 100000);
    pushCombo('vault-salt', 100000);
    pushCombo(salt, 600000);
    pushCombo(storedSalt, 600000);
    pushCombo(kpSalt, 600000);
    pushCombo('vault-salt', 600000);

    let workingCombo = null;
    const recordWorkingCombo = (combo) => {
      workingCombo = combo;
      chrome.storage.local.set({ priorSalt: combo.salt });
    };

    let entries = [];
    const sourceCounts = [];
    const folderNameById = new Map();
    const personalFolders = [];

    try {
      const mine = await secureGet('/my-vault');
      if (Array.isArray(mine?.folders)) {
        for (const f of mine.folders) {
          if (f?.id && f?.name) {
            folderNameById.set(f.id, f.name);
            personalFolders.push({ id: f.id, name: f.name });
          }
        }
      }
      const list = (mine?.passwords || []).map((p) => {
        if (p.folder?.id && p.folder?.name) {
          folderNameById.set(p.folder.id, p.folder.name);
        }
        return {
          ...p,
          vaultName: mine?.name || 'Personal',
        };
      });
      entries = entries.concat(list);
      sourceCounts.push(`personal: ${list.length}`);
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') throw err;
      warnings.push(`Personal vault: ${err.message}`);
    }

    try {
      const shared = await secureGet('/password-shares/shared-with-me');
      const sharedList = Array.isArray(shared)
        ? shared
        : shared?.sharedPasswords || [];
      sourceCounts.push(`shared: ${sharedList.length}`);
      for (const s of sharedList) {
        if (!s?.password) continue;
        if (s.password.folder?.id && s.password.folder?.name) {
          folderNameById.set(s.password.folder.id, s.password.folder.name);
        }
        entries.push({
          ...s.password,
          vaultName: s.password.vault?.name || '',
          shared: true,
          shareKey: s.encryptedItemKey || null,
          rePassword: s.reEncryptedPassword || null,
          reFields: s.reEncryptedFields || null,
        });
      }
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') throw err;
      warnings.push(`Shared: ${err.message}`);
    }

    try {
      const vaults = await secureGet('/vaults');
      const company = (vaults || []).filter((v) => v.type !== 'PERSONAL');
      sourceCounts.push(`company vaults: ${company.length}`);
      for (const vault of company) {
        if (Array.isArray(vault?.folders)) {
          for (const f of vault.folders) {
            if (f?.id && f?.name) folderNameById.set(f.id, f.name);
          }
        }
        try {
          const vaultPasswords = await secureGet(`/passwords/vault/${vault.id}`);
          const withVault = (vaultPasswords || []).map((p) => {
            if (p.folder?.id && p.folder?.name) {
              folderNameById.set(p.folder.id, p.folder.name);
            }
            return {
              ...p,
              vaultName: vault.name || '',
            };
          });
          entries = entries.concat(withVault);
        } catch (err) {
          if (err.message === 'SESSION_EXPIRED') throw err;
          warnings.push(`${vault.name}: ${err.message}`);
        }
      }
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') throw err;
      warnings.push(`Company vaults: ${err.message}`);
    }

    const resolveFolderName = (entry) => {
      if (entry.folder && typeof entry.folder === 'object' && entry.folder.name) {
        return String(entry.folder.name).trim();
      }
      if (typeof entry.folder === 'string' && entry.folder.trim()) {
        return entry.folder.trim();
      }
      if (entry.folderName && typeof entry.folderName === 'string') {
        return entry.folderName.trim();
      }
      if (entry.folderId && folderNameById.has(entry.folderId)) {
        return folderNameById.get(entry.folderId).trim();
      }
      return '';
    };

    const byId = new Map();
    for (const e of entries) {
      if (!byId.has(e.id)) byId.set(e.id, e);
    }

    const decrypted = [];
    let skipped = 0;
    const failures = [];

    const envelopeSummary = (value) => {
      if (!value || typeof value !== 'string') return value === '' ? 'empty' : String(value).slice(0, 30);
      try {
        const p = JSON.parse(value);
        return {
          v: p.v,
          kdf: p.kdf || 'none',
          it: p.iterations,
          saltLen: Array.isArray(p.salt) ? p.salt.length : p.salt,
          ivLen: Array.isArray(p.iv) ? p.iv.length : null,
          contentLen: Array.isArray(p.content) ? p.content.length : null,
        };
      } catch {
        return String(value).slice(0, 30);
      }
    };

    for (const entry of byId.values()) {
      if (entry.type && entry.type !== 'LOGIN') continue;

      let password = '';
      let totpSecret = null;

      try {
        // Key-wrapped item (company vault / shared with me).
        if (privKey && (entry.myWrappedKey || entry.shareKey)) {
          const aesKeyJwk = await unwrapItemKey(
            entry.shareKey || entry.myWrappedKey,
            privKey
          );
          const encryptedPw = entry.shareKey
            ? entry.rePassword || entry.encryptedPassword
            : entry.encryptedPassword;
          password = await decryptValueWithAesKey(encryptedPw, aesKeyJwk);
          if (!password) {
            failures.push({ name: entry.name, reason: 'empty after AES-key decrypt' });
            skipped++;
            continue;
          }
          const fieldsSource = entry.shareKey
            ? entry.reFields || entry.encryptedFields
            : entry.encryptedFields;
          const fields = await decryptFieldsWithAesKey(fieldsSource, aesKeyJwk);
          totpSecret = fields?.totpSecret || fields?.totp || fields?.TOTP || null;
        }
        // Master-password-encrypted item (personal vault).
        else if (isEncryptedFormat(entry.encryptedPassword)) {
          let envelope = null;
          try {
            envelope = JSON.parse(entry.encryptedPassword);
          } catch {
            envelope = null;
          }

          if (envelope && envelope.kdf === 'PBKDF2' && envelope.v === 2) {
            // v2 envelope embeds its own salt — decrypt directly.
            password = await decryptText(entry.encryptedPassword, master, salt);
          } else {
            // Legacy marker-less envelope: probe candidate KDF combos.
            const attempt = await tryDecryptCombos(
              entry.encryptedPassword,
              master,
              legacyCombos
            );
            if (attempt) {
              password = attempt.text;
              if (!workingCombo) recordWorkingCombo(attempt.combo);
            }
          }

          if (!password) {
            failures.push({
              name: entry.name,
              reason: workingCombo ? 'empty after master decrypt' : 'no matching KDF combo',
              envelope: envelopeSummary(entry.encryptedPassword),
            });
            skipped++;
            continue;
          }
          if (entry.encryptedFields) {
            const fields = await decryptFields(
              entry.encryptedFields,
              master,
              workingCombo ? workingCombo.salt : salt
            );
            totpSecret = fields?.totpSecret || fields?.totp || null;
          }
        } else {
          failures.push({
            name: entry.name,
            reason: 'not an encrypted envelope',
            envelope: envelopeSummary(entry.encryptedPassword),
          });
          skipped++;
          continue;
        }
      } catch (err) {
        failures.push({
          name: entry.name,
          reason: `${err?.name || 'Error'}: ${err?.message || err}`,
          envelope: envelopeSummary(entry.encryptedPassword),
        });
        skipped++;
        continue;
      }

      decrypted.push({
        id: entry.id,
        name: entry.name || entry.login || 'Item',
        login: entry.login || '',
        url: entry.url || '',
        folderId: entry.folderId || entry.folder?.id || '',
        folderName: resolveFolderName(entry),
        vaultName: entry.vaultName || entry.vault?.name || '',
        password,
        totpSecret,
        shared: !!entry.shared,
      });
    }

    creds = decrypted;
    const now = Date.now();
    lockAt = lockMs === Infinity ? Infinity : now + lockMs;
    await chrome.storage.session.set({
      cache: { ts: now, creds, folders: personalFolders },
    });
    startLockTimer();

    console.debug(
      '[Vaultix]',
      sourceCounts.join(', '),
      '| items:', byId.size,
      '| decrypted:', decrypted.length,
      '| skipped:', skipped,
      '| masterVerified:', masterVerified,
      '| salt:', (salt || '').slice(0, 12),
      '| privKey:', privKey ? 'loaded' : 'none',
      '| workingCombo:', workingCombo ? `${workingCombo.salt.slice(0, 12)}@${workingCombo.iterations}` : null
    );

    if (failures.length > 0) {
      console.debug(
        '[Vaultix] decrypt failures:',
        JSON.stringify(failures.slice(0, 5), null, 2)
      );
      const diag = $('diag');
      const diagText = $('diagText');
      if (diag && diagText) {
        diagText.textContent = JSON.stringify(
          {
            items: byId.size,
            decrypted: decrypted.length,
            masterVerified,
            salt: (salt || '').slice(0, 12),
            privKey: privKey ? 'loaded' : 'none',
            workingCombo: workingCombo
              ? `${workingCombo.salt.slice(0, 12)}@${workingCombo.iterations}`
              : null,
            failures: failures.slice(0, 5),
          },
          null,
          2
        );
        diag.style.display = 'block';
      }
    }

    if (decrypted.length === 0 && byId.size > 0) {
      const masterNote = masterVerified
        ? 'Master verified — see decrypt diagnostics below.'
        : 'Master could not be verified — Lock, then unlock with your current master password.';
      warnings.push(`${byId.size} loaded, 0 decrypted. ${masterNote}`);
    } else if (failures.length > 0 && decrypted.length > 0) {
      warnings.push(`${failures.length} item(s) failed to decrypt — see decrypt diagnostics below.`);
    }

    if (warnings.length) {
      statusEl.style.display = 'block';
      statusEl.style.color = '#fbbf24';
      statusEl.textContent = warnings.join(' · ');
    } else {
      statusEl.style.display = 'none';
    }
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      await chrome.storage.local.remove(['token', 'refreshToken', 'user']);
      token = '';
      refreshToken = '';
      user = null;
      show('viewLogin');
      return;
    }
    statusEl.style.display = 'block';
    statusEl.textContent = `Error: ${err.message} — try Refresh`;
    return;
  }

  showList();
}

function startLockTimer() {
  const el = $('lockTimer');
  if (!el) return;
  clearInterval(lockTimerId);

  el.title = 'Vault Timeout: click to change in Settings';
  el.style.cursor = 'pointer';
  if (!el.dataset.clickBound) {
    el.dataset.clickBound = 'true';
    el.addEventListener('click', () => chrome.runtime.openOptionsPage());
  }

  const tick = () => {
    if (lockMs === Infinity) {
      if (timeoutMode === 'restart') {
        el.textContent = 'Locks on browser restart';
      } else {
        el.textContent = 'Never auto-locks';
      }
      return;
    }

    const left = Math.max(0, lockAt - Date.now());
    if (left <= 0) {
      el.textContent = 'Auto-lock active';
      clearInterval(lockTimerId);
      lockVault();
      return;
    }

    const totalSecs = Math.floor(left / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (hours > 0) {
      el.textContent = `Auto-lock in ${hours}h ${mins}m`;
    } else {
      el.textContent = `Auto-lock in ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  };
  tick();
  lockTimerId = setInterval(tick, 1000);
}

function toggleField(fieldId, btnId) {
  const field = $(fieldId);
  const btn = $(btnId);
  const reveal = field.type === 'password';
  field.type = reveal ? 'text' : 'password';
  btn.textContent = reveal ? 'Hide' : 'Show';
  field.focus();
}

function showList() {
  show('viewList');
  const label = $('siteLabel');
  const spacer = document.createElement('span');
  spacer.className = 'spacer';

  if (tabHost) {
    const site = document.createElement('span');
    site.innerHTML = '<b></b>';
    site.querySelector('b').textContent = tabHost;

    const toggle = document.createElement('a');
    toggle.id = 'lnkAll';
    toggle.textContent = showAllSites ? 'Only this site' : 'Show all';
    toggle.href = '#';
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      showAllSites = !showAllSites;
      renderList();
    });

    label.innerHTML = '';
    label.append(site, spacer, toggle);
  } else {
    label.textContent = 'No site detected — showing all items';
  }

  renderPendingSaveCard();
  renderList();
}

function renderPendingSaveCard() {
  const cardEl = $('pendingSaveCard');
  if (!cardEl) return;

  try {
    chrome.runtime.sendMessage(
      { type: 'VAULTIX_CHECK_PENDING_LOGIN', fromPopup: true },
      (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok || !resp.pending) {
          cardEl.style.display = 'none';
          cardEl.innerHTML = '';
          return;
        }

        const {
          pending,
          folders = [],
          companyVaults = [],
          defaultFolderName = 'Saved from Browser',
        } = resp;
        const isUpdate = pending.mode === 'UPDATE';

        cardEl.style.display = 'block';
        cardEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:700;color:#a5b4fc;font-size:12px;">
              🔑 ${isUpdate ? 'Update login in Vaultix?' : 'Save new login to Vaultix?'}
            </span>
            <button id="btnDismissPending" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:12px;">✕</button>
          </div>
          <div style="font-size:11.5px;color:#e2e8f0;margin-bottom:6px;">
            <b>${pending.name || pending.hostname}</b> · <span style="color:#94a3b8;">${pending.username || '(no username)'}</span>
          </div>
          <div style="margin-bottom:7px;">
            <select id="selPendingFolder" style="width:100%;padding:6px 8px;border-radius:7px;border:1px solid #334155;background:#0b1222;color:#e2e8f0;font-size:11.5px;outline:none;"></select>
          </div>
          <div style="display:flex;gap:6px;">
            <button id="btnSavePending" class="primary" style="padding:6px 10px;font-size:11.5px;flex:1;">
              ${isUpdate ? 'Update Password' : 'Save Login'}
            </button>
          </div>
        `;

        const selectEl = $('selPendingFolder');
        const pGroup = document.createElement('optgroup');
        pGroup.label = '🔒 Personal Vault (Private)';

        const existingDefault = folders.find(
          (f) => (f.name || '').trim().toLowerCase() === defaultFolderName.toLowerCase()
        );
        const defOpt = document.createElement('option');
        defOpt.value = `personal:${existingDefault ? existingDefault.id : '__DEFAULT_BROWSER_FOLDER__'}`;
        defOpt.textContent = `📁 ${defaultFolderName} (Default)`;
        pGroup.appendChild(defOpt);

        for (const f of folders) {
          if (existingDefault && f.id === existingDefault.id) continue;
          const opt = document.createElement('option');
          opt.value = `personal:${f.id}`;
          opt.textContent = `📁 ${f.name}`;
          if (
            isUpdate &&
            pending.existingVaultType !== 'COMPANY' &&
            pending.existingFolderId &&
            f.id === pending.existingFolderId
          ) {
            opt.selected = true;
          }
          pGroup.appendChild(opt);
        }
        selectEl.appendChild(pGroup);

        for (const cv of companyVaults) {
          if (!cv.folders || !cv.folders.length) continue;
          const cGroup = document.createElement('optgroup');
          cGroup.label = `🏢 ${cv.name} (Company Vault)`;
          for (const f of cv.folders) {
            const opt = document.createElement('option');
            opt.value = `company:${cv.id}:${f.id}`;
            opt.textContent = `🏢 ${f.name}`;
            const isTarget =
              (isUpdate &&
                pending.existingVaultType === 'COMPANY' &&
                pending.existingFolderId &&
                f.id === pending.existingFolderId) ||
              (!isUpdate &&
                pending.suggestedVaultType === 'COMPANY' &&
                pending.suggestedFolderId &&
                f.id === pending.suggestedFolderId);
            if (isTarget) {
              opt.selected = true;
            }
            cGroup.appendChild(opt);
          }
          selectEl.appendChild(cGroup);
        }

        $('btnDismissPending')?.addEventListener('click', () => {
          cardEl.style.display = 'none';
          chrome.runtime.sendMessage({
            type: 'VAULTIX_DISMISS_PENDING',
            hostname: pending.hostname,
          });
        });

        $('btnSavePending')?.addEventListener('click', () => {
          const btn = $('btnSavePending');
          btn.disabled = true;
          btn.textContent = 'Saving…';

          const rawChoice = selectEl.value || 'personal:__DEFAULT_BROWSER_FOLDER__';
          let vaultType = 'PERSONAL';
          let companyVaultId = '';
          let targetFolderId = '';

          if (rawChoice.startsWith('company:')) {
            vaultType = 'COMPANY';
            const parts = rawChoice.split(':');
            companyVaultId = parts[1] || '';
            targetFolderId = parts[2] || '';
          } else {
            const parts = rawChoice.split(':');
            targetFolderId = parts[1] || '';
          }

          chrome.runtime.sendMessage(
            {
              type: 'VAULTIX_SAVE_LOGIN',
              mode: pending.mode,
              existingId: pending.existingId,
              name: pending.name,
              username: pending.username,
              password: pending.password,
              url: pending.url,
              hostname: pending.hostname,
              vaultType,
              companyVaultId,
              folderId: targetFolderId,
            },
            async (saveResp) => {
              if (chrome.runtime.lastError || !saveResp || !saveResp.ok) {
                btn.disabled = false;
                btn.textContent = isUpdate ? 'Update Password' : 'Save Login';
                flash(saveResp?.error || 'Could not save login');
                return;
              }
              cardEl.style.display = 'none';
              flash(`Saved in 📁 "${saveResp.folderName || defaultFolderName}"`);
              await loadCreds(true);
            }
          );
        });
      }
    );
  } catch {
    cardEl.style.display = 'none';
  }
}

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
    return new URL(entryUrl.includes('://') ? entryUrl : `https://${entryUrl}`).hostname.replace(
      /^www\./,
      ''
    );
  } catch {
    return '';
  }
}

function matchesSite(cred) {
  if (!tabHost) return false;
  const credHost = urlHost(cred.url);
  return (
    !!credHost &&
    (credHost === tabHost ||
      credHost.endsWith(`.${tabHost}`) ||
      tabHost.endsWith(`.${credHost}`))
  );
}

function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const listEl = $('list');
  listEl.innerHTML = '';

  const matched = creds.filter(matchesSite);
  const others = creds.filter((c) => !matched.includes(c));
  const filtered = (c) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.login.toLowerCase().includes(q) ||
    (c.folderName && c.folderName.toLowerCase().includes(q)) ||
    (c.vaultName && c.vaultName.toLowerCase().includes(q)) ||
    urlHost(c.url).includes(q);

  const showEverything = !tabHost || showAllSites || !!q;
  const sections = [
    { title: tabHost ? 'For this site' : 'All items', items: matched.filter(filtered), match: true },
    ...(showEverything
      ? [{ title: 'Everything else', items: others.filter(filtered), match: false }]
      : []),
  ];

  let shown = 0;
  for (const section of sections) {
    if (!section.items.length) continue;
    if (section.title === 'Everything else' && matched.length) {
      const head = document.createElement('div');
      head.className = 'empty';
      head.style.padding = '10px 0 4px';
      head.textContent = '— Everything else —';
      listEl.appendChild(head);
    }
    for (const cred of section.items) {
      listEl.appendChild(itemRow(cred, section.match));
      shown++;
    }
  }

  if (!shown) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = tabHost && !showEverything
      ? 'No logins saved for this site.'
      : creds.length
        ? 'No items match your search.'
        : 'No logins found. Add passwords in the web vault first.';
    listEl.appendChild(empty);
  }
}

function itemRow(cred, isMatch) {
  const row = document.createElement('div');
  row.className = `item${isMatch ? ' matched' : ''}`;

  const row1 = document.createElement('div');
  row1.className = 'row1';

  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = cred.name + (cred.shared ? ' (shared)' : '');
  row1.appendChild(name);

  if (isMatch) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'SITE MATCH';
    row1.appendChild(badge);
  }

  // Folder and Vault metadata pills
  const metaElements = [];
  if (cred.folderName) {
    metaElements.push(makeFolderBadge(cred.folderName));
  }
  if (cred.vaultName && cred.vaultName !== 'Personal' && cred.vaultName !== 'My Vault') {
    metaElements.push(makeVaultBadge(cred.vaultName));
  }

  let metaLine = null;
  if (metaElements.length > 0) {
    metaLine = document.createElement('div');
    metaLine.className = 'folder-line';
    for (const el of metaElements) {
      metaLine.appendChild(el);
    }
  }

  const loginLine = document.createElement('div');
  loginLine.className = 'login';
  loginLine.textContent = cred.login || '(no username)';

  const passLine = document.createElement('div');
  passLine.className = 'pass';
  passLine.textContent = cred.password;
  passLine.style.display = 'none';

  const actions = document.createElement('div');
  actions.className = 'actions';

  const fillBtn = actionBtn('Fill', 'fill', () => doFill(cred));
  const copyUserBtn = actionBtn('Copy user', '', () => {
    copy(cred.login, 'Username copied');
  });
  const copyPassBtn = actionBtn('Copy pass', '', () => {
    copy(cred.password, 'Password copied');
    logUse(cred, 'copy');
  });
  let revealed = false;
  const showBtn = actionBtn('Show', '', () => {
    revealed = !revealed;
    passLine.style.display = revealed ? 'block' : 'none';
    showBtn.textContent = revealed ? 'Hide' : 'Show';
    if (revealed) logUse(cred, 'view');
  });
  actions.append(fillBtn, copyUserBtn, copyPassBtn, showBtn);

  if (cred.totpSecret) {
    generateTOTP(cred.totpSecret).then((totp) => {
      if (!totp) return;
      const otpBtn = actionBtn(`OTP ${totp.code}`, '', () => {
        copy(totp.code, 'TOTP code copied');
        logUse(cred, 'copy');
      });
      actions.appendChild(otpBtn);
    });
  }

  if (metaLine) {
    row.append(row1, metaLine, loginLine, passLine, actions);
  } else {
    row.append(row1, loginLine, passLine, actions);
  }
  return row;
}

function createSvgIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (type === 'folder') {
    svg.setAttribute('class', 'folder-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'
    );
    svg.appendChild(path);
  } else if (type === 'vault') {
    svg.setAttribute('class', 'vault-icon');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '7');
    rect.setAttribute('width', '20');
    rect.setAttribute('height', '14');
    rect.setAttribute('rx', '2');
    rect.setAttribute('ry', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16');

    svg.append(rect, path);
  }
  return svg;
}

function makeFolderBadge(folderName) {
  const badge = document.createElement('span');
  badge.className = 'folder-badge';
  badge.title = `Folder: ${folderName}`;

  const icon = createSvgIcon('folder');
  const text = document.createElement('span');
  text.className = 'folder-name';
  text.textContent = folderName;

  badge.append(icon, text);
  return badge;
}

function makeVaultBadge(vaultName) {
  const badge = document.createElement('span');
  badge.className = 'vault-badge';
  badge.title = `Vault: ${vaultName}`;

  const icon = createSvgIcon('vault');
  const text = document.createElement('span');
  text.className = 'vault-name';
  text.textContent = vaultName;

  badge.append(icon, text);
  return badge;
}

function actionBtn(label, cls, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  if (cls) b.className = cls;
  b.addEventListener('click', onClick);
  return b;
}

async function doFill(cred) {
  try {
    const results = await chrome.tabs.sendMessage(tab.id, {
      type: 'VAULTIX_FILL',
      username: cred.login,
      password: cred.password,
    });
    const ok = Array.isArray(results) ? results.some((r) => r && r.ok) : results?.ok;
    if (ok) logUse(cred, 'autofill');
    flash(ok ? `Filled → ${cred.name}` : 'No login form found on this page');
  } catch {
    flash('Reload the page once, then try Fill again');
  }
}

function logUse(cred, action = 'copy') {
  try {
    chrome.runtime.sendMessage(
      { type: 'VAULTIX_LOG', passwordId: cred.id, action },
      () => {
        void chrome.runtime.lastError;
      }
    );
  } catch {
    /* logging is best-effort */
  }
}

async function copy(text, message) {
  if (!text) return;
  await navigator.clipboard.writeText(text);
  flash(message);
}

let flashTimer = null;
function flash(message) {
  let el = $('flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flash';
    el.style.cssText =
      'position:fixed;bottom:38px;left:14px;right:14px;background:#4f46e5;color:#fff;' +
      'padding:7px 10px;border-radius:8px;font-size:12px;text-align:center;z-index:99;';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.display = 'block';
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => (el.style.display = 'none'), 1800);
}