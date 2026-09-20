---
change_id: e2e-harness
title: E2e harness
status: implementing
created: 2026-07-08
updated: 2026-09-20
archived_at: null
---

## Notes

### 2026-09-18 — the suite runs green (warm loop)

Three systemic causes, none of them in the specs' logic, kept 32 spec files off green. All three are
written up in `context/foundation/lessons.md`; the short version:

1. **The browser ran under Rosetta.** `pnpm` here is the x86_64 `@pnpm/exe` build, and macOS hands
   that binary preference to the whole descendant tree — Chrome is universal, so the renderer launched
   translated. Measured, seconds apart on one machine: a bare JS loop 303 ms vs 1211 ms, hydration
   0,3 s vs 20 s. `e2e/chrome-arm64.sh` + `e2e/chrome-launch.ts` pin Chrome with `arch -arm64`, so the
   fix holds whoever invokes Playwright.
2. **The suite was relying on that emulation to lose races.** With a real-speed browser, nine of the
   thirteen remaining failures were one bug: a spec that writes, sees the optimistic UI change,
   and reloads — which ABORTS the in-flight server action and re-renders from a read that raced the
   write. `settleWrite` / `clickAndSettle` (`e2e/helpers.ts`) wait for the action's `next-action` POST
   **response** instead of for the paint.
3. **The retry loops guarding the flaky bits never retried.** `toPass` waits for an in-flight call to
   return before it decides to poll again, so every inner Playwright call left on the 45 s default
   owned the loop's whole 30 s budget — one attempt, and a report blaming „the predicate". Bounding
   each inner call at 2 s (`settleSummaryPanel`, `openTransferFilters`, `pickKosztorysOption`) is what
   makes a transient absence cost one attempt instead of the test.

The rest were product changes the specs had not caught up with: the „Filtry" section is collapsed by
default since `fef44b45`, so the „Suma wybranych transakcji" tile is not in the DOM until
`openTransferFilters` opens it; and `readGridRow` counted `grid-template-columns` tokens off the
INLINE style, which reports 6 tracks for a 2-column table now that the tracks are
`minmax(min(7rem, 24vw), 16rem)` — the computed value is the honest one.

**Wall clock, warm loop, one worker, 5435 test DB**: 12 specs in 2,5 min; the earlier „2–3 h for a
full pass" was the emulated browser and is gone. Individual tests run 1–40 s, not 2–5 min.

**Restart recipe** — build once, then keep the server warm and iterate:

```bash
NEXT_DIST_DIR=.next-e2e pnpm build
set -a && source .env && set +a
DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" NEXT_DIST_DIR=.next-e2e PORT=3100 ./node_modules/.bin/next start
DB_POSTGRES_URL="$DB_POSTGRES_URL_TEST" pnpm exec playwright test --config playwright.warm.config.ts e2e/<spec>
```

**Do not run anything heavy beside a run.** A `pnpm typecheck` started alongside one starved a
`beforeAll` seed — an 8-second script — past its 300 s hook timeout, and the report blamed
`browser.newPage`. One worker on this machine means the suite wants the machine.

The measured-innocent list, so nobody re-opens it: the 3000×1400 viewport, the trace screenshots and
the server were all suspected and all cleared — TTFB stayed at 20–500 ms throughout a run whose every
action took ten seconds.

### 2026-09-18 — the last four, found only under full-suite load

A full 67-test pass surfaced four failures a per-spec loop never showed, in three shapes. All three
are written up in `lessons.md`; what they mean for the harness:

4. **A write's own `router.refresh()` is not evidence.** `findTransfersRaw` is an `unstable_cache`
   entry and a link prefetch that started before the write re-fills it AFTER `updateTag` expired the
   tag, so the refresh re-reads pre-write rows. Specs that must read back a write now call
   `refreshData` (the app's „Odśwież dane" = `revalidatePath('/', 'layout')`). This is a product race,
   not a test artefact — it is reachable by a user who hovers a link before saving, and is filed as
   **EX-808**.
5. **An exit animation hides a wrong assumption.** `client-share` clicked „Lista wydatków" to open a
   section that is open by default, and the 200 ms collapse animation kept the content mounted just
   long enough for six assertions to pass — by one millisecond, per the trace. Toggles are now read
   (`aria-expanded`) before being clicked.
6. **A click during a dialog's teardown is silently dropped.** `openExpenseDialog` retries instead of
   waiting longer.

7. **`settleWrite` waits for „a" write, not for THIS write.** `kosztorys-grid-writes` typed three
   cells whose debounces overlap on purpose and awaited only the last — but the first response to
   arrive is the FIRST cell's save, so the reload landed 100 ms later and killed the two debounces
   still pending. `settleWrites(page, count, …)` counts responses instead; the test went from 48 s
   failing to 4 s passing.

**Warm loop, 67 tests, one worker**: the target test that took 51 s while fighting its own animation
now takes 5 s.

### 2026-09-18 — the two that were the app, not the harness

The run after those four left two failures with the same signature: the written value in Postgres, the
page rendering its pre-write face, and 45 s of retrying that never moved. Both were product bugs.

8. **`revalidateTag(tag, 'default')` bought stale-while-revalidate, not invalidation — all 22 call
   sites.** The second argument is a cacheLife profile, and a named profile stamps the tag as expiring
   `profile.expire` seconds from NOW — 136 years for `'default'` — while the filesystem handler drops
   an `unstable_cache` entry only on a stamp already in the past. It does set `stale`, which
   `unstable_cache` honours by serving the old value once and recomputing in the background. On most
   of those sites that was invisible because the Server Action behind the write had already called
   `updateTag` on the same tags — the hook's call was redundant, not load-bearing. It bit where no
   action runs: a faktura uploaded through `/api/upload-file` is a Route Handler write whose only
   invalidation is the `media` afterChange hook, so `media-all` answered once without the new file and
   the row rendered „Dodaj fakturę" over a `transactions_rels` row that existed. Fixed with
   `EXPIRE_NOW` (`{ expire: 0 }`) at every site outside an action, and `EXPIRE_NEXT` (`{ expire: 1 }`)
   in `deferRefresh` — `expire: 0` there would re-render the route EX-597 stopped re-rendering.
   Written up in `lessons.md`.
9. **A poisoned cache entry never recovers on its own (EX-808 again).** `notification-recipients` read
   a list that Postgres already held, after a full navigation. A refill by a prefetch render that
   began before the write carries the refiller's own timestamp, which is later than the expiry — so
   the entry is valid, not stale, and re-reading it is pointless. Specs that read back a write now
   retry the INVALIDATION: `refreshUntil` (`e2e/helpers.ts`) re-runs „Odśwież dane" until the read
   agrees.

### 2026-09-19 — the cold run's one survivor

A full `pnpm test:e2e` (fresh build, wiped data cache, its own server) left 66/67, and re-running the
one spec warm reproduced it roughly once in three — on a DIFFERENT test of the same file each time,
which is what a shared helper's flake looks like.

10. **`page.keyboard.press('Enter')` after a cell fill commits nothing — it opens a menu.** Four specs
    typed into a grid cell as `cell.click()` → `input.fill()` → `page.keyboard.press('Enter')`, and
    the page-level press goes to `document.activeElement`. An autosave's `router.refresh()` re-renders
    the grid mid-edit, the input unmounts, and focus falls back to where Radix last restored it — the
    discount-type menu's trigger one cell over. Enter opened THAT, and an open Radix menu marks the
    rest of the document `aria-hidden`, so the next `getByRole('button', …)` in the spec found nothing
    and the report blamed the Podsumowanie toggle 30 s later. `commitCellValue(cell, value)`
    (`e2e/helpers.ts`) presses on the input locator, which re-resolves and re-focuses it, so the key
    can only reach the cell under edit. The one deliberate page-level press stays: `kosztorys-grid-writes`
    aims keystrokes at a LOCKED cell that has no input at all, and the point is that they are refused.
