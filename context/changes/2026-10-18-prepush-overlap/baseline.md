# Pre-push test legs — before / after

Test part of `.husky/pre-push` only (`db:dump` and the deploy watcher excluded), 8 cores (4P + 4E).

| Run                                             | Wall   | Load avg at end (1 min) |
| ----------------------------------------------- | ------ | ----------------------- |
| Before: legs in sequence (57.1 + 38.0 + 5.8 s)  | ~101 s | —                       |
| Probe: overlapped, `--maxWorkers=5`, quiet host | 71.4 s | —                       |
| After, run 1                                    | 79 s   | 10.7                    |
| After, run 2                                    | 81 s   | 11.9                    |
| After, run 3                                    | 84 s   | 19.2                    |

All three after-runs: unit 580 files passed, integration 158, parity 2. They ran beside other
sessions' work, so the wall figure is an upper bound; the quiet-host probe is the floor.

Failure path, simulated with stub legs: typecheck and integration failing at once print
`✗ pre-push FAILED at: typecheck, DB integration specs` and exit 1.

Leads cursor spec after the DB-clock fix: 20/20 green, 12 of them while the unit suite ran.
