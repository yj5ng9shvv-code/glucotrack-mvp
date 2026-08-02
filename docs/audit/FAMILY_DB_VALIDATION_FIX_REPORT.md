# FAMILY DB VALIDATION FIX REPORT

Root cause: CI shell quoting error in the post-seed MySQL validation command.

Backend, migration, seed, and DB schema: unchanged.

Fix: workflow validation now sends all SQL through a quoted heredoc and checks
its three read-only result lines separately.
