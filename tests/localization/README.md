# Localization CI gate

Run:

```bash
node tools/localization_audit.mjs --fail-on-findings
```

Current repository still has findings, so the default command writes reports without failing. Enable the flag when the correction queue reaches zero.
