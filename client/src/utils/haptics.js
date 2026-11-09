import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isMobileNative } from './mobileBiometrics';

/**
 * Fires a light haptic impact (ideal for tab clicks, button taps).
 */
export async function hapticLight() {
  if (!isMobileNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Ignore on unsupported platforms
  }
}

/**
 * Fires a medium haptic impact (ideal for copy password, save action).
 */
export async function hapticMedium() {
  if (!isMobileNative()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {
    // Ignore on unsupported platforms
  }
}

/**
 * Fires a success notification haptic pulse.
 */
export async function hapticSuccess() {
  if (!isMobileNative()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Ignore on unsupported platforms
  }
}
