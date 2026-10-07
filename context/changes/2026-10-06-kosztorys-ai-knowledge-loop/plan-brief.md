# Kosztorys AI knowledge loop — Plan Brief

> Full plan: `context/changes/2026-10-06-kosztorys-ai-knowledge-loop/plan.md`
> Research: `context/changes/2026-10-06-kosztorys-ai-knowledge-loop/research.md`
> Spike (reference, not merged): branch `spike/kosztorys-ai-knowledge-loop`, `ff635227..c57e9a21`

## What & Why

The agent measures well but loses money on trade knowledge, which today lives only in employees'
heads. This change gives people a place to write it down: a Komentarz do pracy on each praca in the
katalog, and a review loop on the AI draft (AI przedmiar, Status, Powód zmiany). The agent can then
learn from both. The owner validated the UX in the spike on 2026-10-07.

## Starting Point

- The katalog has no comment field. Every katalog write rebuilds the whole row, so a naïvely added
  field would be wiped by „Zapisz do katalogu”.
- Kosztorys items have no AI columns. About 10 tree writers would silently drop a new column.
- Client and worker surfaces pick columns by allowlist, so new columns cannot leak.

## Desired End State

- „Komentarz do pracy” appears in „Dodaj / Edytuj pracę” and in „Nowa praca” (with the katalog
  checkbox ticked by default). It is a column in every kosztorys and szablon; clicking a cell opens the
  dialog that saves to the katalog. It is never shown to the client.
- In an AI kosztorys:
  - AI przedmiar, Status and Powód zmiany are available as columns;
  - typing Przedmiar sets the Status itself;
  - Zaakceptowana / Odrzucona write Przedmiar;
  - „Problemy” → „Przegląd AI” filters „do sprawdzenia” and „zmienione bez powodu”.
- A kosztorys without AI looks exactly as it does today.
- Toolbar toggles:
  - „Oferta” shows the offer columns at client prices;
  - „Przegląd AI” shows or hides the AI columns.

## Key Decisions Made

| Decision                    | Choice                                                                                                               | Why                                                               | Source                 |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------- |
| Where the comment lives     | On the katalog entry, read live by opis + j.m.; never copied onto rows                                               | One edit shows in every kosztorys and szablon                     | Research / owner       |
| Editing in /katalog-prac    | Field in „Dodaj / Edytuj pracę”, table column read-only                                                              | It is a property of the praca; same form as everything else       | Owner, 2026-10-07      |
| Editing in a kosztorys      | Click the cell → dialog                                                                                              | Validated in the spike; „Akcje” menu rejected                     | Spike / owner          |
| Comment wipe protection     | Candidate types omit it; a blank on „Nadpisz” never erases; the edit form seeds the stored value                     | Katalog writes rebuild whole rows                                 | Research               |
| Comment in the szablon      | Always visible in the szablon workbench                                                                              | Knowledge is curated there                                        | Plan                   |
| Status                      | Stored select; typing Przedmiar sets it (table in plan), Zaakceptowana / Odrzucona write Przedmiar                   | A derived status can't tell „not reached” from „removed”          | Spike / owner          |
| Manually added row          | Shown as „Dodana” (effective, not stored) and counted in „bez powodu”                                                | The manager owes a reason for every addition                      | Owner, 2026-10-07      |
| AI kosztorys gate           | Any row with AI przedmiar; without one there are no AI columns, filters, rules or button                             | No „with AI” switch                                               | Research / owner       |
| Who writes AI przedmiar     | A local script only; closed in the grid, the patch schema and Payload REST                                           | The agent is still being trained; the pipeline is separate        | Owner, 2026-10-07      |
| Szablon / versions / import | AI fields stripped from szablony; carried by versions and sheet re-import                                            | They are per-job evidence                                         | Research               |
| „Oferta”                    | Fixed column list + client prices; not tied to client view settings or `offer-hides-remaining`                       | It is a manager's working view, not the client document           | Owner, 2026-10-07      |
| „Przegląd AI”               | Toggle that adds / removes the AI columns over the current set; combines with „Oferta”; never written to stored prefs | Validated in the spike as a toggle                                | Owner, 2026-10-07      |
| Delivery                    | One change, one migration, 3 phases                                                                                  | Phase 1 is useful on its own                                      | Owner                  |
| E2E                         | Unit + DOM now; one scenario filed to `e2e-backlog`                                                                  | Logic is pure; the browser path is one flow                       | Owner                  |

## Scope

**In scope:** the migration (4 columns, 1 enum), the katalog field and its forms, the kosztorys and
szablon column with its dialog, the AI item fields through every writer, the status rules, the AI
diagnostics, the two toggles, the draft-loader script, and glossary entries.

**Out of scope:** the agent pipeline and the prod AI write; crew visibility of the comment (EX-1011);
comment history and authorship; rules that belong to no single praca; a stored katalog origin; tying
„Oferta” to client view settings.

## Phases at a Glance

| Phase                            | What it delivers                                                                   | Key risk                                                |
| -------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1. Komentarz do pracy            | Migration, katalog field in 3 forms, kosztorys / szablon column + dialog           | A katalog write wiping the comment                      |
| 2. AI draft review               | AI fields through every writer, status rules, gate, diagnostics, loader script     | A writer silently dropping the fields (versions/import) |
| 3. „Oferta” / „Przegląd AI”      | Two transient toggles over column selection                                        | Leaking toggle state into stored column prefs           |

**Prerequisites:** roll back the spike migration on the local DB first. Prod migrates before the push
(human).
**Estimated effort:** ~2 sessions, 3 phases.

## Open Risks & Assumptions

- Status and Przedmiar are two per-field patches. A failed second write leaves a visible, fixable
  mismatch; one undo restores both.
- A row whose opis is rewritten loses its katalog match, and its comment with it (EX-780 limit,
  accepted).

## Success Criteria (Summary)

- A comment written in one kosztorys shows in every kosztorys and szablon with that praca, and no
  katalog save erases it.
- Reviewing an AI draft needs only accept / reject clicks and typed quantities; the filters list what
  is left to do.
- No new column reaches the client, the worker or a PDF.
