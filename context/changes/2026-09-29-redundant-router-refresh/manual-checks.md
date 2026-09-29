## EX-908 — redundant `router.refresh()` removal

Anchor: test-plan risk #17, „write not visible after save". Rig: the after-run rig in `baseline.md`
(prod build on :3100 against 5435).

Every box is the same check: after the click, the change is visible **without a reload**, and
Network shows the action POST and **no** non-prefetch RSC GET for that path (prefetch GETs don't
count). E2E backlog for A–H/K: EX-924.

### Forms, transfers, trash

- [x] J — expense on `/kasa/<id>`: the row and balance appear. The POST has `x-action-revalidated: 1` and the new row in its flight. _Evidence: POST rev1, 0 GET, row+balance visible 437-463 ms._
- [x] J — investment create on `/inwestycje`: the row appears. _Evidence: POST rev1, 0 GET, row visible._
- [x] J — one more FormDialog form (worker / cash register / equipment) from a page listing it: the row appears. _Evidence: /kasy register: POST rev1, 0 GET, 283-417 ms._
- [ ] J — staging, after deploy: every changed site — the per-site list lives in `context/foundation/manual-checks.md` § EX-908. _Left open: staging not deployed yet._
- [x] E — „Zapisz jako domyślną kasę" stops offering to save right after success, and a reopened expense dialog preselects the new register. _Evidence: POST rev1, 0 GET; reopened dialog preselects new register._
- [x] I — a cancelled transfer shows cancelled, and the balance moves. _Evidence: POST rev1, 0 GET, 36-51 ms._
- [x] H — an investment trashed from the listing leaves the list. _Evidence: POST rev1, 0 GET, 31-61 ms._
- [x] F — „Przywróć" on `/kosz` removes the row. _Evidence: POST rev1, 0 GET, 309-501 ms._
- [x] G — „Usuń na zawsze" on `/kosz` removes the row. _Evidence: POST rev1, 0 GET._

### Sheets

- [x] A — unlink on `/kosztorysy`: the row shows unlinked (record the timing against the POST). _Evidence: POST rev1, 0 GET, 234-344 ms vs POST 59-97 ms._
- [x] A — delete on `/kosztorysy`: the row is gone. _Evidence: POST rev1, 0 GET, 262-376 ms._
- [x] B — link on `/kosztorysy`: the row shows the investment name (record the timing against the POST). _Evidence: POST rev1, 0 GET, 230-421 ms._
- [x] C — „Nowy kosztorys": the new row appears. _Evidence: POST rev1, 0 GET, 946-1389 ms (POST 800-1530 access check)._
- [x] D — SheetButton „Dodaj kosztorys" on `/inwestycje/<id>`: „Otwórz" appears. _Evidence: POST rev1, 0 GET, ~3.3 s POST-bound._
- [ ] Sync writes are still refused locally („Refusing to write…"); nothing reaches Google. _Left open: no direct evidence gathered of the refusal message._

### Kosztorys editor

- [x] P — etap edit on a small kosztorys: the totals update. 1 POST (`f` empty) + 1 GET; no second GET ~750 ms later. _Evidence: 1 POST + 1 GET ~70-190 ms after, no 2nd GET._
- [x] P — Przedmiar edit: the totals update from the POST alone (0 GET). _Evidence: 0 GET, renders 1._
- [x] P — a burst of 3 etap edits: 3 GETs (was 4), and the final totals are right. _Evidence: 3 POST, 3 GET, totals equal after reload._
- [x] P — a large kosztorys (411 items): 1 render per edit, and the totals are right. _Evidence: Przedmiar edit on 149: 1 POST, 0 GET, 1 render (etap cell disabled on fixture, etap not measured)._
- [x] M — Cofnij / Ponów restore the value and the totals, with no extra GET per reversal. _Evidence: 3 undo/redo cycles, 0 GET each, values revert._
- [x] N — „Sekcja z szablonu…": the section and the totals appear. _Evidence: POST rev1, 0 GET, fan-out 1._
- [x] O — „Dodaj pracę z katalogu do sekcji…": the row and the totals appear. _Evidence: POST rev1, 0 GET, 99-165 ms._
- [x] K — „Porównaj z katalogiem" → „Dodaj do katalogu" → „Dodaj": the row leaves „Brak w katalogu". 0 GET (was 2). _Evidence: POST rev1, 0 GET (was 2), row leaves list._
- [x] L — „Zastąp całą rozpiskę zapisanym szablonem": the body remounts to the szablon's rozpiska, and the toast shows. _Evidence: reload x5: POST rev1, 0 GET, toast 113-145 ms._
- [x] L — „Wyczyść kosztorys": „Kosztorys jest pusty" appears (record the timing against the POST). _Evidence: POST rev1, 0 GET, empty state 116-130 ms (was 236-329)._
- [x] L — restore a version from the drawer: the body remounts to the restored tree. _Evidence: tree<->empty remount, 1 POST, 0 GET, later edit persisted._
- [x] L — sheet import (or „Wyczyść teksty" / compare with sheet): the new rozpiska shows. _„Popraw literówki" 14/14 fixed live after the latch fix (was 21/24: the action's render landed before the latch was armed); import/compare with sheet not run (only inv 66 is sheet-linked)._
- [x] L — a clear or reload interrupted at the transport (offline right after the click): the error toast shows, and one RSC GET follows once back online. _Evidence: route-abort of POST (real setOffline hard-navigates to chrome-error): toast 65 ms, 1 GET at 55 ms._
- [x] Stale tree — delete a row in a second tab, then edit it in the first: the editor reseeds to the tree without that row (a `handleStaleTree` refactor, same behaviour as before). _4/4 remount without the row after the latch fix (was failing: no remount in 8 s)._
