# GlucoTrack Backend

Node.js API for server-side accounts, health-data sync, family access, billing,
and the OpenAI proxy. MySQL/MariaDB is required. Passwords are stored as bcrypt
hashes and clients authenticate with expiring JWTs.

## API

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `POST /sync/push`, `POST /sync/pull`
- `POST /sos/profile`, `GET /sos/scans/recent`
- `GET /sos/:token`, `POST /sos/:token/scan`, `POST /sos/:token/unlock`
- `POST /family/invitations`
- `POST /family/invitations/accept`
- `GET /family/members`, `DELETE /family/members/:id`
- `GET /family/patients`, `GET /family/patients/:ownerId`
- `GET /subscription/status`, `POST /billing/checkout`, `POST /billing/portal`
- `POST /billing/webhook` (Stripe signature required)
- `POST /reports`, `GET /reports`, `GET /reports/:id`, `DELETE /reports/:id`
- `POST /ai/chat`, `POST /ai/recognize-food`

Public SOS viewing, scanning, PIN unlock, health, registration, and login do
not require a bearer JWT. SOS profile management and scan history do.

## Server Setup

Install Node.js 20+, create a MySQL/MariaDB database in Hestia/phpMyAdmin and
fill `.env`:

```bash
npm install --omit=dev
nano .env
npm start
```

Required database settings:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=diabetik_app
DB_USER=admin_glukotrack
DB_PASSWORD=your_database_password
```

Tables and indexes are created automatically on startup. You can also import
`database_schema.sql` manually in phpMyAdmin.

The startup process also attempts `CREATE DATABASE IF NOT EXISTS` when
`DB_AUTO_CREATE=true`. If the normal Hestia database user does not have that
permission, create only the empty database in Hestia; every table will still be
installed automatically. Optional `DB_ADMIN_USER` and `DB_ADMIN_PASSWORD` can
be used for fully automatic database creation.

Run the installer without starting the API:

```bash
npm run db:install
```

Set `PUBLIC_BASE_URL` to the public API address used in QR links. The optional
`SOS_SCAN_WEBHOOK_URL` receives a JSON event when a QR is scanned. Approximate
coordinates are included only when the scanner grants browser permission.

Use a randomly generated `JWT_SECRET` of at least 32 characters. Create monthly
and yearly recurring prices in Stripe, put their IDs and the secret keys in
`.env`, then register this webhook endpoint in Stripe:

```text
https://glukotrack.com/api/billing/webhook
```

Subscribe it to `checkout.session.completed`, `customer.subscription.updated`,
and `customer.subscription.deleted`. Premium is granted only by verified
webhooks; the client cannot activate it locally.

## Hestia Deployment

1. Create the MySQL/MariaDB database `diabetik_app` in Hestia/phpMyAdmin.
2. Create the user `admin_glukotrack` and give it access to the database.
3. Create a Node.js application for `api.glukotrack.com`, or reverse-proxy
   `https://glukotrack.com/api/` to `http://127.0.0.1:8787/`.
4. Upload this backend folder outside `public_html`.
5. Edit `.env` and set the real `DB_PASSWORD`, `JWT_SECRET`, OpenAI, and Stripe
   values.
6. Run `npm install --omit=dev` and start the app with a process manager.
7. Build Flutter with:

```bash
flutter build web --release --base-href /app/ \
  --dart-define=API_BASE_URL=https://glukotrack.com/api
```

If the API uses a subdomain, set `API_BASE_URL=https://api.glukotrack.com`.

## Family Access

The owner creates a seven-day invitation for a specific email and chooses
permissions. The caregiver must register with that same email and explicitly
accept the invitation code. The owner can revoke access at any time.

Before production use, add encrypted backups, audit logging, email delivery,
token revocation, password reset/email verification, monitoring, and a legal
privacy review for medical data in every target country.
