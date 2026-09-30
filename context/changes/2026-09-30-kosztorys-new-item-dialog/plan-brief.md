# Add a praca through a form dialog — Plan Brief

> Full plan: `context/changes/2026-09-30-kosztorys-new-item-dialog/plan.md`
> Research: `context/changes/2026-09-30-kosztorys-new-item-dialog/research.md`

## What & Why

Every „add a praca” in the kosztorys editor today appends an empty „Nowa praca” row that the owner then has to fill cell by cell. Instead, a „Nowa praca” dialog (opis, j.m., Cena j.m., stawka źródła) places the praca where it was asked for. It can also write the same praca into the katalog prac in one go (EX-951).

## Starting Point

- All five entry points (row menu „Wstaw powyżej/poniżej”, sekcja band and menu „Dodaj pracę”, toolbar „Dodaj → Praca”) funnel into two editor callbacks. Those callbacks call two server actions that mint a blank row.
- The katalog already has a form with the same fields and an overwrite-with-confirm flow („Zapisz pozycję do katalogu prac”).

## Desired End State

- Each entry point opens „Nowa praca”, and the saved praca appears at the chosen spot without a reload.
- An optional „Dodaj pracę do katalogu prac” (with Kategoria, prefilled from the sekcja) also writes the katalog entry in the same transaction.
- A collision on opis + j.m. asks: overwrite / kosztorys only / back.
- The blank-row path is gone.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Entry points | All five open the dialog; the blank row is removed everywhere | One way in, no half-filled rows | Owner 2026-09-30 |
| Przedmiar | Not in the dialog | Owner: no | Owner |
| Stawka „auto” | No override → investment współczynnik | Same as today | Owner |
| Katalog write | Optional checkbox, same transaction | Praca and katalog stay consistent | Owner |
| Kategoria | Shown only with the checkbox, prefilled with the sekcja name minus its number | Matches the existing sekcja → kategoria rule | Owner |
| Collision UX | Confirm with three buttons: „Nadpisz w katalogu” / „Tylko do kosztorysu” / „Wróć”; Escape = Wróć | "Decline = save to kosztorys only" needs a third outcome; Escape must never save | Plan |
| Kategoria on overwrite | Keep the katalog's kategoria by default; a checkbox when they differ | Same as „Zapisz pozycję do katalogu prac” | Plan |
| Checkbox default | Always off on open | The katalog is curated; nothing enters it by accident | Plan |
| Keep-open | Form fully resets; the next praca lands under the previous one (end-of-sekcja stays end-of-sekcja) | Owner: everything clean | Plan |
| Zero sekcje | Create the sekcja first, then open the dialog | Approved design; reuses the existing path | Owner / Research |
| Ceiling >65% | Warn by toast, never block | Same as placing from the katalog | Research |
| Server shape | One action with placement `end` / `next-to`; katalog helpers shared with the katalog actions | Two blank-row actions collapse into one; one overwrite implementation | Research |

## Scope

**In scope:**
- the new action;
- katalog helper extraction;
- the „Nowa praca” form and dialog;
- the three-outcome confirm;
- the host and editor wiring;
- the `showKeepOpen` store fix;
- deletion of the blank-row path;
- spec retargeting;
- the E2E spec rewrite (authored, run on request);
- domain notes.

**Out of scope:**
- Przedmiar in the dialog;
- undo for add;
- deduping the worker-report `extraAsItem` (that file is in flight);
- changes to the katalog picker or „Zapisz pozycję do katalogu prac” behaviour.

## Architecture / Approach

- **Server:** `addItemAction({placement, data, catalogue})` runs in one Payload transaction:
  1. decide the katalog outcome first (a returned refusal still commits, so no write may precede it);
  2. resolve the slot (append or insert-at under the section lock);
  3. insert the filled item;
  4. write the katalog with the same `req`.

  It returns the item, with ceiling warnings on `warning`.
- **Client:** the editor's `handleAddItem` / `handleInsertItem` keep their names but open the dialog through a stable ref. A `NewItemHost` beside `CataloguePickerHost` owns the open state, so the grid never re-renders on open. `placeNewItem` splices the returned item into the rows and unfolds the sekcja.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Server action | Filled praca at append/insert-at, optional katalog write, one transaction; retargeted DB specs | Refusal after a write would commit; ordering must hold |
| 2. Form + confirm | „Nowa praca” form from extracted stawka pieces; three-outcome collision confirm; `beforeSubmit` hook; store fix | Extraction regressing the katalog form |
| 3. Wiring + removal | Host, ref bridge, `placeNewItem`, keep-open chain; blank-row path deleted; specs, E2E and docs updated | Grid re-render on open (EX-496); stale anchor under a chain |

**Prerequisites:** local docker DB (5433) and the `db-test` container (5435) for the integration specs.
**Estimated effort:** ~2 sessions across 3 phases.

## Open Risks & Assumptions

- The client-side collision check reads the page's `workCatalogue` prop, which can be stale. The server re-checks inside the transaction and refuses a stale `'new'` with the duplicate sentence.
- `display-order.test.ts` uses the old `addItemAction` about 20 times as a fixture. A shared helper keeps that churn mechanical.

## Success Criteria (Summary)

- From any of the five entry points, the owner types a praca once and sees it at the right spot, priced correctly, without a reload.
- With the checkbox on, the same praca is in the katalog. A name clash never overwrites silently, and never loses the praca.
- No blank „Nowa praca” row can be created anywhere.
