# Server Log Audit Report

Date: 2026-07-15

## nginx

- `nginx -t`: passed.
- Recent `/var/log/nginx/error.log` scan did not show recent critical/error/upstream entries in the last 200 lines.

## Backend

Recent backend log contains repeated:

```text
Error: listen EADDRINUSE: address already in use :::8787
```

Interpretation:
- The active backend process is already listening on port `8787`.
- A second backend start attempt is being made and fails because the port is occupied.

Required follow-up before production deployment:
- Identify whether `/usr/bin/node dist/main.js` is expected.
- Ensure only the intended backend process manager starts `/home/ODESSA/web/glukotrack.com/backend/server.js`.
- Remove duplicate startup entries only after confirming ownership and rollback path.
