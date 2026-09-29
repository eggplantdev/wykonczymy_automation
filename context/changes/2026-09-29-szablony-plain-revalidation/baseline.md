# Baseline — before (EX-909)

Same run and rig as `../2026-09-29-redundant-router-refresh/baseline.md`: 2026-09-29, clean
worktree at `4c3ee036`, prod build (`.next-e2e`) on :3100 against the 5435 test DB, OWNER
`e2e@wykonczymy.test`, Playwright MCP Chrome at 2400×1300. Column definitions are in that file. A
page render is one `kosztorys_v2/<id> 7-fetch fan-out` line (editor) or one request in the network
log (pages without `[PERF]`).

## 5 — „Opcje” → „Zapisz jako wzór do użycia na innych inwestycjach” (`savePresetAction`), inv 388

Control flow: it already revalidates `presets` inline and should not change.

| flow      | run      | POST                | GET | PF  | visible (click → „Zapisano szablon”) |
| --------- | -------- | ------------------- | --- | --- | ------------------------------------ |
| new       | 0 (cold) | 1 (rev 1, 38 124 B) | 0   | 26  | 109                                  |
|           | 1        | 1 (rev 1, 38 075 B) | 0   | 26  | 119                                  |
|           | 2        | 1                   | 0   | 26  | 114                                  |
| overwrite | 0        | 1 (rev 1, 38 134 B) | 0   | 26  | 126                                  |
|           | 1        | 1                   | 0   | 26  | 108                                  |
|           | 2        | 1                   | 0   | 26  | 110                                  |

Server per save: `savePresetAction` (22–50 ms, one in-handler `buildKosztorysTree` of the source)
plus **1** `kosztorys_v2/388` fan-out, the POST re-rendering the source kosztorys. That is the
opposite-direction case research §1 #5 names (a render for a list nobody is looking at); it is out
of scope and stays as is.

Created szablony, left in the test DB for the flows below: „EX909 baseline A” (overwritten 3×),
„EX909 baseline B”, „EX909 baseline C”, each 2 sections / 3 items.

## 1 — `/szablony` list render (sidebar „Szablony kosztorysów” from `/inwestycje`)

Visible = the first data row.

| flow                    | run | POST | GET (offset)          | PF  | visible |
| ----------------------- | --- | ---- | --------------------- | --- | ------- |
| click                   | 0   | 0    | 1 `/szablony` (58 ms) | 1   | 109     |
|                         | 1   | 0    | 1 (52 ms)             | 1   | 70      |
|                         | 2   | 0    | 1 (34 ms)             | 1   | 42      |
| hover 1.5 s, then click | 0   | 0    | 1 (52 ms)             | 1   | 70      |
|                         | 1   | 0    | 1 (32 ms)             | 1   | 40      |
|                         | 2   | 0    | 1 (34 ms)             | 1   | 50      |

A hover changes nothing, because the sidebar link is already viewport-prefetched. The list logs no
`[PERF]` line (warm `presets` cache), so the network log is the only counter.

## 2 — „Nowy szablon” → „Załóż” (`createEmptyPresetAction` + `router.push`)

Visible = the crumb link with the new name. `nfFlash` = a MutationObserver watching for „Nie
znaleziono” anywhere in the body, from click until +800 ms after visible.

| run | POST                 | GET (offset)               | PF  | visible | url             | crumb | „Nie znaleziono” flash |
| --- | -------------------- | -------------------------- | --- | ------- | --------------- | ----- | ---------------------- |
| 0   | 1 (132 B, no render) | 1 `/szablony/705` (264 ms) | 2   | 1 042   | `/szablony/705` | 1     | no                     |
| 1   | 1 (133 B)            | 1 `/szablony/706` (263 ms) | 2   | 1 048   | `/szablony/706` | 1     | no                     |
| 2   | 1 (132 B)            | 1 `/szablony/707` (268 ms) | 2   | 1 054   | `/szablony/707` | 1     | no                     |

Server per create: `createEmptyPresetAction` 13–21 ms plus **1** `buildKosztorysTree` (the pushed
page). The POST renders nothing (132 B), as the after-response expiry intends. That is **1 render
per create** today, and the after-run's expected cost is +1 `/szablony` render inside the POST.

rAF timeline, 2 more runs (click = 0): url + dialog gone 327 / 554 ms, crumb 627 / 865 ms, editor
body 942 / 865 ms. The crumb and the editor land about 300 ms after the URL changes, so the ~1 s
visible is the pushed page streaming in, not the action.

## 3 — szablon cell autosave, „Cena j.m. netto” (`updateItemFieldAction`)

Window = commit → +4.5–5 s. `renders` = `buildKosztorysTree` lines, since the szablon page has no
`7-fetch fan-out` line.

| fixture                                                                                                           | runs | POST / edit                            | GET / edit (offset)                           | PF  | renders / edit |
| ----------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------- | --------------------------------------------- | --- | -------------- |
| small: „EX909 baseline A” (498; 2 sections / 3 items), row „Praca szablonowa jeden”                               | 5    | 1 (rev 1, 37 773 B where read)         | 1 at 747–769 ms (the EX-908 trailing refresh) | 26  | **2**          |
| large: „EX909 baseline C” (500; `INV=500 pnpm seed:kosztorys:test` → 10 sections / 1000 items), row „Pozycja 1.2” | 4    | 1 — **59 KB encoded / 617 KB decoded** | 1 at 784–959 ms — **59 / 617 KB**             | 26  | **2**          |

On 500 the action takes 28–57 ms (one outlier 319 ms), and `buildKosztorysTree` takes 13–60 ms (one
outlier 158 ms). The after-response `presets` expiry shows no measurable cost of its own
(`revalidate 0ms`). The second render per edit is EX-908's trailing `router.refresh()`, not
anything szablon-specific.

**Ordering note for the after-run:** EX-909 ships after EX-908. Measure the after-run on a tree
that carries EX-908, and compare against this table minus the trailing GET, i.e. the expected
count is **1 render per edit**. Otherwise EX-908's delta is credited to EX-909.

`snapshotAction` (≤1 per 10 min) was not triggered in these windows. Research §2 expects +1 render
for it after the change.

## 4 — stage progress edit on a szablon — not reachable

The szablon editor forces the client view (`use-kosztorys-view-state.ts:72`, `isTemplate ?
'client'`) and hides the view menu (`kosztorys-editor-toolbar.tsx:108`). There are no etap columns,
so no UI path calls `setStageProgressAction` on a szablon (visible headers on 498 and 500: Sekcja,
Opis prac, Jednostka miary, Cena j.m. netto, the six wykonawca-price columns, Komentarz). Research
§2's „stage progress autosave” row is therefore theoretical. `opts` still has to be carried in the
template tail for any other `deferRefresh` caller.

## 6 — back to `/szablony` after a create: stale list reproduced

After flow 2, return to the list and look for the new row (no reload):

| route back                                             | runs | new row listed  |
| ------------------------------------------------------ | ---- | --------------- |
| browser Back                                           | 3    | **0 / 3**       |
| „Wróć” (`HistoryBackButton`, `router.back`)            | 1    | **0 / 1**       |
| sidebar link „Szablony kosztorysów” (fresh navigation) | 1    | 1 / 1           |
| `page.reload()`                                        | 1    | all rows listed |

So the server cache is fresh by the next request (the after-response expiry did land). What goes
stale is the **client router cache**: a back/forward navigation restores the `/szablony` payload
cached before the create, and no revalidation inside the POST ever invalidated it. The after-run
passes if Back and „Wróć” list the new row.

## Test-DB leftovers from this baseline

Szablony „EX909 baseline A/B/C” (498–500; C now holds the 1000-item perf seed) and „EX909 nowy 0–8”
(705–713, empty). Reset with `pnpm db:import:test`, or reuse them for the after-run.
