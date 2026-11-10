import { Capacitor } from '@capacitor/core';

/**
 * Checks if the current environment is running on the native mobile app (Capacitor Android/iOS).
 * All web browser visits (both desktop and mobile phone browsers) will load the responsive Web Application.
 * For testing/development in a browser, visiting with `?view=mobile` will force the mobile app shell.
 */
export function isMobileDevice() {
  if (Capacitor.isNativePlatform()) return true;

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'mobile') return true;
  }

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
