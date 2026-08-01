# FAMILY DB PORT AUDIT

Base: `origin/main` (`cf1ead6`)

## Current schema

`db.js` installs schema version 7.  There is no `backend/migrations/` directory
or migration runner. Existing Family data is stored in `family_links` and must
remain unchanged.

## Existing Family tables

- `family_links`

## Missing Family Security tables

- `family_groups`
- `family_members`
- `family_permissions`
- `family_invitations`
- `location_grants`

## Migration plan

Add a new, forward-only SQL migration. It creates only new tables and indexes,
uses foreign keys to `users`, and does not alter `family_links` or user data.
The next DB-only implementation step must add a migration runner and register
the migration after the existing schema-v7 bootstrap.
