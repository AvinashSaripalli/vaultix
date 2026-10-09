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
  } catch {
    // unable to persist the verifier - local fallback still applies
  }
}

export async function verifyMasterPassword(
  enteredPassword,
  salt,
  { verifier, samples = [] } = {}
) {
  const effectiveVerifier =
    verifier !== undefined
      ? verifier
      : (cachedVerifier || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(MASTER_VERIFIER_STORAGE_KEY) : null));

  const local = await verifyMasterPasswordLocally(enteredPassword, salt, {
    verifier: effectiveVerifier,
    samples,
  });

  if (local === true) {
    if (!effectiveVerifier) {
      await saveVerifier(enteredPassword, salt);
    }
    return true;
  }

  // A sample-based "false" is NOT definitive: owned items encrypted with
  // per-item AES keys can never validate locally. Only trust a negative
  // result when the cryptographic verifier exists.
  if (local === false && effectiveVerifier) {
    return false;
  }

  try {
    // Derive Zero-Knowledge AuthKey:
    const authKey = await deriveAuthKey(enteredPassword, salt);

    // Send zero-knowledge authKey with legacy masterPassword fallback for auto-migration
    await api.post(
      '/auth/verify-master-password',
      {
        authKey,
        masterPassword: enteredPassword,
      },
      { skipAuthRefresh: true }
    );
    await saveVerifier(enteredPassword, salt);
    return true;
  } catch {
    return false;
  }
}
