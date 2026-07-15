# GlukoTrack Server Deep Audit Report

Generated: 2026-07-15 20:30 Europe/Warsaw

Mode: read-only checks only. No server cleanup was executed.

## Verified

- Public API health endpoint: `https://glukotrack.com/api/health`
- Result: HTTP 200
- Backend response: service `glucotrack-backend`, database ready, database `ODESSA_glukotrack`, schemaVersion `20`.

## Server Backup

Created on server, outside public web folders:

```text
/root/glukotrack_backups/GLUKOTRACK_SERVER_DB_BACKUP_2026-07-15_18-38
```

Files:

| File | Size | Verification |
|---|---:|---|
| `SERVER_BACKUP_BEFORE_CLEANUP_2026-07-15_18-38.tar.gz` | 171,972,902 bytes | `tar -tzf` passed, 9248 entries |
| `SHA256SUMS.txt` | 378 bytes | contains server archive and DB dump hashes |
| `server_tar_warnings.log` | 0 bytes | no tar warnings |

Server archive SHA256:

```text
17ae85acae2add27d81ca19100c5e368a5527c351c165d7b41b5c15f2a7a8948
```

Included:

- `/home/ODESSA/web/glukotrack.com`
- `/etc/nginx`
- `/etc/cron.d`
- `/etc/crontab`
- `/etc/systemd/system`

## Still Not Cleaned

No production filesystem cleanup was executed. Old releases, logs, caches, cron, and systemd targets still require a separate read-only inventory and user approval before removal.

## Server Cleanup Status

No server files were deleted.

## Required User Decision

Approve exact server cleanup candidates after the next server inventory report. The backup exists, but deletion is still blocked until candidate-by-candidate approval.
