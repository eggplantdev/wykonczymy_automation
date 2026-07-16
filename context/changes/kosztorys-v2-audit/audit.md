# Kosztorys v2 — audit of the four largest files

- **Linear:** [EX-496](https://linear.app/ex-plant/issue/EX-496/kosztorys-v2-audit-usekosztoryseditor-is-not-compiled-by-react) (Urgent)
- **Run:** 2026-07-16, branch `dogfooding/kosztorys-editor-ux`, after `f8acf24`
- **Scope:** the four files by size — `kosztorys-v2-columns.tsx` (778), `use-kosztorys-editor.ts` (591), `lib/actions/kosztorys.ts` (447), `v2-rows.ts` (432)

Findings are tagged **verified** (checked by hand against the code or the compiler) or **agent-reported**
(surfaced by an audit agent, not yet independently confirmed). The distinction is load-bearing: two agents
contradicted each other on the cast count and `grep` settled it against one of them, so nothing here is
trustworthy on an agent's word alone.

---

## 1. 🔴 `useKosztorysEditor` is not compiled by React Compiler — **verified**

`src/components/kosztorys/use-kosztorys-editor.ts` emits **zero** `_c` cache slots. Every sibling compiles:

| file                                 | cache            |
| ------------------------------------ | ---------------- |
| `use-kosztorys-editor.ts`            | **NOT COMPILED** |
| `use-money-axis.ts`                  | `_c(2)`          |
| `use-price-view.ts`                  | `_c(7)`          |
| `use-column-widths.ts`               | `_c(10)`         |
| `kosztorys-editor-body.tsx`          | `_c(45)`         |
| `kosztorys-toolbar-actions.tsx`      | `_c(21)`         |
| `kosztorys-toolbar-view-toggles.tsx` | `_c(13)`         |

Established by compiling the file directly with `babel-plugin-react-compiler@1.0.0` and reading the emitted
output plus the bailout event from the plugin's `logger.logEvent` hook. First blocker:

```
BAIL @ line 352: (BuildHIR::lowerExpression) Expected Identifier, got CallExpression key in ObjectExpression
```

Line 352 is `handleAddStage`'s updater: `(r) => ({ ...r, [stageKey(id)]: 0 })`. The compiler's HIR lowering
won't take a computed key whose value is a call expression.

Two further blockers sit behind it (agent-reported; each only surfaces once the prior clears, so they can't be
confirmed until the first is fixed):

1. `columnOpts` (~:140) captures refs during render → "Cannot access refs during render"
2. `handleRemoveItem` (~:287) calls `handleRemoveSection`, which is declared later at :411

### Why this went unnoticed

`panicThreshold` defaults to skip-and-continue. A bail is not a build error, not a lint warning, not a console
message — the file simply comes out of the pipeline untransformed. Nothing in `pnpm build` reports it.

### Consequence

`columns`, `columnToggleItems`, `sectionCoeffs`, `columnOpts` and ~15 handlers get fresh identities on every
render. Downstream consumers _are_ compiled, so their caches exist and are keyed on these values — and
therefore always miss. `kosztorys-toolbar-actions.tsx` (`_c(21)`) never hits, and `DynamicDataSheetGrid`
receives a new `columns` array on every keystroke.

This predates the toolbar context refactor and is not caused by it. It does, however, **qualify the earlier
"no performance penalty" conclusion** about that refactor: the claim holds for `kosztorys-toolbar-view-toggles.tsx`,
whose cache keys (`view`/`setView` and siblings) all come from compiled leaf hooks and are referentially stable.
It does not generalise to anything reading from `useKosztorysEditor`.

### Reproducing

Compile the file standalone. `@babel/core` is not hoisted (pnpm strict), so resolve against the store:

```
node_modules/.pnpm/@babel+core@7.29.0/node_modules/@babel/core
node_modules/.pnpm/babel-plugin-react-compiler@1.0.0/node_modules/babel-plugin-react-compiler
```

No `@babel/preset-typescript` is installed — parse with `parserOpts: { plugins: ['jsx', 'typescript'] }`.
Do **not** `pnpm add` anything to make this easier: per `AGENTS.md` it can swap the native `lightningcss`
binary to x64 on this arm64 machine.

---

## 2. 🔴 Ten columns render a sort control that silently does nothing — **agent-reported**

`kosztorys-v2-columns.tsx:207-224` + `use-kosztorys-editor.ts:72-90`.

The sort key is the column id, but `sortValue` only handles `price` / `net` / `remaining`. Every other id
resolves to `undefined` → `''` → the comparison is a no-op. The header still flips to its active style and
renders a direction arrow.

It does not fail — it lies. A user sorts, the header confirms the sort, the rows don't move.

The file **already documents this rule** at `stageValueHeader` (:251-255) and exempts the stage mirror columns
by hand. The computed columns were missed by the same pass.

**Test disposition:** test-driven-debugging · unit — a no-op sort still returns a valid array of the right
length, so this sails past any assertion that doesn't check ordering explicitly. Repro first.

---

## 3. 🔴 Coefficient / VAT saves swallow their failures — **agent-reported**

`handleGlobalCoeffChange`, `handleVatChange`, `handleSectionCoeffChange` each do:

```ts
if (res.success) router.refresh()
```

with no `else`. `rows` is seeded by a once-only `useState` initializer, so `router.refresh()` is the only thing
that re-seeds it — and it doesn't run on failure. A rejected save therefore leaves a **wrong price on screen
that survives every subsequent refresh**, until a full page reload. That is exactly the staleness the comment at
:446 claims the patch prevents.

The sibling handlers revert on failure. These three don't. The inconsistency is what makes it look deliberate
when it isn't.

**Test disposition:** test-driven-debugging · unit — assert the persisted/observable state after a rejected
action, not the action's return value; a success-shaped result is precisely what's being mishandled here.

---

## 4. 🟡 `investments` cache tag missing from the two settings actions — **agent-reported**

`lib/actions/kosztorys.ts`. Masked today only because a Payload hook bumps the tag lazily — so the bug is
invisible until that hook's timing changes. `restoreSnapshotAction` does it correctly and carries a comment
explaining why, which makes the omission in the neighbours look like an oversight rather than a decision.

## 5. 🟡 `addItemAction` / `insertItemAction` trust a client-supplied `investmentId` — **agent-reported**

Neither checks that the target section actually belongs to the given investment. An item can be fetched for
investment A and bucketed under a section of investment B, at which point it is **dropped from both sheets and
undeletable through the UI** — it renders in neither tree.

## 6. 🔵 Twelve no-op casts — **verified (grep)**

`kosztorys-v2-columns.tsx`, at lines 389, 408, 425, 449, 475, 614, 621, 626, 672, 684, 698, 701:

```ts
as unknown as ViewPricingT
```

`v2-rows.ts:323` passes the same type **uncast** and compiles. So these are not bridging a real mismatch — they
are switching off type checking at twelve sites for nothing. (Two agents disagreed here, 12 vs 4; `grep -c`
settled it at 12.)

## 7. 🔵 `widthsKey` / `stagesKey` are dead — **verified**

Returned by `useKosztorysEditor`, consumed by nothing outside it. `ee497cb` removed the remount they existed to
key; the only remaining trace is a past-tense comment at `stage-header.tsx:20`. `JSON.stringify(widths)` runs
every render for no reader.

## 8. 🔵 `kosztorysDoneNetForView` is dead — **verified**

Zero production callers. Kept alive solely by `src/__tests__/kosztorys-v2-rows.test.ts`, i.e. the test is the
only reason the function looks used.

---

## Structural candidates

- **Extract `settlement.ts` from `v2-rows.ts`** — the `calc → settlement → rows` layering that `bb15fed`
  describes currently exists only as a comment. Making it a file makes the layering checkable.
- **Extract `HEADER_TIPS`** (~47 lines of Polish copy) out of the column builder — copy and structure in one
  file is what makes the builder hard to scan.
- **Narrow the 16-field opts bag with `Pick<>`** — zero call-site changes; structural typing handles it for free.

## Rejected as dedupe traps

Recorded so they don't get re-proposed:

- **The three stage-value column blocks** — percent is a different _kind_ of thing, not a third twin.
- **The six `net + toGross` pairs** — one needs a custom className, and the stage pair can't use the helper at all.
- **The async handler families** — four different shapes, not one shape repeated.
- **The `sumOverStages` walkers** — identical in shape, but one sums PLN and the other quantities. A shared name
  would erase the only thing distinguishing them.

---

## Suggested order

1. Hoist `stageKey(id)` to a `const` above the updater at :352, recompile, read the next bail. Cheapest change
   on the list and the highest leverage.
2. Clear blockers 2 and 3; confirm `_c(n)` actually appears in the output. The fix is not "the diff looks right"
   — it's the compiler emitting a cache.
3. Findings 2 and 3: verify by hand first, then repro test, then fix.
