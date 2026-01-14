/**
 * Checks if the browser supports notifications
 * @returns true if notifications are supported, false otherwise
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Gets the current notification permission status
 * @returns 'granted', 'denied', or 'default'
 */
export function getNotificationPermission(): NotificationPermission | null {
  if (!isNotificationSupported() || typeof window === 'undefined') {
    return null;
  }
  return Notification.permission;
}

/**
 * Requests notification permission from the user
 * @returns Promise that resolves to the permission status
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported() || typeof window === 'undefined') {
    throw new Error('Notifications are not supported in this browser');
  }

  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }

  return await Notification.requestPermission();
}

/**
 * Plays a notification sound using Web Audio API
 * @param beepCount Number of beeps to play (default: 3)
 */
function playNotificationSound(beepCount: number = 3): void {
  if (typeof window === 'undefined' || !window.AudioContext && !(window as any).webkitAudioContext) {
    return;
  }

  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();

    // Play beeps with 150ms delay between them
    const beepDuration = 0.1;
    const beepGap = 0.15;
    const baseTime = audioContext.currentTime;

    for (let i = 0; i < beepCount; i++) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Configure a pleasant notification sound (800Hz tone)
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      // Envelope: quick attack, short sustain, quick release
      const startTime = baseTime + i * (beepDuration + beepGap);
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + beepDuration);

      oscillator.start(startTime);
      oscillator.stop(startTime + beepDuration);
    }
  } catch (error) {
    // Silently fail if audio context cannot be created
    console.error('Failed to play notification sound:', error);
  }
}

/**
 * Shows a system notification
 * @param title The notification title
 * @param options Optional notification options (body, icon, tag, etc.)
 * @param beepCount Optional number of beeps to play (default: 3)
 * @returns The Notification object, or null if permission is not granted
 */
export function showNotification(
  title: string,
  options?: NotificationOptions,
  beepCount?: number
): Notification | null {
  if (!isNotificationSupported() || typeof window === 'undefined') {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  // Play notification sound with specified beep count
  playNotificationSound(beepCount ?? 3);

  return new Notification(title, options);
}
