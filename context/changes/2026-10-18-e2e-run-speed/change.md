---
change_id: e2e-run-speed
title: Skip the unchanged E2E build and reset the test DB per cold run
status: implemented
created: 2026-10-18
updated: 2026-10-18
archived_at: null
branch: staging
worktree: null
---

## Notes

Levers 4 and 9 from `2026-10-18-test-suite-speed/research.md`.

- `scripts/e2e-build.sh` fingerprints every file the build reads (tracked + untracked, minus `e2e/`,
  `src/__tests__/`, `context/`, `*.md`, `scripts/`, `.husky/`, Playwright configs; plus `.env`,
  `node -v`, `node_modules/.modules.yaml`) and skips `pnpm build` when `.next-e2e` was built from
  the same fingerprint. Fingerprint: 0.24 s.
- `typescript.ignoreBuildErrors` only when `NEXT_DIST_DIR` is set (the E2E build): pre-push runs
  `tsc` on every push.
- `pnpm test:e2e` runs `db:reset:test` first. `test:e2e:warm` does not — a reset under a running
  warm server would leave its `unstable_cache` serving rows the reset removed.

Measured with the E2E env, no Playwright: rebuild 98 s with type validation skipped, reuse 0 s. A
probe file in `src/` changes the fingerprint; one in `e2e/` does not. A full E2E run is not done
yet — it's the manual check in `context/foundation/manual-checks.md`.
