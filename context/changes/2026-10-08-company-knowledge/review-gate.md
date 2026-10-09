# Review-gate ledger — company-knowledge (EX-1032) + EX-1030 Komentarz AI follow-up · 2026-10-09

Scope: `bb6c51b3b..e3af6b1b7` (c15fd7ae2 … e3af6b1b7) plus the uncommitted EX-1030 edit to
`src/components/kosztorys/editor/grid/cells/ai-review-columns.tsx` (blank cell when nothing to say,
multi-item answers comma-joined), its change.md and manual-checks wording.

Verification pass (Step 0.5) skipped — the browser pass needs Playwright, which runs only on request;
manual checks live in `context/foundation/manual-checks.md` § EX-1032 / EX-1030.

## Findings

- [x] 🟡 WARNING · fixed · code-review · `company-knowledge-book.tsx` save · a created entry sat in the list
      under a negative temp id, so it could be dragged, edited or deleted with an id the server rejects —
      root cause removed (simplify/altitude): create is no longer optimistic, „Zapisz” waits for the id
      test: TDD · unit (dom) — `company-knowledge-button.test.tsx` „puts a created entry on top once the server has given it an id”
- [x] 🟡 WARNING · fixed · code-review · `company-knowledge-book.tsx` save · a refused create/edit
      closed the form and lost the typed text — the draft comes back unless the code is NOT_FOUND
      test: test-driven debugging · unit (dom) — „keeps the typed entry…”, „puts a refused edit back…”; the edit spec goes red with the restore removed
- [x] 🔵 OBSERVATION · fixed · code-review · `company-knowledge-book.tsx` write · a NOT_FOUND
      (entry deleted by another manager) rolled the stale list back — the book is now refetched
      test: TDD · unit (dom) — „reloads the book when the entry was already deleted elsewhere”; red with the refetch removed
- [x] 🔵 OBSERVATION · fixed · impl-review (F4) · `lib/queries/company-knowledge.ts` · the EMPLOYEE
      refusal of the read had no spec
      test: TDD · unit — `lib/actions/company-knowledge.test.ts` now refuses the read too and asserts nothing was queried
- [x] 🔵 OBSERVATION · fixed · code-review · `cells/ai-review-columns.tsx` · the Komentarz AI rule
      (blank when nothing to say, comma-joined items) had no spec — moved to `lib/kosztorys/ai-review-columns.ts`
      test: TDD · unit — `lib/kosztorys/ai-review-columns.test.ts`
- [x] 🔵 OBSERVATION · fixed · impl-review (F5) · `dump-knowledge-prod.ts` · `sort=displayOrder` had no
      tiebreak — `sort=displayOrder,id` (Payload REST splits on commas, `sanitizeSortParams`)
      test: no automated test · — a context/ script run by hand against prod
- [x] 🔵 OBSERVATION · fixed · code-review · company-knowledge write paths · no spec covered a write —
      covered by the four DOM specs above
- [x] 🟡 WARNING · dismissed · impl-review (F2) · `lib/actions/company-knowledge.ts` · every write
      re-renders the calling route — accepted precedent, documented in lessons.md
- [x] 🔵 OBSERVATION · skipped · code-review · `company-knowledge-book.tsx` write · overlapping writes
      roll back to a snapshot that may predate the other write — with NOT_FOUND refetched, this needs a
      DB error during an overlap; not worth a queue
- [x] 🔵 OBSERVATION · dismissed · code-review · REQUEST_FAILED should refetch too — the refetch is a
      server action and fails the same way
- [x] 🔵 OBSERVATION · dismissed · impl-review (F6) · plan drift — neutral, recorded here
- [x] 🔵 OBSERVATION · dismissed · impl-review (F7) · old „nic” comments in drafts — local DB cleaned,
      prod holds none (the loader is local-only)
- [x] 🔵 OBSERVATION · dismissed · code-review · comma-joined items could be ambiguous — owner's ruling
- [x] dismissed · code-review · its own three self-dismissed candidates — verified benign by the reviewer
- [x] dismissed · feature-first-structure · `src/types/company-knowledge.ts` placement — precedent in
      fleet, leads, trash, notifications
- [x] dismissed · impl-review · two AGENTS.md doc nits — not introduced by this slice
- [x] dismissed · impl-review · `context/changes/2026-10-01-ai-kosztorys-generation-tests/change.md`
      rules list duplicates the seeded book — it maps 1:1 to the 9 seeds, records each rule's source,
      and already says „where the list above and the book differ, the book wins”
- [x] fixed · code-review · `company-knowledge-book.tsx` · hand-rolled order compare → `sameItems`
- [x] fixed · code-review · `company-knowledge-book.tsx` · create copied write's rollback by hand → one
      `write`; dead `?? failure` fallbacks gone
- [x] fixed · code-review · `lib/actions/company-knowledge.ts` · `CompanyKnowledgeDataT` exported, never imported → unexported
- [x] fixed · comment-noise · book (2), dialog, `lib/db` JSDoc, row prop comment — deleted; button,
      migration, dump script, Komentarz AI — trimmed
- [x] fixed · simplify (reuse) · `company-knowledge-book.tsx` · hand-rolled fold-and-filter search →
      `useSearchFilter` (`src/hooks/use-search-filter.ts`)
- [x] fixed · simplify (altitude) · `company-knowledge-book.tsx`, `knowledge-entry-row.tsx` · temp-id
      special cases (`every(id > 0)`, hidden actions, id swap) → non-optimistic create with `pending`
- [x] fixed · simplify · `company-knowledge-book.tsx` · `editing`/`order` copies of const state, nested
      `create`/`update`, generic `write`, separate one-caller `rollBack` — flattened
- [x] fixed · simplify · `company-knowledge-book.tsx` · `SORT_OPTIONS` typed against `SortT` so they can't drift
- [x] fixed · simplify · `company-knowledge-button.tsx` · dead `result.data ?? []` / `result.error ?? …`
- [x] fixed · simplify · `lib/db/company-knowledge.ts` nextTopDisplayOrder · dead `?? 0` on a COALESCE aggregate
- [x] fixed · simplify · `dump-knowledge-prod.ts` · inputs path built before CASE was checked
- [x] dropped · simplify (efficiency/altitude) · `lib/actions/company-knowledge.ts` · tag expired twice
      (collection hook + action) on create/update/delete — repo-wide convention, one cheap tag bump
- [x] dropped · simplify (reuse) · `lib/db/company-knowledge.ts` applyCompanyKnowledgeOrder · same
      `UPDATE … FROM (VALUES …)` as `renumberDisplayOrder` — that helper knows only kosztorys scopes and
      bumps `updated_at`, which this one must not; generalising for two callers costs more than it saves
- [x] dropped · simplify (reuse) · inline editor not on `useAppForm` — two trimmed fields, no dialog-in-dialog option
- [x] dropped · simplify (reuse) · Reorder list vs `column-order-dialog` — different drag models
- [x] dismissed · reuse-scan · no confirmed reinventions; repeated `toastMessage(..., 'error', 4000)`
      matches repo convention

## Simplify pass

Ran /simplify (4 agents) + primitive-reuse-scan — 9 applied, 4 dropped, 1 dismissed; each folded into

## Findings above. No separate report.

## Tests & suite

- typecheck: clean
- eslint (touched files): clean
- `company-knowledge-button.test.tsx` (9), `lib/actions/company-knowledge.test.ts` (7),
  `lib/kosztorys/ai-review-columns.test.ts` (5): 21 passed; the restore and refetch specs go red
  with their fix removed
- `components/kosztorys/editor/grid/cells/*` (13 files, 89 tests): passed
- full suite: not run — owed on the user's go
- Manual checks: `context/foundation/manual-checks.md` § EX-1032 (create step reworded for the
  non-optimistic create) and § EX-1030 — unticked, so the slice stays in review
