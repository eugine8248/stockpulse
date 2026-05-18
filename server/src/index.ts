import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import path from 'path';
import { authRouter } from './routes/auth';
import { watchlistRouter } from './routes/watchlist';
import { alertsRouter } from './routes/alerts';
import { quotesRouter } from './routes/quotes';
import { settingsRouter } from './routes/settings';
import { reportsRouter, REPORTS_DIR } from './routes/reports';
import { adminRouter } from './routes/admin';
import { setupWebSocket } from './services/wsHub';
import { startPoller } from './services/poller';
import { startReportWatcher, stopReportWatcher } from './services/reportWatcher';
import { validateEnv } from './lib/envValidation';
import { prisma } from './lib/prisma';

// --- Env validation: fail fast in prod, warn-and-continue in dev. ----------
try {
  validateEnv();
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('[bootstrap] aborting due to env validation failure:', (err as Error).message);
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
const server = http.createServer(app);

// --- Helmet (hardened). ---------------------------------------------------
// CSP is tightened from `false` to a real policy:
//  - default-src 'self'
//  - script-src 'self' (no inline scripts; React+Vite outputs no inline)
//  - style-src 'self' 'unsafe-inline' (Tailwind injects inline)
//  - img-src 'self' data: blob:
//  - connect-src 'self' ws: wss:  (WS lives at /ws)
// crossOriginEmbedderPolicy is OFF — recharts + lucide do not ship COEP headers.
// referrerPolicy strict-origin-when-cross-origin (helmet default but pinned).
// HSTS is only meaningful behind HTTPS (Caddy provides this); the value is
// harmless on plaintext.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        // Allow same-origin web workers (recharts may spawn one)
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts: { maxAge: 31536000, includeSubDomains: true },
  }),
);

// --- CORS. -----------------------------------------------------------------
// In prod, prefer CLIENT_ORIGIN. In dev or when CLIENT_ORIGIN is unset, allow
// any reflected origin (existing behaviour).
const corsOrigin: cors.CorsOptions['origin'] = IS_PROD && process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: corsOrigin, credentials: true }));

app.use(express.json({ limit: '1mb' }));
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

// --- API routes. -----------------------------------------------------------
app.use('/api/auth', authRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);

// Health endpoint with DB ping — orchestrator uses this for liveness checks.
// Returns 503 when the DB is unreachable so the container gets pulled out of
// rotation instead of serving 500s.
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, ts: Date.now() });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[health] db ping failed:', err);
    res.status(503).json({ ok: false, ts: Date.now(), error: 'db' });
  }
});

// Static client (production build) — last so it doesn't shadow API
const clientDir = path.resolve(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Global error handler — surfaces 500 instead of crashing the process.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    // eslint-disable-next-line no-console
    console.error('[express] unhandled:', err);
    if (res.headersSent) return;
    res.status(500).json({ success: false, error: 'Server error' });
  },
);

// --- WebSocket on /ws ------------------------------------------------------
setupWebSocket(server);

// --- Background poller — broadcasts price updates and evaluates alerts ----
startPoller();

// --- Report watcher --------------------------------------------------------
startReportWatcher(REPORTS_DIR);

const listening = server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`stockpulse listening on http://localhost:${PORT}`);
});

// --- Graceful shutdown -----------------------------------------------------
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[shutdown] received ${signal}, draining...`);
  // Stop accepting new connections.
  listening.close((err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[shutdown] server.close error:', err);
    }
  });
  try {
    await stopReportWatcher();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[shutdown] reportWatcher close error:', err);
  }
  try {
    await prisma.$disconnect();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[shutdown] prisma disconnect error:', err);
  }
  // Give in-flight requests a moment to finish, then exit.
  setTimeout(() => {
    // eslint-disable-next-line no-console
    console.log('[shutdown] exit');
    process.exit(0);
  }, 1500).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[process] unhandledRejection:', reason);
});
