# Family Watch Location Architecture

## Current State

The current backend has a Family Security foundation, but it does not implement Family Watch location collection or location-reading endpoints.

| Table or component | Purpose | Current state | Missing for Family Watch |
| --- | --- | --- | --- |
| `users` | Patient and caregiver identities | Present | No device-location association |
| `family_groups` | One active patient-owned family group | Present | No change required |
| `family_members` | Patient/caregiver membership and revocation | Present | Must be the authoritative caregiver relationship check |
| `family_permissions` | Explicit access flags, including `can_view_location` | Present | API enforcement is not connected |
| `location_grants` | Per-patient/per-family-member active, revoked, or expired grant | Present | No grant/create API, expiry job, access audit, or current-location enforcement |
| `family_links` / `family_invitations` | Invitation flows | Present | Not a location-consent source |
| `sos_profiles` | Patient-owned QR SOS card | Present | Separate from Family Watch consent |
| `sos_scans` | Location optionally supplied by a QR scanner | Present | It records scanner location, not patient tracking history |
| `patient_locations` | Patient device coordinates | Absent | New storage required |
| `location_access_logs` | Location access audit trail | Absent | New append-only storage required |
| Family API router | Family group, member, invite endpoints | Present | No `/api/location` adapter |
| Authentication | Bearer JWT verified by `authGuard` | Present | Must protect all future location endpoints |

Current SOS routes use public QR tokens for a card and authenticated routes for profile management and scan history. They must not be repurposed as a Family Watch location feed.

## Database Design

The current `location_grants` table is the recommended consent record for v1. Do not introduce a duplicate `location_consents` table unless the product needs multiple independent consent scopes per caregiver. A future migration can rename or replace it only with a compatibility plan.

### Consent record: existing `location_grants`

| Field | Purpose |
| --- | --- |
| `id` | Immutable grant identifier |
| `patient_user_id` | Patient who controls sharing |
| `family_member_id` | Active caregiver membership receiving sharing rights |
| `status` | `active`, `revoked`, or `expired` |
| `expires_at` | Optional time-bounded consent |
| `created_at` | Consent creation time |
| `revoked_at` | Consent withdrawal time |

For a future explicit `location_consents` model, preserve these fields and add `created_by` (normally the patient) plus a foreign key to the caregiver user/member. The service must validate that the patient owns the family group and that the caregiver member is active in that same group.

### Proposed `patient_locations`

| Field | Type / rule |
| --- | --- |
| `id` | Big integer primary key |
| `patient_id` | Foreign key to `users.id`; never client-selectable for another patient |
| `latitude`, `longitude` | Decimal coordinates with range validation |
| `accuracy_meters` | Nullable positive decimal |
| `battery_level` | Nullable 0-100 integer |
| `device_id` | Pseudonymous registered device identifier, not a hardware advertising ID |
| `captured_at` | Device capture time, validated within an allowed clock-skew range |
| `received_at` | Server time; authoritative ordering value |

Recommended retention: retain raw points for 30 days by default, then delete or aggregate them into coarse daily summaries only if a documented product need remains. Run cleanup in a controlled server-side job; do not rely on client deletion. Do not retain precise coordinates indefinitely. History queries should default to a short, bounded time window and a maximum point count.

### Proposed `location_access_logs`

| Field | Purpose |
| --- | --- |
| `id` | Big integer primary key |
| `patient_id` | Patient whose location was requested or whose consent changed |
| `caregiver_id` | Actor receiving location or attempting access; nullable only for patient actions |
| `action` | `view_current`, `view_history`, `grant`, `revoke`, `denied` |
| `occurred_at` | Server timestamp |
| `ip_address` | Request source, minimized and retention-limited |
| `device_id` | Request device identifier when available |
| `metadata` | Minimal request context, never raw coordinates |

Logs must be append-only for application roles. Retain for 90 days by default, subject to the product's legal/privacy policy. A denied attempt is also security-relevant and should be logged without revealing consent state to the caller.

## Consent Model

1. The patient creates or renews a grant for one active caregiver member.
2. The grant is effective only when all three checks pass: same active family group, `family_permissions.can_view_location = true`, and `location_grants.status = active` with no elapsed expiry.
3. The patient can revoke at any time. Revocation takes effect before the response is returned and is recorded in `location_access_logs`.
4. A caregiver cannot create, extend, transfer, or revoke another caregiver's consent.
5. Member revocation, family disablement, and permission revocation must immediately deny location reads, even if a stale grant row remains.
6. The patient can view the access log for their own location. A caregiver cannot view the patient's log.

## API Design

This is a contract proposal only; no endpoints exist yet.

| Method and route | Auth | Role | Description | Security rules |
| --- | --- | --- | --- | --- |
| `POST /api/location/grant` | JWT | Patient/owner | Grants an active caregiver member location access | Body contains only caregiver member ID and optional expiry. Verify patient owns the family group, member belongs to it and is active, and record a grant log. |
| `DELETE /api/location/revoke/:caregiverId` | JWT | Patient/owner | Revokes a caregiver's location grant | Resolve caregiver ID within the patient's group; do not accept a cross-family member. Revoke permission/grant atomically and log. |
| `GET /api/location/consents` | JWT | Patient/owner | Lists the patient's grants and status | Return only the caller's patient-owned group; omit coordinates. |
| `POST /api/location/points` | JWT + device binding | Patient | Uploads the caller patient's current point | Ignore any body patient ID. Apply rate, coordinate, freshness, and device checks. No caregiver upload path. |
| `GET /api/location/current/:patientId` | JWT | Patient or authorized caregiver | Returns most recent permitted point | Patient may request only self. Caregiver requires active membership, explicit location permission, active unexpired grant, and same patient group. Log successful and denied access. |
| `GET /api/location/history/:patientId` | JWT | Patient or authorized caregiver | Returns a bounded time range of permitted points | Apply all current-location checks plus mandatory `from`/`to`, maximum range, pagination, down-sampling, and access log. |
| `GET /api/location/access-log/:patientId` | JWT | Patient/owner | Returns own location access events | Only patient self-access; never expose logs to caregivers. |

All routes should use a dedicated location service and repository, not SQL in route handlers. Responses to unauthorized caregivers should be a generic `403 { "error": "forbidden" }`; they must not disclose whether a patient exists, has enabled sharing, or has a current point.

## Permission Matrix

| Action | Patient | Caregiver |
| --- | --- | --- |
| View own current location | Allowed | Not applicable |
| View own location history | Allowed | Not applicable |
| Upload own location | Allowed after mobile OS consent | Denied |
| View a patient's current location | Not applicable | Allowed only with active membership, explicit `can_view_location`, and active grant |
| View a patient's location history | Not applicable | Allowed only with the same checks and bounded retention window |
| Grant access | Allowed for own family group | Denied |
| Revoke access | Allowed for own family group | Denied |
| View access logs | Allowed for own patient ID | Denied |

## Security Model

| Threat | Risk | Protection |
| --- | --- | --- |
| IDOR: caregiver A requests patient B | High | Resolve every patient ID against the authenticated caregiver's active membership, explicit permission, and active grant; use generic 403; log denial. |
| Stolen JWT | High | Shorter access-token lifetime for location-sensitive sessions, device/session revocation, TLS, server-side rate limits, and re-authentication for grant/revoke actions. |
| Unauthorized location access after membership revocation | High | Check member status and grant status on every read; do not cache authorization decisions beyond the request. |
| Location scraping | High | Per-user and per-patient request limits, minimum refresh interval, capped history windows, pagination/down-sampling, access logs, and anomaly alerts. |
| Excessive upload requests | Medium | Device-bound upload authentication, point ingestion rate limit, deduplication, coordinate validation, and payload-size limits. |
| Background tracking abuse | High | Patient opt-in, visible mobile indicator, immediate revocation, per-caregiver grant, configurable expiry, and clear audit history. |
| GPS spoofing or stale points | Medium | Persist accuracy and server receive time, flag implausible jumps, show point freshness/accuracy to viewers, and never treat a point as medical evidence. |
| SOS QR scan confused with Family Watch | Medium | Keep SOS scan coordinates logically and physically separate from patient device locations and enforce distinct API authorization. |

## Mobile Requirements

### Android

- Request foreground location first; request background location only after a separate, clearly explained patient action.
- Use a foreground service with persistent notification while continuous sharing is enabled.
- Respect Android background-location and battery-optimization flows; guide the patient to settings rather than bypassing them.
- Show a visible sharing state, active recipients, last upload time, accuracy, and a one-tap stop/revoke action.
- Use adaptive upload intervals and significant-movement filtering to limit battery use and data collection.

### iOS

- Request `When In Use` first and `Always` only when continuous Family Watch is explicitly enabled.
- Enable the required Background Modes capability only during implementation and document why it is needed.
- Explain permission prompts before invoking them; handle `Denied`, `Restricted`, reduced accuracy, and background refresh disabled states.
- Display ongoing sharing state and an immediate disable/revoke path in the app.
- Use significant-change monitoring or bounded background updates rather than continuous high-frequency tracking.

## Implementation Plan

1. Review and approve this consent, retention, and threat model with product/privacy owners.
2. Add a forward-only migration for `patient_locations` and `location_access_logs`; reuse `location_grants` unless a new consent scope is approved.
3. Implement repository and service authorization checks with transactions for grant/revoke operations.
4. Add API adapters and security regression tests for patient ownership, caregiver isolation, revoked grants, expiry, IDOR, rate limits, and audit logging.
5. Add isolated MariaDB CI coverage before connecting any mobile client.
6. Implement mobile consent UX and OS permission handling only after backend authorization and retention controls pass review.
7. Define operational retention cleanup, incident response, and access-log review before release.
