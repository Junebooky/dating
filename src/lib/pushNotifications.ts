type AccountProfile = 'boyfriend' | 'girlfriend';

export type PushNotificationStatus =
  | 'default'
  | 'denied'
  | 'error'
  | 'loading'
  | 'missing-key'
  | 'subscribed'
  | 'unsupported';

interface RegisterPushOptions {
  profile: AccountProfile;
  token: string;
  username: string;
}

interface NotifyPushOptions {
  actorProfile: AccountProfile;
  actorUsername?: string;
  body: string;
  tag?: string;
  targetProfiles?: AccountProfile[];
  title: string;
  type: string;
  url?: string;
}

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export function getInitialPushNotificationStatus(): PushNotificationStatus {
  if (typeof window === 'undefined') {
    return 'unsupported';
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  if (!vapidPublicKey) {
    return 'missing-key';
  }

  if (Notification.permission === 'granted') {
    return 'default';
  }

  return Notification.permission === 'denied' ? 'denied' : 'default';
}

export function getPushNotificationStatusText(status: PushNotificationStatus) {
  if (status === 'subscribed') {
    return '푸시 알림이 켜져 있습니다.';
  }

  if (status === 'denied') {
    return '브라우저 설정에서 알림 허용이 필요합니다.';
  }

  if (status === 'missing-key') {
    return 'VAPID 공개 키 설정이 필요합니다.';
  }

  if (status === 'unsupported') {
    return '이 브라우저는 푸시 알림을 지원하지 않습니다.';
  }

  if (status === 'loading') {
    return '푸시 알림을 설정하는 중입니다.';
  }

  if (status === 'error') {
    return '푸시 알림 설정에 실패했습니다.';
  }

  return '일정, 러브온도, 버킷리스트 업데이트를 알려드립니다.';
}

export async function registerPushSubscription({ profile, token, username }: RegisterPushOptions) {
  if (!vapidPublicKey) {
    throw new Error('Missing VAPID public key.');
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    throw new Error('Push notification is not supported.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  const readyRegistration = await navigator.serviceWorker.ready;
  const existingSubscription = await readyRegistration.pushManager.getSubscription();
  const subscription =
    existingSubscription ??
    (await readyRegistration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      userVisibleOnly: true,
    }));

  const response = await fetch('/api/push/subscribe', {
    body: JSON.stringify({
      profile,
      subscription: subscription.toJSON(),
      username,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Push subscription save failed.');
  }

  await registration.update();
}

export async function notifyPushUpdate(payload: NotifyPushOptions, token: string | null) {
  if (!token) {
    return;
  }

  try {
    await fetch('/api/push/notify', {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
  } catch (error) {
    console.warn('Push notification request failed', error);
  }
}
