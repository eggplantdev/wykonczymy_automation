# Manual verification — kosztorys-stages (S-04)

Separate manual-check tracker for the slice (per the 10x-implement manual gate, externalized
from `plan.md` Progress). Record each result inline; when all pass, the plan's Progress rows
4.5–4.10 get flipped and the slice can be committed → prod-migrated → archived.

- **Status:** PENDING author sign-off
- **Scope:** Phase 4 (Editor UI) only. Phases 1–3 manual rows already confirmed (1.5, 2.5, 2.6, 3.4).
- **Build state:** all automated legs green (typecheck / lint / 758 unit / build); code uncommitted.

## Setup

1. Dev server against **local docker Postgres 5433** (the S-04 migration is already applied there).
   Often lands on `:3001` if `:3000` is busy.
   ```bash
   pnpm dev
   ```
2. Log in as **OWNER or MANAGER** (stage controls require MANAGEMENT_ROLES). The `ADMIN`/`PASS`
   env is stale — mint a temp OWNER via the Local API script (`skipRevalidation`) if needed.
3. Open an existing investment's **Kosztorys** tab (`/inwestycje/<id>/kosztorys`). Use a test
   kosztorys with ≥1 section and a few items across the three price views.

> Reset the local DB from a dump only if you must — it wipes anything entered locally since the
> last `pnpm db:dump`. These checks don't require a reset.

## Checks

Mark each `[x]` PASS / `[!]` FAIL and add a one-line note.

- [ ] **4.5 — Add stage → new column; second stage → existing rows show 0.**
      Click `＋ etap`. A new "Etap N" column appears (this is the remount-key check — if no column
      appears, `stagesKey` isn't forcing the dsg remount). Click `＋ etap` again → a second column;
      existing rows show `0`, not blanks.
      Result:

- [ ] **4.6 — Rename a stage via its header, persists across refresh.**
      Type a label into the stage header input, blur (or Enter). Reload the page (or trigger
      `router.refresh()`). The label sticks. Empty label → header shows the `Etap N` placeholder and
      persists `null` (not the literal "Etap N"). Tabbing through the header without a change issues
      **no** write (no-op guard).
      Result:

- [ ] **4.7 — Progress entry → Pozostało recomputes live; view toggle recomputes.**
      Enter a done-quantity in a stage cell. "Pozostało" updates immediately and equals
      `row net − Σ(stage qty × view price − discount)` by hand. Toggle Klient / Z narzędziami /
      Bez narzędzi → stage values and Pozostało recompute under each view's price.
      Result:

- [ ] **4.8 — Progress persists across reload; no duplicate row on re-entry (upsert).**
      Reload → the entered quantities are still there. Re-edit the _same_ item×stage cell to a new
      value → it updates in place (the `ON CONFLICT` upsert), does not create a duplicate
      `stage_progress` row. (Spot-check row count in the DB if unsure.)
      Result:

- [ ] **4.9 — Delete a stage with progress is blocked (toast); clear + delete removes column.**
      With a non-zero quantity recorded in a stage, click its header ✕ → blocked with the toast
      "Najpierw wyczyść ilości wpisane w tym etapie"; the column stays. Clear all quantities in that
      stage to 0, click ✕ again → the column disappears.
      Result:

- [ ] **4.10 — EMPLOYEE no access; sections/items/reorder/discount unchanged; financials unchanged.**
      As an EMPLOYEE, the kosztorys editor is still inaccessible. As OWNER/MANAGER, existing
      behaviour is intact: add/remove/reorder items, rename/remove sections, discount edits, the
      three price views, per-section subtotals. Transfer balances / marża / bilela figures elsewhere
      in the app are unaffected (this slice is additive).
      Result:

## Sign-off

- **Verified by:**
- **Date:**
- **Overall:** ☐ all pass ☐ issues found (list below)
