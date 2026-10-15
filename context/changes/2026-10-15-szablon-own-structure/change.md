---
change_id: szablon-own-structure
title: Szablon — własna struktura danych zamiast pozycji kosztorysu z martwą kopią
status: preparing
created: 2026-10-15
updated: 2026-10-15
archived_at: null
branch: null
worktree: null
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
