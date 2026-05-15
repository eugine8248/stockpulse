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
import { reportsRouter } from './routes/reports';
import { setupWebSocket } from './services/wsHub';
import { startPoller } from './services/poller';

const PORT = parseInt(process.env.PORT || '3000', 10);
const app = express();
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));

// API routes
app.use('/api/auth', authRouter);
app.use('/api/watchlist', watchlistRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// Static client (production build) — last so it doesn't shadow API
const clientDir = path.resolve(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});

// WebSocket on /ws
setupWebSocket(server);

// Background poller — broadcasts price updates and evaluates alerts
startPoller();

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`stockpulse listening on http://localhost:${PORT}`);
});
