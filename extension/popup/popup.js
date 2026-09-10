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

const DEFAULT_URL = 'http://localhost:4000';
const DEFAULT_LOCK_MS = 15 * 60 * 1000;

const $ = (id) => document.getElementById(id);

let baseUrl = '';
let token = '';
let refreshToken = '';
let user = null;
let creds = [];
let tab = null;
let tabHost = '';
let lockMs = DEFAULT_LOCK_MS;
let lockAt = 0;
let lockTimerId = null;
let showAllSites = false;

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
  baseUrl = (sync.baseUrl || DEFAULT_URL).replace(/\/+$/, '');

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
  lockMs = (Number(user?.vaultTimeoutMinutes) || 15) * 60 * 1000;

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabHost = hostOf(tab?.url || '');

  $('loginServer').textContent = baseUrl;
  $('lnkSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());
  $('lnkOpenVault').addEventListener('click', () => chrome.tabs.create({ url: baseUrl }));
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
    sess.master && sess.cache && Date.now() - sess.cache.ts < lockMs;

  if (token && user && cacheValid) {
    creds = sess.cache.creds;
    lockAt = sess.cache.ts + lockMs;
    showList();
    startLockTimer();
    if (creds.length === 0) {
      // A fresh-but-empty cache usually means a previous fetch/decrypt failed;
      // refetch in the background instead of showing a false "no logins".
      loadCreds(false);
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
  if (!refreshToken) return false;
  try {
    const ref = await apiRefresh(baseUrl, refreshToken);
    if (ref.token && ref.refreshToken) {
      token = ref.token;
      refreshToken = ref.refreshToken;
      if (ref.user) user = ref.user;
      lockMs = (Number(user?.vaultTimeoutMinutes) || 15) * 60 * 1000;
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
    lockMs = (Number(user?.vaultTimeoutMinutes) || 15) * 60 * 1000;
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
      Date.now() - cached.cache.ts < lockMs
    ) {
      creds = cached.cache.creds;
      lockAt = cached.cache.ts + lockMs;
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

    try {
      const mine = await secureGet('/my-vault');
      const list = mine?.passwords || [];
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
        entries.push({
          ...s.password,
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
        try {
          const vaultPasswords = await secureGet(`/passwords/vault/${vault.id}`);
          entries = entries.concat(vaultPasswords || []);
        } catch (err) {
          if (err.message === 'SESSION_EXPIRED') throw err;
          warnings.push(`${vault.name}: ${err.message}`);
        }
      }
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') throw err;
      warnings.push(`Company vaults: ${err.message}`);
    }

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
        password,
        totpSecret,
        shared: !!entry.shared,
      });
    }

    creds = decrypted;
    const now = Date.now();
    lockAt = now + lockMs;
    await chrome.storage.session.set({ cache: { ts: now, creds } });
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
  const tick = () => {
    const left = Math.max(0, lockAt - Date.now());
    if (left <= 0) {
      el.textContent = 'Auto-lock active';
      clearInterval(lockTimerId);
      return;
    }
    const secs = Math.floor(left / 1000);
    el.textContent = `Auto-lock ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(
      secs % 60
    ).padStart(2, '0')}`;
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

  renderList();
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
    logUse(cred);
  });
  const copyPassBtn = actionBtn('Copy pass', '', () => {
    copy(cred.password, 'Password copied');
    logUse(cred);
  });
  let revealed = false;
  const showBtn = actionBtn('Show', '', () => {
    revealed = !revealed;
    passLine.style.display = revealed ? 'block' : 'none';
    showBtn.textContent = revealed ? 'Hide' : 'Show';
    if (revealed) logUse(cred);
  });
  actions.append(fillBtn, copyUserBtn, copyPassBtn, showBtn);

  if (cred.totpSecret) {
    generateTOTP(cred.totpSecret).then((totp) => {
      if (!totp) return;
      const otpBtn = actionBtn(`OTP ${totp.code}`, '', () => {
        copy(totp.code, 'TOTP code copied');
        logUse(cred);
      });
      actions.appendChild(otpBtn);
    });
  }

  row.append(row1, loginLine, passLine, actions);
  return row;
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
    if (ok) logUse(cred);
    flash(ok ? `Filled → ${cred.name}` : 'No login form found on this page');
  } catch {
    flash('Reload the page once, then try Fill again');
  }
}

function logUse(cred) {
  try {
    chrome.runtime.sendMessage({ type: 'VAULTIX_LOG', passwordId: cred.id }, () => {
      void chrome.runtime.lastError;
    });
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