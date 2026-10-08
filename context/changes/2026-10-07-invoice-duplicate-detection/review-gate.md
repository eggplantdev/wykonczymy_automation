# Review-gate ledger — invoice-duplicate-detection (EX-1025) · 2026-10-08

Scope: `staging...HEAD` (merge-base `256080796`), 55 files, no untracked files. Step 0.5 (browser
verification) skipped — no Playwright unless asked; manual checks live in
`context/foundation/manual-checks.md` § EX-1025.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure` +
`module-cohesion-audit` + `structure-scatter-audit` (one agent), `comment-noise-audit` (flag-only).

## Findings

- [x] 🟡 WARNING · skipped · code-review · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:214` · a reject loses the „Duplikat" marks already set on other paragony — „Odrzuć" sends none, marking the last paragon sends only its own — user ruling 2026-10-08: a reject is one decision with one `duplicate_of`; the „Duplikaty" filter still finds the zgłoszenie, only the earlier pointer is lost
      test: no automated test — accepted behaviour
- [x] 🔵 OBSERVATION · dropped · impl-review + code-review · `src/lib/queries/expense-draft-duplicates.ts:44` · paragony within one zgłoszenie are never compared with each other — user ruling 2026-10-08: the manager sees both photos side by side in the dialog
      test: no automated test — dropped
- [x] 🟡 WARNING · fixed · impl-review + code-review · `src/components/worker-expenses/expense-draft-duplicate-hints.tsx:90` · „Duplikat" during a scan removed a row while `applyReceiptToRow` held its index, so the scan landed on the next row — fixed at the root (simplify/altitude): `use-receipt-generation.ts` resolves the row's index by id after the await and skips a row that is gone, so no button needs disabling
      test: test-driven-debugging · dom — `expense-draft-duplicate-mark.test.tsx` „lands an in-flight scan on its own row…”; verified red against the pre-await index, green on the fix
- [x] 🟡 WARNING · dismissed · impl-review · `src/lib/expense-duplicates/match.ts:44` · „Notatka" line-1 fallback could give a false strong match („Cement 25kg 2szt") — needs ≥5 chars + a digit AND an agreeing amount; two paragony with the same line 1 and the same kwota are worth a look anyway, and the hint never blocks
- [x] 🟡 WARNING · fixed · impl-review · `src/lib/db/expense-duplicate-candidates.ts:144` · `text(row.sent_at)` would print a `Date` as `Wed Oct…`, breaking the date sort — now `isoOrNull(...) ?? ''` like `worker-expense-drafts.ts:129`; `t.date` keeps `String()` like every other transactions mapper
      test: no automated test — coercion matches the two sibling mappers
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/db/expense-duplicate-candidates.ts:21` · two paragony of one other zgłoszenie shared a hint key, so „OK, to nie duplikat" hid both — candidates carry `key` (`draft-<id>-<ordinality>`)
      test: TDD · dom — `expense-draft-duplicate-mark.test.tsx` „dismisses only the clicked match when two come from the same zgłoszenie”
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/queries/expense-draft-duplicates.ts:32` · the check reads the stored AI read, not the manager's edits in the open form — intended: the hint is computed once on open, edits aren't persisted until the save
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/tables/expense-duplicates.tsx:65` · „Data" showed the booking/send date while matching keys on the printed date — shows `documentDate`, booking date as fallback
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:32` · `AcceptingT.files` written, never read — removed
- [x] 🔵 OBSERVATION · fixed · impl-review · `src/lib/queries/expense-draft-duplicates.ts:17` · `rowIndex` returned, never read — removed with its SQL ordinality
- [x] 🔵 OBSERVATION · fixed · impl-review · `context/foundation/test-plan.md` risk 26 · five planned specs not authored (no-tests order during implement) — authored (29 new tests across the five files + the actions spec), all green; see Tests & suite
- [x] fixed · module-cohesion-audit · `src/lib/expense-duplicates/match.ts:41` · `firstLine` duplicated `firstNoteLine` (`lib/utils/invoice-note.ts`) — reused
- [x] fixed · module-cohesion-audit · `src/lib/db/expense-duplicate-candidates.ts:17` · `PageT` duplicated `PreviewFileT` (`types/media.ts`) — reused
- [x] fixed · module-cohesion-audit · `src/lib/queries/expense-draft-duplicates.ts:37` · `Math.round(amount * 100)` duplicated `cents` — exported and reused
- [x] fixed · module-cohesion-audit · `match.ts:17`, `expense-duplicate-candidates.ts:19,30` · `MatchTierT` / `DraftProbeT` / `CandidateFilterT` exported, never imported — unexported
- [x] fixed · feature-first-structure · `src/lib/expense-duplicates/duplicate-of.ts:19` · `duplicateOfLabel` (Polish UI string) in `lib/` with one consumer — moved into `components/tables/expense-drafts.tsx`
- [x] dismissed · feature-first-structure · `src/lib/expense-duplicates/duplicate-of.ts:12` · move `skippedReceiptSchema` to `lib/worker-expenses/` — the carrier's only non-trivial field is the duplicate mark; it sits with the mark it carries
- [x] fixed · module-cohesion-audit + simplify · `src/lib/db/expense-duplicate-candidates.ts:15` · note-line-1 SQL duplicated Telmak's `NOTE_NUMBER` (`db/telmak-check.ts:8`) — identical on inspection; extracted `db/document-number-sql.ts` (`normalizedNumber`, `noteLine1`), both use it
- [x] dropped · structure-scatter-audit · `src/lib/utils/validation.ts:98` · `refineDocumentIdentity` in `utils/validation.ts` vs `schemas/transfer-validation.ts` — pre-existing split; it sits beside the `get*Error` helpers it calls
- [x] fixed · tailwind-v4-audit · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:186` · `sm:max-w-[96vw]` arbitrary — `sm:max-w-dialog-2xl` token (telmak's own `[96vw]` is pre-existing, untouched)
- [x] fixed · comment-noise-audit · `src/lib/utils/validation.ts:96` · docblock restated `getDocumentDateError` — deleted
- [x] fixed · comment-noise-audit · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:120` · comment restated the call order — deleted
- [x] fixed · comment-noise-audit · `src/lib/expense-duplicates/match.ts:1-2` · header pointed at the change folder, dead after archive — deleted
- [x] fixed · comment-noise-audit · `src/lib/queries/expense-draft-duplicates.ts:26` · docblock restated the name — deleted
- [x] dismissed · comment-noise-audit · `queue-filters.tsx:17`, `expense-form.tsx:114`, `transfers.ts:253`, `expense-drafts.tsx:114`, `expense-duplicates.tsx:3,17`, `expense-draft-duplicate-hints.tsx:24,38`, `company.ts:1-2`, `duplicate-of.ts:3,11`, `match.ts:32,47`, `validation.ts:92,101`, `nip.ts:3`, `bulk-expense-form.ts:21`, migration `:3-9` · each carries a why the code can't say (`?param=1` convention, nothing-stored-until-save, worker-sees-only-„Odrzucone", buyer-NIP trap, fallback for legacy rows, spike `IF NOT EXISTS`)
- [x] fixed · simplify · `src/lib/db/media-json.ts` · the media `json_build_object` was hand-written in four places (`expense-duplicate-candidates.ts` ×2, `telmak-check.ts`, `worker-expense-drafts.ts` ×2) — `MEDIA_JSON` + `transactionInvoicesJson`
- [x] fixed · simplify · `src/lib/db/expense-duplicate-candidates.ts` · the amount/number `OR` pre-filter re-implemented `inList` — `amountOrNumber` builds on it
- [x] fixed · simplify · `src/lib/db/expense-duplicate-candidates.ts` · `loadDraftProbes` selected columns the read row already carries — selects the read row only
- [x] fixed · simplify · `src/components/worker-expenses/use-expense-draft-acceptance.tsx:93` · the duplicate check waited for the page download it doesn't need — requested alongside it, awaited once the dialog exists
- [x] fixed · simplify · `use-expense-draft-acceptance.tsx:32` · `AcceptingT.isReading` mirrored `duplicates.status === 'reading'` — derived
- [x] fixed · simplify · `use-expense-draft-acceptance.tsx:152` · `readOnOpen` wrote `aiRead` into `prev.draft`, never read — removed; the two `if (aiRead)` merged
- [x] fixed · simplify · `src/lib/queries/expense-draft-duplicates.ts:40` · `documentNumbers` four-line flatMap — `documentNumberOf(probe) ?? []`
- [x] fixed · simplify · `src/lib/expense-duplicates/match.ts:44` · hand-rolled `Date.UTC / DAY_MS` day math — `DayT` + `daysBetween` (`lib/utils/days.ts`)
- [x] fixed · simplify · `src/lib/actions/transfers.ts:318` · `updateTransferAction` destructured the three identity fields only to pass them back — `documentIdentity(parsed.data)`
- [x] dropped · simplify · `src/components/forms/expense-form/map-line-item.ts:48` · NIP normalised client-side and again in `documentIdentity` — both idempotent and cheap; removing one saves an import, not a bug
- [x] skipped · simplify · `src/components/forms/expense-form/expense-form.tsx` · one `removeLineItem(itemId, duplicateOf?)` instead of the trash path + `markDuplicate` — a refactor of a shared form, worth its own review; today's two paths are short and tested together
- [x] skipped · simplify · `src/lib/utils/validation.ts:98` · field-level `optionalNip()` / optional-day zod instead of `refineDocumentIdentity` in four `superRefine`s — touches four schemas outside this slice's behaviour; own change if it recurs
- [x] dismissed · simplify · `queue-filters.tsx`, `match.ts` · reuse `foldText` / the queue toggle — low-confidence matches; different normalisation goals

## Simplify pass

Ran /simplify — 9 applied (+ the scan-by-id root fix and the Telmak dedup above), 2 skipped, 1 dropped, 1 dismissed; each folded into ## Findings (tagged simplify).

## Tests & suite

- typecheck: clean apart from the 3 pre-existing `importMap.js` errors (generated file absent in this worktree)
- eslint (touched files): 0 errors; 1 pre-existing warning (`logError` unused in `lib/actions/transfers.ts`, already on staging)
- specs, each file alone (user: „Author specs + typecheck”; no full suite, no E2E):
  - `lib/expense-duplicates/match.test.ts` 9 ✓ · `lib/worker-expenses/receipt-decision.test.ts` 4 ✓
  - `lib/db/expense-duplicate-candidates.db.test.ts` 4 ✓ · `lib/db/worker-expense-drafts.db.test.ts` 26 ✓ (2 new) · `lib/actions/worker-expense-drafts.db.test.ts` 5 ✓ (2 new) — on 5435 after `payload migrate` applied `20261008_0_add_document_identity_and_duplicate_of` there
  - `components/worker-expenses/expense-draft-duplicate-mark.test.tsx` 8 ✓
- full suite / E2E: not run (user's call); browser flow stays in the E2E backlog
