// Отправка push-уведомлений через Expo Push API.
// Никакого отдельного SDK не нужно — это обычный HTTP POST на сервер Expo,
// который сам разбирается, слать ли через FCM (Android) или APNs (iOS).
// Документация: https://docs.expo.dev/push-notifications/sending-notifications/

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// Токен из expo-notifications выглядит как "ExponentPushToken[xxxxxxxxxxxx]".
// Если в базе лежит что-то другое (например, пусто или битый токен) — не шлём зря.
function isExpoPushToken(token: string): boolean {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export async function sendPushNotification(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!token || !isExpoPushToken(token)) return;

  const message: PushMessage = { to: token, title, body, data };

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    if (!res.ok) {
      console.error('Expo push отклонён:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.error('Не удалось отправить push-уведомление:', err);
  }
}