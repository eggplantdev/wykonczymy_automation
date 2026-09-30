---
change_id: szablony-plain-revalidation
title: Szablony na tę samą ścieżkę rewalidacji co inwestycje, z baseline'em przed/po
status: archived
created: 2026-09-29
updated: 2026-09-30
archived_at: 2026-09-30T07:08:02Z
branch: szablony-plain-revalidation
worktree: ../wykonczymy-worktrees/szablony-plain-revalidation
---

## Notes

Linear: **EX-909** (z analizy EX-895). Po EX-908 — korzysta z tej samej metody pomiaru renderów.

Archived on the owner's call with verification still owed: `e2e/szablony-list.spec.ts` is written but
has never run (a worktree cannot build it — see `review-gate.md` § Tests & suite), `baseline.md` has
no `# After` section, and the manual checks in `manual-checks.md` § EX-909 are unticked. Until one of
those passes, the Back-to-/szablony fix is unverified in a browser.
