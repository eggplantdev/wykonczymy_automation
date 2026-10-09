---
change_id: done-percent-vs-offer
title: „% wykonania (względem przedmiaru ofertowego)” column
status: archived
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09T07:33:15Z
branch: spike/transfer-cards
worktree: null
---

## Notes

— uwaga właściciela po EX-921: „% wykonania” i „Pozostało” liczą się od aktualizacji przedmiaru, a
brakuje mu odczytu „ile procent oferty zrobione”. Nowa kolumna obok istniejącej, liczona od
przedmiaru ofertowego; istniejąca zostaje bez zmian.

**Prod (human):** push, then `pnpm db:migrate:prod` straight after the deploy is live — both
migrations in one batch. `20261009_2` must follow the deploy (the old code reads a stored
`plannedQty` as the Aktualizacja); until the batch runs, the new columns show on the worker link and
on saved investor documents. The pre-push hook's generic „migrate BEFORE" does not apply here.

**Deviation from the plan:** `tipPlannedQty` now carries the worker's wording in all three
languages (its ru/uk text had no reader since EX-921); the editor's tip, which speaks of the margin
forecast, is a literal in `HEADER_TIPS`, like `plannedNetForPlane`.

**Archived 2026-10-09** with the tests still owed (typecheck + 10 touched specs — see `review-gate.md` § Tests & suite) and the manual checks open in `context/foundation/manual-checks.md`. The plan's rationale lives in `context/reference/kosztorys-editor-domain-notes.md` (§ „% wykonania (względem przedmiaru ofertowego)”).
