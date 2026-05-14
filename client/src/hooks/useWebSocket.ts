import { useEffect, useRef } from 'react';
import { useStore } from '../store';

// Connects to /ws, sends auth, dispatches price + alert messages into the store.
// Reconnects with exponential backoff up to 30s.
export function useWebSocket() {
  const token = useStore((s) => s.token);
  const setConnectionStatus = useStore((s) => s.setConnectionStatus);
  const applyPrice = useStore((s) => s.applyPrice);
  const pushAlertToast = useStore((s) => s.pushAlertToast);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedByUs = useRef(false);

  useEffect(() => {
    closedByUs.current = false;
    let cancelled = false;
    let reconnectTimer: number | undefined;

    function connect() {
      if (cancelled) return;
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${proto}://${window.location.host}/ws`;
      setConnectionStatus('reconnecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        try {
          ws.send(JSON.stringify({ type: 'auth', token: token || '' }));
        } catch {}
      };

      ws.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch { return; }
        switch (msg.type) {
          case 'auth_ok':
            retryRef.current = 0;
            setConnectionStatus('connected');
            break;
          case 'price':
            applyPrice({
              symbol: msg.symbol,
              price: msg.price,
              change: msg.change ?? null,
              changePct: msg.changePct ?? null,
              previousClose: msg.previousClose ?? null,
              volume: msg.volume ?? null,
              ts: msg.ts || Date.now(),
            });
            break;
          case 'alert':
            if (msg.event) {
              pushAlertToast({
                id: msg.event.id,
                symbol: msg.event.symbol,
                message: msg.event.message,
                alertType: msg.event.alertType,
                observedValue: msg.event.observedValue,
                triggeredAt: msg.event.triggeredAt,
              });
              // Browser notification (if permission granted)
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                try {
                  new Notification(`stockpulse — ${msg.event.symbol}`, {
                    body: msg.event.message,
                  });
                } catch {}
              }
            }
            break;
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (closedByUs.current || cancelled) {
          setConnectionStatus('disconnected');
          return;
        }
        setConnectionStatus('reconnecting');
        const delay = Math.min(30_000, 500 * Math.pow(2, retryRef.current));
        retryRef.current += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try { ws.close(); } catch {}
      };
    }

    connect();

    return () => {
      cancelled = true;
      closedByUs.current = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [token, setConnectionStatus, applyPrice, pushAlertToast]);
}
