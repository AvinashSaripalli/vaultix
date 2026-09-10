/**
 * In-memory store for sensitive session data.
 * RSA private key, verified flag, and session master password are persisted
 * in sessionStorage so they survive page refresh (cleared on tab close).
 */

const MASTER_VERIFIED_KEY = 'vaultix-master-verified';
const RSA_PRIVATE_KEY_KEY = 'vaultix-rsa-private-key';
const RSA_PUBLIC_KEY_KEY = 'vaultix-rsa-public-key';
const SESSION_MASTER_PASSWORD_KEY = 'vaultix-session-master-password';

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

// Restore RSA keys and session master password from sessionStorage on load.
try {
  const storedPrivateKey = sessionStorage.getItem(RSA_PRIVATE_KEY_KEY);
  if (storedPrivateKey) {
    store.rsaPrivateKey = JSON.parse(storedPrivateKey);
  }
  const storedPublicKey = sessionStorage.getItem(RSA_PUBLIC_KEY_KEY);
  if (storedPublicKey) {
    store.rsaPublicKey = JSON.parse(storedPublicKey);
  }
  const storedSessionMp = sessionStorage.getItem(SESSION_MASTER_PASSWORD_KEY);
  if (storedSessionMp) {
    store.sessionMasterPassword = storedSessionMp;
  }
} catch {
  // ignore
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
  try {
    if (value) {
      sessionStorage.setItem(RSA_PRIVATE_KEY_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(RSA_PRIVATE_KEY_KEY);
    }
  } catch {
    // ignore
  }
}

export function getRsaPublicKey() {
  return store.rsaPublicKey;
}

export function setRsaPublicKey(value) {
  store.rsaPublicKey = value || null;
  try {
    if (value) {
      sessionStorage.setItem(RSA_PUBLIC_KEY_KEY, JSON.stringify(value));
    } else {
      sessionStorage.removeItem(RSA_PUBLIC_KEY_KEY);
    }
  } catch {
    // ignore
  }
}

export function getSessionMasterPassword() {
  return store.sessionMasterPassword;
}

export function setSessionMasterPassword(value) {
  store.sessionMasterPassword = value || null;
  try {
    if (value) {
      sessionStorage.setItem(SESSION_MASTER_PASSWORD_KEY, value);
    } else {
      sessionStorage.removeItem(SESSION_MASTER_PASSWORD_KEY);
    }
  } catch {
    // ignore
  }
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
