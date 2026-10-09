import api from '../services/api';
import {
  createMasterPasswordVerifier,
  verifyMasterPasswordLocally,
  deriveAuthKey,
  MASTER_VERIFIER_STORAGE_KEY,
} from './crypto';

// Keep verifier in memory
let cachedVerifier = null;

async function saveVerifier(masterPassword, salt) {
  try {
    cachedVerifier = await createMasterPasswordVerifier(masterPassword, salt);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(MASTER_VERIFIER_STORAGE_KEY, cachedVerifier);
    }
  } catch {
    // unable to persist the verifier - local fallback still applies
  }
}

export async function verifyMasterPassword(
  enteredPassword,
  salt,
  { verifier, samples = [] } = {}
) {
  let effectiveSalt = salt;
  if (!effectiveSalt && typeof localStorage !== 'undefined') {
    try {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      effectiveSalt = stored?.encryptionSalt || null;
    } catch {
      // ignore
    }
  }

  const effectiveVerifier =
    verifier !== undefined
      ? verifier
      : (cachedVerifier || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(MASTER_VERIFIER_STORAGE_KEY) : null));

  // If local check succeeds, accept immediately
  const local = await verifyMasterPasswordLocally(enteredPassword, effectiveSalt, {
    verifier: effectiveVerifier,
    samples,
  });

  if (local === true) {
    if (!effectiveVerifier) {
      await saveVerifier(enteredPassword, effectiveSalt);
    }
    return true;
  }

  // NOTE: If local is false, it might be due to a stale verifier from a previous master password.
  // We ALWAYS verify against the server to be certain.

  try {
    // 1. Primary zero-knowledge verification via derived authKey:
    const authKey = await deriveAuthKey(enteredPassword, effectiveSalt);

    await api.post(
      '/auth/verify-master-password',
      {
        authKey,
        masterPassword: enteredPassword,
      },
      { skipAuthRefresh: true }
    );
    await saveVerifier(enteredPassword, effectiveSalt);
    return true;
  } catch (err) {
    // 2. Salt mismatch fallback: if user's account was initialized with default salt
    if (effectiveSalt) {
      try {
        const defaultAuthKey = await deriveAuthKey(enteredPassword, null);
        await api.post(
          '/auth/verify-master-password',
          {
            authKey: defaultAuthKey,
            masterPassword: enteredPassword,
          },
          { skipAuthRefresh: true }
        );
        await saveVerifier(enteredPassword, effectiveSalt);
        return true;
      } catch {
        // server rejected both attempts
      }
    }
    return false;
  }
}
