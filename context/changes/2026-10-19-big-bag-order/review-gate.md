# Review-gate ledger — big-bag-order · 2026-10-19

Scope: `4c456b4e1...6335341c9` (staging merge-base → epilogue; includes the note-save fix `164f68ed7`).
Step 0.5 (browser verification) skipped — not requested this turn; manual checks live in the registry.

## Findings

- [x] 🟡 WARNING · dismissed · impl-review + code-review · `src/components/orders/order-dialog.tsx:82` · the SMS address comes from the investment the dialog opened on, but the expense form still lets the user switch the investment (or the type) before booking — owner ruling 2026-10-19: no lock, the fields stay editable in order mode
      test: no automated test — behaviour kept as is by decision
- [x] 🟡 WARNING · fixed · code-review + impl-review · `src/components/orders/order-form-values.ts:44` · amount = quantity × price carried float residue (3 × 799.99) — now `roundToCents`
      test: TDD · unit — `order-form-values.test.ts` „rounds the amount to grosze"
- [x] 🟡 WARNING · filed · impl-review · `context/foundation/manual-checks.md` · browser-level order flow (pick → book → SMS → status toggle) has no E2E — filed EX-1117 (`e2e-backlog`)
      test: no automated test now · e2e — carried by EX-1117
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/actions/order-status.ts:34` · status toggle wrote without `user` / `updatedBy`, so the row's „zmienione przez" stayed stale
      test: TDD · integration — `order-status.db.test.ts` asserts `updated_by_id`
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/orders/order-sms-step.tsx:41` · a free-text supplier phone („+48 601-000-003 (Marek)") went into the `sms:` URI raw — now digits and `+` only
      test: TDD · DOM — `order-dialog.test.tsx` „keeps only digits and a plus of a free-text supplier number"
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/actions/order-status.ts:20` · read-then-update race on the status toggle — two people toggling the same order within ms ends on one of the two statuses, both valid; harmless at ~40 accounts
- [x] 🔵 OBSERVATION · dismissed · code-review + impl-review · `src/lib/actions/order-settings.ts:37` · setting the default supplier can overwrite a concurrent settings save — one OWNER edits these; no realistic concurrency
- [x] 🔵 OBSERVATION · dropped · code-review · `src/lib/orders/compose-order-sms.ts:20` · no warning when the investment has no address — the SMS text is shown and editable before sending
- [x] 🔵 OBSERVATION · dismissed · impl-review · plan-accepted deviations (F6 remainder, F7, F8) — each matches a decision recorded in `plan.md`
- [x] fixed · feature-first-structure · `src/components/orders/order-form-values.ts` · builder of form values lived in `lib/orders` while only the order dialog uses it — moved next to it
- [x] fixed · structure-scatter-audit · `src/lib/investments/format-address.ts` · the site-address shape was declared three times — one `SiteAddressT`
- [x] dropped · module-cohesion-audit · C1 — cosmetic split, not worth the churn
- [x] dismissed · structure-scatter-audit · S3 — `lib/orders` is the established home for order logic, not a competing one
- [x] fixed · comment-noise-audit · `src/collections/transfers.ts`, `expense-form.tsx`, `order-settings-schema.ts`, `order-status.ts` · 5 restating comments deleted
- [x] fixed · comment-noise-audit · `expense-form.tsx`, `find-category-by-name.ts`, `constants/orders.ts` · 3 comments trimmed to their reason
- [x] dismissed · comment-noise-audit · `src/collections/investments.ts:104`, `src/lib/actions/order-settings.ts:16` · flagged comments carry a real "without this, ___ breaks" — kept
- [x] fixed · simplify · `src/components/orders/order-form-values.ts:45` · default expense category now via `resolveExpenseCategoryId`, the same exact match the plain expense form uses
- [x] fixed · simplify · `src/lib/orders/find-category-by-name.ts:7` · dead blank-fragment guard removed (only constant labels reach it); spec's blank case dropped with it
- [x] fixed · simplify · `src/components/orders/default-supplier-button.tsx:21` · dead `if (!selectedId)` — the button renders only with ≥ 1 supplier
- [x] fixed · simplify · `src/components/forms/expense-form/expense-form.tsx:216` · nested ternary → `prefill?.values ?? orderValues ?? …`
- [x] fixed · simplify · `src/lib/actions/order-status.ts:16` · hand-rolled `isOrderStatus` guard → `validateAction(z.enum(ORDER_STATUSES))`
- [x] fixed · simplify · `src/components/orders/order-dialog.tsx:67` · no-op `className="h-auto"` removed
- [x] fixed · simplify · `src/components/orders/order-sms-step.tsx:74` · warnings via `Description tone="error" withIcon={false}` (same look)
- [x] fixed · simplify · `src/components/ui/settings-card.tsx` · order-settings card duplicated the recipient-list card shell — both now render `SettingsCard`
- [x] fixed · simplify · `src/components/forms/hooks/form-api-of.ts` · three hand-written array-field types → one `ArrayFieldT<RowT>` (line items, suppliers, recipient e-mails)
- [x] dropped · simplify · `src/app/(frontend)/inwestycje/[id]/page.tsx:93`, `investment-data-table.tsx:166` · `siteAddressPartsOf` for the 3-field projection — needs `country` the table row lacks; the call would be as long as the code
- [x] dropped · simplify · `src/components/orders/order-form-values.ts:30` · shared blank-expense-values builder — 6 literal fields, TS already catches drift; params ≈ the code
- [x] dropped · simplify · `src/components/orders/order-sms-step.tsx:41` · `smsHref` helper shared with `sms-test-dialog.tsx` — that dialog is a throwaway test tool with different sanitizing
- [x] dismissed · simplify · `src/components/forms/order-settings-form/order-settings-form.tsx:44` · client trims what the server trims again — the form spec pins trimmed values; harmless
- [x] skipped · simplify · `src/components/forms/expense-form/expense-form.tsx:264` · move the order marker into the form values/schema and drop the `flags` param — touches the shared expense schema and `toBulkData`; review-worthy refactor for a one-flag gain
- [x] dropped · simplify · `src/lib/actions/order-status.ts:38` · `skipRevalidation` to save ~2 queries per toggle — negligible at ~40 accounts
- [x] dismissed · simplify · reference data serialized twice to the client — repo-wide pattern, not introduced here
- [x] dropped · simplify · `src/collections/investments.ts:104`, `src/lib/actions/investments.ts:216` · reword site-manager comments — wording nit, both still true
- [x] dismissed · simplify · default supplier listed first in the select — intended
- [x] dismissed · tailwind-v4-audit · 0 findings

## Simplify pass

Ran /simplify — 9 applied, 0 proposed, 9 dropped/dismissed/skipped; each folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck: clean apart from the 3 pre-existing `importMap.js` errors (generated file absent in the worktree)
- eslint on touched files: clean
- touched specs (orders, order-settings-form, recipient-list-form, notification-recipients, expense-form): 22 files / 101 tests green after the blank-guard spec edit
- `order-status.db.test.ts`: 5/5 green
- `pnpm test` (unit): 588 files / 5892 tests green, 1 file / 15 tests skipped
- E2E: not run — filed EX-1117
