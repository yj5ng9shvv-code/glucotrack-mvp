# API Logic Audit Report

Date: 2026-07-15

## Route Inventory

The backend exposes these major API groups:

- Auth: register, login, Google, Apple, refresh, email verify, password reset, profile, logout.
- Notifications: list, create, mark read, delete.
- SOS: public card, scan, unlock, profile, recent scans, delete scans.
- Sync: push and pull.
- Subscription and billing: status, trial, devices, checkout, portal, Stripe webhook.
- Reports: create, list, details, delete.
- Family: invitations, accept, members, patients.
- AI: chat, food search, transcription, food recognition, lab analysis, medication check.
- Referrals: validation, click tracking, user code, stats, history, attach.
- Help Center: categories, articles, search, popular, feedback, contact.
- GDPR: user request lifecycle, verification, reply, cancel, export download.
- About: public about content and locales.
- Admin: dashboard, users, subscriptions, payments, devices, trials, family, SOS, AI, notifications, referrals, help, about, localizations, audit, settings, security, errors, backups, GDPR, app versions, support, admins, export.

## Security / Encoding Checks

- API health returns `application/json; charset=utf-8`.
- Backend sets JSON responses to `application/json; charset=utf-8` when no content type is already set.
- Source scan did not find project usage of `latin1.decode`, `String.fromCharCodes`, `utf8_decode`, `utf8_encode`, PHP `iconv`, or `mb_convert_encoding`.
- Web release artifact scan found no API secrets and no local development host references.

## Test Result

- Backend tests: 40 passed.
- Flutter integration/service tests covering API clients passed as part of 614 Flutter tests.
