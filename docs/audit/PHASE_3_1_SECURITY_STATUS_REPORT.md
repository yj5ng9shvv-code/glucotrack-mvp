# PHASE 3.1 Family Security Status Report

## Summary

PHASE 3.1 completed static security audit work, targeted authorization fixes, and regression-test implementation. Runtime regression verification in GitHub Actions is blocked and is not represented as a pass.

## Completed Security Work

- Audit: `PHASE_3_1_FAMILY_API_SECURITY_AUDIT.md`.
- HIGH: only the family owner/patient may remove a family member.
- MEDIUM: unauthorized or non-member `GET /api/family` returns `403` with `{ "error": "forbidden" }` instead of an internal error.
- MEDIUM: legacy `family_links` invite codes are stored as SHA-256 hashes; raw codes are returned only when created and are cleared from storage.
- Invite acceptance verifies hash, pending status, expiry, and recipient email. Failed attempts are recorded and rate limited.

## Commits

- `10a2154` - restrict family member removal to owner.
- `a35a375` - return forbidden for unauthorized family access.
- `3734ec52f28e6493823852a27cf9e0d71b871899` - hash family invite tokens.

## Tests Added

`backend/tests/family-security.test.mjs` covers:

- caregiver member-removal denial;
- non-member family access denial;
- invalid and expired JWT rejection;
- valid, invalid, expired, reused, and wrong-email legacy invite scenarios;
- absence of raw invite-code leakage from the member listing.

## CI Integration

The `Family HTTP Smoke` workflow runs the Family security authorization tests after isolated MariaDB setup, migrations, seed data, and backend startup.

## Runtime Verification

**STATUS: BLOCKED**

Reason:

- GitHub Actions for the private repository is unavailable from the current environment.
- The unauthenticated GitHub API returns HTTP `404`.
- GitHub CLI authentication and a `GITHUB_TOKEN` are unavailable.
- No actual CI run or runtime security-test output has been verified.

## Remaining Action

Provide the `Family HTTP Smoke` GitHub Actions log for commit `3734ec52f28e6493823852a27cf9e0d71b871899`, then finalize the regression status from the factual runtime result.

Commit: N/A

Push: N/A
