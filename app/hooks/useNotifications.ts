import { useEffect, useState, useCallback } from 'react';
import {
  isNotificationSupported,
  requestNotificationPermission,
  getNotificationPermission,
  showNotification,
  type NotificationPermission as NotificationPermissionType,
} from '../utils/notifications';

export interface UseNotificationsReturn {
  permission: NotificationPermissionType | null;
  isSupported: boolean;
  notify: (title: string, options?: NotificationOptions) => void;
}

/**
 * Custom hook for managing browser notifications
 * Requests permission on mount if supported and permission is not yet determined
 * @returns Permission status, support status, and notification function
 */
export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermissionType | null>(null);
  const [isSupported] = useState<boolean>(isNotificationSupported());

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    // Get current permission status
    const currentPermission = getNotificationPermission();
    setPermission(currentPermission);

    // Request permission if not yet determined
    if (currentPermission === 'default') {
      requestNotificationPermission()
        .then((permissionStatus) => {
          setPermission(permissionStatus);
        })
        .catch((error) => {
          // Silently handle errors (e.g., user dismissed prompt)
          console.error('Failed to request notification permission:', error);
        });
    }
  }, [isSupported]);

  const notify = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (!isSupported || permission !== 'granted') {
        return;
      }
      showNotification(title, options);
    },
    [isSupported, permission]
  );

  return {
    permission,
    isSupported,
    notify,
  };
}
