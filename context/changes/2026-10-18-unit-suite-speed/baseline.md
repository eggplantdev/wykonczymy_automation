# Unit suite — before / after

`pnpm test` (node + node-shared + dom + dom-shared), timed with `/usr/bin/time -p`.

| Run                                      | Wall   | User CPU-s | Load avg at start (1 min) |
| ---------------------------------------- | ------ | ---------- | ------------------------- |
| Baseline (research, before levers 10/11) | 175 s  | 725.8      | —                         |
| After, run 1                             | 55.5 s | 220.0      | 17.1                      |
| After, run 2                             | 45.3 s | 216.4      | 15.9                      |

Both after-runs started on a loaded machine (other sessions' work), so the wall figure is an upper
bound; user CPU-s is the steadier number — roughly 3.3× less work than the baseline.

Project split after the change: `node-shared` 357 / `node` 62, `dom-shared` 140 / `dom` 22 files.
Shuffled shared projects (`--sequence.shuffle`) passed twice, seeds 1792347272828 and 1792347352848.

Pre-push: `tsc --noEmit` now runs beside `pnpm test:integration` (~35 s), so its time drops out of
the hook's wall clock except where it outlasts the integration leg.
