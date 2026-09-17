# Review-gate ledger — rwd-mobile · 2026-09-16

Scope: every uncommitted change in the working tree EXCEPT `e2e/` and `src/__tests__/`,
which a parallel agent owns. That includes a second agent's dead-code/refactor work
(notifications, unread badges, reconcile-leads, parse-date-range) sitting in the same tree.

## Findings

_Trimmed at archive (2026-09-17)._ Every `fixed` finding was removed: a fix's durable record is
its commit and the code that now reads that way, so re-stating it here only ages. What survives is
the negative space git cannot hold — what was deliberately **not** done, and why. Pre-trim tally: 42 fixed, 13 dismissed, 5 filed, 5 dropped, 4 skipped, 1 accepted, 0 open.

- [x] filed EX-787 · feature-first · `ui/data-table/data-table-toolbar.tsx:3-6` · directory-level cycle `ui/ → filters/ → ui/`. The named fix (drop the `search` slot) removes only ONE of the two imports — `FILTER_CONTROL_GRID` keeps the cycle alive — and discards the toolbar's stated slot contract across ~10 tables. The real question is whether `ui/data-table/` belongs in `ui/` at all; deferred to EX-787.
- [x] filed EX-787 · feature-first · `filters/search-filter-input.tsx:11` · same root as the cycle above; `FILTER_CONTROL_GRID` in `filters/filter-grid.tsx` is the same shape, so moving one without the other buys nothing. Rides on EX-787.
- [x] dismissed · tailwind-v4 · `filters/search-filter-input.tsx:11` · not a mis-mapped upstream tier — the constant is new in this slice, written against this app's scale, so there is no upstream `md:` it was copied from. 160px from 768→1280 and 224px above is a deliberate three-step ramp; EX-624 governs re-mapping copied snippets, which this is not.
- [x] filed EX-786 · tailwind-v4 · z-ladder `10000/10001/10002/100000000` across 13 call sites in two spellings; ordering contract lives only in a prose comment in `mobile-nav.tsx`. Deferred out of the slice by the owner — no mobile symptom, and the fix touches files this slice never opened.
- [x] dropped · responsive · `ui/button.tsx:35-39` · a 44px floor on `buttonVariants` was applied and REVERTED on the user's ruling — it changed every button in the app on mobile off one audit finding nobody asked for. The drawer's own hamburger/X keep their inline `size-11`; no app-wide touch-target work in this slice.
- [x] dismissed · responsive · `sheets/iframe-view.tsx` · decision, not defect: the „otwórz na komputerze" fallback is gone, phone affordance is now only the „Otwórz w Arkuszach ↗" link. Owner reviewed and accepted — the link IS the phone affordance.
- [x] 🔵 · dismissed (owner: deliberate) · code-review · `lib/queries/fleet.ts:54` · `fetchFleetOverview()` lost its `costRange` param and hardcodes `ALL_TIME` while `/flota` still parses `?from=`/`?to=` — the range chip renders active and the „Koszty" column silently ignores it. [other agent's work]
- [x] 🔵 · dismissed · code-review · `hooks/transfers/recalculate-balances.ts:11,47` · premise checked and false. The flag was never "skip sheet write" — that is the separate `skipSheetSync` (`with-payload-transaction.ts:15`). `skipRevalidation` already means "caller is outside a Next request scope, where `revalidateTag` throws" at ~40 sites (`revalidate-collection.ts:21`, `store-lead.ts:47`), so honouring it here is consistent, not a widening. Every setter touching transfers is a seed script or DB spec; the one in-request setter (`sweep-io.ts:57`) writes equipment and revalidates once after its loop. No stale-balance path exists.
- [x] 🔵 · dismissed · code-review · `nav/mobile-nav.tsx` footer · missing `/admin` link — owner ruled the link is no longer wanted anywhere; the commented-out twin in `sidebar.tsx:127` deleted rather than restored.
- [x] 🔵 · dismissed · code-review · `ui/dialog.tsx:52` · the invariant is already written down where a caller meets it — the sheet comment at `dialog.tsx:55-59` ends "A caller overriding width or height must therefore prefix it `sm:`, or it overrides the sheet too." All 8 callers are correct, and the three new `max-w-dialog*` tokens are `sm:`-prefixed at every use. Enforcing it in types would mean a bespoke className parser; not worth it.
- [x] dismissed · 🔵 · code-review · `filters/filter-multi-select.tsx:92` · the default is load-bearing, not sloppy: a toggles-only menu has no `values` and no handler (documented at `:21`). Making it a type error means a discriminated union over the whole prop type, rippling to every call site's inference, for a small payoff.
- [x] ⚠️ · accepted · impl-review · `ui/data-table/data-table-toolbar.tsx` · Phase-4-shaped toolbar refactor (11 files, 259+/318-) landed inside Phase 1–3. Surfaced to the owner with its origin (the ragged wrapped toolbars on a phone) and its size; ruled to keep it in this slice and finish now.
- [x] ⚠️ · filed EX-786 · impl-review · plan item 1.4 · untouched, and the drawer added a FOURTH ad-hoc z layer (`z-10002`). Owner deferred it out of this slice; plan item 1.4 is marked DEFERRED → EX-786.
- [x] dismissed · impl-review · commit-splitting · owner's ruling (2026-09-16): „I don't care how you split commits." The split is the agent's call, so this is no longer a question the gate owes anyone. Recorded for the record: the other agent's unread-badge unification is a DEPENDENCY of plan item 1.2 and rides in the same commit as the drawer; `cancelled-filter-button.tsx` / `cancelled-transaction-audit-button.tsx` are THIS slice's deletions, not the other agent's.

- [x] filed EX-788 · gate · E2E obligation · a browser-level slice owes its E2E; deferred rather than authored, per the gate's file-or-author rule. Covers the nav drawer at a phone viewport (the „Wyloguj" paint-order bug is the regression guard), adding a transaction as a full-height sheet, and no horizontal page scroll at 360px. Labelled `e2e-backlog`.
- [x] dismissed · simplify · `ui/dialog.tsx:98` · premise false. The finding said only 2 of 18 dialogs render the „Wyczyść formularz" button that `pr-24` reserves room for; in fact 13 forms go through `FormShell`, which always renders it, plus `edit-transfer-form`. The reservation is right for the majority.
- [x] dismissed · simplify · `ui/summary-grid.tsx:18-20` · premise false. `min(7rem, 24vw)` is a FLOOR, not a breakpoint approximation — above ~467px the rem is simply the smaller of the two and the floor is a flat 7rem, which is what the existing comment already says. Nothing to align to 768.
- [x] dismissed · simplify · `ui/data-table/data-table.tsx:175,179` · `max-sm:space-y-6` does not re-implement `PageWrapper`'s `gap-6` — the table is ONE grid item; this spaces its own children, deliberately to the same value, and the comment says so. `max-sm:-mt-4` pulls the count row to 8px, it does not cancel the 24px.
- [x] dismissed · simplify · `kosztorys/summary/tables/materials-transactions-table.tsx:73-83` · a `truncatedCell(maxWidth)` factory would have to take the element (`span` vs `button`), the text derivation (`getValue` vs `firstNoteLine`) and the focus classes — the parameters are the code. The two cells differ for reasons each records.
- [x] dropped · simplify · `transfers/transfers-section.tsx:7` · restoring the `title` default to remove three `"Transfery"` literals needs a `null` sentinel for the one heading-free caller. The explicit prop reads better than the sentinel; not worth the trade.
- [x] dropped · simplify · `filters/filter-multi-select.tsx:88-95` · `options = []` / `onValuesChange = () => {}`. Making them required just relocates the no-op to the one toggles-only call site. Same conclusion the code-review finding at the top of this list reached independently.
- [x] dropped · simplify · `filters/filter-grid.tsx:14` · `[&_button]` → `[&>button]`. Popover content is portalled, so the descendant over-reach is largely theoretical, and the child combinator would silently drop `justify-start` from any wrapped control. Not worth the churn without a browser.
- [x] dropped · simplify · `lib/actions/workers.ts:17` · routing `crypto.randomUUID()` through `randomId()`. Verified: `random-id.ts`'s fallback is a real v4 off `crypto.getRandomValues`, so there is no security gap either way, and the file is `'use server'` — the non-secure-context case it guards cannot arise.
- [x] skipped · simplify · `ui/dialog.tsx` · a `size` prop on `DialogContent`. 16 of 18 callers sit on stock `sm:max-w-md/lg/2xl/3xl/4xl/5xl`; a three-token scale cannot reproduce six widths, so adopting it is behavior-changing and wants a browser. Real, but not this slice.
- [x] skipped · simplify · `lib/fleet/rows.ts:38,55` · `costRange` is now a dead param in production. Other agent's domain, it removes a capability, and it deletes specs the parallel test agent owns. Already dismissed as deliberate under the code-review finding above.
- [x] skipped · simplify · `filters/filter-multi-select.tsx:313-327` · two `actionRows` layouts for one caller. Collapsing them drops the „Sekcje" caption, which is a visible behavior change.
- [x] dismissed · simplify · efficiency pass · returned clean over the whole 96-file / 3951-line diff — no redundant computation, sequential independent I/O or closure-captured long-lived objects introduced.

- [x] skipped · gate · manual phone pass · owner deferred it to a later session ("manual checks later"). 3.1 / 3.2 / 2.3 stay ticked as code-complete with the caveat recorded in `plan.md`, not claimed verified.

## Simplify pass

Ran /simplify as a 4-agent read-only fan-out (reuse / simplification / efficiency / altitude) over
`git diff HEAD -- src/ ':(exclude)src/__tests__/'` — 96 files, 3951 lines. 25 findings after dedup:
**13 applied, 0 proposed, 6 dismissed, 3 dropped, 3 skipped.** Each is folded into `## Findings`
above, tagged `simplify`. Report: see the path printed at the end of the run.

## Tests & suite

- `pnpm exec tsc --noEmit` (excluding pre-existing `e2e/` errors, owned by a parallel agent) — clean
  after every batch, including the last.
- `pnpm exec prettier --check` on every file this gate touched — clean.
- Tailwind generation for the new `@utility typing-surface` verified by compiling a probe through
  `@tailwindcss/postcss`, not assumed.
- Unit/DOM suite: owned by the parallel test agent, not run here. Two test obligations recorded
  above (`transfer-filters` nested-branch case, the virgin-URL filter-count spec) are theirs.
- `pnpm test:e2e`: not run (~1h, on request only). The slice's E2E obligation is filed as EX-788,
  labelled `e2e-backlog`.
