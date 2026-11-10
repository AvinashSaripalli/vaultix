import { Capacitor } from '@capacitor/core';

/**
 * Checks if the current environment is running on a mobile device:
 * either natively via Capacitor (Android/iOS) or within a mobile viewport (< 768px).
 */
export function isMobileDevice() {
  if (Capacitor.isNativePlatform()) return true;
  if (typeof window !== 'undefined' && window.innerWidth < 768) return true;
  return false;
}

/**
 * Returns 'ios' or 'android' for platform styling.
 */
export function getMobilePlatformStyle() {
  const cap = Capacitor.getPlatform();
  if (cap === 'ios' || cap === 'android') return cap;
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  }
  return 'android';
}
