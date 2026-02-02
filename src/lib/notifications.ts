import { notifications } from '@mantine/notifications';

type NotificationData = Parameters<typeof notifications.show>[0];

const THROTTLE_MS = 2000;
const recentNotifications = new Map<string, number>();

/**
 * Throttled notification wrapper to prevent toast stacking.
 * Same notification (based on title + message) won't show again within THROTTLE_MS.
 */
export const showNotification = (data: NotificationData) => {
  const key = `${data.title}-${data.message}`;
  const now = Date.now();
  const lastShown = recentNotifications.get(key) || 0;

  if (now - lastShown < THROTTLE_MS) return;

  recentNotifications.set(key, now);
  notifications.show(data);

  // Cleanup old entries to prevent memory leak
  if (recentNotifications.size > 20) {
    const cutoff = now - THROTTLE_MS * 2;
    for (const [k, v] of recentNotifications) {
      if (v < cutoff) recentNotifications.delete(k);
    }
  }
};
