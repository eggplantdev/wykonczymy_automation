# Review-gate ledger — EX-971 worker-expenses · 2026-10-05

Scope: the 13 EX-971 commits on `staging` (`c816a010` … `b792ce30`), interleaved with other slices'
commits — reviewed per commit, not as one `base...HEAD` range. Step 0.5 (browser verification pass)
skipped: no browser driving unasked; manual checks stay in `context/foundation/manual-checks.md` § EX-971.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure` +
`module-cohesion-audit` + `structure-scatter-audit`, `comment-noise-audit` (flag-only).

**Trimmed at archive (2026-10-05).** The 30 closed `fixed` lines are gone — their record is the commit
that landed them. What stays is what git cannot hold: the dismissals, drops, skip and filing, plus the
five fixes whose specs had not run when the change archived. Pre-trim tally across both gates: 30 fixed,
5 fixed-not-yet-run (open), 1 filed (EX-997), 5 dismissed, 7 dropped, 1 skipped.

## Findings

- [ ] 🟡 WARNING · fixed (spec not yet run) · code-review · `src/migrations/20261005_3_add_worker_expense_drafts.ts:13-15` · `ON DELETE CASCADE` on worker / investment / kasa, and no draft probe in their delete blockers: „Usuń na zawsze" erased a draft before anyone decided it — owner's call (2026-10-05): a pending draft blocks the delete and the trash of its pracownik / inwestycja / kasa (`countPendingDrafts` probe in all three blockers), a manager accepts or rejects it first. A decided draft still goes with the CASCADE: an accepted one's expense blocks the delete on its own, a rejected one is accepted loss (its draft-only photos stay in Blob unreferenced)
      test: TDD · integration — `lib/db/worker-expense-drafts.db.test.ts` „a pending draft blocks the delete until a manager decides it"; box checks once it has run green
- [ ] 🟡 WARNING · fixed (spec not yet run) · impl-review + code-review · `src/components/transfers/transfer-table-server.tsx:71-76`, `src/components/dashboard/manager-dashboard.tsx:47-48` · „Zgłoszone wydatki" prepended the rejected drafts on page 1 regardless of the other filters — owner chose (A): `buildRejectedDraftScope` narrows them by inwestycja / kasa / the Warsaw day sent, and hides them under a filter on a field a draft lacks (Typ without wydatek inwestycyjny, pracownik, kategoria, kwota, id, „Tylko anulowane"); the SQL in `listRejectedExpenseDrafts`. Sort still does not reach them — they stay a page-1 block above the transfers
      test: TDD · unit + integration — `lib/queries/transfer-filters.test.ts` „buildRejectedDraftScope", `lib/db/worker-expense-drafts.db.test.ts` „refused drafts under the transfers filters"; box checks once both have run green
- [ ] 🟡 WARNING · fixed (spec not yet run) · impl-review · `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts` · the EMPLOYEE write paths added after the plan (edit, add photo, remove photo, delete, restore, the investment/kasa target check) had no spec — authored: foreign/inactive kasa + investment without etap refused on send and edit; another worker's draft and a decided draft refused for edit/append/remove/delete; foreign photo not appended; last photo kept; delete reclaims the photos; „Przywróć" only from rejected (run as OWNER — it is a manager's action) — all asserted on the persisted rows
      test: TDD · integration — box checks once the spec has run green
- [x] filed EX-997 · slice-review-gate · E2E obligation (plan § Testing Strategy: „E2E — do backlogu") · worker sends → manager sees the row in Transakcje → accepts with the dialog → the expense is booked; crosses client → action → DB → revalidation, so it is browser-level — filed EX-997 (`e2e-backlog`, „Wykonczymy")
- [x] 🟡 WARNING · dismissed · impl-review · `src/migrations/20261005_3_add_worker_expense_drafts.ts` · migration owed on preview and prod — a deploy-time gate, not a code finding (AGENTS.md § Migrations); carried as a reminder in the close-out
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/worker-expense-drafts.ts:185` · editing re-runs the investment/kasa check even when neither changed, so a worker taken off the investment can no longer fix the note on his waiting draft — owner (2026-10-05): keep it; the manager still sees and decides the draft
- [x] 🔵 OBSERVATION · skipped · impl-review + code-review · `src/lib/actions/transfers.ts:160` · a draft accepted as several lines tags only the first expense, so „Zgłoszone wydatki" shows one of them — tagging all of them needs a draft→expense 1:N table; the draft still records its first expense and the photos sit on every line
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `src/lib/db/worker-expense-drafts.ts:246-253` · two concurrent removals of the last two photos can both pass the „more than one page" guard — needs one worker double-clicking two different photos inside one round-trip; the draft is still deletable whole
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `src/components/worker-expenses/pending-expense-drafts.tsx:63-95` · a worker's edit made while a manager has the draft open is not seen by the open dialog — five users, the manager sees the photos and inwestycja before saving; a version check costs more than the race
- [x] 🔵 OBSERVATION · dismissed · impl-review · F8 „CASCADE leaks media" — same root as the first finding, tracked there
- [x] dropped · feature-first-structure · `src/components/worker-expenses/pending-expense-drafts.tsx:71-87` · extract `draftToExpensePrefill` into `forms/expense-form/` — one consumer, nothing to share
- [x] dropped · structure-scatter-audit · `src/hooks/media/prevent-referenced-delete.ts:22`, `src/lib/media/delete-unreferenced-media.ts:103` · a raw-table media-reference registry beside `MEDIA_RELATIONS` — one raw table today; a registry of one is indirection, revisit at the second
- [x] dismissed · module-cohesion-audit · `TransferRowT` mappers in two homes (`lib/queries/fetch-transfer-rows.ts`, `lib/transfers/rejected-draft-row.ts`) — different sources (transaction doc vs draft row), each beside its consumer

## Gate 2 — the uncommitted fixes of gate 1 · 2026-10-05

Scope: `git diff 530f8713` + untracked `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`,
`src/lib/db/sql-warsaw-day.ts`, `src/lib/utils/list-param.ts`. Same fan-out as gate 1.

- [ ] 🟡 WARNING · fixed (spec not yet run) · code-review · `src/lib/db/worker-expense-drafts.ts` `restoreRejectedExpenseDraft` · a rejected draft does not block its pracownik / inwestycja / kasa going to the trash, so „Przywróć" re-opened a draft whose party sat in the trash — holding back its purge, with a kasa nobody can book into. Owner (2026-10-05): such a refusal disappears from „Zgłoszone wydatki" and „Przywróć" refuses it (`PARTIES_NOT_TRASHED` in the list and the restore UPDATE)
      test: TDD · integration — `lib/db/worker-expense-drafts.db.test.ts` „a refusal whose %s is in the trash is neither listed nor restored"; box checks once it has run green
- [ ] 🟡 WARNING · fixed (spec not yet run) · code-review · `src/__tests__/lib/db/worker-expense-drafts.db.test.ts`, `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts` `afterAll` · the leftover pending drafts now block `deleteTestInvestment`, swallowed by `.catch` — both investments leaked into the shared DB on every run; drafts deleted first
      test: no automated test — the teardown itself; box checks once both specs have run green
- [x] dropped · code-review · `src/lib/queries/transfer-filters.ts` junk list params · a non-numeric `?investment=` parses to `[]` and lists nothing — hand-typed URL only, and „nothing" is the honest answer
- [x] dropped · code-review · `src/lib/db/worker-expense-drafts.ts` · `createdBy` set on the draft but not on its media rows — raw fixture-shaped asymmetry, nothing reads it
- [x] dropped · code-review · `src/lib/constants/worker-expense-drafts.ts` · `EXPENSE_DRAFT_STATUSES` exported with no importer — it types `ExpenseDraftStatusT`; not worth the churn
- [x] dismissed · comment-noise · `src/components/worker-expenses/expense-draft-dialog.tsx` · restore the removed prop comment — gate 1 decided it

## Simplify pass

No separate `/simplify` run — every fix-now finding was applied directly in the main thread and is a `fixed` line in ## Findings / ## Gate 2.

## Tests & suite

Authored, not run yet (waiting on the go): `lib/actions/worker-expense-drafts-worker.db.test.ts` (new), new cases in `lib/db/worker-expense-drafts.db.test.ts` and `lib/queries/transfer-filters.test.ts`. Typecheck / lint / suite not run — deferred by user.
