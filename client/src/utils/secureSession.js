/**
 * In-memory store and encrypted session manager for sensitive session data.
 * The master password is NEVER stored in plaintext in Web Storage.
 * Instead, an AES-256-GCM encrypted envelope bound to the user's active session token
 * is kept in sessionStorage to survive tab refresh without exposing credentials.
 */

const MASTER_VERIFIED_KEY = 'vaultix-master-verified';
const RSA_PRIVATE_KEY_KEY = 'vaultix-rsa-private-key';
const RSA_PUBLIC_KEY_KEY = 'vaultix-rsa-public-key';
const SESSION_MASTER_PASSWORD_KEY = 'vaultix-session-master-password';
const ENC_SESSION_STORAGE_KEY = 'vaultix-enc-session';

const store = {
  masterPassword: null,
  adminMasterPassword: null,
  rsaPrivateKey: null,
  rsaPublicKey: null,
  sessionMasterPassword: null,
  masterVerified: (() => {
    try {
      return sessionStorage.getItem(MASTER_VERIFIED_KEY) === 'true';
    } catch {
      return false;
    }
  })(),
};

// Ensure no legacy sensitive plaintext keys remain in Web Storage from previous versions
try {
  sessionStorage.removeItem(RSA_PRIVATE_KEY_KEY);
  sessionStorage.removeItem(RSA_PUBLIC_KEY_KEY);
  sessionStorage.removeItem(SESSION_MASTER_PASSWORD_KEY);
} catch {
  // ignore
}

async function getSessionCryptoKey() {
  const token = localStorage.getItem('token') || 'vaultix-ephemeral-session';
  const enc = new TextEncoder();
  const hash = await window.crypto.subtle.digest('SHA-256', enc.encode(token + ':vaultix-session-v1'));
  return window.crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function persistEncryptedSession(sessionMp, rsaPriv, rsaPub) {
  try {
    const mp = sessionMp !== undefined ? sessionMp : store.sessionMasterPassword;
    const priv = rsaPriv !== undefined ? rsaPriv : store.rsaPrivateKey;
    const pub = rsaPub !== undefined ? rsaPub : store.rsaPublicKey;

    if (!mp && !priv) {
      sessionStorage.removeItem(ENC_SESSION_STORAGE_KEY);
      return;
    }

    const key = await getSessionCryptoKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const payload = JSON.stringify({
      sessionMasterPassword: mp || null,
      rsaPrivateKey: priv || null,
      rsaPublicKey: pub || null,
    });
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(payload)
    );
    const envelope = JSON.stringify({
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(ciphertext)),
    });
    sessionStorage.setItem(ENC_SESSION_STORAGE_KEY, envelope);
    sessionStorage.setItem(MASTER_VERIFIED_KEY, 'true');
  } catch {
    // sessionStorage or crypto unavailable
  }
}

export async function restoreEncryptedSession() {
  try {
    const raw = sessionStorage.getItem(ENC_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.iv || !parsed.data) return null;
    const key = await getSessionCryptoKey();
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(parsed.iv) },
      key,
      new Uint8Array(parsed.data)
    );
    const session = JSON.parse(new TextDecoder().decode(plaintext));
    if (session.sessionMasterPassword) {
      store.sessionMasterPassword = session.sessionMasterPassword;
    }
    if (session.rsaPrivateKey) {
      store.rsaPrivateKey = session.rsaPrivateKey;
    }
    if (session.rsaPublicKey) {
      store.rsaPublicKey = session.rsaPublicKey;
    }
    store.masterVerified = true;
    return session;
  } catch {
    sessionStorage.removeItem(ENC_SESSION_STORAGE_KEY);
    return null;
  }
}

export function getMasterPassword() {
  return store.masterPassword;
}

export function setMasterPassword(value) {
  store.masterPassword = value || null;
}

export function getAdminMasterPassword() {
  return store.adminMasterPassword;
}

export function setAdminMasterPassword(value) {
  store.adminMasterPassword = value || null;
}

export function getRsaPrivateKey() {
  return store.rsaPrivateKey;
}

export function setRsaPrivateKey(value) {
  store.rsaPrivateKey = value || null;
}

export function getRsaPublicKey() {
  return store.rsaPublicKey;
}

export function setRsaPublicKey(value) {
  store.rsaPublicKey = value || null;
}

export function getSessionMasterPassword() {
  return store.sessionMasterPassword;
}

export function setSessionMasterPassword(value) {
  store.sessionMasterPassword = value || null;
}

export function isMasterVerified() {
  return store.masterVerified;
}

export function setMasterVerifiedFlag(value) {
  store.masterVerified = !!value;
  try {
    if (value) {
      sessionStorage.setItem(MASTER_VERIFIED_KEY, 'true');
    } else {
      sessionStorage.removeItem(MASTER_VERIFIED_KEY);
      sessionStorage.removeItem(ENC_SESSION_STORAGE_KEY);
    }
  } catch {
    // storage unavailable
  }
}

export function clearSecureSession() {
  store.masterPassword = null;
  store.adminMasterPassword = null;
  store.rsaPrivateKey = null;
  store.rsaPublicKey = null;
  store.sessionMasterPassword = null;
  store.masterVerified = false;
  try {
    sessionStorage.removeItem(MASTER_VERIFIED_KEY);
    sessionStorage.removeItem(ENC_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(RSA_PRIVATE_KEY_KEY);
    sessionStorage.removeItem(RSA_PUBLIC_KEY_KEY);
    sessionStorage.removeItem(SESSION_MASTER_PASSWORD_KEY);
  } catch {
    // ignore
  }
}

export function clearVerifierOnly() {
  try {
    sessionStorage.removeItem('masterPasswordVerifier');
  } catch {
    // ignore
  }
}
