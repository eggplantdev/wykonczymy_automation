---
change_id: test-suite-speed
title: Cut test-suite wall-clock time further
status: archived
created: 2026-10-18
updated: 2026-10-18
archived_at: 2026-10-18T20:01:38Z
branch: staging
worktree: null
---

## Notes

Follows EX-1093 (DB integration 250 s → 70 s by moving 115 specs to db-shared). Where does the
remaining time go across `pnpm test`, `test:integration`, the pre-push legs and E2E, and which
levers cut it further?

## Outcome

Against the research baseline on `8fb828e54`: `test:integration` ~70 s → 35.6 s (all DB specs in
`db-shared`), `test:parity` 31.8 s → 5.3 s, `db:reset:test` 27.3 s → 2.5 s (template clone; a rebuild
takes ~30 s).

Review gate (with unit-suite-speed, prepush-overlap, e2e-run-speed), accepted as is:

- The template fingerprint covers only the collections the seeds write; a hook change elsewhere is
  caught by the 7-day age limit or `pnpm db:template:test`.
- Process env, `domToast` / `router` / `getCurrentUserJwt` implementations and the fake clipboard
  survive across shared files; no shared spec steers them persistently, and a blanket `mockReset`
  would wipe the stubs' defaults.
- The shell scripts (`pre-push-tests.sh` signal path, `test-db-template.sh`, `e2e-build.sh`) carry
  no automated test.
