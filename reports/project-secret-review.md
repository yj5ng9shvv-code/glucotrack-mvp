# GlukoTrack Secret Review

Generated: 2026-07-15

Scope: current workspace after generated/build and release/archive cleanup.
Values are intentionally not printed in this report.

## Result

- No tracked production-shaped OpenAI, Stripe, webhook, or private-key values were found in the focused source/config scan.
- Real local environment files exist, but they are ignored by git:
  - `backend/.env`
  - `backend_proxy_sample/.env`
- Tracked environment templates remain in the repository:
  - `backend/.env.example`
  - `backend_proxy_sample/.env.example`

## Fixed

`backend_proxy_sample/.env.example`

- Replaced token-shaped placeholder `OPENAI_API_KEY=sk-...` with a non-token placeholder.
- Replaced token-shaped Stripe placeholders with non-token placeholders.
- Replaced a mojibake/encoding-sensitive QR scan comment with plain ASCII text.

`backend/.env.example`

- Already contains non-token placeholders in the current working tree.
- Current diff shows the same secret-template hardening pattern: non-token OpenAI/Stripe placeholders and plain ASCII QR scan comment.

## Remaining Findings

These are not active secrets by themselves, but should stay under review:

| Path | Status | Risk | Action |
|---|---|---:|---|
| `backend/.env` | ignored local config | high if leaked | keep ignored; never commit; rotate values if this file was ever shared |
| `backend_proxy_sample/.env` | ignored local config | high if leaked | keep ignored; never commit; rotate values if this file was ever shared |
| `backend/.env.example` | tracked template | low | keep placeholder-only values |
| `backend_proxy_sample/.env.example` | tracked template | low | fixed placeholder-only values |
| `backend/README.md`, `backend_proxy_sample/README.md`, `DB_SETUP_RU.md` | docs mention env variable names | low | safe as documentation; do not put real values there |

## False Positives Removed From Review

- `backend/node_modules/**`: dependency examples and library code, not project secrets.
- `build/**`: generated artifact already removed.
- `release/**`: archive/release artifact already removed.
- `.apkcheck*/**`: unpacked APK inspection output already removed.
- CanvasKit `.symbols` entries such as `ps_mask_test_bit`: not tokens.

## Verification

- `git check-ignore` confirms local `.env` files are ignored by `**/.env`.
- Focused scan did not find production-shaped `sk-*`, `sk_live_*`, `whsec_*`, or private-key blocks in source/config files after the template fix.
- No secret values were printed to chat or report.

