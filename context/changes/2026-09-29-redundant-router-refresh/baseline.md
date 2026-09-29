# Baseline — before (EX-908)

Measured 2026-09-29 on a clean worktree at `4c3ee036`, prod build (`.next-e2e`,
`pnpm test:e2e:warm:server`) on :3100 against the 5435 test DB, OWNER `e2e@wykonczymy.test`,
Playwright MCP Chrome at 2400×1300.

Per flow:

- **POST** = Server Action requests (`next-action`), with `x-action-revalidated` and response bytes.
- **GET** = non-prefetch `RSC: 1` requests, i.e. `router.refresh()` round-trips, with their offset
  from the click.
- **PF** = prefetch requests in the window.
- **renders** = server-side page renders counted from `[PERF]` lines (a route-specific line per
  render; `buildKosztorysTree` for the editor).
- **visible** = click → proof element visible, ms.
- Window = click → proof + 3 s. First (cold) run discarded.

Raw notes stay in this file so the after-run can be diffed row by row.

## J — expense create on `/kasa/5` (`use-form-submit.ts:61`, optimistic path)

Four warm runs, `createBulkTransferAction`, one line item.

| run | POST | revalidated | POST bytes | GET                    | GET offset | PF  | visible |
| --- | ---- | ----------- | ---------- | ---------------------- | ---------- | --- | ------- |
| 0   | 1    | 1           | 24 146     | 1 `/kasa/5`            | 232        | 34  | 431     |
| 1   | 1    | (not read)  | —          | 1 `/kasa/5`            | 394        | 34  | 625     |
| 2   | 1    | 1           | 24 106     | 1 `/kasa/5` (24 182 B) | 258        | 34  | 1191    |
| 3   | 1    | 1           | 24 097     | 1 `/kasa/5`            | 206        | 34  | 438     |

Server: 4 creates → **8** `kasa/5 fetchReferenceData` renders and 8 `TransferTableServer` renders,
i.e. **2 full page renders per save**. The first comes from the POST (`x-action-revalidated: 1`,
about 24 KB flight). The second is the `router.refresh()` GET, which re-downloads the same
about 24 KB.

The 34 prefetches per save are the nav links being re-prefetched after the router cache is
invalidated. The after-run will show whether they come from the refresh or from the action.

## I — cancel an expense on `/kasa/5` (`cancel-transfer-button.tsx:46`)

Three warm runs (a fresh expense created, unmeasured, before each).

| run | POST | revalidated | POST bytes | GET                    | GET offset | PF  | visible |
| --- | ---- | ----------- | ---------- | ---------------------- | ---------- | --- | ------- |
| 0   | 1    | 1           | 24 048     | 1 `/kasa/5` (24 169 B) | 233        | 34  | 428     |
| 1   | 1    | —           | —          | 1 `/kasa/5`            | 293        | 34  | 529     |
| 2   | 1    | —           | —          | 1 `/kasa/5`            | 303        | 34  | 575     |

Server: 3 × `cancelTransferAction` → **6** `kasa/5` renders (2 per cancel).

## E — „Zapisz jako domyślną kasę” in the expense dialog on `/kasa/5` (`save-default-register-button.tsx:42`)

Six warm runs alternating Igor ↔ Kasa główna Bartek. The label flip is local, so „visible” measures
the client and not the round-trip.

| run | POST | revalidated | POST bytes | GET                    | GET offset | PF  | visible |
| --- | ---- | ----------- | ---------- | ---------------------- | ---------- | --- | ------- |
| 0   | 1    | 1           | 23 921     | 1 `/kasa/5`            | 133        | 34  | 158     |
| 1   | 1    | 1           | 23 930     | 1 `/kasa/5`            | 99         | 34  | 157     |
| 2   | 1    | 1           | 23 886     | 1 `/kasa/5`            | 66         | 34  | 120     |
| 3   | 1    | 1           | 23 916     | 1 `/kasa/5`            | 113        | 34  | 152     |
| 4   | 1    | 1           | 23 885     | 1 `/kasa/5` (23 936 B) | 83         | 34  | 164     |
| 5   | 1    | 1           | 23 930     | 1 `/kasa/5` (24 157 B) | 79         | 34  | 140     |

Server: 6 × `setDefaultCashRegisterAction` → **12** `kasa/5` renders (2 per click). The whole
register page is re-rendered twice to store a user preference.

Recorder note: a `—` in revalidated/bytes means `requestfinished` details were not read in time.
The request itself was counted. The server-side render count is the authoritative figure.

## J (investment form), H, F, G — investment lifecycle on `/inwestycje` and `/kosz`

Four cycles: create (`use-form-submit`) → trash from listing (H) → restore on `/kosz` (F) → trash
again (unmeasured) → delete forever (G). Cycle 0's create/H/F are the cold run.

| flow             | run | POST                | GET (path, bytes)      | GET offset | PF  | visible |
| ---------------- | --- | ------------------- | ---------------------- | ---------- | --- | ------- |
| J invest. create | 0   | 1 (rev 1, 25 963 B) | 1 `/inwestycje` 25 973 | 86         | 76  | 201     |
|                  | 1   | 1                   | 1 `/inwestycje` 25 936 | 110        | 76  | 288     |
|                  | 2   | 1                   | 1 `/inwestycje`        | 294        | 79  | 1437    |
|                  | 3   | 1                   | 1 `/inwestycje` 25 972 | 107        | 76  | 243     |
| H trash          | 0   | 1 (rev 1, 25 886 B) | 1 `/inwestycje`        | 274        | 24  | 409     |
|                  | 1   | 1                   | 1 `/inwestycje`        | 344        | 24  | 530     |
|                  | 2   | 1 (rev 1, 25 902 B) | 1 `/inwestycje`        | 304        | 24  | 434     |
|                  | 3   | 1 (rev 1, 25 903 B) | 1 `/inwestycje`        | 297        | 24  | 423     |
| F restore        | 0   | 1                   | 1 `/kosz` 13 787       | 61         | 24  | 115     |
|                  | 1   | 1                   | 1 `/kosz`              | 67         | 24  | 108     |
|                  | 2   | 1 (rev 1, 13 674 B) | 1 `/kosz` 13 760       | 67         | 24  | 123     |
|                  | 3   | 1 (rev 1, 13 649 B) | 1 `/kosz`              | 58         | 24  | 822     |
| G delete forever | 0   | 1                   | 1 `/kosz` 13 804       | 315        | 24  | 437     |
|                  | 1   | 1                   | 1 `/kosz`              | 371        | 24  | 458     |
|                  | 2   | 1                   | 1 `/kosz`              | 285        | 24  | 426     |
|                  | 3   | 1                   | 1 `/kosz`              | 287        | 24  | 431     |

Every flow does **1 POST that already carries the re-rendered page (`x-action-revalidated: 1`,
same size as the GET) plus 1 refresh GET of the same route**. So each flow is 2 page renders
where 1 would do. `/inwestycje` and `/kosz` log no `[PERF]` line, so these counts come from
network data only.

## P — grid autosave + the 700 ms trailing `router.refresh()` (`use-kosztorys-editor.ts:157,1279`)

Small fixture inv 383 (1 section, 3 items, 2 etapy); large inv 149 „Kopernika 2a Marki” (14
sections, 411 items; a real kosztorys from the dump). Inv 7 (1000 synthetic items) is `completed`,
so its editor is read-only and cannot be used for this.

Window = commit → +4–5 s. `renders` = `buildKosztorysTree` lines.

| flow                                                                   | runs                          | POST / edit                            | GET / edit (offset from commit)                                                   | renders / edit  |
| ---------------------------------------------------------------------- | ----------------------------- | -------------------------------------- | --------------------------------------------------------------------------------- | --------------- |
| etap edit (`setStageProgressAction`, `deferRefresh`), 383              | 5                             | 1 (117 B, `f` empty)                   | **2** — about 560 ms (deferRefresh follow-up) and about 750 ms (trailing refresh) | **2**           |
| Przedmiar edit (`updateItemFieldAction`, item hook → POST render), 383 | 5                             | 1 (renders)                            | **1** at about 755 ms (trailing refresh)                                          | **2**           |
| burst of 3 etap edits (3 rows, typed back to back), 383                | 3                             | 3                                      | **4** — 3 follow-ups + 1 coalesced trailing refresh (e.g. 570/607/653/843 ms)     | **4** per burst |
| Przedmiar edit, 149 (411 items)                                        | 3 warm (run 0 did not commit) | 1 — **52 KB encoded / 395 KB decoded** | 1 at about 760–910 ms — **52 KB / 395 KB**                                        | **2**           |

On 149 `buildKosztorysTree` takes 30–140 ms per render and the 7-fetch fan-out 32–170 ms. The
trailing refresh doubles both the server work and the 395 KB flight on every edit. The one case
where it genuinely coalesces is a burst: 3 edits cost 4 GETs, not 6.

Encoded/decoded sizes come from `performance.getEntriesByType('resource')`. The Playwright
`sizes()` read fails on streamed flight responses.

Grid refresh count in the existing spec (`kosztorys-grid-writes.spec.ts:136-137`, `≤ typed×2`): 4 for
3 typed, which passes today.

## M — undo/redo via „Opcje” → Cofnij / Ponów, inv 384 (`use-kosztorys-editor.ts:773`)

Three cycles: Przedmiar 22 → 99 (unmeasured), then Cofnij, then Ponów.

| run    | POST                | GET (offset)         | visible |
| ------ | ------------------- | -------------------- | ------- |
| undo 0 | 1                   | 1 (38 146 B, 688 ms) | 667     |
| redo 0 | 1                   | 1 (38 192 B, 636 ms) | 549     |
| undo 1 | 1 (rev 1, 37 907 B) | 1 (457 ms)           | 584     |
| redo 1 | 1                   | 1 (432 ms)           | 545     |
| undo 2 | 1 (rev 1, 37 881 B) | 1 (364 ms)           | 506     |
| redo 2 | 1                   | 1 (369 ms)           | 510     |

Server: every undo/redo = `updateItemFieldAction` + **2** `buildKosztorysTree` (POST render via
the item hook plus the refresh GET). The GET carries the same ~38 KB as the POST. Only one GET per
reversal was seen, so the reversal's `router.refresh()` and the P trailing refresh did not stack.

## N — „Dodaj” → „Sekcja z szablonu…”, inv 384 (`use-kosztorys-editor.ts:1033` `handleAppendedSections`)

One section („Wiatrołap”, 1 poz.) from szablon „Kosztorys 2026 kolory” (inv 166). Each run is
followed by an unmeasured „Usuń sekcję” so 384 goes back to its fixture shape.

| run      | POST                | GET (offset) | PF  | visible |
| -------- | ------------------- | ------------ | --- | ------- |
| 0 (cold) | 1                   | 1 (172 ms)   | 26  | 173     |
| 1        | 1 (rev 1, 38 239 B) | 1 (149 ms)   | 26  | 150     |
| 2        | 1                   | 1 (117 ms)   | 26  | 121     |
| 3        | 1 (rev 1, 38 203 B) | 1 (119 ms)   | 26  | 120     |

Server per append: `appendPresetSectionsAction` reads the source szablon inside the handler (one
`buildKosztorysTree` on inv 166, not a render), then **2** `kosztorys_v2/384` fan-outs, one from the
POST and one from the `router.refresh()` GET. The picker's `getPresetSectionOptions` read happens when the dialog
opens, not on submit.

**Render counter note.** A page render is one `kosztorys_v2/<id> 7-fetch fan-out` line.
`buildKosztorysTree` over-counts wherever a handler builds a tree itself (the szablon source here,
the predicate check in `removeSectionAction`). The P/M counts above are unaffected: their actions
log no in-handler build.

### Control — „Usuń sekcję” (`handleRemoveSection`, no `router.refresh()`)

1 POST (rev 1, 37 872 B), **0 GET**, visible 47 ms. Server: 1 in-handler `buildKosztorysTree`
plus **1** fan-out. This is the target shape for every row above: the POST render alone.

## O — „Akcje sekcji” → „Dodaj pracę z katalogu do sekcji…”, inv 391 (`use-kosztorys-editor.ts:1059` `handleAppendedCatalogueItems`)

One catalogue praca („Montaż i demontaż kratek wentylacyjnych”) into „Sekcja beta”, removed again
(unmeasured, „Usuń pozycję”) after each run.

| run      | POST                | GET (bytes, offset)  | PF  | visible |
| -------- | ------------------- | -------------------- | --- | ------- |
| 0 (cold) | 1                   | 1 (172 ms)           | 26  | 178     |
| 1        | 1 (rev 1, 38 319 B) | 1 (38 274 B, 133 ms) | 26  | 135     |
| 2        | 1                   | 1 (71 ms)            | 26  | 72      |
| 3        | 1 (rev 1, 38 354 B) | 1 (38 288 B, 73 ms)  | 26  | 73      |

Server: `insertCatalogueItemsAction` + **2** `kosztorys_v2/391` fan-outs per insert. The GET fires
as the row is patched in (offset ≈ visible), so it re-downloads the ~38 KB the POST just delivered.

## K — „Problemy” → „Porównaj z katalogiem…” → „Dodaj do katalogu” → „Dodaj”, inv 390 (`catalogue-compare-dialog.tsx:167` + `useFormSubmit`)

Three saves, one per „Brak w katalogu” praca of the fixture (each adds a real catalogue row to the
test DB, the same as `work-catalogue.spec.ts` does).

| run      | POST                | GET (offsets)     | PF  | visible |
| -------- | ------------------- | ----------------- | --- | ------- |
| 0 (cold) | 1                   | **2** (70, 70 ms) | 26  | 115     |
| 1        | 1 (rev 1, 37 990 B) | **2** (61, 61 ms) | 26  | 64      |
| 2        | 1                   | **2** (79, 79 ms) | 26  | 83      |

Server: 3 × `createCatalogueItemAction` → **9** `kosztorys_v2/390` fan-outs, i.e. **3 renders per
save**. This confirms the research: the POST render, plus the `onSaved` refresh, plus
`useFormSubmit`'s own refresh. The two GETs leave in the same tick and are not coalesced; one of
them came back with a readable size, 38 251 B.

## L — `handleTreeReplaced` (`kosztorys-editor-v2.tsx:44`), inv 389

Measured: „Opcje” → „Zastąp całą rozpiskę zapisanym szablonem” → „Wczytaj i zastąp”, using
szablon „EX909 baseline B” (2 sections / 3 items, saved from 388 in the EX-909 baseline), and
„Opcje” → „Wyczyść kosztorys…” → „Wyczyść”, alternated. Visible for reload = the „Wczytano: …”
toast; for clear = „Kosztorys jest pusty”. 389 is left holding szablon B's rozpiska (the E2E seed
mints a fresh 389-equivalent per run).

| run             | POST                | GET (offset) | PF  | visible |
| --------------- | ------------------- | ------------ | --- | ------- |
| reload 0 (cold) | 1 (rev 1, 38 041 B) | 1 (92 ms)    | 26  | 110     |
| reload 1        | 1 (rev 1, 38 090 B) | 1 (93 ms)    | 26  | 112     |
| reload 2        | 1 (rev 1, 38 067 B) | 1 (103 ms)   | 26  | 113     |
| reload 3        | 1                   | 1 (127 ms)   | 26  | 133     |
| clear 0         | 1                   | 1 (146 ms)   | 26  | 329     |
| clear 1         | 1 (rev 1, 37 872 B) | 1 (119 ms)   | 26  | 245     |
| clear 2         | 1 (rev 1, 37 804 B) | 1 (117 ms)   | 26  | 236     |

Server: every `reloadFromPresetAction` / `clearKosztorysAction` → **2** `kosztorys_v2/389`
fan-outs (7 ops → 14). `reloadFromPresetAction` also builds the source szablon's tree and the
target's tree in the handler (not renders).

**Watch in the after-run:** on clear, „Kosztorys jest pusty” shows up about 120 ms _after_ the
refresh GET (236–329 ms vs a GET at 117–146 ms). The reload toast shows up at the GET offset. So the
empty state may be painted from the refreshed tree and not from the POST's flight. If removing
the refresh delays or loses the empty state, that is a regression, not noise.

Not measured: sheet import, „Wyczyść teksty”, compare-with-sheet and restore-version. They share
the same `handleTreeReplaced` success path; the `catch` paths are covered by the research, not by
a timing.

## A, B, C — sheet actions on `/kosztorysy` (`linked-sheet-actions.tsx:39,49`, `link-sheet-to-investment-dialog.tsx:49`, `add-sheet-dialog.tsx:55`)

Visible = the row in its new state (unlinked row / investment name / row gone / new row). Cycle for
delete: C add „EX908” (test sheet `1qN68…`) → B link to 386 „E2E Cofanie granica 1790678238596” →
A delete. Unlink/link-back used kosztorys 44 „Marcin Olszewski Altowa 12 - Oleg Hnatiuk” (inv 66).
End state checked in the DB: 44 linked to 66, no `1qN68` row, 386 without a sheet.

| flow                  | runs | POST                     | GET (offset)                | PF  | visible   |
| --------------------- | ---- | ------------------------ | --------------------------- | --- | --------- |
| A unlink (44 ← 66)    | 0–2  | 1 (rev 1, ~23.4–23.5 KB) | 1 `/kosztorysy` (82–145 ms) | 62  | 228–317   |
| B link back (44 → 66) | 0–2  | 1 (rev 1, ~23.2 KB)      | 1 (72–128 ms)               | 66  | 310–326   |
| B link EX908 → 386    | 1–3  | 1                        | 1 (88–268 ms)               | —   | 219–814   |
| A delete              | 0–3  | 1 (rev 1, ~23.3–23.4 KB) | 1 (66–272 ms)               | 60  | 226–868   |
| C add                 | 1–3  | 1 (rev 1, 23 349 B)      | 1 (549–1 086 ms)            | 62  | 823–1 328 |

C's action takes about 920 ms, most of it the Google access check (`verifySheetAccess`, reader
account). Server logs 2 `fetchAllSheets` per add. The material-sync and `setupTab` writes were
refused by the credential gate ("Refusing to write…"), as intended. `/kosztorysy` has no page-level
`[PERF]` line (`query.fetchAllSheets` logs only on a cache miss), so for A–C the network log is the
render counter: **2 renders per action** (POST + refresh GET).

**Watch in the after-run:** on A and B the row state shows up about 150–200 ms _after_ the refresh
GET. So it may be painted from the refreshed payload and not from the POST. If the row lags or stays
stale without the refresh, that is a regression.

## D — SheetButton → „Dodaj” → „Dodaj kosztorys” on `/inwestycje/386` (`sheet-setup-dialog.tsx:43`)

Pasted the test sheet URL (`1qN68…`). Visible = the „Otwórz” link on the investment page. Cleanup
after each run: `/kosztorysy` → „Usuń kosztorys”. End state: no `1qN68` row, 386 without a sheet.

| run      | POST                    | GET (offset)                   | PF  | visible |
| -------- | ----------------------- | ------------------------------ | --- | ------- |
| 0 (cold) | 1 (header not captured) | 1 `/inwestycje/386` (3 199 ms) | 31  | 3 362   |
| 1        | 1 (rev 1, 18 166 B)     | 1 (3 075 ms)                   | 31  | 3 374   |
| 2        | 1 (header not captured) | 1 (2 847 ms)                   | 31  | 3 327   |
| 3        | 1 (header not captured) | 1 (3 284 ms)                   | 31  | 3 833   |

`linkSheetAction` takes 2.8–3.2 s on the server (access check plus the refused sync writes), so the
action dominates and the refresh GET lands right after the POST. Server per add (run 0): **2**
`inwestycje/386 data fetch` + 2 `InvestmentSummaryPanel`, i.e. POST render + refresh render.
"Header not captured" means the probe missed the POST's response headers on a ~3 s response, so it
is not a missing `x-action-revalidated`. The 2-render count comes from the server log.

---

# After — EX-908

Same rig (prod build on :3100, 5435 test DB), driven by standalone Playwright/CDP Chromium instead of
the MCP browser (busy). Renders = `[PERF]` lines. First cold run per flow discarded from the numbers
below. POST = `next-action` requests, GET = non-prefetch `RSC: 1`, PF = prefetches (unchanged vs before).

## Per flow

| flow                                   | POST           | GET                              | PF      | renders/save | visible ms                            |
| -------------------------------------- | -------------- | -------------------------------- | ------- | ------------ | ------------------------------------- |
| J expense /kasa/5                      | 1 (rev 1)      | 0                                | 34      | 1            | 437-463                               |
| I cancel                               | 1 (rev 1)      | 0                                | 34      | 1            | 36-51                                 |
| E default register                     | 1 (rev 1)      | 0                                | 34      | 1            | 133-509                               |
| J investment create                    | 1 (rev 1)      | 0                                | 78-80   | -            | 321-1228                              |
| H trash / F restore / G delete forever | 1 (rev 1) each | 0                                | 24-26   | -            | 31-61 / 309-501 / -                   |
| J register /kasy                       | 1 (rev 1)      | 0                                | 26      | -            | 283-417                               |
| A unlink / B link / C add / A delete   | 1 (rev 1) each | 0                                | 106-110 | 1            | 230-376 (C 946-1389, POST-bound)      |
| D SheetButton                          | 1 (rev 1)      | 0                                | 31      | 1            | 3058-3494 (POST 2.6-3.2 s)            |
| P etap 383                             | 1              | 1 (70-190 ms after POST; no 2nd) | 26      | 1            | -                                     |
| P Przedmiar 383                        | 1              | 0                                | 26      | 1            | -                                     |
| P burst of 3 etap                      | 3              | 3                                | 26      | 3            | totals equal after reload             |
| P large 149 (Przedmiar x3)             | 1              | 0                                | 26      | 1            | 106-154                               |
| M undo/redo                            | 1              | 0                                | 26      | 1            | 321-443 / 331-340 (incl ~300 ms menu) |
| N section from template                | 1              | 0                                | 26      | fan-out 1    | 126-518                               |
| N remove section                       | 1              | 0                                | -       | 1            | -                                     |
| O catalogue item                       | 1              | 0                                | 26      | 1            | 99-165                                |
| K compare -> Dodaj do katalogu         | 1              | 0                                | 26      | 1            | 91-150                                |
| L reload szablon                       | 1              | 0                                | 26      | 1            | 113-145                               |
| L clear                                | 1              | 0                                | 26      | 1            | 116-130                               |
| L restore version                      | 1              | 0                                | -       | 1            | body remounts, no reload              |

## Delta

| flow                    | before GET / renders    | after | delta             | visible ms before -> after                  |
| ----------------------- | ----------------------- | ----- | ----------------- | ------------------------------------------- |
| J expense               | 1 GET / 2               | 0 / 1 | -1 GET, -1 render | - -> 437-463                                |
| I cancel                | 1 / 2                   | 0 / 1 | -1, -1            | - -> 36-51                                  |
| E                       | 1 / 2                   | 0 / 1 | -1, -1            | - -> 133-509                                |
| A/B/C/A-delete          | 1 / 2                   | 0 / 1 | -1, -1            | - -> 230-376                                |
| D                       | 1 / 2                   | 0 / 1 | -1, -1            | POST-bound ~3.3 s both                      |
| P etap                  | 2 GET (2nd ~750 ms) / 2 | 1 / 1 | -1, -1            | -                                           |
| P Przedmiar             | 1 / 2                   | 0 / 1 | -1, -1            | -                                           |
| P burst of 3            | 4 / 4                   | 3 / 3 | -1, -1            | -                                           |
| M undo/redo             | 1 / 2                   | 0 / 1 | -1, -1            | - -> 321-443 (incl menu)                    |
| N section from template | 1 / 2                   | 0 / 1 | -1, -1            | 120-173 -> 126-518 (POST 115-292 in window) |
| O catalogue             | 1 / 2                   | 0 / 1 | -1, -1            | 72-178 -> 99-165                            |
| K compare               | 2 / 3                   | 0 / 1 | -2, -2            | 64-115 -> 91-150                            |
| L clear                 | 1 / 2                   | 0 / 1 | -1, -1            | 236-329 -> 116-130 (painted from POST)      |
| L reload                | 1 / 2                   | 0 / 1 | -1, -1            | 110-133 -> 113-145                          |

Visible times that rose (N, O, K) are POST-bound: the window now ends at the POST render instead of a
refresh GET that used to land inside a fast window; no visible regression beyond POST latency.

## Latch paths and PF

- Restore version: tree -> empty and empty -> tree both remount from the action's own render (1 POST, 0 GET); edit right after remount saved and persisted. OK.
- Zastap szablonem / Wyczyść: remount without reload, 1 POST, 0 GET. OK.
- Popraw literówki: 1 POST, 0 GET, live grid updates in ~21 of 24 runs. INTERMITTENT STALE in 3 early runs (grid kept the typo until reload; POST flight and DB had the fix; toast not seen). Cause: the latch was armed in `.then`, after the action's render had already committed, so it waited for a change that had already happened. Fixed by arming from the pre-action token (`use-restore-remount.test.tsx` "remounts when the fresh tree landed before it was armed"); after the fix 14/14 runs updated live.
- Compare with sheet / sheet import: UNPROVEN. Only inv 66 is sheet-linked ("Pobierz z arkusza Google…", "Porównaj z arkuszem…" present) and running import would overwrite its data; writes to Google are refused locally by design.
- Interrupted clear: route-abort of the POST (real `setOffline` makes Next hard-navigate to chrome-error, toast lost, tree intact after reload). Abort: toast „Czyszczenie przerwane" at 65 ms, 1 RSC GET at 55 ms, tree unchanged.
- Stale tree: FAILED. Tab 2 deletes a row, tab 1 edits it: POST1 NOT_FOUND, toast „Kosztorys zmienił się…" (~966 ms), POST2 (`refreshDataAction`) rev 1 and its flight (replayed) lacks the deleted row, but tab 1 never remounted (DOM marker survived 8 s); reload showed the row gone. After the latch fix (arm from the token on screen when `handleStaleTree` runs, not from the render order): 4/4 runs on 383/384/391 remount without the row. Most likely the same ordering race as „Popraw literówki"; not proven, because no build of `4c3ee036` was measured.
- PF question: PF counts are unchanged (26 editor, 34 kasa, 106-110 sheets); prefetches come from the action's invalidation, not from the removed refresh.

Deviations: CDP Chromium instead of MCP browser; worktree `node_modules` is a real copy; renders counted from `[PERF]`; etap edit on the 411-item fixture not measured (cell disabled); fixtures 389/390 drifted, 3 `ARKASA-*` registers and some catalogue rows left in 5435.
