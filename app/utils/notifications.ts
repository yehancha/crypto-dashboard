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
 * Shows a system notification
 * @param title The notification title
 * @param options Optional notification options (body, icon, tag, etc.)
 * @returns The Notification object, or null if permission is not granted
 */
export function showNotification(
  title: string,
  options?: NotificationOptions
): Notification | null {
  if (!isNotificationSupported() || typeof window === 'undefined') {
    return null;
  }

  if (Notification.permission !== 'granted') {
    return null;
  }

  // Note: Sound is controlled by OS/browser settings, not by Notification API
  return new Notification(title, options);
}
