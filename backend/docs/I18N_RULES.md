# GlukoTrack i18n Rules

These rules are mandatory for every existing and future GlukoTrack admin module.

## Required practice

- No new module, screen, component, heading, description, field label, button, status, error, validation message, confirmation, toast, or empty state is accepted without i18n keys.
- Every new key must be added to both `ru` and `en` in the same change.
- Hardcoded user-facing text in components is prohibited. Technical identifiers, API paths, URLs, metric names, enum values, and data returned from the server may remain technical only when they are not shown as UI copy.
- Localization files and inline dictionaries must be saved as UTF-8.
- Placeholders must match in every language. For example, `{count}` in `en` requires `{count}` in `ru`.
- Technical keys must not be displayed to users.
- Falling back to a raw key in the production interface is forbidden.
- The architecture must allow adding new languages by adding translations, without changing business logic.
- The automated i18n check is mandatory before build or commit.

## Backup Settings coverage

The Backup Settings screen must use i18n for all visible strings: section titles, descriptions, field labels, field descriptions, buttons, statuses, warnings, confirmation prompts, validation messages, notifications, cleanup reasons, weekdays, modes, roles, and units.

## Automated check

Run the check from the backend project:

```bash
npm run i18n:check
```

The command validates the admin dictionary used by production and fails with a non-zero exit code when it finds:

- missing keys in `ru` or `en`;
- mismatched `settings.backup` structure;
- empty translations;
- raw technical keys exposed as text;
- `???`, `�`, or common mojibake signs;
- placeholder mismatches;
- known hardcoded text regressions in Backup Settings.

The command is also connected to `prebuild`, so a future `npm run build` will run i18n validation first.

## Adding a new module

1. Define stable technical keys for stored settings and API contracts.
2. Add UI labels, descriptions, hints, errors, statuses, and empty states as i18n keys.
3. Add `ru` and `en` translations in the same change.
4. Keep technical keys hidden from users.
5. Run `npm run i18n:check` before shipping.
