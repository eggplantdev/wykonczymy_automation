---
change_id: szablon-own-structure
title: Szablon — własna struktura danych zamiast pozycji kosztorysu z martwą kopią
status: implemented
created: 2026-10-15
updated: 2026-10-15
archived_at: null
branch: szablon-own-structure
worktree: .claude/worktrees/szablon-own-structure
---

## Notes

A szablon pozycja means only "a katalog entry + sekcja + kolejność" (EX-1017). It still lives in
`kosztorys_items`, though, and that row carries its own copy of the opis, j.m., ceny, stawki,
mnożniki and tłumaczenia. The app never reads the copy: `selectKosztorysTreeData` substitutes the
katalog's values for a szablon host. Nothing refreshes the copy either, so it goes stale on the first
katalog edit. Anything that reads the table directly (the REST API, raw SQL, the AI kosztorys
scripts) takes the stale text for the opis.

Found 2026-10-15: the AI kosztorys scripts read szablon „Kosztorys 2026 kolory” through the API.
They got 3 stale opisy, and the loader added near-duplicate pozycje in two investments. The scripts
now resolve through the katalog (`itemsOfTemplate`). The model gap is still open.

Owner, 2026-10-15: research going straight to the proper model, with no intermediate step. While the
app is still small, a change of this size is cheap.

**Decided (owner, 2026-10-15): separate tables, no B, no intermediate step.** Fallback B (blanked
copy columns in `kosztorys_items`) is rejected. Szablon rows living in the kosztorys table was a
carry-over from the Google-sheet era, when a szablon was a copy of a sheet. That framing keeps
producing wrong decisions about what a szablon is. A szablon is katalog references in sections, in
order, and the schema must say so.

**Decided (owner, 2026-10-15): the szablon leaves `investments` entirely.** It gets its own table with
the unique name, its own kosz entry, its own „Wersje” and its own editor route; it does not keep an
investments row as a holder. Rationale: a szablon kept as an investment leaves every investment query
having to exclude it (6 such filters today), which is the same kind of compromise as the dead copy.

Done 2026-10-15, ahead of the change:

- Prod: 47 of the 50 „Wersje” of szablon „Kosztorys 2026 kolory” deleted (owner's go). They predated
  EX-1017 and carried no katalog links, so restoring one revived the dead copy. The 3 left (12.10) are
  fully linked. The trashed „Kosztorys 2026” keeps its 6; it auto-purges around 2026-11-07.
- „Aktualizuj pozycję w katalogu prac” hidden in a szablon (`use-kosztorys-editor.ts`). EX-1017
  scoped it to kosztorys; in a szablon it read the stale row copy and would push it over the katalog.
  Only the UI hides it: `saveItemToCatalogueAction` still accepts a szablon pozycja (stale tab or a
  direct call, management only). Owner, 2026-10-15: no server refusal now — it goes away with the
  szablon's own tables.
- Residual until this change lands: restoring a szablon version after one of its katalog entries was
  deleted still brings that praca back unlinked, with its old copy (`insert-kosztorys-tree.ts:74-77`).
  An FK on the new table removes it.

Research: `research.md`.

## Plan decisions (owner, 2026-10-15)

1. **Editor writes through injected actions.** The szablon gets its own action set
   (`lib/actions/template-*.ts`, own gate); the route hands the shared editor its action set (prop /
   hook — never `KosztorysEditorProvider`, EX-496). Kosztorys actions stay untouched and carry no
   „is this a szablon” branch. Rejected: branching inside each action (the exclusion compromise moved
   into actions) and a separate szablon editor (two grids that drift).
2. **„Wersje” in their own table, refs only.** `template_snapshots` (FK to the szablon, cascade); the
   payload is sections (name, colour, order) + katalog ids in order — no opis / j.m. / cena / stawki.
   A restore renders today's katalog wording (a version is „which prace, in what layout”, never „how
   they read then”); a ref to a since-deleted katalog entry is skipped with a warning. List / restore
   / GC are its own; GC copies the kosztorys bands. The 3 linked versions of „Kosztorys 2026 kolory”
   are converted by the migration. Rejected: sharing `kosztorys_snapshots` with a `template_id`
   column — it freezes the dead copy into JSON and branches every reader.
3. **Payload collections**, like `kosztorys-items` / `kosztorys-sections`: `templates`,
   `template-sections`, `template-items`. `template_snapshots` stays a raw table, like
   `kosztorys_snapshots` (no collection there either). Generated types, and REST with access
   control for the AI kosztorys scripts (one query: the szablon's prace with their katalog entry,
   nothing else to read). Editor writes stay raw SQL in `lib/db`. The hand-written migration carries
   the Payload checklist (`payload_locked_documents_rels` column per collection, lesson 1763).
   Rejected: bare SQL tables — the scripts would need their own endpoint.
4. **The trashed „Kosztorys 2026” is not migrated.** 310 prace, none linked, 6 versions — it dies with
   the old szablon rows in the destructive migration. The new tables take linked prace only, with no
   exception path from day one. Rejected: waiting for the ~2026-11-07 auto-purge (blocks the deploy
   three weeks) and cataloguing its 310 prace (near-duplicates in the katalog).
5. **Deploy: copy before, delete after** (the 20260929 pattern). Migration 1 (additive, before push)
   creates the tables and copies „Kosztorys 2026 kolory” + its 3 versions — the copy is checked on
   the DB before anything ships. Migration 2 (`RUN-AFTER-DEPLOY`) deletes the old szablon rows; then a
   Vercel Data Cache purge. Accepted windows: a szablon edit made during the build is lost (nobody
   edits a szablon for those minutes); between deploy and migration 2 the szablon shows on the
   investment lists. The whole sequence is rehearsed on staging first. Rejected: empty tables first,
   copy + delete after deploy (no lost edit, but „brak szablonów” for minutes and the copy unchecked
   until after the fact).
6. **The `szablon` status value is cut from the DB enum** in migration 2, once its rows are gone:
   recreate `enum_investments_status` without it, re-point `investments.status` (drop + restore the
   `'active'` default; `investments_szablon_name_idx` is dropped first), drop the old type. Every code
   trace of szablon-as-investment goes with it (status, badge, form option, lock constant). Rejected:
   leaving a dead value the DB still accepts.
7. **Tests: rewrite what exists, add where the change can break.** `createTestTemplate` rewritten onto
   the new tables (re-points most of the ~29 DB specs). New DB specs: each szablon action writes the
   szablon tables and never the kosztorys ones; the gate refuses a trashed szablon; a restore skips a
   praca deleted from the katalog; a name held by a trashed szablon is refused; trash + 30-day purge.
   The migration is verified once on a local prod-dump copy (counts before/after, then nothing
   szablon-shaped left in `investments`) — a plan step, not a committed spec. The 8 szablon E2E specs
   are updated, run by the owner. Rejected: a new szablon-editor E2E (mostly covered by the 8) and
   fixing only what breaks (nothing would guard the wrong-table risk of decision 1).
8. **Out of scope: a kosztorys remembering its source szablon.** No „founded from szablon X” field;
   seeding stays a one-time copy and the pickers keep listing every szablon. The change is a
   structural move with no behaviour change.
9. **Scripts that know szablon-as-investment.** Repointed: the AI kosztorys scripts
   (`context/changes/2026-10-01-ai-kosztorys-generation-tests/scripts/`, REST onto the new
   collections, replacing the `itemsOfTemplate` workaround) and the two E2E seeds as needed.
   Simplified: `fill-translations-from-catalogue`, `fill-description-translations`,
   `fix-kosztorys-descriptions` lose their „szablony included” branch — a szablon's text lives in the
   katalog they already cover. Deleted (done, unrunnable after the change, kept in git history): the
   EX-1017 one-offs `link-kosztorys-items-to-catalogue`, `sync-template-translations`.

Derived, not asked: the szablon's tree reads `DEFAULT_COEFFS` / `DEFAULT_VAT` /
`SETTLEMENT_MODE_DEFAULT` as constants. Verified on prod (read-only, 2026-10-15): both szablony carry
exactly those defaults (0.65 / 0.5525 / 8% / NET), and the totals panel that edits them is hidden in a
szablon — no capability is lost.
