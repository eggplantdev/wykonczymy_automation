# Review-gate ledger — EX-971 worker-expenses · 2026-10-05

Scope: the 13 EX-971 commits on `staging` (`c816a010` … `b792ce30`), interleaved with other slices'
commits — reviewed per commit, not as one `base...HEAD` range. Step 0.5 (browser verification pass)
skipped: no browser driving unasked; manual checks stay in `context/foundation/manual-checks.md` § EX-971.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure` +
`module-cohesion-audit` + `structure-scatter-audit`, `comment-noise-audit` (flag-only).

## Findings

- [ ] 🟡 WARNING · fixed (spec not yet run) · code-review · `src/migrations/20261005_3_add_worker_expense_drafts.ts:13-15` · `ON DELETE CASCADE` on worker / investment / kasa, and no draft probe in their delete blockers: „Usuń na zawsze" erased a draft before anyone decided it — owner's call (2026-10-05): a pending draft blocks the delete and the trash of its pracownik / inwestycja / kasa (`countPendingDrafts` probe in all three blockers), a manager accepts or rejects it first. A decided draft still goes with the CASCADE: an accepted one's expense blocks the delete on its own, a rejected one is accepted loss (its draft-only photos stay in Blob unreferenced)
      test: TDD · integration — `lib/db/worker-expense-drafts.db.test.ts` „a pending draft blocks the delete until a manager decides it"; box checks once it has run green
- [ ] 🟡 WARNING · fixed (spec not yet run) · impl-review + code-review · `src/components/transfers/transfer-table-server.tsx:71-76`, `src/components/dashboard/manager-dashboard.tsx:47-48` · „Zgłoszone wydatki" prepended the rejected drafts on page 1 regardless of the other filters — owner chose (A): `buildRejectedDraftScope` narrows them by inwestycja / kasa / the Warsaw day sent, and hides them under a filter on a field a draft lacks (Typ without wydatek inwestycyjny, pracownik, kategoria, kwota, id, „Tylko anulowane"); the SQL in `listRejectedExpenseDrafts`. Sort still does not reach them — they stay a page-1 block above the transfers
      test: TDD · unit + integration — `lib/queries/transfer-filters.test.ts` „buildRejectedDraftScope", `lib/db/worker-expense-drafts.db.test.ts` „refused drafts under the transfers filters"; box checks once both have run green
- [ ] 🟡 WARNING · fixed (spec not yet run) · impl-review · `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts` · the EMPLOYEE write paths added after the plan (edit, add photo, remove photo, delete, restore, the investment/kasa target check) had no spec — authored: foreign/inactive kasa + investment without etap refused on send and edit; another worker's draft and a decided draft refused for edit/append/remove/delete; foreign photo not appended; last photo kept; delete reclaims the photos; „Przywróć" only from rejected (run as OWNER — it is a manager's action) — all asserted on the persisted rows
      test: TDD · integration — box checks once the spec has run green
- [x] filed EX-997 · slice-review-gate · E2E obligation (plan § Testing Strategy: „E2E — do backlogu") · worker sends → manager sees the row in Transakcje → accepts with the dialog → the expense is booked; crosses client → action → DB → revalidation, so it is browser-level — filed EX-997 (`e2e-backlog`, „Wykonczymy")
- [x] 🟡 WARNING · fixed · impl-review · `context/changes/2026-10-05-worker-expenses/plan.md`, migration `:8` · plan drift: the owner's post-implementation changes (worker edits a pending draft, „Zobacz" dialog, rejected rows + „Przywróć", the filter) were not recorded; the migration comment still says the kasa is the default one copied at send time
- [x] 🟡 WARNING · dismissed · impl-review · `src/migrations/20261005_3_add_worker_expense_drafts.ts` · migration owed on preview and prod — a deploy-time gate, not a code finding (AGENTS.md § Migrations); carried as a reminder in the close-out
- [x] 🔵 OBSERVATION · fixed · code-review · `src/components/worker-expenses/worker-expense-drafts-section.tsx:43-46` · the dialog offers an inactive kasa, and sending from it fails with the misleading „To nie jest Twoja kasa"
      test: no automated test — a one-line list filter at the call site; the server refusal it front-runs is pinned by the Step 3 integration spec
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/worker-expense-drafts.ts:185` · editing re-runs the investment/kasa check even when neither changed, so a worker taken off the investment can no longer fix the note on his waiting draft — owner (2026-10-05): keep it; the manager still sees and decides the draft
- [x] 🔵 OBSERVATION · skipped · impl-review + code-review · `src/lib/actions/transfers.ts:160` · a draft accepted as several lines tags only the first expense, so „Zgłoszone wydatki" shows one of them — tagging all of them needs a draft→expense 1:N table; the draft still records its first expense and the photos sit on every line
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `src/lib/db/worker-expense-drafts.ts:246-253` · two concurrent removals of the last two photos can both pass the „more than one page" guard — needs one worker double-clicking two different photos inside one round-trip; the draft is still deletable whole
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `src/components/worker-expenses/pending-expense-drafts.tsx:63-95` · a worker's edit made while a manager has the draft open is not seen by the open dialog — five users, the manager sees the photos and inwestycja before saving; a version check costs more than the race
- [x] 🔵 OBSERVATION · dismissed · impl-review · F8 „CASCADE leaks media" — same root as the first finding, tracked there
- [x] fixed · code-review · `src/lib/actions/worker-expense-drafts.ts` · the session preamble (`requireAuth` → `workerId` → `runAuthorizedHandler`) is copied into five actions — one `workerAction` helper
- [x] fixed · code-review · `src/lib/db/worker-expense-drafts.ts:287-290,307-310`, `src/lib/db/media-ownership.ts:13-16` · three hand-rolled `IN (…)` lists — `sqlList`
- [x] fixed · code-review · `src/lib/db/worker-reports.ts:199` · the option-A filter needed the same `inList` helper worker reports had privately — moved to `lib/db/sql-list.ts`, both read it
- [x] fixed · code-review · `src/lib/actions/worker-expense-drafts.ts:33,89,154,157` · „Za dużo zdjęć w jednym zgłoszeniu" and „Nie udało się dołączyć zdjęć" spelled twice each — module constants
- [x] fixed · code-review · `src/lib/actions/worker-expense-drafts.ts:148` · adding photos reads the whole draft (joins + media JSON) only to count its pages — a count query; ownership/pending is already enforced by the append statement
- [x] fixed · feature-first-structure · `src/lib/db/worker-expense-drafts.ts:5-6`, `src/components/worker-expenses/draft-status-badge.tsx:5-9` · status vocabulary (`EXPENSE_DRAFT_STATUSES`, `ExpenseDraftStatusT`, labels) lives in a DB module and a component — moved to the constants module, as `report-status.ts` does for worker reports
- [x] fixed · structure-scatter-audit · `src/lib/constants/expense-drafts.ts` · the one module of the feature not named after it — renamed `worker-expense-drafts.ts`
- [x] dropped · feature-first-structure · `src/components/worker-expenses/pending-expense-drafts.tsx:71-87` · extract `draftToExpensePrefill` into `forms/expense-form/` — one consumer, nothing to share
- [x] dropped · structure-scatter-audit · `src/hooks/media/prevent-referenced-delete.ts:22`, `src/lib/media/delete-unreferenced-media.ts:103` · a raw-table media-reference registry beside `MEDIA_RELATIONS` — one raw table today; a registry of one is indirection, revisit at the second
- [x] dismissed · module-cohesion-audit · `TransferRowT` mappers in two homes (`lib/queries/fetch-transfer-rows.ts`, `lib/transfers/rejected-draft-row.ts`) — different sources (transaction doc vs draft row), each beside its consumer
- [x] fixed · tailwind-v4-audit · `src/components/worker-expenses/draft-status-badge.tsx:12` · the amber pending tone is the second status-pill copy (`worker-report-status-badge.tsx:10`) — `BADGE_TONE.pending`, both read it; `ROLE_COLORS.ADMIN` keeps its own literal (same colour, unrelated meaning)
- [x] fixed · comment-noise · `src/migrations/20261005_3_add_worker_expense_drafts.ts:4` · feature summary that restates the table names — trimmed to the why
- [x] fixed · comment-noise · `src/lib/db/media-ownership.ts:4` · JSDoc restates the function name
- [x] fixed · comment-noise · `src/lib/db/worker-expense-drafts.ts:280` · JSDoc restates the signature
- [x] fixed · comment-noise · `src/lib/actions/worker-expense-drafts.ts:44` · restates the two checks below it
- [x] fixed · comment-noise · `src/lib/actions/worker-expense-drafts.ts:134` · „read off the session like the send" — absorbed by `workerAction`
- [x] fixed · comment-noise · `src/components/worker-expenses/expense-draft-dialog.tsx:35` · restates the optional prop
- [x] fixed · comment-noise · `src/components/worker-expenses/expense-draft-dialog.tsx:63` · restates `hasPhotos`
- [x] fixed · comment-noise · `src/components/worker-expenses/expense-draft-pages-cell.tsx:23` · duplicates the `isEditable` rule the DB layer already states
- [x] fixed · comment-noise · `src/types/transfers.ts:48`, `src/components/forms/expense-form/expense-form.tsx:73` · restate the field name
- [x] fixed · manual-checks · `context/foundation/manual-checks.md:3732` · stale filter label „Zgłoszenia pracowników" (the UI says „Zgłoszone wydatki")

## Gate 2 — the uncommitted fixes of gate 1 · 2026-10-05

Scope: `git diff 530f8713` + untracked `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts`,
`src/lib/db/sql-warsaw-day.ts`, `src/lib/utils/list-param.ts`. Same fan-out as gate 1.

- [ ] 🟡 WARNING · fixed (spec not yet run) · code-review · `src/lib/db/worker-expense-drafts.ts` `restoreRejectedExpenseDraft` · a rejected draft does not block its pracownik / inwestycja / kasa going to the trash, so „Przywróć" re-opened a draft whose party sat in the trash — holding back its purge, with a kasa nobody can book into. Owner (2026-10-05): such a refusal disappears from „Zgłoszone wydatki" and „Przywróć" refuses it (`PARTIES_NOT_TRASHED` in the list and the restore UPDATE)
      test: TDD · integration — `lib/db/worker-expense-drafts.db.test.ts` „a refusal whose %s is in the trash is neither listed nor restored"; box checks once it has run green
- [x] 🟡 WARNING · fixed · code-review · `src/lib/constants/cash-register-lock.ts`, `src/lib/*/delete-blocker.ts` · the pending-draft probe also locks a kasa's owner (`guard-update.ts:47-49`), but the message said „która ma transakcje", and every refusal told the manager to move transakcje — owner (2026-10-05): keep the lock, fix the wording; „…lub zgłoszenia wydatków do rozpatrzenia", „Zgłoszenia wydatków najpierw przyjmij lub odrzuć." appended when a draft blocks, the transakcje hint only when transakcje do
      test: no automated test — message wording; `cash-registers-update-guard.test.ts` imports the constant, manual-checks § EX-971 covers the sentence
- [ ] 🟡 WARNING · fixed (spec not yet run) · code-review · `src/__tests__/lib/db/worker-expense-drafts.db.test.ts`, `src/__tests__/lib/actions/worker-expense-drafts-worker.db.test.ts` `afterAll` · the leftover pending drafts now block `deleteTestInvestment`, swallowed by `.catch` — both investments leaked into the shared DB on every run; drafts deleted first
      test: no automated test — the teardown itself; box checks once both specs have run green
- [x] fixed · code-review · `src/lib/actions/run-action.ts` · `workerAction` (any-role session preamble) hand-rolled beside `protectedAction` — `sessionAction` in `run-action.ts`, both share `authorizedAction`; `deleteOrphanedMediaAction` and `changeOwnCredentialsAction`, which spelled the same preamble, read it too
- [x] fixed · code-review · `src/components/worker-expenses/worker-expense-drafts-section.tsx` · the inline active-kasa filter duplicated `isActiveRef`
- [x] fixed · reuse-scan · `src/lib/utils/list-param.ts` · `listParam` private to `worker-report-filters.ts` and an `idsOrNull` copy in `transfer-filters.ts` — one helper
- [x] fixed · reuse-scan · `src/lib/db/sql-warsaw-day.ts` · the Warsaw-day `SENT_DAY` fragment spelled in `worker-reports.ts` and `worker-expense-drafts.ts` — `warsawDayWithin`
- [x] fixed · simplify · `src/lib/db/worker-expense-drafts.ts` `pendingDraftsProbe` · the same pending-draft probe object spelled in three blockers — one factory; `countPendingDrafts` no longer exported
- [x] fixed · simplify · `src/__tests__/lib/db/worker-expense-drafts.db.test.ts` · four hand-written `decideExpenseDraft(… 'rejected' …)` calls — a local `reject`
- [x] fixed · impl-review · `context/changes/2026-10-05-worker-expenses/plan.md:62-66,338` · „What We're NOT Doing" still listed what the owner reversed (re-deciding, worker edit/delete, the delete block), and „przyjęte i tak blokuje" was imprecise (the worker only through his kasa, and only until the expense is cancelled)
- [x] fixed · comment-noise · `src/components/ui/badge.tsx:8`, `src/lib/actions/worker-expense-drafts.ts:80`, `src/__tests__/lib/db/worker-expense-drafts.db.test.ts:222`, `src/__tests__/lib/queries/transfer-filters.test.ts:275`, `src/lib/queries/transfer-filters.ts` · restated the keys, the action name, the test name, the parameter list
- [x] fixed · prettier · `src/components/worker-reports/worker-report-status-badge.tsx:12`, `src/components/ui/badge.tsx:8` · over the print width
- [x] dropped · code-review · `src/lib/queries/transfer-filters.ts` junk list params · a non-numeric `?investment=` parses to `[]` and lists nothing — hand-typed URL only, and „nothing" is the honest answer
- [x] dropped · code-review · `src/lib/db/worker-expense-drafts.ts` · `createdBy` set on the draft but not on its media rows — raw fixture-shaped asymmetry, nothing reads it
- [x] dropped · code-review · `src/lib/constants/worker-expense-drafts.ts` · `EXPENSE_DRAFT_STATUSES` exported with no importer — it types `ExpenseDraftStatusT`; not worth the churn
- [x] dismissed · comment-noise · `src/components/worker-expenses/expense-draft-dialog.tsx` · restore the removed prop comment — gate 1 decided it

## Simplify pass

No separate `/simplify` run — every fix-now finding was applied directly in the main thread and is a `fixed` line in ## Findings / ## Gate 2.

## Tests & suite

Authored, not run yet (waiting on the go): `lib/actions/worker-expense-drafts-worker.db.test.ts` (new), new cases in `lib/db/worker-expense-drafts.db.test.ts` and `lib/queries/transfer-filters.test.ts`. Typecheck / lint / suite not run — deferred by user.
