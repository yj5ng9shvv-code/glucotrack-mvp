# Staging Smoke Test Report

Date: 2026-07-15

Staging deploy was not performed.

Reason:
- No staging target was configured or provided for this pass.
- Android release signing is blocked by missing keystore environment variables.
- The production deploy gate requires successful staging first, so the release was stopped before production.

Recommended staging smoke checklist when staging is available:

- `/` returns 200 and correct language selector text.
- `/app/` returns 200 and loads Flutter app.
- `/admin/` returns 200 and loads admin login.
- `/api/health` returns 200 with `application/json; charset=utf-8`.
- Login/register/password reset render valid UTF-8 for Russian and all supported locales.
- Help, GDPR, profile, SOS, AI, diary, analytics, notifications, subscription and support routes open without fallback mojibake.
