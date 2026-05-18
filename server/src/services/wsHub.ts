// WebSocket hub: per-user connection tracking + broadcast helpers.
// Path: /ws. Client must send {type:'auth', token} as first message.

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyTokenSafe, ensureNoAuthUser } from '../middleware/auth';

const NO_AUTH = process.env.NO_AUTH === 'true';

interface SockMeta {
  userId: number;
  isAlive: boolean;
}

const sockets = new Map<number, Set<WebSocket>>();
const meta = new WeakMap<WebSocket, SockMeta>();

let wss: WebSocketServer | null = null;

function attach(userId: number, ws: WebSocket) {
  let set = sockets.get(userId);
  if (!set) {
    set = new Set();
    sockets.set(userId, set);
  }
  set.add(ws);
  meta.set(ws, { userId, isAlive: true });
}

function detach(ws: WebSocket) {
  const m = meta.get(ws);
  if (!m) return;
  const set = sockets.get(m.userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) sockets.delete(m.userId);
  }
  meta.delete(ws);
}

export function setupWebSocket(server: http.Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let authed = false;
    const authTimer = setTimeout(() => {
      if (!authed) {
        try { ws.close(4001, 'Auth timeout'); } catch {}
      }
    }, 5000);

    ws.on('message', async (data) => {
      let parsed: any = null;
      try {
        parsed = JSON.parse(data.toString());
      } catch {
        return;
      }

      if (!authed) {
        if (parsed?.type !== 'auth') {
          try { ws.close(4002, 'Auth required'); } catch {}
          return;
        }
        let userId: number | null = null;
        if (NO_AUTH) {
          try { userId = await ensureNoAuthUser(); } catch { userId = null; }
        } else {
          const token = typeof parsed.token === 'string' ? parsed.token : '';
          userId = await verifyTokenSafe(token);
        }
        if (!userId) {
          try { ws.close(4003, 'Invalid token'); } catch {}
          return;
        }
        authed = true;
        clearTimeout(authTimer);
        attach(userId, ws);
        try {
          ws.send(JSON.stringify({ type: 'auth_ok', userId }));
        } catch {}
        return;
      }

      // Authed messages — currently we accept pings only.
      if (parsed?.type === 'ping') {
        try { ws.send(JSON.stringify({ type: 'pong', ts: Date.now() })); } catch {}
      }
    });

    ws.on('pong', () => {
      const m = meta.get(ws);
      if (m) m.isAlive = true;
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      detach(ws);
    });

    ws.on('error', () => {
      clearTimeout(authTimer);
      detach(ws);
    });
  });

  // Heartbeat: ping every 30s, drop dead sockets
  setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      const m = meta.get(ws);
      // Unauth'd connections won't have meta — let the auth timer handle them.
      if (!m) return;
      if (!m.isAlive) {
        try { ws.terminate(); } catch {}
        detach(ws);
        return;
      }
      m.isAlive = false;
      try { ws.ping(); } catch {}
    });
  }, 30_000).unref();
}

export function broadcast(userId: number, msg: unknown) {
  const set = sockets.get(userId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify(msg);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(payload); } catch {}
    }
  }
}

export function broadcastAll(msg: unknown) {
  const payload = JSON.stringify(msg);
  for (const set of sockets.values()) {
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(payload); } catch {}
      }
    }
  }
}

export function connectedUserIds(): number[] {
  return Array.from(sockets.keys());
}
