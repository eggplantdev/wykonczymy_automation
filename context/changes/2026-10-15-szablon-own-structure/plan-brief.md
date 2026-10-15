# Szablon — own structure — Plan Brief

> Full plan: `context/changes/2026-10-15-szablon-own-structure/plan.md`
> Research: `context/changes/2026-10-15-szablon-own-structure/research.md`

## What & Why

A szablon is a list of katalog references grouped into sections and put in order. It is stored as an
investment with `status = 'szablon'`, though, and its prace sit in `kosztorys_items`, each row
carrying a dead copy of the katalog's opis, ceny, stawki and tłumaczenia. Anyone who reads the table
directly gets stale text; the AI scripts added near-duplicate pozycje this way on 2026-10-15. This
change gives the szablon a schema that cannot hold a copy.

## Starting Point

Since EX-1017 the app hides the copy behind a katalog overlay in `selectKosztorysTreeData`, and six
investment readers filter szablony out by hand. „Wersje” are full `kosztorys_snapshots` payloads, and
the kosz is shared with investments. Prod has one live szablon (302 prace, all linked, 3 wersje) and
one trashed szablon with nothing linked.

## Desired End State

Szablony live in `templates` → `template-sections` → `template-items`; each item is a non-null FK to
the katalog entry and nothing else. „Wersje” live in `template_snapshots` and store references only.
The szablon has its own kosz kind. `investments` has no szablon rows and no `szablon` status. For
the owner, `/szablony` behaves exactly as it does today.

## Key Decisions Made

| Decision            | Choice                                                                | Why (1 sentence)                                                                  | Source   |
| ------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| Model               | Separate tables, no intermediate blanked-copy step                    | The schema should say what a szablon is; fallback B keeps the wrong framing.      | Research |
| Holder              | The szablon leaves `investments` entirely                             | Six hand-written exclusion filters are the same compromise as the dead copy.      | Research |
| Editor writes       | The route injects the action set; template actions get their own gate | Kosztorys actions get no szablon branch, and there is still one grid.             | Plan     |
| „Wersje”            | Own `template_snapshots` table, refs only                             | A restore uses today's katalog wording; a deleted katalog praca is skipped.       | Plan     |
| Storage             | Payload collections + raw snapshot table                              | Generated types and REST access for the AI scripts; writes stay raw SQL.          | Plan     |
| Trashed szablon     | Not migrated, deleted in M2                                           | None of its 310 prace are linked, and waiting for the purge blocks for 3 weeks.   | Plan     |
| Deploy              | M1 copies before the push; M2 (RUN-AFTER-DEPLOY) deletes after        | The copy is checked on the DB before anything ships.                              | Plan     |
| Enum                | `szablon` cut from `enum_investments_status` in M2                    | No dead value left in the DB.                                                     | Plan     |
| Tests               | Rewrite `createTestTemplate`, add new DB specs, update existing E2E   | Guards the wrong-table risk of injected actions.                                  | Plan     |
| Source link         | None — a kosztorys does not remember its szablon                      | This is a structural move with no behaviour change.                               | Plan     |
| Coefficients / VAT  | Constants                                                             | Both prod szablony hold the defaults, and the panel is hidden in a szablon.       | Plan     |

## Scope

**In scope:**

- 4 new tables and M1.
- Template data layer and gate.
- Editor action injection.
- Every szablon flow: list, create, rename, save / overwrite, reload, append, seed, katalog delete.
- „Wersje”, kosz kind and purge.
- Removing szablon-as-investment from the code.
- Scripts, E2E updates and docs.
- M2, authored after the deploy.

**Out of scope:**

- A source-szablon link.
- Kosztorys behaviour changes.
- Any change to `KosztorysEditorProvider`.
- A new szablon E2E spec.
- Per-szablon coefficients.
- Migrating the trashed „Kosztorys 2026”.

## Architecture / Approach

Phases 1–6 build the new plane beside the old one, which keeps working. Phase 7 removes the old path
from the code, while the old rows stay in the DB. React-free logic goes in
`lib/kosztorys/templates/`, statements in `lib/db/template*.ts` and mutations in
`lib/actions/template-*.ts`. A template tree is served in the shape the editor already reads, and
`serializeTemplate` feeds the existing seed / reload / append functions unchanged.

## Phases at a Glance

| Phase                          | What it delivers                                             | Key risk                                                      |
| ------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------- |
| 1. Schema + M1                 | Tables + copy of the live szablon and its 3 versions          | Nine-item Payload migration checklist; counts must match      |
| 2. Data layer + gate           | Tree read, statements, gate, serialize, test helper           | Tree shape drift vs `selectKosztorysTreeData`                 |
| 3. Actions + injection         | Editor writes through the injected set                        | Wrong-plane write (id spaces overlap); kosztorys regressions  |
| 4. Szablony in circulation     | All create / copy / katalog paths on the new tables           | Many entry points (lead, form, dialogs)                       |
| 5. „Wersje”                    | Ref-only versions, restore skips deleted katalog prace        | Restore inside the transaction handle                         |
| 6. Kosz                        | Own trash kind + purge                                        | A raw reader missing its `trashed_at` filter                  |
| 7. Leave investments           | No szablon branch or status left in the code                  | Leftover rows until M2 must not throw                         |
| 8. Scripts, E2E, docs          | Repointed scripts, updated specs, living docs                 | AI scripts relying on the old REST shape                      |
| 9. M2 after deploy             | Old rows and enum value gone                                  | Authored too early, it rides `db:migrate:prod` before the code ships |

**Prerequisites:**

- The worktree is on `szablon-own-structure`.
- A fresh prod dump is loaded locally for the M1 and M2 rehearsals.

**Estimated effort:** ~3–4 sessions, implemented in one go. Phase 9 comes after the prod deploy.

## Open Risks & Assumptions

- A szablon edit made during the M1 → deploy build window is lost. The owner accepted this.
- Between the deploy and M2, the szablon shows on investment lists. Accepted, a few minutes.
- The four E2E specs are updated but run by the owner, so they are unverified until then.
- Assumption: no live kosztorys code path needs `investments.content_edited_at` once szablony leave.
  This is checked in Phase 9.

## Success Criteria (Summary)

- The owner edits, versions, trashes and restores „Kosztorys 2026 kolory” exactly as before.
- The AI scripts read a szablon through REST and get current katalog wording, with no workaround.
- The DB cannot hold a szablon praca without a katalog entry, or a szablon investment.
