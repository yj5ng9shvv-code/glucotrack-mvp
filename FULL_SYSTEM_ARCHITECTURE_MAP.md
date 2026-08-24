# GlukoTrack Full System Architecture Map

Generated: 2026-07-15 20:30 Europe/Warsaw

Phase: audit only. No cleanup was executed.

## Components

| Component | Local location | Server location | Entry point | Runtime/service | Database | APIs | Storage | Criticality |
|---|---|---|---|---|---|---|---|---|
| Flutter app: Android/iOS/Web/Windows/macOS | `lib`, `android`, `ios`, `web`, `windows`, `macos` | deployed web build under production site, exact path not verified this pass | `lib/main.dart` | Flutter runtime | `ODESSA_glukotrack` through backend API | `/api/*` | local device prefs/cache, backend storage | high |
| Public website | `website_source` plus root `index.html`, `style.css` | `glukotrack.com`, exact filesystem path blocked by SSH credentials | `website_source/index.html` | static site | through backend APIs | public pages, `/app/`, `/help/`, `/about/`, `/r/` | static assets | high |
| Web application/PWA | `website_source/app` | production `/app/`, exact path blocked | `website_source/app/index.html` | Flutter web | backend API | `/api/*` | service worker/cache | high |
| Admin panel | backend admin routes and production admin UI | production `/admin`, exact path blocked | `backend/admin.js` | Node/Express | `ODESSA_glukotrack` | `/api/admin/*` | database plus generated exports | high |
| Backend/API | `backend` | production backend, exact path blocked | `backend/server.js` | Node/Express | `ODESSA_glukotrack` schemaVersion 20 by health endpoint | `/api/health`, auth, sync, AI, SOS, GDPR, referrals, subscription | uploads/exports/email temp where configured | critical |
| Database | schema files in `backend/*.sql` | MariaDB `ODESSA_glukotrack` by health endpoint | backend DB connector | MariaDB | `ODESSA_glukotrack` | SQL through backend | medical/profile/subscription/GDPR/admin data | critical |
| AI services | `backend/server.js`, Flutter AI screens | production backend proxy | backend endpoints | OpenAI client via backend env | request logs/usage tables if configured | AI/chat/transcription endpoints | no client-side key expected | high |
| SOS/public patient card | Flutter SOS screens and backend public renderer | production public SOS route | QR/deep link | Flutter + backend-rendered route | SOS/profile tables | SOS endpoints | QR/token data | critical |
| Premium/trial/referral/GDPR | Flutter screens, `backend/admin.js`, `backend/gdpr.js`, `backend/referrals.js` | production API | app/profile/admin routes | Node/Express + Flutter | subscription/referral/GDPR tables | `/api/*` and admin APIs | DB and generated exports | critical |

## Verified This Pass

- Local project backup: `C:\Backups\GLUKOTRACK_FULL_BACKUP_BEFORE_CLEANUP_2026-07-15_20-27`
- Local source inventory: 1951 files in backup, 143,957,414 bytes, key directories present.
- API health: `https://glukotrack.com/api/health` returned 200 and database ready.
- Database name/schema from health: `ODESSA_glukotrack`, schemaVersion `20`.

## Not Verified This Pass

- Production filesystem inventory, nginx config, cron, PM2/systemd, server disk/inodes: SSH password rejected.
- Full database dump and restore test: blocked by SSH/DB credentials.
- Phone local app storage/cache: no active ADB/device session was available in this turn.
