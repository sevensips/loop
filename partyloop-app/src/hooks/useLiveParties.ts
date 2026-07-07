import { useEffect, useRef } from 'react';
import { WS_URL } from '../config';

type PartyEvent = { type: 'party:new' | 'party:updated' | 'party:deleted'; payload: unknown };

/**
 * Подключается к /ws бэкенда и дёргает onEvent при любом party:*-событии,
 * с автопереподключением при обрыве связи (например, телефон ушёл в сон).
 */
export function useLiveParties(onEvent: () => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByUnmount = false;

    function connect() {
      socket = new WebSocket(WS_URL);

      socket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data) as PartyEvent;
          if (data.type?.startsWith('party:')) onEventRef.current();
        } catch {
          // игнорируем сообщения, которые не парсятся (например, {type:'connected'})
        }
      };

      socket.onclose = () => {
        if (!closedByUnmount) reconnectTimer = setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    }

    connect();

    return () => {
      closedByUnmount = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);
}
