# Baseline

"Before" = the research measurements (`research.md` §1–§2), taken 2026-10-18 on `8fb828e54`, the
commit this change starts from. The after-measurement repeats them with `measure.sh`.

| Command                                                   | Before                      | Phase 1 | Phase 2 | Phase 3 | Phase 4 | After |
| --------------------------------------------------------- | --------------------------- | ------- | ------- | ------- | ------- | ----- |
| `test:integration` vitest duration                        | ~70 s                       |         |         |         |         |       |
| — `db` project (22 files): total / import / tests         | 45.95 s / 26.89 s / 16.83 s |         |         |         |         |       |
| — `db-shared` project (135 files): total / import / tests | 31.92 s / 4.43 s / 26.90 s  |         |         |         |         |       |
| `test:parity` wall-clock                                  | 31.8 s                      |         |         |         |         |       |
| `db:reset:test`                                           | 27.3 s                      |         |         |         |         |       |
