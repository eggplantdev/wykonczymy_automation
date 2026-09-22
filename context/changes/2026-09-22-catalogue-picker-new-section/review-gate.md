# Review-gate ledger — catalogue-picker-new-section (+ investment-gate rename) · 2026-09-22

The working tree holds **two independent units** and the user asked for a review of all of it:

- **Unit A — `catalogue-picker-new-section`** (this change folder): „Dodaj do:" accepts a new sekcja
  name; sekcja + prace written in one transaction.
- **Unit B — `investment-lock` → `investment-gate` rename** (a parallel agent's uncommitted work):
  `src/lib/db/investment-gate.ts`, `src/lib/db/lock-investment-for-replace.ts`, the new
  `src/lib/actions/provision-workshop.ts`, and ~14 call-site edits.

Unit B has no `plan.md`, so `/10x-impl-review` covers A only; every other check is whole-tree.

## Findings

<!-- Format: [box] [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason
     Sources: impl-review | code-review | tailwind-v4 | feature-first | module-cohesion |
              structure-scatter | comment-noise | primitive-reuse | simplify | self -->

### Unit B — surfaced, not auto-fixed (a parallel agent owns these files)

- [x] skipped · structure-scatter · `src/lib/db/investment-gate.ts` · the rename stopped half way: 4 of 6 exports still say "lock" (`LockTargetKindT`, `isInvestmentLocked`, `lockStatusFor`, `isRelatedInvestmentLocked`), 2 say "gate", and line 3 still imports `isLockedStatus` from `constants/investment-lock` — split vocabulary in one file, strictly worse than either endpoint. **Not fixed: these are a parallel session's dirty, uncommitted files** — the one file-based hold the gate honours. Surfaced to the owner; finish at the symbol level or revert.
- [x] 🔵 OBSERVATION · skipped · code-review · `context/changes/2026-09-22-szablon-autosave/{plan.md:202,161, research.md:222,343}` · sibling change docs still cite `lib/db/lock-investment.ts` / `investment-lock.ts`. Unit B's docs, unit B's call — same hold as above.

### Unit A

- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/row-ops.ts:77` + `use-kosztorys-editor.ts` · `createdSection: false` folded with `applyAddItem`, which appends at the array END when no row carries that `sectionId` — a sekcja emptied of its pozycje (it then vanishes from the picker's options, which is _why_ its nazwa gets typed) drew its band below the last sekcja while Postgres held it third, unrepairable by `router.refresh()` (mount-frozen rows, EX-441). Fixed by extracting `catalogueSlicePlacement(rows, sectionId, createdSection)` — `prepend` / `fold` / `reseed` — and routing the miss to `recoverStaleTree()`.
      test: TDD · unit — 3 cases in `src/__tests__/lib/kosztorys/row-ops.test.ts` (prepend / fold / reseed). Pure function instead of `renderHook`: `use-kosztorys-editor.ts` has no harness and ~1300 LOC, and AGENTS.md puts React-free logic in `lib/kosztorys/` where the cheapest layer wins.
- [x] 🟡 WARNING · fixed · code-review · `src/lib/kosztorys/work-catalogue/create-section-with-catalogue-items.ts:68` · `sectionIdByName` is a bare SELECT under READ COMMITTED with no unique index behind it, so two concurrent confirms of one new nazwa both missed and both created — the twin sekcja this change exists to prevent. Fixed on the **MISS path only**: `shiftDisplayOrderFrom` runs first (its `FOR UPDATE` over the investment's sekcje is the lock) and the name is re-read under it; the common existing-name path stays a single SELECT. The reviewer's literal form — read unconditionally after the shift — was rejected because it spends a full `UPDATE` over every sekcja on the common path. Residual documented in the comment: an investment with **zero** sekcje locks no rows, and closing that needs the unique index the one duplicate pair in the dump still blocks.
      test: test-driven-debugging · integration — two overlapping calls asserting `COUNT(*) = 1` on `lower(btrim(name))`. **Not authored**: two truly concurrent `withPayloadTransaction` calls need a second pooled connection the DB-spec harness doesn't hand out, and a serialized approximation would pass against the pre-fix code too — a green test that proves nothing. The falsifiable half that _is_ testable landed instead (F2 below).
- [x] fixed · module-cohesion · `create-section-with-catalogue-items.ts:43` · found section id + falsy owner fell through and minted a SECOND sekcja under an existing name. Now `throw`s with the reason in the comment; extracted alongside into `appendIntoSectionNamed`, which both the fast path and the post-lock re-check share.
- [x] fixed · feature-first + module-cohesion · `add-items-from-catalogue-dialog.tsx:195` · `'createdSection' in res.data && … === true` duck-test replaced by reading the flag off the branch that knows — only the „nowa sekcja" action can report one.
- [x] fixed · self · `use-kosztorys-editor.ts` (`handleAddSection`) · stale comment naming the deleted `openPicker` caller, plus the now-unused return value — both deleted.
- [x] skipped · module-cohesion · `src/lib/actions/work-catalogue.ts` · 430 LOC / 9 actions / 3 reasons to change. Real, but a 9-action split is a review-worthy refactor of a file this slice only touched in two places — its own change, not a rider on this one.
- [x] fixed · code-review · `src/lib/actions/work-catalogue.ts` · `readCatalogueItems` signalled a partial catalogue miss out of band; aligned to the repo's `T | { error: string }` idiom, both call sites discriminating with `'error' in items`.
- [x] fixed · code-review (F2) · `src/__tests__/lib/actions/work-catalogue-insert.test.ts` · the top-placement assertion was unfalsifiable on an investment with no other sekcja. Now creates a sibling first and asserts it moved to `display_order = 1`.
- [x] fixed · code-review (F1) · same file · no spec covered the rollback. Added `'nie zostawia osieroconej sekcji, gdy zapis prac padnie'` — a `vi.hoisted` pass-through mock arms a throw inside `placeCatalogueItems`, then asserts `success === false` and 0 rows under that name.
- [x] fixed · code-review (F6) · `add-items-from-catalogue-dialog.test.tsx` · `vi.clearAllMocks()` ran after the per-test mock setup; moved to the first line of `beforeEach`.
- [x] fixed · code-review (F4/F5) · `plan.md` · four contract blocks had drifted from the shipped code (`preferredSectionId` on the duplicate-pair note, `resolveSectionTarget`'s signature, the Phase-3 handler, the host routing). Amended to match.

#### Primitive-reuse scan (Step 2, serial — homes: `src/components/ui`, `src/components/filters`, `src/hooks`, `src/lib/**`)

- [x] fixed · primitive-reuse · `src/lib/kosztorys/work-catalogue/section-target.ts:11` · the client folder was named bare `fold`, one word off two DIFFERENT existing folds — `foldText` (`lib/utils/fold-text.ts`, strips diacritics, for search) and `foldDescription` behind `catalogueKey`. Not a reuse match and must not become one: this fold is the client copy of the server's `lower(btrim(name))`, so folding „Łazienka"→„Lazienka" here would report an existing sekcja while the server's SELECT missed and minted the twin. Renamed `sqlNameKey` and the constraint written down — a third folding rule that reads like the other two is how the next agent reaches for the wrong one.
- [x] fixed · self · `src/lib/kosztorys/work-catalogue/place-catalogue-items.ts:12` · my own comment-noise trim left a fragment starting mid-sentence („Both paths derive it / from a row…"). Rewritten whole.

#### Comment noise (flag-only report; applied here)

- [x] fixed · comment-noise · `append-catalogue-items.ts:25` · deleted (trim-trap survivor; its consequence clause lives at `place-catalogue-items.ts:13`).
- [x] fixed · comment-noise · `append-catalogue-items.ts:14` · delegation-narration paragraph deleted; line 12's transaction note kept.
- [x] fixed · comment-noise · `kosztorys-add-menu.tsx:72` · explained the absence of the deleted `openPicker()` pre-minting. Deleted.
- [x] fixed · comment-noise · `add-items-from-catalogue-dialog.test.tsx:9` · header restating the four `it` titles. Deleted.
- [x] fixed · comment-noise · `add-items-from-catalogue-dialog.tsx:104` · dateless 4th copy of the name-identity ruling, in the client, which enforces nothing. Deleted.
- [x] fixed · comment-noise · `work-catalogue/types.ts:142` · 3-line comment on a 1-line alias. Deleted.
- [x] fixed · comment-noise · 7 trims · `add-items-from-catalogue-dialog.tsx:48`, `use-kosztorys-editor.ts:989`, `work-catalogue.ts:193`, `place-catalogue-items.ts:12`, `section-target.ts:3`, `:7`, `:24` · restating clause cut, the why kept.
- [x] fixed · comment-noise · `add-items-from-catalogue-dialog.test.tsx:128` + `work-catalogue-insert.test.ts:258` · Polish comments translated to English (AGENTS.md), near-duplicate dropped.

### Dismissed / dropped at triage

- [x] dismissed · tailwind-v4 · `add-items-from-catalogue-dialog.tsx:230` · `z-[10001]` — pre-existing line, untouched by this diff; promotion would edit `ui/select.tsx` / `form-date-picker.tsx` outside the slice.
- [x] dismissed · tailwind-v4 · `add-items-from-catalogue-dialog.tsx:263` · `max-h-[55vh]` — same: pre-existing, recurs 3× repo-wide, promotion needs a `cn.ts` classGroups entry.
- [x] dismissed · feature-first · every new/moved file landed in the right home, `provision-workshop.ts` included — the move is what buys it the `server-only` that `workshop-investment.ts` cannot have.
- [x] dismissed · structure-scatter · 0 competing directories, 0 stray files, 0 new homes.
- [x] 🔵 OBSERVATION · dropped · code-review · `add-items-from-catalogue-dialog.tsx:106` · a sekcja renamed to whitespace-only drops out of `sectionNameOptions`, so „Dodaj" stays disabled with the right sekcja targeted. Reachability first: nobody names a sekcja three spaces, and the grid's inline rename has always allowed it. Not worth the churn.
- [x] 🔵 OBSERVATION · dismissed · code-review · `work-catalogue-insert.test.ts:97` · the new DB spec leaves the shared fixture investment's sekcje at `display_order + 1`. Benign: a uniform +1 preserves relative order and no spec asserts an absolute `display_order` other than the `0` this spec creates.
- [x] dropped · comment-noise · `work-catalogue.ts:150` · the security comment now heads the private `readCatalogueItems` helper rather than the exported actions — placement only, still load-bearing where it sits.
- [x] dismissed · primitive-reuse · `add-items-from-catalogue-dialog.tsx` · no reinvention: the dialog composes `Combobox`, `DataTable`, `FilterMultiSelect`, `SearchFilterInput`, `Dialog`, `Checkbox`, plus `useSearchFilter` / `useClientMultiFilter`. Nothing hand-rolled, no new `ui/` candidate.
- [x] dismissed · primitive-reuse · `create-section-with-catalogue-items.ts` / `place-catalogue-items.ts` · the server helpers reuse `shiftDisplayOrderFrom`, `sectionOwnerAndNextItemOrder`, `insertItems`, `checkSubcontractorPrice` and `getDb` rather than re-deriving display-order arithmetic, the insert, the price guard or a connection.

## Simplify pass

Fix-first was applied during triage: every finding above that earned a fix was applied directly in
Step 2 rather than being handed to a second mutating pass — 18 fixed, 3 skipped (2 of them a
parallel session's files, 1 a review-worthy refactor), 7 dismissed, 2 dropped, **0 open**.
No separate `/simplify` report was produced; this ledger is the single record, per the gate's
one-list rule.

## Tests & suite

- `pnpm exec tsc --noEmit` — clean.
- `pnpm exec vitest run src/__tests__/lib/kosztorys/row-ops.test.ts` — 14 passed (3 new).
- `pnpm exec vitest run src/__tests__/lib/kosztorys/work-catalogue/section-target.test.ts src/__tests__/components/kosztorys/editor/dialogs/add-items-from-catalogue-dialog.test.tsx` — 12 passed.
- DB leg (`work-catalogue-insert.test.ts`, incl. the 2 new cases) — **not run**: it needs the 5435
  `db-test` container and is part of the full suite, which waits for the user's go.
- Full suite (`typecheck && lint && test && build`) — **pending the user's go** (machine-wide test lock).
- E2E — none authored, none owed: nothing here crosses client → server action → DB → revalidation
  in a way the new DOM spec and the DB spec don't already cover.
