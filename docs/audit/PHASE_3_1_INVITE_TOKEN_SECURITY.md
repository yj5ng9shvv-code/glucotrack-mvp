# PHASE 3.1 Invite Token Security Audit

Date: 2026-08-02
Mode: audit only
Scope: legacy `family_links` invitation flow

## Current implementation

### Table and storage

`family_links` is defined in `backend/phpmyadmin_import.sql:70-87`.

- `invite_code` is `VARCHAR(255) NOT NULL UNIQUE`.
- The invite code is stored **in plaintext**, not as a hash.
- The code is returned to the owner through `familyLink()` and `GET /family/members`
  (`backend/server.js:919-930`, `1521-1531`).
- This is separate from the new `family_invitations` table, which stores
  `invite_code_hash`; this audit does not assess that new flow.

### Generation and entropy

`POST /family/invitations` creates the token in `backend/server.js:881` with:

```js
randomBytes(18).toString("base64url")
```

This supplies 144 bits of cryptographically secure random input and produces a
base64url-safe code. Token randomness and length are adequate against online guessing.

### Expiration

Creation sets `expires_at` to seven days (`backend/server.js:883-895`). Acceptance
requires `expires_at > NOW()` (`backend/server.js:900-910`). An expired code is
rejected.

### One-time use and reuse

The acceptance query updates only a record whose status is `pending`, then changes it
to `accepted` in the same SQL statement. A second use cannot match `status = 'pending'`.
The unique database constraint also prevents the same stored code from appearing in
multiple rows.

Creation for the same owner/email uses an upsert that replaces the current code and
resets the invitation to `pending`. This intentionally invalidates the previous code.

### Recipient binding

Acceptance requires both the invite code and the authenticated account email:

```sql
WHERE invite_code = $2 AND invite_email = $3
```

The invitation is therefore bound to the invited email. It cannot be accepted by an
authenticated account with a different email.

### Brute-force protection

The application applies the generic in-memory `rateLimitGuard` to all routes except
`/health` (`backend/server.js:91-93`, `1959+`), with a default of 60 requests per
minute. There is no invite-specific attempt counter, account lockout, code-prefix
throttling, or persistent distributed rate-limit store.

## Assessment

| Control | Result |
| --- | --- |
| Plaintext / hash | Plaintext storage: fail-safe handling is absent |
| Randomness | PASS: 18 cryptographic random bytes |
| Expiration | PASS: seven-day expiry checked at acceptance |
| Reuse protection | PASS: acceptance requires `pending`, then atomically sets `accepted` |
| Email binding | PASS: code is matched to authenticated recipient email |
| Brute-force protection | Partial: generic in-memory rate limit only |

## Risk

**MEDIUM**

The secret is strong, short-lived, recipient-bound, and one-time, so online guessing is
not a practical primary risk. The risk comes from storing a reusable secret in plaintext
and returning it in normal member-list responses. A database read, application log, or
over-broad owner response exposure reveals a still-valid invitation code. Email binding
limits exploitation but does not make the handling equivalent to a hashed token.

The generic in-memory rate limit is not sufficient as a dedicated brute-force or abuse
control in a horizontally scaled production deployment.

## Minimal fix plan

1. Add a forward-only migration with `invite_code_hash CHAR(64)` for legacy
   `family_links`; do not alter unrelated Family tables.
2. Generate the code as today, store only `SHA-256(code)`, and compare its hash during
   acceptance. Return the raw code only at creation time.
3. Remove `invite_code` from `familyLink()` and `GET /family/members` responses.
4. Retire or null the plaintext column after a bounded migration window.
5. Add a per-IP and per-invite acceptance throttle backed by shared storage before
   production scale-out.

## Final result

- Current: plaintext code, seven-day expiry, one-time acceptance, recipient-email binding
- Risk: MEDIUM
- Code changes: none
- Commit: N/A
