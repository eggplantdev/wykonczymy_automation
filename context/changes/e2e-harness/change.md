---
change_id: e2e-harness
title: E2e harness
status: implementing
created: 2026-07-08
updated: 2026-09-17
archived_at: null
---

## Notes

### 2026-09-17 — stabilising the suite (in progress, UNCOMMITTED)

The harness works; what is being paid down is 32 spec files authored 2026-09-15/16 without ever being
run to green. `plan.md` step 1.4 („`pnpm test:e2e` passes") is stale — it was true for smoke + auth only.

**Verified green** (warm loop, one worker, 5435 test DB):
`invoice-ingest` 3/3 · `kosztorys-versions` 2/2 · `kosztorys-deletes` 3/3 ·
`kosztorys-global-discount-failed-save` 1/1 · `investments-listing-kosztorys` 1/1 ·
`kosztorys-global-discount-overrides` 1/2.

**Not yet run**: the second overrides test, `kosztorys-grid-writes`, `-presets`, `-route-guards`,
`-section-headers`, `-share-link`, `-sort-order`, `-structure`, `-undo-redo`, `client-share`,
`notification-recipients`, `smoke`, `auth`, `transfer-*` ×4, `work-catalogue`,
`deposit-settlement-plane`, `fleet-inspections`, `investment-planowana-status`,
`investment-expense-netto:28`, `equipment-registry` (2nd), `investment-panel-filters:129`.

**Root causes fixed** (the durable ones are in `context/foundation/lessons.md`):

| symptom                                            | cause                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| „Marża" read 0 before and after                    | `tableCell` matches headers by `startsWith`, so „Marża" hit „Marża v1" — the TRANSACTIONS plane, which a kosztorys write never moves. Retargeted at „Robocizna v2". |
| the write-confirm passed, the listing didn't move  | the confirm read an amount identical to „Wartość netto przedmiar"; nothing had been saved. Now read by label + reload.                                              |
| `collapseSummaryPanel` stalls 30 s, `Received: ""` | the panel is mounted only when `subtotals.length > 0`. Absent now counts as folded.                                                                                 |
| „element not found" on an uploaded invoice         | `appendShortId` stamps a 6-char id on EVERY upload by design; the assertions allowed only Payload's „-N" uniquifier, which never runs.                              |
| a menuitem never appears after a restore           | the restore re-renders the editor, so a click can open the menu onto a trigger replaced a frame later. `pickKosztorysOption` re-opens until an item is there.       |
| a stage cell click does nothing                    | the toggle above it had not hydrated; a dispatched event on an unclaimed button is swallowed silently.                                                              |

**Wall clock**: tests average 2–3 min, some 5. Seeding is NOT the bottleneck — measured at 197 s of
1529 s (13%). A full pass of all 32 files is ~2–3 h, plus a diagnose+rerun cycle per new failure.

**Measured optimisation plan, not yet implemented**: split into two Playwright projects so only the 8
grid-touching files pay the 3000×1400 viewport; split isolated-fixture specs (parallel) from
shared-dump specs (serial), since `workers: 1` currently serialises everything; drop
`waitForHydration`'s budget now that it proceeds best-effort; turn screenshots off inside the trace
(every diagnosis this session came from DOM snapshots and RSC payloads, never screenshots); reset the
test DB to clear the accumulated `E2E Recon …` rows the heaviest page renders past.

**Restart recipe** — build once, then keep the server warm and iterate:

```bash
NEXT_DIST_DIR=.next-e2e pnpm build
set -a && source .env && set +a
DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" NEXT_DIST_DIR=.next-e2e PORT=3100 ./node_modules/.bin/next start
DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec playwright test --config playwright.warm.config.ts e2e/<spec>
```

Restart the server between batches — 16 GB is not enough to keep it up across the whole suite (four
OOM kills on 2026-09-17).
