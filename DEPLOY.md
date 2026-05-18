# Stockpulse — Self-host Deployment

A field guide for deploying the production build of stockpulse on your own
Linux server.

## 1. Server requirements

- Docker 24+ and Docker Compose v2 (`docker compose`, not the legacy
  `docker-compose`)
- ~1 GB RAM (Node + SQLite + Caddy fit comfortably in 512 MB; 1 GB gives
  headroom for builds)
- ~5 GB disk for image + db + a few months of backups
- A DNS A/AAAA record pointing at the server's public IP

## 2. Reverse proxy: Caddy (recommended)

Caddy gives you automatic Let's Encrypt HTTPS with effectively zero config.
Install via your distro's package manager, then create `/etc/caddy/Caddyfile`:

```
stockpulse.example.com {
  reverse_proxy 127.0.0.1:3003

  # Long-lived WebSocket for live quotes
  @ws path /ws
  reverse_proxy @ws 127.0.0.1:3003 {
    transport http {
      versions h1
    }
  }

  encode gzip zstd
  header {
    Strict-Transport-Security "max-age=31536000; includeSubDomains"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
  }
}
```

Reload Caddy (`sudo systemctl reload caddy`). HTTPS is live as soon as DNS
propagates and ports 80/443 are reachable.

Nginx works too, but you'd have to provision certificates manually (certbot).

## 3. First-deploy sequence

```sh
# 1. Get the code on the box
git clone https://github.com/eugine8248/stockpulse.git
cd stockpulse

# 2. Copy the env template and fill in real values
cp .env.production.example .env.production
# Edit .env.production:
#   - JWT_SECRET (generate via: openssl rand -base64 48)
#   - CLIENT_ORIGIN=https://stockpulse.example.com
nano .env.production

# 3. Build + start
docker compose --env-file .env.production up -d --build

# 4. Initialise the SQLite schema (idempotent — runs prisma db push)
docker compose exec stockpulse npx prisma db push --schema=./prisma/schema.prisma

# 5. Open the front-end in a browser and complete /setup to create the
#    admin user. The first registered user is the owner (id=1) and is the
#    only account that can access /api/admin/audit-log.
```

## 4. Reports watcher

The stock-analysis reports surface auto-refreshes from the directory mounted
at `/app/data/reports/stocks`. Two options:

- **Same-host taskpulse cron** — point `REPORTS_HOST_DIR` at
  `/path/to/taskpulse/data/reports/stocks` in `.env.production`, restart with
  `docker compose up -d`. New cron drops appear in stockpulse within ~1 sec.
- **Separate machine** — `rsync` the directory from the cron host to this
  host every few minutes. The watcher fires on any file `add` / `change` /
  `unlink` event.

## 5. Backups

Atomic SQLite backup script ships at `scripts/backup-sqlite.sh`. Run it via
host cron:

```cron
# /etc/cron.d/stockpulse-backup — daily 03:30 UTC
30 3 * * * root docker compose -f /path/to/stockpulse/docker-compose.yml exec -T stockpulse /bin/sh /app/scripts/backup-sqlite.sh
```

Retention: 7 most-recent daily + 4 most-recent weekly (Sunday tags). Anything
older is pruned automatically.

### Restoring from backup

```sh
# 1. Stop the running container so SQLite isn't being written to.
docker compose stop stockpulse

# 2. Replace the live DB with the backup file you want.
cp ./backups/stockpulse-2026-05-18T03-30-00Z.bak ./data/stockpulse.db

# 3. Verify integrity before bringing the app back up.
docker run --rm -v $(pwd)/data:/data alpine sh -c "apk add --no-cache sqlite > /dev/null && sqlite3 /data/stockpulse.db 'PRAGMA integrity_check;'"

# 4. Restart.
docker compose start stockpulse
```

## 6. Smoke test checklist

After every deploy:

- [ ] `curl https://stockpulse.example.com/api/health` → `{ ok: true, ts: ... }`
- [ ] Sign in via the web UI — confirm dashboard renders
- [ ] Add a ticker to the watchlist — confirm it persists across a page reload
- [ ] Open the Reports page — today's report appears with BUY/WATCH chips
- [ ] Drop a fake `2026-XX-XX-stock-analysis.md` into the cron drop dir;
      confirm `/api/reports/stock-analysis` lists it within 5 sec
- [ ] `curl -i -H "Authorization: Bearer bogus" https://.../api/auth/me`
      → 401
- [ ] 6th login attempt in 15 min from the same IP → 429

## 7. Upgrades

```sh
git pull
docker compose --env-file .env.production up -d --build
# If the Prisma schema changed:
docker compose exec stockpulse npx prisma db push --schema=./prisma/schema.prisma
```

The server uses a SIGTERM-driven graceful shutdown — in-flight requests are
drained before the container exits.

## 8. Common gotchas

- **CSP errors in the browser console**: tighten or relax
  `contentSecurityPolicy` in `server/src/index.ts`. Tailwind needs
  `'unsafe-inline'` in `styleSrc` (already set).
- **CLIENT_ORIGIN is required for cross-origin browsers in prod**. Without
  it, the server falls back to `cors({ origin: true })` (reflects request
  origin) which is fine for same-origin Caddy-fronted deploys but unsafe if
  someone else's site embeds yours.
- **WebSocket disconnects every minute**: most reverse-proxy defaults idle
  out WS at 60s. Caddy keeps them open by default; if you're on nginx, add
  `proxy_read_timeout 3600s;` to the `/ws` location block.
