# Family Security Integration Report

Date: 2026-08-02

## Environment

- Database: `glucotrack_test`
- API: `127.0.0.1:8788`
- Runtime: `NODE_ENV=test`
- External services: mock SMTP, Stripe and OpenAI adapters
- Production database, configuration and process: not used

## Result

The Family HTTP integration suite passed 8 of 8 scenarios:

1. Test-account authentication.
2. Linked caregiver access and stranger isolation.
3. Permission matrix, including explicit report denial.
4. Caregiver revoke and live-location grant revocation.
5. SOS visibility and protection from caregiver cancellation.
6. Invitation email binding, expiry and one-time acceptance.
7. Premium / Family and AI entitlement isolation.
8. Family subscription expiration blocking list, location and SOS history.

## Security fixes covered by regression tests

1. `history=true` no longer implicitly grants `viewReports` when reports are explicitly disabled.
2. SOS read endpoints now require the owner's active Family subscription, preventing access after expiry.

## Regression command

```bash
npm run test:family:integration
```

The command must run only after `migrate:test`, `seed:test`, `start:test` and a successful loopback health check.
