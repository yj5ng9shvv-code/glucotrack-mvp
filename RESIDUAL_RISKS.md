# Residual Risks

Date: 2026-07-15

## Release Blockers

- Android APK/AAB release signing is not configured in the current environment.
- Staging deployment and staging smoke testing were not completed.
- Production deploy was intentionally not performed.

## Server Runtime Risks

- Backend log shows repeated `EADDRINUSE :::8787`, indicating duplicate backend start attempts.
- Server has another Node process: `/usr/bin/node dist/main.js`; ownership and necessity should be confirmed before cleanup.

## Build / Artifact Notes

- Web release build succeeded and is archived locally.
- Web release output contains standard Flutter `sourceMappingURL` comments, but no source map files.
- iOS/macOS release packaging was not performed on this Windows machine.

## Dependency Risks

- Flutter reports newer package versions outside current constraints.
- No dependency upgrades were performed in this pass.
