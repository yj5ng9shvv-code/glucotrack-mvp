# Server Deploy Report

Date: 2026-07-15

## Deployment Status

Production deploy: not performed.

Reason:
- Android release artifacts are blocked by missing keystore signing environment variables.
- No complete staging deployment gate was available in this pass.
- The instruction required staging verification before production, so production was intentionally left unchanged.

## Current Production Health Check

- `https://glukotrack.com/`: 200, `text/html; charset=utf-8`
- `https://glukotrack.com/app/`: 200, `text/html; charset=utf-8`
- `https://glukotrack.com/admin/`: 200, `text/html; charset=utf-8`
- `https://glukotrack.com/api/health`: 200, `application/json; charset=utf-8`

## Server Snapshot

- Host: `vps-814076.eur`
- Node: `v20.20.2`
- npm: `10.8.2`
- MariaDB: `11.4.12`
- nginx: `1.31.2`
- nginx config test: passed.
- Disk `/`: 197G total, 11G used, 179G free.

## Active Runtime Observation

- Port `8787` is currently listened by `/usr/bin/node /home/ODESSA/web/glukotrack.com/backend/server.js`.
- Another Node process `/usr/bin/node dist/main.js` is also running and should be reviewed before deployment cleanup.
