import {
  encryptText,
  estimateStrength,
  decryptPrivateKey,
  generateItemAesKey,
  encryptValueWithAesKey,
  wrapItemKey,
} from './lib/crypto.js';
import { apiGet, apiPost, apiPut, apiRefresh } from './lib/api.js';

const DEFAULT_URL = 'https://vaultix.knadvisors.pro';
const DEFAULT_LOCK_MS = 8 * 60 * 60 * 1000; // 8 hours (workday default)
const DEFAULT_BROWSER_FOLDER = 'Saved from Browser';
const PENDING_TTL_MS = 3 * 60 * 1000;

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

async function lockMs() {
  try {
    const config = await getVaultTimeoutConfig();
    return config.ms;
  } catch {
    return DEFAULT_LOCK_MS;
  }
}

async function getBaseUrl() {
  const sync = await chrome.storage.sync.get('baseUrl');
  let rawBaseUrl = sync.baseUrl;
  if (!rawBaseUrl || rawBaseUrl === 'http://localhost:4000') {
    rawBaseUrl = DEFAULT_URL;
  }
  return rawBaseUrl.replace(/\/+$/, '');
}

async function getAuthContext() {
  const baseUrl = await getBaseUrl();
  const local = await chrome.storage.local.get(['token', 'refreshToken', 'user']);
  return {
    baseUrl,
    token: local.token || '',
    refreshToken: local.refreshToken || '',
    user: local.user || null,
  };
}

async function tryRefreshSession(baseUrl, refreshToken) {
  if (!refreshToken) return null;
  try {
    const ref = await apiRefresh(baseUrl, refreshToken);
    if (ref.token && ref.refreshToken) {
      const updates = { token: ref.token, refreshToken: ref.refreshToken };
      if (ref.user) updates.user = ref.user;
      await chrome.storage.local.set(updates);
      return updates;
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function bgGet(path) {
  const ctx = await getAuthContext();
  if (!ctx.token) throw new Error('NOT_SIGNED_IN');
  try {
    return await apiGet(ctx.baseUrl, path, ctx.token);
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      const refreshed = await tryRefreshSession(ctx.baseUrl, ctx.refreshToken);
      if (refreshed?.token) {
        return await apiGet(ctx.baseUrl, path, refreshed.token);
      }
    }
    throw err;
  }
}

async function bgPost(path, body) {
  const ctx = await getAuthContext();
  if (!ctx.token) throw new Error('NOT_SIGNED_IN');
  try {
    return await apiPost(ctx.baseUrl, path, ctx.token, body);
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      const refreshed = await tryRefreshSession(ctx.baseUrl, ctx.refreshToken);
      if (refreshed?.token) {
        return await apiPost(ctx.baseUrl, path, refreshed.token, body);
      }
    }
    throw err;
  }
}

async function bgPut(path, body) {
  const ctx = await getAuthContext();
  if (!ctx.token) throw new Error('NOT_SIGNED_IN');
  try {
    return await apiPut(ctx.baseUrl, path, ctx.token, body);
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      const refreshed = await tryRefreshSession(ctx.baseUrl, ctx.refreshToken);
      if (refreshed?.token) {
        return await apiPut(ctx.baseUrl, path, refreshed.token, body);
      }
    }
    throw err;
  }
}

function cleanSiteTitle(hostname) {
  if (!hostname) return 'Website Login';
  const stripped = hostname.replace(/^(www|auth|login|signin|account|accounts|my|app|portal|hpanel)\./i, '');
  const base = stripped.split('.')[0] || hostname;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function canUserWriteCompanyFolder(folder, user) {
  if (!user) return false;
  if (['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return true;

  // Explicit block or forbidden takes precedence
  const blocked = Array.isArray(folder?.blockedUserIds) ? folder.blockedUserIds : [];
  if (blocked.includes(user.id)) return false;

  const direct = Array.isArray(folder?.permissions)
    ? folder.permissions.find((p) => (p.userId || p.user?.id) === user.id)
    : null;
  if (direct?.accessLevel === 'FORBIDDEN') return false;

  const WRITABLE = new Set(['READ_WRITE', 'FULL_ACCESS', 'ADMINISTRATOR']);
  if (direct && WRITABLE.has(direct.accessLevel)) return true;

  const dept = Array.isArray(folder?.departmentMembers)
    ? folder.departmentMembers.find((dm) => (dm.userId || dm.user?.id) === user.id)
    : null;
  if (dept && WRITABLE.has(dept.accessLevel)) return true;

  return false;
}

function evaluateAgainstCache(creds, hostname, username, password) {
  if (!Array.isArray(creds) || !creds.length || !hostname) {
    return { status: 'NEW' };
  }
  const siteMatches = creds.filter((c) => hostMatches(hostname, c.url));
  if (!siteMatches.length) {
    return { status: 'NEW' };
  }

  const normUser = (username || '').trim().toLowerCase();

  // Find if site matches any existing company vault item (for smart folder pre-selection)
  const companyMatch = siteMatches.find(
    (c) => c.shared || (c.vaultName && c.vaultName !== 'Personal' && c.vaultName !== 'My Vault')
  );
  const suggestion = {
    suggestedVaultType: companyMatch ? 'COMPANY' : 'PERSONAL',
    suggestedVaultId: companyMatch?.vaultId || '',
    suggestedVaultName: companyMatch?.vaultName || '',
    suggestedFolderId: companyMatch?.folderId || '',
    suggestedFolderName: companyMatch?.folderName || '',
  };

  // 1. Check if an exact match (same username + same password) already exists
  const exactMatch = siteMatches.find((c) => {
    const cUser = (c.login || '').trim().toLowerCase();
    return cUser === normUser && c.password === password;
  });
  if (exactMatch) {
    return { status: 'EXISTS', item: exactMatch, ...suggestion };
  }

  // 2. Check if the same username exists in Personal or Company Vault with a different password
  const userMatch = siteMatches.find((c) => {
    const cUser = (c.login || '').trim().toLowerCase();
    return normUser && cUser === normUser && c.password !== password;
  });
  if (userMatch) {
    const isPersonal =
      !userMatch.shared &&
      (!userMatch.vaultName ||
        userMatch.vaultName === 'Personal' ||
        userMatch.vaultName === 'My Vault');
    return {
      status: 'UPDATE',
      existingId: userMatch.id,
      existingName: userMatch.name,
      existingVaultType: isPersonal ? 'PERSONAL' : 'COMPANY',
      existingVaultId: userMatch.vaultId || '',
      existingVaultName: userMatch.vaultName || '',
      existingFolderId: userMatch.folderId || '',
      existingFolderName: userMatch.folderName || '',
      ...suggestion,
    };
  }

  return { status: 'NEW', ...suggestion };
}

async function fetchAvailableVaultFolders(user) {
  let personalFolders = [];
  let companyVaults = [];
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  try {
    const mine = await bgGet('/my-vault');
    if (Array.isArray(mine?.folders)) {
      personalFolders = mine.folders.map((f) => ({ id: f.id, name: f.name }));
    }
  } catch {
    /* ignore */
  }

  try {
    const vaults = await bgGet('/vaults');
    const nonPersonal = (Array.isArray(vaults) ? vaults : []).filter(
      (v) => v.type !== 'PERSONAL'
    );
    for (const v of nonPersonal) {
      const writableFolders = (Array.isArray(v.folders) ? v.folders : [])
        .filter((f) => canUserWriteCompanyFolder(f, user))
        .map((f) => ({ id: f.id, name: f.name, vaultId: v.id, vaultName: v.name }));

      if (writableFolders.length > 0 || isAdmin) {
        companyVaults.push({
          id: v.id,
          name: v.name || 'Company Vault',
          canCreateFolder: isAdmin,
          folders: writableFolders,
        });
      }
    }
  } catch {
    /* ignore */
  }

  return { personalFolders, companyVaults };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;

  // 1. Host-filtered credentials for autofill
  if (msg.type === 'VAULTIX_GET_CREDS') {
    (async () => {
      try {
        const data = await chrome.storage.session.get('cache');
        const cache = data.cache;
        const maxAge = await lockMs();

        if (!cache || (maxAge !== Infinity && Date.now() - cache.ts >= maxAge)) {
          sendResponse({ ok: true, creds: [] });
          return;
        }

        // Slide activity window on successful autofill request
        cache.ts = Date.now();
        chrome.storage.session.set({ cache }).catch(() => {});

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

  // 2. Capture login form submission candidate
  if (msg.type === 'VAULTIX_CAPTURE_LOGIN') {
    (async () => {
      try {
        const tabUrl = sender.tab?.url || msg.url || '';
        const hostname = hostOf(tabUrl) || hostOf(msg.url || '');
        const password = msg.password || '';
        const username = (msg.username || '').trim();

        if (!hostname || !password) {
          sendResponse({ ok: false, reason: 'missing-data' });
          return;
        }

        // Ignore Vaultix web app itself so unlocking Vaultix doesn't prompt to save Vaultix master password
        const baseUrl = await getBaseUrl();
        const vaultixHost = hostOf(baseUrl);
        if (vaultixHost && hostname === vaultixHost && msg.isVaultixOwnApp) {
          sendResponse({ ok: false, reason: 'own-app' });
          return;
        }

        const { neverSaveHosts = [] } = await chrome.storage.local.get('neverSaveHosts');
        if (Array.isArray(neverSaveHosts) && neverSaveHosts.includes(hostname)) {
          sendResponse({ ok: true, status: 'BLOCKED' });
          return;
        }

        const sess = await chrome.storage.session.get(['cache', 'master']);
        const maxAge = await lockMs();
        const cacheValid =
          sess.master && sess.cache && (maxAge === Infinity || Date.now() - sess.cache.ts < maxAge);
        const creds = cacheValid ? sess.cache.creds || [] : [];

        const evalResult = evaluateAgainstCache(creds, hostname, username, password);
        if (evalResult.status === 'EXISTS') {
          await chrome.storage.session.remove('pendingLogin');
          sendResponse({ ok: true, status: 'EXISTS' });
          return;
        }

        let originUrl = msg.url || tabUrl;
        let sourcePath = '';
        try {
          const parsedUrl = new URL(originUrl);
          originUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
          sourcePath = parsedUrl.pathname || '';
        } catch {
          originUrl = `https://${hostname}`;
        }

        const pendingLogin = {
          mode: evalResult.status, // 'NEW' or 'UPDATE'
          existingId: evalResult.existingId || null,
          existingVaultType: evalResult.existingVaultType || 'PERSONAL',
          existingVaultId: evalResult.existingVaultId || '',
          existingVaultName: evalResult.existingVaultName || '',
          existingFolderId: evalResult.existingFolderId || '',
          existingFolderName: evalResult.existingFolderName || '',
          suggestedVaultType: evalResult.suggestedVaultType || (evalResult.existingVaultType || 'PERSONAL'),
          suggestedVaultId: evalResult.suggestedVaultId || evalResult.existingVaultId || '',
          suggestedVaultName: evalResult.suggestedVaultName || evalResult.existingVaultName || '',
          suggestedFolderId: evalResult.suggestedFolderId || evalResult.existingFolderId || '',
          suggestedFolderName: evalResult.suggestedFolderName || evalResult.existingFolderName || '',
          name: evalResult.existingName || msg.title || cleanSiteTitle(hostname),
          username,
          password,
          url: originUrl,
          sourceUrl: msg.sourceUrl || tabUrl || msg.url || '',
          sourcePath,
          hostname,
          hasPrompted: false,
          ts: Date.now(),
        };

        await chrome.storage.session.set({ pendingLogin });
        sendResponse({ ok: true, status: pendingLogin.mode, pending: pendingLogin });
      } catch (err) {
        sendResponse({ ok: false, error: err?.message || 'capture-failed' });
      }
    })();
    return true;
  }

  // 3. Check if there is a pending login to prompt the user about
  if (msg.type === 'VAULTIX_CHECK_PENDING_LOGIN') {
    (async () => {
      try {
        const sess = await chrome.storage.session.get(['pendingLogin', 'cache', 'master']);
        const pending = sess.pendingLogin;

        if (!pending || Date.now() - pending.ts > PENDING_TTL_MS) {
          if (pending) await chrome.storage.session.remove('pendingLogin');
          sendResponse({ ok: true, pending: null });
          return;
        }

        // ONE-TIME ONLY: If this pending login was already prompted to the user on a web page,
        // do not prompt again (unless opened explicitly from the extension popup)
        if (!msg.fromPopup && pending.hasPrompted) {
          sendResponse({ ok: true, pending: null });
          return;
        }

        const tabHost = hostOf(sender.tab?.url || msg.tabUrl || '');
        const isRecentRedirect = Date.now() - pending.ts < 45 * 1000;
        const sameSite =
          !tabHost ||
          hostMatches(tabHost, pending.url) ||
          hostMatches(tabHost, `https://${pending.hostname}`) ||
          isRecentRedirect;

        if (!sameSite && !msg.fromPopup) {
          sendResponse({ ok: true, pending: null });
          return;
        }

        const { neverSaveHosts = [], token, user } = await chrome.storage.local.get([
          'neverSaveHosts',
          'token',
          'user',
        ]);
        if (Array.isArray(neverSaveHosts) && neverSaveHosts.includes(pending.hostname)) {
          await chrome.storage.session.remove('pendingLogin');
          sendResponse({ ok: true, pending: null });
          return;
        }

        const maxAge = await lockMs();
        const unlocked =
          !!sess.master &&
          (!sess.cache || maxAge === Infinity || Date.now() - sess.cache.ts < maxAge);

        // Re-check against decrypted cache if available
        if (unlocked && sess.cache?.creds) {
          const evalResult = evaluateAgainstCache(
            sess.cache.creds,
            pending.hostname,
            pending.username,
            pending.password
          );
          if (evalResult.status === 'EXISTS') {
            await chrome.storage.session.remove('pendingLogin');
            sendResponse({ ok: true, pending: null });
            return;
          }
          if (evalResult.status === 'UPDATE') {
            pending.mode = 'UPDATE';
            pending.existingId = evalResult.existingId;
            pending.existingVaultType = evalResult.existingVaultType || 'PERSONAL';
            pending.existingVaultId = evalResult.existingVaultId || '';
            pending.existingVaultName = evalResult.existingVaultName || '';
            pending.existingFolderId = evalResult.existingFolderId || '';
            pending.existingFolderName = evalResult.existingFolderName || '';
            if (evalResult.existingName) pending.name = evalResult.existingName;
            await chrome.storage.session.set({ pendingLogin: pending });
          } else if (evalResult.status === 'NEW' && evalResult.suggestedVaultType) {
            pending.suggestedVaultType = evalResult.suggestedVaultType;
            pending.suggestedVaultId = evalResult.suggestedVaultId || '';
            pending.suggestedVaultName = evalResult.suggestedVaultName || '';
            pending.suggestedFolderId = evalResult.suggestedFolderId || '';
            pending.suggestedFolderName = evalResult.suggestedFolderName || '';
            await chrome.storage.session.set({ pendingLogin: pending });
          }
        }

        let folders = sess.cache?.folders || [];
        let companyVaults = sess.cache?.companyVaults || [];

        if (
          token &&
          (!Array.isArray(folders) ||
            folders.length === 0 ||
            !Array.isArray( sess.cache?.companyVaults ))
        ) {
          const fetched = await fetchAvailableVaultFolders(user);
          folders = fetched.personalFolders;
          companyVaults = fetched.companyVaults;
          if (sess.cache) {
            sess.cache.folders = folders;
            sess.cache.companyVaults = companyVaults;
            await chrome.storage.session.set({ cache: sess.cache });
          }
        }

        if (!msg.fromPopup) {
          pending.hasPrompted = true;
          await chrome.storage.session.set({ pendingLogin: pending });
        }

        sendResponse({
          ok: true,
          pending,
          signedIn: !!token,
          unlocked: !!sess.master,
          folders,
          companyVaults,
          defaultFolderName: DEFAULT_BROWSER_FOLDER,
        });
      } catch {
        sendResponse({ ok: true, pending: null });
      }
    })();
    return true;
  }

  // 3b. Reset prompted status (e.g. if page is waiting on 2FA or in-flight login)
  if (msg.type === 'VAULTIX_RESET_PROMPTED') {
    (async () => {
      try {
        const sess = await chrome.storage.session.get('pendingLogin');
        if (sess.pendingLogin) {
          sess.pendingLogin.hasPrompted = false;
          await chrome.storage.session.set({ pendingLogin: sess.pendingLogin });
        }
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  // 4. Dismiss pending login or block site
  if (msg.type === 'VAULTIX_DISMISS_PENDING') {
    (async () => {
      try {
        const sess = await chrome.storage.session.get('pendingLogin');
        const hostToBlock = msg.hostname || sess.pendingLogin?.hostname;
        await chrome.storage.session.remove('pendingLogin');

        if (msg.neverForSite && hostToBlock) {
          const { neverSaveHosts = [] } = await chrome.storage.local.get('neverSaveHosts');
          if (!neverSaveHosts.includes(hostToBlock)) {
            neverSaveHosts.push(hostToBlock);
            await chrome.storage.local.set({ neverSaveHosts });
          }
        }
        sendResponse({ ok: true });
      } catch {
        sendResponse({ ok: false });
      }
    })();
    return true;
  }

  // 5. Save or Update login in Personal Vault OR Company Vault with Zero-Knowledge Encryption
  if (msg.type === 'VAULTIX_SAVE_LOGIN') {
    (async () => {
      try {
        const ctx = await getAuthContext();
        if (!ctx.token) {
          sendResponse({
            ok: false,
            reason: 'NOT_SIGNED_IN',
            error: 'Sign in to the Vaultix extension first.',
          });
          return;
        }

        const sess = await chrome.storage.session.get([
          'master',
          'cache',
          'pendingLogin',
          'privKey',
        ]);
        let master = sess.master || '';

        // Allow unlocking directly from the Save Banner if masterPassword was provided
        if (!master && msg.masterPassword) {
          try {
            await bgPost('/auth/verify-master-password', {
              masterPassword: msg.masterPassword,
            });
            master = msg.masterPassword;
            await chrome.storage.session.set({ master });
          } catch (verifyErr) {
            sendResponse({
              ok: false,
              reason: 'INVALID_MASTER',
              error:
                verifyErr.message === 'Invalid master password'
                  ? 'Incorrect master password.'
                  : verifyErr.message || 'Could not verify master password.',
            });
            return;
          }
        }

        if (!master) {
          sendResponse({
            ok: false,
            reason: 'LOCKED',
            error: 'Enter your Master Password to encrypt and save this login.',
          });
          return;
        }

        let user = ctx.user;
        let salt = user?.encryptionSalt || '';
        if (!salt || !user?.id) {
          const me = await bgGet('/auth/me');
          if (me) {
            user = me;
            salt = me.encryptionSalt || '';
            await chrome.storage.local.set({ user: me });
          }
        }

        const itemName = (msg.name || sess.pendingLogin?.name || 'Website Login').trim();
        const loginUser = (msg.username ?? sess.pendingLogin?.username ?? '').trim();
        const plainPassword = msg.password || sess.pendingLogin?.password || '';
        const itemUrl = (msg.url || sess.pendingLogin?.url || '').trim();
        const mode = msg.mode || sess.pendingLogin?.mode || 'NEW';
        const existingId = msg.existingId || sess.pendingLogin?.existingId || null;
        const vaultType = msg.vaultType || 'PERSONAL';
        const companyVaultId = msg.companyVaultId || '';
        const requestedNewFolder = (msg.newFolderName || '').trim();

        if (!plainPassword) {
          sendResponse({ ok: false, error: 'Password cannot be empty.' });
          return;
        }

        const strengthScore = estimateStrength(plainPassword);
        const isWeak = strengthScore <= 2;

        // ─── CASE A: Save to Company Vault (RSA + Per-Item AES Key Wrapping) ───
        if (vaultType === 'COMPANY' && companyVaultId) {
          // 1. Fetch user's RSA keypair
          const kp = await bgGet('/keypair');
          if (!kp?.publicKey || !kp?.encryptedPrivateKey) {
            sendResponse({
              ok: false,
              error: 'Encryption keys are not initialized for Company Vault.',
            });
            return;
          }

          let privKey = sess.privKey || null;
          if (!privKey) {
            privKey = await decryptPrivateKey(
              kp.encryptedPrivateKey,
              master,
              kp.salt || salt
            );
            await chrome.storage.session.set({ privKey });
          }

          // 2. Resolve Company Vault & Folder
          const vaults = await bgGet('/vaults');
          const companyVault = (Array.isArray(vaults) ? vaults : []).find(
            (v) => v.id === companyVaultId
          );
          if (!companyVault) {
            sendResponse({ ok: false, error: 'Selected Company Vault was not found.' });
            return;
          }

          let targetFolderId = msg.folderId || '';
          let targetFolderName = '';
          const vFolders = Array.isArray(companyVault.folders) ? companyVault.folders : [];

          if (requestedNewFolder) {
            const found = vFolders.find(
              (f) => f.name.trim().toLowerCase() === requestedNewFolder.toLowerCase()
            );
            if (found) {
              targetFolderId = found.id;
              targetFolderName = found.name;
            } else {
              const created = await bgPost('/folders', {
                name: requestedNewFolder,
                vaultId: companyVaultId,
              });
              targetFolderId = created.id;
              targetFolderName = created.name;
            }
          } else {
            const found = vFolders.find((f) => f.id === targetFolderId);
            targetFolderName = found ? found.name : 'Folder';
          }

          if (!targetFolderId) {
            sendResponse({
              ok: false,
              error: 'Please select a Company Vault folder.',
            });
            return;
          }

          // 3. Encrypt password with a per-item AES key and wrap for all authorized users
          const { aesKeyJwk } = await generateItemAesKey();
          const encryptedPassword = await encryptValueWithAesKey(plainPassword, aesKeyJwk);

          const recipientIds = new Set(user?.id ? [user.id] : []);
          try {
            const recRes = await bgGet(`/folders/${targetFolderId}/wrap-recipients`);
            for (const uid of recRes?.userIds || []) {
              if (uid) recipientIds.add(uid);
            }
          } catch {
            /* fallback to self */
          }

          const wrappedKeys = {};
          for (const uid of recipientIds) {
            try {
              const pubRes = await bgGet(`/keypair/${uid}/public`);
              if (pubRes?.publicKey) {
                wrappedKeys[uid] = await wrapItemKey(aesKeyJwk, pubRes.publicKey);
              }
            } catch {
              /* skip unavailable recipient key */
            }
          }
          if (user?.id && !wrappedKeys[user.id] && kp.publicKey) {
            wrappedKeys[user.id] = await wrapItemKey(aesKeyJwk, kp.publicKey);
          }

          // 4. Create or Update in Company Vault
          const vaultPasswords = await bgGet(`/passwords/vault/${companyVaultId}`).catch(
            () => []
          );
          let savedEntry = null;

          if (
            mode === 'UPDATE' &&
            existingId &&
            Array.isArray(vaultPasswords) &&
            vaultPasswords.some((p) => p.id === existingId)
          ) {
            const existingItem = vaultPasswords.find((p) => p.id === existingId);
            savedEntry = await bgPut(`/passwords/${existingId}`, {
              name: itemName,
              parentId: existingItem?.parentId || null,
              type: 'LOGIN',
              login: loginUser,
              encryptedPassword,
              encryptedNote: '',
              encryptedFields: '',
              wrappedKeys,
              url: itemUrl,
              folderId: targetFolderId,
              tags: [],
              isSensitive: existingItem?.isSensitive ?? true,
              strengthScore,
              isWeak,
              isOld: false,
              isAtRisk: isWeak,
            });
          } else {
            const parentCandidate = (Array.isArray(vaultPasswords) ? vaultPasswords : []).find(
              (p) =>
                p.folderId === targetFolderId &&
                !p.parentId &&
                (p.name || '').trim().toLowerCase() === itemName.toLowerCase()
            );

            savedEntry = await bgPost('/passwords', {
              name: parentCandidate ? parentCandidate.name : itemName,
              parentId: parentCandidate ? parentCandidate.id : null,
              type: 'LOGIN',
              login: loginUser,
              encryptedPassword,
              encryptedNote: '',
              encryptedFields: '',
              wrappedKeys,
              url: itemUrl,
              vaultId: companyVaultId,
              folderId: targetFolderId,
              tags: [],
              isSensitive: true,
              strengthScore,
              isWeak,
              isOld: false,
              isAtRisk: isWeak,
            });
          }

          const currentCreds = Array.isArray(sess.cache?.creds) ? [...sess.cache.creds] : [];
          const newCredObj = {
            id: savedEntry.id,
            name: savedEntry.name || itemName,
            login: savedEntry.login || loginUser,
            url: savedEntry.url || itemUrl,
            vaultId: companyVaultId,
            vaultName: companyVault.name || 'Company Vault',
            folderId: targetFolderId,
            folderName: targetFolderName,
            password: plainPassword,
            totpSecret: null,
            shared: true,
          };

          const idx = currentCreds.findIndex((c) => c.id === savedEntry.id);
          if (idx >= 0) {
            currentCreds[idx] = newCredObj;
          } else {
            currentCreds.unshift(newCredObj);
          }

          const updatedFolders = await fetchAvailableVaultFolders(user);
          await chrome.storage.session.set({
            cache: {
              ts: Date.now(),
              creds: currentCreds,
              folders: updatedFolders.personalFolders,
              companyVaults: updatedFolders.companyVaults,
            },
          });
          await chrome.storage.session.remove('pendingLogin');

          sendResponse({
            ok: true,
            mode,
            vaultType: 'COMPANY',
            vaultName: companyVault.name || 'Company Vault',
            folderName: `${companyVault.name || 'Company Vault'} → ${targetFolderName}`,
            savedItem: newCredObj,
          });
          return;
        }

        // ─── CASE B: Save to Personal Vault (Default: "Saved from Browser") ───
        const mine = await bgGet('/my-vault');
        const folders = Array.isArray(mine?.folders) ? mine.folders : [];
        const passwords = Array.isArray(mine?.passwords) ? mine.passwords : [];

        let targetFolderId = msg.folderId || '';
        let targetFolderName = '';

        if (requestedNewFolder) {
          const found = folders.find(
            (f) => f.name.trim().toLowerCase() === requestedNewFolder.toLowerCase()
          );
          if (found) {
            targetFolderId = found.id;
            targetFolderName = found.name;
          } else {
            const created = await bgPost('/my-vault/folders', { name: requestedNewFolder });
            targetFolderId = created.id;
            targetFolderName = created.name;
            folders.push(created);
          }
        } else if (targetFolderId && targetFolderId !== '__DEFAULT_BROWSER_FOLDER__') {
          const found = folders.find((f) => f.id === targetFolderId);
          if (found) {
            targetFolderName = found.name;
          } else {
            targetFolderId = '';
          }
        }

        // Default to "Saved from Browser" (auto-created if it doesn't exist yet)
        if (!targetFolderId || targetFolderId === '__DEFAULT_BROWSER_FOLDER__') {
          const defaultFolder = folders.find(
            (f) => f.name.trim().toLowerCase() === DEFAULT_BROWSER_FOLDER.toLowerCase()
          );
          if (defaultFolder) {
            targetFolderId = defaultFolder.id;
            targetFolderName = defaultFolder.name;
          } else {
            const created = await bgPost('/my-vault/folders', {
              name: DEFAULT_BROWSER_FOLDER,
            });
            targetFolderId = created.id;
            targetFolderName = created.name;
            folders.push(created);
          }
        }

        const encryptedPassword = await encryptText(plainPassword, master, salt);

        let savedEntry = null;

        if (
          mode === 'UPDATE' &&
          existingId &&
          passwords.some((p) => p.id === existingId)
        ) {
          const existingItem = passwords.find((p) => p.id === existingId);
          savedEntry = await bgPut(`/my-vault/passwords/${existingId}`, {
            folderId: targetFolderId || existingItem?.folderId,
            parentId: existingItem?.parentId || null,
            type: 'LOGIN',
            name: itemName,
            login: loginUser,
            url: itemUrl,
            encryptedPassword,
            encryptedNote: existingItem?.encryptedNote || '',
            encryptedFields: existingItem?.encryptedFields || '',
            tags: Array.isArray(existingItem?.tags)
              ? existingItem.tags
                  .map((t) => (typeof t === 'string' ? t : t?.tag?.name))
                  .filter(Boolean)
              : [],
            isSensitive: existingItem?.isSensitive ?? true,
            strengthScore,
            isWeak,
            isOld: false,
            isAtRisk: isWeak,
          });
        } else {
          const parentCandidate = passwords.find(
            (p) =>
              p.folderId === targetFolderId &&
              !p.parentId &&
              (p.name || '').trim().toLowerCase() === itemName.toLowerCase()
          );

          savedEntry = await bgPost('/my-vault/passwords', {
            folderId: targetFolderId,
            parentId: parentCandidate ? parentCandidate.id : null,
            type: 'LOGIN',
            name: parentCandidate ? parentCandidate.name : itemName,
            login: loginUser,
            url: itemUrl,
            encryptedPassword,
            encryptedNote: '',
            encryptedFields: '',
            tags: [],
            isSensitive: true,
            strengthScore,
            isWeak,
            isOld: false,
            isAtRisk: isWeak,
          });
        }

        const currentCreds = Array.isArray(sess.cache?.creds) ? [...sess.cache.creds] : [];
        const newCredObj = {
          id: savedEntry.id,
          name: savedEntry.name || itemName,
          login: savedEntry.login || loginUser,
          url: savedEntry.url || itemUrl,
          folderId: targetFolderId,
          folderName: targetFolderName,
          vaultName: mine?.name || 'Personal',
          password: plainPassword,
          totpSecret: null,
          shared: false,
        };

        const idx = currentCreds.findIndex((c) => c.id === savedEntry.id);
        if (idx >= 0) {
          currentCreds[idx] = newCredObj;
        } else {
          currentCreds.unshift(newCredObj);
        }

        await chrome.storage.session.set({
          cache: {
            ts: Date.now(),
            creds: currentCreds,
            folders: folders.map((f) => ({ id: f.id, name: f.name })),
            companyVaults: sess.cache?.companyVaults || [],
          },
        });
        await chrome.storage.session.remove('pendingLogin');

        sendResponse({
          ok: true,
          mode,
          vaultType: 'PERSONAL',
          folderName: `Personal → ${targetFolderName}`,
          savedItem: newCredObj,
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error: err?.message || 'Failed to save login to Vaultix.',
        });
      }
    })();
    return true;
  }

  // 6. Log credential usage
  if (msg.type !== 'VAULTIX_LOG' || !msg.passwordId) return;

  (async () => {
    try {
      const baseUrl = await getBaseUrl();
      const local = await chrome.storage.local.get('token');

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