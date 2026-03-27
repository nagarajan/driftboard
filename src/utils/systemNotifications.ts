let pendingPermissionRequest: Promise<NotificationPermission | 'unsupported'> | null = null;

function supportsSystemNotifications(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function canSendSystemNotifications(): boolean {
  return supportsSystemNotifications() && Notification.permission === 'granted';
}

export function requestSystemNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!supportsSystemNotifications()) {
    return Promise.resolve('unsupported');
  }

  if (Notification.permission !== 'default') {
    return Promise.resolve(Notification.permission);
  }

  if (!pendingPermissionRequest) {
    pendingPermissionRequest = Notification.requestPermission()
      .then((permission) => permission)
      .finally(() => {
        pendingPermissionRequest = null;
      });
  }

  return pendingPermissionRequest;
}

interface TaskUnsnoozedNotificationOptions {
  taskId: string;
  taskTitle: string;
  boardName?: string;
  swimlaneTitle?: string;
  unsnoozedAt?: number;
}

export function notifyTaskUnsnoozed({
  taskId,
  taskTitle,
  boardName,
  swimlaneTitle,
  unsnoozedAt = Date.now(),
}: TaskUnsnoozedNotificationOptions): boolean {
  if (!canSendSystemNotifications()) {
    return false;
  }

  const locationParts = [boardName, swimlaneTitle].filter(Boolean);
  const body = locationParts.length > 0 ? `Ready in ${locationParts.join(' / ')}` : 'Ready to work on again';
  const notification = new Notification('Task unsnoozed', {
    body: `${taskTitle} - ${body}`,
    tag: `task-unsnoozed-${taskId}-${unsnoozedAt}`,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  return true;
}
