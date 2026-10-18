# Baseline

"Before" = the research measurements (`research.md` §1–§2), taken 2026-10-18 on `8fb828e54`, the
commit this change starts from. The after-measurement repeats them with `measure.sh`.

| Command                                                   | Before                      | Phase 1 | Phase 2 | Phase 3 | Phase 4 | After                              |
| --------------------------------------------------------- | --------------------------- | ------- | ------- | ------- | ------- | ---------------------------------- |
| `test:integration` vitest duration                        | ~70 s                       | 89 s¹   | 62 s³   | 52 s⁴   | 42 s⁵   | 35.6 s⁶ (−34 s, −49 %)             |
| — `db` project (22 files): total / import / tests         | 45.95 s / 26.89 s / 16.83 s |         |         |         |         | 0 files (−46 s)                    |
| — `db-shared` project (135 files): total / import / tests | 31.92 s / 4.43 s / 26.90 s  |         |         |         |         | 158 files: 33.8 s / 4.0 s / 29.1 s |
| `test:parity` wall-clock                                  | 31.8 s                      | 6.4 s   |         |         |         | 5.3 s (−26.5 s, −83 %)             |
| `db:reset:test`                                           | 27.3 s                      | 3.2 s²  |         |         |         | 2.5 s (−24.8 s, −91 %)             |

¹ One run on a loaded machine (15-min load average 12, another session's E2E had just released the
lock); Phase 1 does not touch the vitest run itself, so the delta is noise until the
after-measurement repeats it on an idle machine.
² Warm clone; a rebuild (missing or stale template) takes 30.4 s.
³ Mean of two runs (64.0 s, 60.3 s); import 25 s, tests 35 s across both projects.
⁴ Mean of two runs (54.4 s, 49.4 s); import 17 s, tests 33 s; shuffled run 49.7 s.
⁵ Mean of two runs (36.4 s, 47.3 s) at load average ~8; import 5 s, tests 31–41 s; shuffled run
57.8 s. The `db` project now collects no file.
⁶ `measure.sh after` on `be38987b3`, two runs each, load average 7.4 → 4.4: integration 36.2 s / 35.1 s
(import 3–4 s, tests 31 s). Counts one more spec than the baseline (158 vs 157 files —
`kosztorys-item-field` arrived by merge), so the saving is if anything understated.
