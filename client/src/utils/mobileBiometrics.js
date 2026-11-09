import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType } from '@aparajita/capacitor-biometric-auth';

const BIOMETRIC_ENABLED_KEY = 'vaultix_biometric_enabled';
const BIOMETRIC_STORED_KEY = 'vaultix_bio_vault_key';

/**
 * Checks if the current runtime is a native mobile device (Android or iOS).
 */
export function isMobileNative() {
  return Capacitor.isNativePlatform();
}

/**
 * Returns the platform name ('ios', 'android', or 'web').
 */
export function getMobilePlatform() {
  return Capacitor.getPlatform();
}

/**
 * Inspects the native hardware for biometric support (Face ID, Touch ID, Fingerprint).
 */
export async function checkBiometricsAvailable() {
  if (!isMobileNative()) {
    return { available: false, type: 'none', label: 'None' };
  }

  try {
    const result = await BiometricAuth.checkBiometry();
    if (!result.isAvailable) {
      return { available: false, type: 'none', label: 'None', reason: result.reason };
    }

    let type = 'fingerprint';
    let label = 'Fingerprint';

    if (result.biometryType === BiometryType.faceId || result.biometryType === BiometryType.faceAuthentication) {
      type = 'faceId';
      label = getMobilePlatform() === 'ios' ? 'Face ID' : 'Face Unlock';
    } else if (result.biometryType === BiometryType.touchId) {
      type = 'touchId';
      label = 'Touch ID';
    }

    return {
      available: true,
      type,
      label,
      strong: result.strongBiometryIsAvailable,
    };
  } catch (error) {
    console.warn('Biometric check failed:', error);
    return { available: false, type: 'none', label: 'None' };
  }
}

/**
 * Prompts the user with native Face ID / Fingerprint prompt.
 */
export async function authenticateWithBiometrics(reason = 'Unlock your Vaultix vault') {
  if (!isMobileNative()) {
    return { success: false, error: 'Not on native mobile device' };
  }

  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Enter Master Password',
      androidTitle: 'Unlock Vaultix',
      androidSubtitle: reason,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err?.message || 'Biometric authentication cancelled' };
  }
}

/**
 * Enables and saves master credentials for biometric quick-unlock.
 */
export async function enableBiometricUnlock(masterPassword, userId) {
  if (!masterPassword || !userId) return false;
  try {
    localStorage.setItem(`${BIOMETRIC_ENABLED_KEY}_${userId}`, 'true');
    // Store obfuscated key tied to user profile
    const encoded = btoa(encodeURIComponent(masterPassword));
    localStorage.setItem(`${BIOMETRIC_STORED_KEY}_${userId}`, encoded);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if biometric unlock is enabled for a given user.
 */
export function isBiometricUnlockEnabled(userId) {
  if (!isMobileNative() || !userId) return false;
  return localStorage.getItem(`${BIOMETRIC_ENABLED_KEY}_${userId}`) === 'true';
}

/**
 * Authenticates with biometrics and unlocks the master password.
 */
export async function unlockWithBiometrics(userId) {
  if (!isBiometricUnlockEnabled(userId)) {
    return { success: false, error: 'Biometric unlock is not enabled' };
  }

  const bioResult = await authenticateWithBiometrics('Unlock your Vaultix vault');
  if (!bioResult.success) {
    return bioResult;
  }

  try {
    const raw = localStorage.getItem(`${BIOMETRIC_STORED_KEY}_${userId}`);
    if (!raw) {
      return { success: false, error: 'No stored credentials found' };
    }
    const masterPassword = decodeURIComponent(atob(raw));
    return { success: true, masterPassword };
  } catch (err) {
    return { success: false, error: 'Failed to retrieve vault key' };
  }
}

/**
 * Disables and deletes biometric unlock data for a user.
 */
export function disableBiometricUnlock(userId) {
  if (!userId) return;
  localStorage.removeItem(`${BIOMETRIC_ENABLED_KEY}_${userId}`);
  localStorage.removeItem(`${BIOMETRIC_STORED_KEY}_${userId}`);
}
