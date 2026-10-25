import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Failure-safe wrapper around Capacitor Haptics with Web Vibration API fallback.
 * Works natively in the Android/iOS APK and in mobile browsers, and is a clean no-op on desktop.
 */
const safeHaptic = (fn: () => Promise<void>, fallbackMs: number | number[]) => {
  try {
    fn().catch(() => {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(fallbackMs);
      }
    });
  } catch {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(fallbackMs);
      } catch {
        // ignore
      }
    }
  }
};

export const hapticFX = {
  select: () => safeHaptic(() => Haptics.selectionStart(), 8),
  move: () => safeHaptic(() => Haptics.impact({ style: ImpactStyle.Light }), 14),
  capture: () =>
    safeHaptic(() => Haptics.impact({ style: ImpactStyle.Heavy }), [30, 40, 45]),
  superpower: () =>
    safeHaptic(
      () => Haptics.notification({ type: NotificationType.Success }),
      [20, 30, 60]
    ),
  treasure: () =>
    safeHaptic(
      () => Haptics.notification({ type: NotificationType.Success }),
      [15, 25, 35]
    ),
  check: () =>
    safeHaptic(
      () => Haptics.notification({ type: NotificationType.Warning }),
      [40, 50, 40]
    ),
  victory: () =>
    safeHaptic(
      () => Haptics.notification({ type: NotificationType.Success }),
      [50, 40, 50, 40, 90]
    ),
};
