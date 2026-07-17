# Review-gate ledger — kosztorys-stage-values · 2026-07-15

Slice: per-stage value columns (netto+brutto). Commits `870f883`, `a93a7ac`, `8dcfdf3`, `585281b` on
`dogfooding/kosztorys-editor-ux`.

Code diff under review (5 files):

- `src/lib/tables/kosztorys-v2-columns.tsx`
- `src/lib/kosztorys/constants.ts`
- `src/components/kosztorys/use-hidden-columns.ts`
- `src/components/kosztorys/use-column-widths.ts`
- `src/components/kosztorys/use-kosztorys-editor.ts`

Step 0.5 (verification pass) **skipped** — no `verify-manual-checks` skill installed. The slice's 12
manual checks stay open in `context/foundation/manual-checks.md` and block the archive.

Fan-out: `/10x-impl-review`, `/code-review`, `comment-noise-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `tailwind-v4-audit` — all 7 applied, all read-only.
`tailwind-v4-audit` returned clean (no meaningful Tailwind surface in the diff).

## Findings

- [x] 🔴 CRITICAL · **fixed** · code-review · `src/lib/kosztorys/calc.ts:90` · An `amount` (zł) rabat is subtracted
      **once per stage** instead of being spread across them: `stageValueForView` calls
      `applyDiscount(qtyDone × viewPrice, row)`, and `applyDiscount` subtracts the whole row's
      `discountValue`. Two user-visible defects, both landing in this slice's new cells: a stage with
      **zero progress renders a negative value**, and the netto stage columns **do not sum to Netto** —
      the exact reconciliation the sheet's `V–AE` block exists to allow. `percent` is multiplicative so
      it distributes correctly, which is why this stayed hidden.
      **Confirmed numerically** (throwaway spec vs real `calc.ts`): price 100 × qty 10, `amount` rabat
      200, stages `[5,5,0]` → Netto `800`, stage values `[300, 300, -200]`, sum `400`.
      **Reachable:** `zł` is live in `DISCOUNT_OPTIONS` (`kosztorys-v2-columns.tsx:51`) and the
      prod-restored dev DB holds 2 `amount` rows (vs 2 `percent`). `seed-kosztorys.ts:124` only emits
      `percent`, so **no manual check on seeded data would surface it**.
      Root cause is pre-existing (`rowDoneNetForView` → `Pozostało` already sums the same broken figure),
      but this slice is the first surface to render it directly, in N×2 new cells. The plan's "the math
      is done, `stageValueForView` is the sheet's `V` verbatim" gate (`plan.md:16`, `:58`, `:323`) is
      what let it through — and it's wrong for one of the two discount types. The sheet has no parity
      answer here: its `V = D*$Q-(D*$Q*$R)` is rate-based, i.e. percent-only. `amount` is app-specific.
      test: test-driven-debugging · unit — red repro in `kosztorys-calc.test.ts` (no `amount` case for
      `stageValueForView` exists today, `:37-48` covers no-discount + percent only), asserting a
      zero-qty stage is `0` and that per-stage values reconcile to `rowNetForView`.
      **Resolution (owner, 2026-07-15):** a zł rabat is a discount off the **whole row**, percent
      unchanged. Both types collapse to one rule — _stage value = its gross − its share of the row's
      discount_, share = `qtyDoneInStage / measuredQty`. Percent is algebraically identical to the old
      path (asserted across all 3 views), so this is a strict simplification: no discount-type branch,
      no new maths, and `Pozostało` on amount rows is fixed for free. 5 red-first tests in
      `kosztorys-calc.test.ts` (incl. the zero-`measuredQty` divide guard) — all green.

- [x] 🟡 WARNING · **fixed** · impl-review F3 · `src/components/kosztorys/use-column-widths.ts:58` · The approved
      variadic `dropWidth` ships untested. The plan's "no new tests — the delta is presentation"
      rationale was sound as written, but the deviation changed the premise: this is a state transition
      with a subtle trap (last-write-resurrects), and the `some()`-vs-`every()` guard at `:59` is a
      second trap on the same three lines. Nothing in the suite would catch either regressing.
      test: TDD · unit — extract a pure `dropKeys(widths, ids)` and test it directly (the
      `discount-edit.ts` precedent).
      **Applied as recommended:** `dropKeys` extracted; returns the same reference when nothing was
      pinned, which is how `dropWidth` skips a pointless write. 4 tests in
      `src/__tests__/kosztorys-column-widths.test.ts` (all-at-once drop, partial hit, no mutation,
      identity no-op).

- [x] 🟡 WARNING · **fixed** · impl-review F1 · `src/lib/tables/kosztorys-v2-columns.tsx:209` · `stageValueHeader`
      returns a bare `<span>` with no `className`, unlike every other header in the grid: `SortHeader`
      gives `flex h-full w-full items-center gap-1 px-1 text-left font-medium` + a `truncate` inner
      span; `StageHeader` gives `flex size-full items-center`. These 2×N new headers get no
      `font-medium`, no vertical centering, no `px-1`, no `truncate` — a long stage label in a narrow
      column has nothing truncating it and sits top-aligned against neighbours that don't. The `:204-208`
      comment justifies skipping those _components_; that argument doesn't extend to their _styling_.
      **Applied:** header now `flex size-full items-center` with a `truncate text-sm` inner span. No
      `font-medium` added — the plain `title(...)` headers don't carry it either, so the audit's "every
      other header" is only true of `SortHeader`; matching `StageHeader`, the actual sibling, is right.

- [x] 🟡 WARNING · **fixed** · impl-review F2 · `src/lib/tables/kosztorys-v2-columns.tsx:209` · The new columns are
      the only computed columns with no `HEADER_TIPS` entry. The plan's stated precedent `c468ec6` added
      tips for **both** its new columns (`discountAmount:143`, `discountAmountGross:144`). A user seeing
      `Etap 1 — netto` can't tell the figure is post-discount at the _active view's_ price — exactly the
      confusion `discountAmount`'s tip exists to prevent. Needs owner sign-off on Polish copy.
      **Applied:** two tips added, keyed by column **group** (not per-stage id) — the only thing that
      differs between a stage's value columns is the stage's name. Copy names the discount-share rule
      the CRITICAL fix established and the view-dependence. Polish copy still owes the owner's read —
      that's manual check `stage-values-tooltips` in `manual-checks.md`, not an open finding here.

- [x] **fixed** · convergent (feature-first #1 · module-cohesion #2 · scatter #1 · impl-review F5) ·
      `src/lib/kosztorys/constants.ts:60` · The `stage_` qty prefix is an **unowned string literal in 5
      places** (`v2-rows.ts:12`, `:93`, `:96`, `kosztorys-v2-columns.tsx:678`, `types/kosztorys.ts:117`)
      while the two new value prefixes get constants — `toggleKey:678` uses _both conventions on one
      line_. So `constants.ts:60-63`'s claim that the namespace "is decided in one place" is **false**,
      and the mutual-exclusivity invariant the slice worked hardest to get right is enforced by prose
      across a file boundary rather than by the code. Failure: rename `stage_` → `stageQty_` and
      `diffRow` silently stops classifying qty edits — stage autosave dies with no type error.
      Fix: `export const STAGE_QTY_PREFIX = 'stage_'` consumed by all five sites.
      test: TDD · unit — assert the three prefixes are pairwise non-prefixing.
      **Applied to all five**, incl. the type site: `StageKeyT` in `types/kosztorys.ts` is now derived
      from the constant (`` `${typeof STAGE_QTY_PREFIX}${number}` ``, `import type` so no runtime cycle
      with `constants.ts`), so the runtime `startsWith` and the row's key type cannot drift apart. Two
      tests in `kosztorys-v2-rows.test.ts`: `diffRow` ignores value-column keys, and the three prefixes
      are pairwise non-prefixing. Every surviving `stage_` in `src/` is the `stage_progress` table.

- [x] **fixed** · comment-noise defect 1 · `src/lib/tables/kosztorys-v2-columns.tsx:85` · This slice made the
      comment **false**: `// Column picker: true = the user switched this column off.` — `isHidden` now
      returns `true` for a default-hidden column the user never touched. A comment asserting something
      untrue is worse than one adding nothing.
      **Applied:** now states both sources (stored choice OR `DEFAULT_HIDDEN_COLUMNS`) and that they're
      indistinguishable at this boundary. Same pass caught a second false comment the audits missed: the
      qty stage header's tooltip still read `Wartość etapu = ilość × Cena − Rabat` — the formula the
      CRITICAL fix replaced. Corrected to the discount-share rule.

- [x] 🔵 OBSERVATION · **deferred** · impl-review F4 · `src/components/kosztorys/use-kosztorys-editor.ts:341` ·
      Residual stale closure one level up from the fixed one: `handleRemoveStage` awaits
      `removeStageAction` **before** `dropWidth`, so a resize released mid-request is clobbered by the
      pre-await `widths` closure. The variadic fix removed the intra-handler instance; this is the
      across-await instance. Narrow, and pre-existing for `setWidth`. Structural fix: make `writeWidths`
      take an updater that re-reads at write time.
      test: test-driven-debugging · unit — recorded in the issue: red repro drives the width map through
      an interleaved write before the fix lands.
      **Filed EX-481** — bundled with the store-factory extraction, since the updater-based write is
      that factory's write API and fixing it per-call-site would re-arm on the next `dropWidth` caller.

- [x] 🔵 OBSERVATION · **deferred** · code-review · `src/components/kosztorys/use-kosztorys-editor.ts:156` ·
      `widthsKey` / `stagesKey` are dead — leftovers of the remount keys `ee497cb` removed. Nothing in
      `src/` or `e2e/` consumes either; `widthsKey` runs `JSON.stringify(widths)` every editor render for
      nothing. Not obviously deletable: `:120-123` documents neighbouring refs as a deliberate EX-422
      rollback path and these may sit under the same intent, uncommented. Confirm against EX-422 first.
      test: no automated test — a deletion gated on `pnpm typecheck` + the EX-422 confirmation, not grep.
      **Filed EX-483** (item 2), carrying the EX-422 caveat and the never-re-add-a-remount-key warning.

- [x] 🔵 OBSERVATION · **fixed** · impl-review F6 · `src/lib/kosztorys/constants.ts:62` · The `NaN` rationale's
      literal is wrong: `diffRow` does `k.slice('stage_'.length)`, so a hypothetical `stageValueNet_7`
      yields `'ValueNet_7'` (capital V), not `'valueNet_7'`. Conclusion right, illustration misdirects —
      the one job that comment has. **Applied:** literal corrected to `'ValueNet_7'`.

- [x] 🔵 OBSERVATION · **fixed** · impl-review F7 · comment-noise · `src/components/kosztorys/use-hidden-columns.ts:12`
      · Vanished-state narration: "Only the meaning of ABSENT changed (was: visible)". The
      backwards-compat clause before it is durable rationale and must stay (it binds on live localStorage
      payloads, not deleted code); the "(was: visible)" half is diff-voice. Same milder tic at `:66`
      ("would **now** mean") and `constants.ts:54`.
      **Applied, going further than the finding:** the whole backwards-compat clause is gone, not just
      its "(was: visible)" half. The finding argued the clause binds on live localStorage payloads —
      but the paragraph above it already states the contract that binds (absent = ask
      `DEFAULT_HIDDEN_COLUMNS`); the clause only restated it in diff-voice, as a reassurance about a
      migration nobody reading the file today needs. It fails the strip test. `:66`'s "now" trimmed.

- [x] 🔵 OBSERVATION · **fixed** · code-review · `src/components/kosztorys/use-hidden-columns.ts:6` · The file's own
      header ("sparse: only columns explicitly switched off get an entry") no longer describes what gets
      written — `toggleColumn` now always writes an explicit boolean and never deletes. Correct and
      deliberate per `:66-67`, and bounded by the column count (not a leak), but the comment drifted.
      Also `hidden` is returned (`:72`) and unused — the only consumer destructures `{ isHidden, toggleColumn }`.
      **Both halves closed:** the header now defines sparse by what ABSENT means (not by what gets
      written), which is the claim that actually binds; the dead `hidden` return was dropped by the
      `/simplify` altitude fix above.

- [x] 🔵 OBSERVATION · **fixed** · comment-noise (5 trims) · `constants.ts`, `kosztorys-v2-columns.tsx` ·
      Lead-in sentences restating the symbol directly beneath them. Applied to the two that genuinely
      failed the strip test: `// Columns that start hidden.` over `DEFAULT_HIDDEN_COLUMNS`, and
      `// Computed, read-only column…` over `computedColumn` (which restated the identifier, `disabled:
    true`, and the `compute` param in one line). The `NON_HIDEABLE_COLUMNS` lead-in was reordered so
      the why leads instead of the restatement. The other flagged sites were **not** trims on inspection —
      `toggleKey`'s comment carries the mutual-exclusivity rationale, and `STAGE_QTY_PREFIX`'s carries the
      diffRow hazard. Every hazard comment (Postgres reissue, diffRow NaN, stale-closure, sheet-order
      deviation) verified real and survives. Typecheck clean after.

- [x] 🔵 OBSERVATION · **fixed** · comment-noise defect 2 · `constants.ts:77` ↔ `use-hidden-columns.ts:6` · The
      default-not-seeded rationale is stated **twice in full**, each copy free to drift. **Applied as
      recommended:** the full argument stays at the mechanism's home (`use-hidden-columns.ts`); the
      `constants.ts` copy is now the brutto-is-least-read justification + a pointer ("useHiddenColumns
      owns that argument").

- [x] 🔵 OBSERVATION · **deferred** · code-review · impl-review F8 · `src/components/kosztorys/use-hidden-columns.ts:60`,
      `use-column-widths.ts:46` · `readJson` guards localStorage _access_ but not _parse_: a corrupt value
      — or literally the string `"null"`, which parses fine then makes `hidden[id]` throw — white-screens
      the grid permanently (nothing ever clears the key). Pre-existing in both hooks; this slice adds a
      second reader of the same unvalidated blob.
      test: test-driven-debugging · unit — recorded in the issue: feed the store `"null"` and a truncated
      blob, assert it falls back to empty rather than throwing.
      **Filed EX-481** — deliberately bundled with the store-factory extraction: fixing it before the
      factory means writing the same guard twice, in the two files the factory merges.

- [x] · **deferred** · feature-first #3 · scatter #2 · `src/lib/tables/kosztorys-v2-columns.tsx` · The file's folder
      contradicts an explicit refactor: `a8691df` (2026-07-08) moved **all seven** JSX column defs
      `lib/tables/` → `components/tables/`, emptying the dir; `6b44f8f` (same day, descends from it)
      re-created `lib/tables/` for this one file. It's a `.tsx` rendering JSX with `'use client'` cells,
      in `lib/` — which `AGENTS.md` scopes to infra/SQL/actions. One importer to update.
      **Pre-existing; this slice only added lines to it.** Its own commit, not this slice's.
      **Filed EX-483** (item 1) — a pure move, which is exactly why it must not ride inside a feature diff.

- [x] · **deferred** · module-cohesion #4 · `src/lib/tables/kosztorys-v2-columns.tsx:123` · `HEADER_TIPS` (33 lines of
      Polish copy) is a copy deck whose sibling `COLUMN_LABELS` already lives in `constants.ts:27` — a
      column's label and its tooltip are the same kind of thing, split across two files. Rewording a
      tooltip means editing a 700-line column-factory module. **Not a god file otherwise** — all four
      exports are on-topic; length is breadth of one concern.
      **Filed EX-483** (item 3), paired with item 4 — if the copy deck moves, the tip wrapper's config
      moves with it.

- [x] · **deferred** · simplify (reuse #4) · `use-hidden-columns.ts` ↔ `use-column-widths.ts` ↔
      `use-price-view.ts` · Extract `createJsonMapStore<V>(storageKey)`. The two hooks are line-for-line
      identical for ~25 of their ~70 lines (`SERVER_SNAPSHOT`, `listeners`, `subscribe`, `readJson`, the
      write's try/catch + notify, the `useSyncExternalStore` + `JSON.parse` pair); the `listeners`/try-catch
      triple has a **third** copy in `use-price-view.ts`. Both differences I'd have defended are wrong: the
      `Record<string,number>` vs `<string,boolean>` split is one generic param, and default-resolution lives
      _above_ the store boundary (`isHidden` reads the parsed map — a factory owning only
      subscribe/read/write never sees it). All three files carry a "Same pattern as X" comment — the
      codebase annotating its own duplication instead of removing it. **Bundles the F8 fix above:** the
      unguarded `JSON.parse` must otherwise be fixed twice.
      **Filed EX-481** — the anchor of that issue; F4 and F8 ride on it.

- [x] · **deferred** · simplify (altitude #1) · `use-column-widths.ts:67` · Make the store's write take an
      **updater** (`update(prev => next)`) that re-reads at write time, instead of rebuilding from the
      render's closure. **Supersedes the variadic `dropWidth`** and closes F4 below at the root rather than
      per-call-site: the same stale-closure bug lives in `setWidth` and in `toggleColumn`, and any second
      `dropWidth` caller re-arms it. The reviewer's line is hard to argue with — _the fix is smaller than
      the comment explaining why it wasn't done_. Do it together with the factory above.
      **Filed EX-481** (same issue as the factory — the updater IS the factory's write API).

- [x] · **deferred** · simplify (efficiency #2) · `kosztorys-v2-columns.tsx:702` · `buildV2Columns` and
      `buildV2ToggleItems` each call `assembleV2Columns` independently, so every rebuild builds ~47 column
      objects twice — and the toggle-items pass discards ~40 freshly-built `SimpleTooltip` JSX trees to read
      only `col.id`. Assemble once in `use-kosztorys-editor`, pass the array to both. Tens of µs, rebuild
      renders only (view switch, stage add/remove, sort) — flagged because this slice roughly doubled the
      constant, not because it's hot.
      **Filed EX-482** (item 1).

- [x] · **deferred** · simplify (efficiency #3) · `kosztorys-v2-columns.tsx:205` · `computedColumn` mints a
      fresh `component` function identity per assemble, so dsg **remounts** the cell subtree instead of
      updating it. Pre-existing, but this slice takes computed columns ~8 → ~18 (28 with brutto shown),
      roughly tripling the remount set: ~630 cell remounts per rebuild render vs ~280. Fix: one
      module-level `ComputedCell` reading `compute` from dsg's `columnData`, giving stable identity. A real
      refactor near the remount machinery `ee497cb` already burned us on (EX-422) — not a `/simplify` edit.
      **Filed EX-482** (item 2), carrying the EX-422 / never-re-add-a-remount-key warning.

- [x] · **deferred** · simplify (reuse #1 tail) · `stage-header.tsx:48`, `sort-header.tsx:57` · The header-tip
      wrapper's other two copies hardcode `delayDuration={600}` rather than reading `HEADER_TIP_DELAY`, so
      the constant already fails to own the value it names. `withTip` (fixed above) covers only the two
      same-file copies; unifying across files means exporting it or moving the tip config to a shared home.
      **Filed EX-483** (item 4), paired with item 3.

- [x] **deferred** · e2e-obligation · `e2e/` · The slice is browser-level (2×N dynamically-built grid
      columns + a localStorage-resolved visibility default), so per `AGENTS.md` it **owes** an E2E: the
      grid wiring no unit test can reach. Highest-value leg is stage **delete** — dsg keys header cells by
      index, so an off-by-one renames a neighbour's columns. Not authored here: `/simplify` had just
      reshaped the column factory and 14 manual checks are still unticked, so browser specs would risk
      pinning a surface the owner hasn't signed off on. **Filed EX-484** (label `e2e-backlog`, project
      Wykonczymy) carrying all 5 risks, the EX-422 no-remount-key warning, and the `zł`-fixture note.

- [x] **fixed** · simplify · `src/lib/kosztorys/calc.ts:90` · `stageValueForView` spelled the
      proportional split the long way round (`stageGross − rowDiscountForView × share`, reaching through
      two derived helpers). Rewritten as what the docblock already claimed it was:
      `rowNetForView(row, view) × (qtyDoneInStage / measuredQty)`. Algebraically identical — the 23
      existing `calc` tests pass untouched — but now the sum-to-`rowNetForView` invariant (the whole
      point of the sheet's V–AE block) holds **by construction** instead of by cancellation. Also drops
      one `viewPrice` call per stage cell.

- [x] **fixed** · simplify · `src/lib/kosztorys/calc.ts:46` · `× (1 + vatRate)` was inlined at **6**
      call sites in the column factory while `calc.ts` — documented as "the single source of the
      breakdown formulas" — had no net→gross function at all. The tell: the rule "VAT applies to
      post-discount net" was commented on exactly one of the six. `toGross(net, vatRate)` extracted;
      all six routed through it. A future rounding rule (grosze) is now one edit.

- [x] **fixed** · simplify · `src/lib/tables/kosztorys-v2-columns.tsx:167` · The header-tooltip wrapper
      (`SimpleTooltip` + delay + `max-w-xs whitespace-pre-line` + a centering span) existed **twice in
      one file** — and had already drifted on its first copy (`h-full w-full` vs `size-full`).
      Extracted as `withTip(node, tip)`; `title()` and `stageValueHeader` both call it.
      Two further copies live in `stage-header.tsx` / `sort-header.tsx`, which hardcode
      `delayDuration={600}` instead of reading `HEADER_TIP_DELAY` — deferred below, cross-file.

- [x] **fixed** · simplify · `src/lib/tables/kosztorys-v2-columns.tsx:127` · The qty axis's tip was a
      bare inline literal in the `stageCols` map while its two new siblings sat in `HEADER_TIPS` — and
      this gate's own CRITICAL fix had to edit that literal to keep the wording consistent, which is
      exactly the sync cost. Moved to `HEADER_TIPS[STAGES_COLUMN_GROUP]`; all three stage tips now in
      one block, all keyed by group.

- [x] **fixed** · simplify · `src/lib/tables/kosztorys-v2-columns.tsx:622` · `stageKey(st.id)` ran
      inside the per-**cell** compute closure though it's a per-**column** constant — ~350–700 throwaway
      string allocations per render. Hoisted into the `.map` body. Micro (single-digit µs), applied only
      because it's one line and zero-risk.

- [x] **fixed** · simplify · altitude · code-review · `src/components/kosztorys/use-hidden-columns.ts:54`
      · The hook returned the raw `hidden` map, which this slice turned into a footgun: absent now means
      "ask `DEFAULT_HIDDEN_COLUMNS`", so any `hidden[id]` read silently bypasses the defaults the slice
      just introduced. It was also dead — the only consumer destructures `{ isHidden, toggleColumn }`.
      Dropped from the return + type; `isHidden` is now the only reader. (This also closes the second
      half of the earlier `use-hidden-columns.ts:6` OBSERVATION.)

- [x] **skipped** · simplify (reuse #3) · `kosztorys-v2-columns.tsx:229` ↔ `stage-header.tsx:27` · Extract
      `stageDisplayName(stage)` — the "what is a stage called when unnamed" rule lives in two places, and
      inconsistently (`||` vs `??`). Skipped: the two aren't the same mechanism — `StageHeader` splits the
      rule across an input's `defaultValue` + `placeholder`, so it can't call a string helper without
      contorting. The `||`/`??` divergence is behaviourally invisible (an empty label renders the
      placeholder either way). Below the churn bar.

- [x] **skipped** · simplify (#6) · `src/lib/kosztorys/constants.ts:56` · Collapse the three stage axes
      into one `STAGE_AXES = { qty, net, gross }` table so `toggleKey` becomes a `find` and a 4th axis
      costs zero classifier edits. Real, and I nearly took it — but the altitude reviewer killed it on a
      fact the simplification reviewer missed: the qty axis's prefix (`stage_`) deliberately **isn't**
      derived from its group (`stages`), and `stage_<id>` is a live key in users' stored width maps, so
      regularizing the table orphans pinned widths for a cosmetic win. 3 axes, one 5-line classifier,
      disjointness now pinned by a test. **Revisit trigger: a 4th stage axis.**

- [x] **dismissed** · simplify (#3) · `use-column-widths.ts:42` · Pushback on `dropKeys`' identity
      protocol ("the same-reference return exists only because the function was pulled out; the caller
      decodes it straight back into the early-return it replaced"). Fair as written, but it argues against
      a finding the gate had already accepted on stronger grounds (impl-review F3: the `some()`-vs-`every()`
      guard and last-write-resurrects are two traps on three lines with zero coverage). Keeping the
      extraction and its 4 tests.

- [x] **dismissed** · simplify (efficiency) · `src/lib/kosztorys/calc.ts:90` · The added per-cell
      arithmetic (`stageValueForView` now reaching `viewPrice` 3× via `rowDiscountForView`) is **not**
      worth optimizing — reviewer costed it honestly: dsg virtualizes rows (~35 rendered, never the
      1000), so it's ~5 µs of maths against a 5–15 ms render, ≈0.05%. The dominant cost this slice adds
      is the 20 extra React cells per row, not the arithmetic inside them. (The share-of-net rewrite
      above happens to drop one `viewPrice` per cell anyway.) Worth crediting: `DEFAULT_HIDDEN_COLUMNS`
      hiding the brutto axis by default does more for render cost than any arithmetic tuning could.

## Dismissed (verified, no action)

- [x] dismissed · module-cohesion #1 · `constants.ts:64,68` · The two key-builder **functions** in a
      constants module: rationale holds. They're the derivation of the const one line above, and their
      inverse (`toggleKey`) already shares that const as its contract — the skill's "defining const + its
      derivation" and "matched pair encoding one convention" carve-outs both cover it. Splitting would put
      builder, group const, and label in three files synced by hand: a net cohesion **loss**.
      (feature-first #1 argued the opposite — move them beside `stageKey` in `v2-rows.ts`. Overruled: its
      own premise, that all three prefixes belong in one module, is better served by `STAGE_QTY_PREFIX`
      above, which fixes the invariant **without** splitting the const from its builder.)
- [x] dismissed · scatter (hypothesis) · `constants.ts` ↔ `kosztorys-v2-columns.tsx` · The brief's
      suspicion that column knowledge is scattered across the two is **not confirmed** — it's two kinds in
      a correct layered order (a 9-importer vocabulary leaf vs. a 1-importer render module), not one kind
      in two homes. Merging would drag the leaf (incl. the Payload CLI graph via `collections/investments.ts`)
      into a React `.tsx`. Leave it.
- [x] dismissed · tailwind-v4-audit · whole diff · Clean: 0 arbitrary values, 0 inline styles, 0
      `var(--x)` in brackets. The `computedColumn` className default (`text-muted-foreground`) is a
      generated theme utility and pre-dates the slice.

## Simplify pass

Ran `/simplify` (4 parallel angle agents: reuse · simplification · efficiency · altitude) over the
slice diff `bf56f31..HEAD` + working tree — **6 applied, 5 held back (now filed: EX-481 ×2, EX-482 ×2,
EX-483 ×1), 2 skipped, 2 dismissed**; each folded into `## Findings` above, tagged `simplify`. No
separate report file: the gate's ledger is the single source, and a second one would just rot.

The pass paid for itself twice over. Its best catch wasn't a cleanup at all: the CRITICAL fix's
formula was still spelled as _gross − share-of-discount_ when the rule the owner gave is simply
_share of the row's net_ — the reconciliation now holds by construction. Its second-best was the
`hidden` map this slice had quietly turned into a footgun. The efficiency agent's most useful output
was a **refusal**: it costed the added per-cell arithmetic honestly (~0.05% of render) and told me not
to touch it.

## Tests & suite

**Authored at the gate — 11 new unit tests, all green:**

- `src/__tests__/kosztorys-calc.test.ts` (23 total, +5) · the CRITICAL's red-first repro: a `zł` rabat
  spreads by qty share, a zero-progress stage reads `0` (never negative), stage values sum to
  `rowNetForView` across all 3 views, `percent` is unchanged, and the zero-`measuredQty` divide guard.
  These 5 are also what proved `/simplify`'s share-of-net rewrite behaviour-identical — they passed
  untouched against the new formula.
- `src/__tests__/kosztorys-v2-rows.test.ts` (23 total, +2) · `diffRow` doesn't take a value column for
  stage progress; the three stage prefixes are pairwise non-prefixing (the `Number('ValueNet_7')` → NaN
  hazard `STAGE_QTY_PREFIX` exists to prevent).
- `src/__tests__/kosztorys-column-widths.test.ts` (4, new file) · `dropKeys` — all-at-once drop, partial
  hit, no mutation, identity no-op (the `some()`-vs-`every()` and last-write-resurrects traps).

**Legs run (during the gate, on the working tree):**

| Leg                        | Result                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `typecheck`                | clean                                                            |
| `lint`                     | 0 errors, 87 warnings (repo baseline, none from this diff)       |
| `test` (3 kosztorys specs) | 50 passed                                                        |
| `test:e2e`                 | not run — no spec touches this slice; E2E deferred as **EX-484** |
| `build`                    | not run                                                          |

**Full suite: not run — awaiting the owner's go.** Only the 3 affected specs were run, per
`feedback_no_premature_tests`.
