## EX-908 — redundant `router.refresh()` removal

Anchor: test-plan risk #16, „write not visible after save". Rig: the after-run rig in `baseline.md`
(prod build on :3100 against 5435).

Every box is the same check: after the click, the change is visible **without a reload**, and
Network shows the action POST and **no** non-prefetch RSC GET for that path (prefetch GETs don't
count). E2E backlog for A–H/K: EX-924.

### Forms, transfers, trash

- [ ] J — expense on `/kasa/<id>`: the row and balance appear. The POST has `x-action-revalidated: 1` and the new row in its flight.
- [ ] J — investment create on `/inwestycje`: the row appears.
- [ ] J — one more FormDialog form (worker / cash register / equipment) from a page listing it: the row appears.
- [ ] J — staging, after deploy: one expense on preview shows the row without a reload.
- [ ] E — „Zapisz jako domyślną kasę" stops offering to save right after success, and a reopened expense dialog preselects the new register.
- [ ] I — a cancelled transfer shows cancelled, and the balance moves.
- [ ] H — an investment trashed from the listing leaves the list.
- [ ] F — „Przywróć" on `/kosz` removes the row.
- [ ] G — „Usuń na zawsze" on `/kosz` removes the row.

### Sheets

- [ ] A — unlink on `/kosztorysy`: the row shows unlinked (record the timing against the POST).
- [ ] A — delete on `/kosztorysy`: the row is gone.
- [ ] B — link on `/kosztorysy`: the row shows the investment name (record the timing against the POST).
- [ ] C — „Nowy kosztorys": the new row appears.
- [ ] D — SheetButton „Dodaj kosztorys" on `/inwestycje/<id>`: „Otwórz" appears.
- [ ] Sync writes are still refused locally („Refusing to write…"); nothing reaches Google.

### Kosztorys editor

- [ ] P — etap edit on a small kosztorys: the totals update. 1 POST (`f` empty) + 1 GET; no second GET ~750 ms later.
- [ ] P — Przedmiar edit: the totals update from the POST alone (0 GET).
- [ ] P — a burst of 3 etap edits: 3 GETs (was 4), and the final totals are right.
- [ ] P — a large kosztorys (411 items): 1 render per edit, and the totals are right.
- [ ] M — Cofnij / Ponów restore the value and the totals, with no extra GET per reversal.
- [ ] N — „Sekcja z szablonu…": the section and the totals appear.
- [ ] O — „Dodaj pracę z katalogu do sekcji…": the row and the totals appear.
- [ ] K — „Porównaj z katalogiem" → „Dodaj do katalogu" → „Dodaj": the row leaves „Brak w katalogu". 0 GET (was 2).
- [ ] L — „Zastąp całą rozpiskę zapisanym szablonem": the body remounts to the szablon's rozpiska, and the toast shows.
- [ ] L — „Wyczyść kosztorys": „Kosztorys jest pusty" appears (record the timing against the POST).
- [ ] L — restore a version from the drawer: the body remounts to the restored tree.
- [ ] L — sheet import (or „Wyczyść teksty" / compare with sheet): the new rozpiska shows.
- [ ] L — a clear or reload interrupted at the transport (offline right after the click): the error toast shows, and one RSC GET follows once back online.
- [ ] Stale tree — delete a row in a second tab, then edit it in the first: the editor reseeds to the tree without that row (a `handleStaleTree` refactor, same behaviour as before).
