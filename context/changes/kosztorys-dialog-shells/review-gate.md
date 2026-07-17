# Review-gate ledger — kosztorys-dialog-shells (EX-519) · 2026-07-17

Unit: uncommitted working tree on `refactor/kosztorys-dialog-shells`.
Scope: dialog unification (`DialogActions`, `FormDialogShell`, header prop-form) + dead-code removal
(`onCreate` / create-from-template path / `investmentName` prop cascade).

## Findings

<!-- ONE checkbox per finding. Format: [box] [severity, bug-checks only] · disposition · `source` · `file:line` · what — reason -->

- [x] 🔵 OBSERVATION · fixed · `code-review` · `src/lib/actions/investments.ts` · removed caller-less `provisionSheetAction` (create-from-template path, disabled by SA Drive quota → link-existing only). Cascade fully orphaned: deleted `lib/google/drive.ts` (`createSheetFromTemplate` / `isStorageQuotaError` / `getDriveClient`) + `__tests__/lib/google/drive.test.ts`; rewrote the `linkSheetAction` docstring that referenced it. Env vars `KOSZTORYS_TEMPLATE_SHEET_ID` / `KOSZTORYS_DRIVE_FOLDER_ID` left in `env/schema.ts` (documented working creds; breadcrumb for a future Shared-Drive rewire). typecheck + lint + unit green after cut. Recoverable from git if the feature returns.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `save-preset-dialog.tsx` / `save-version-dialog.tsx` · Anuluj now routes through the local reset handler (was raw `onOpenChange(false)`) — benign improvement, makes cancel consistent with Esc/overlay/X and clears stale form state on reopen.
- [x] 🔵 OBSERVATION · dismissed · `code-review` · `sheet-setup-dialog.tsx` · commented-out create block + `border-t` removed cleanly, no leftover commented code.
- [x] dismissed · `tailwind` · `lead-answers-dialog.tsx:28` · `grid-cols-[1fr_1.5fr]` — legit grid-template arbitrary value (no scale utility expresses it), pre-existing + untouched by this diff. Leave.
- [x] fixed · `comment-noise` · `form-dialog-shell.tsx:12` · deleted `// The dialog body…` restatement.
- [x] fixed · `comment-noise` · `dialog-actions.tsx:13` · trimmed pending comment to the cross-file coupling why only.
- [x] fixed · `comment-noise` · `form-dialog-shell.tsx:18` · trimmed `contentClassName` comment, cut the restated default tail.
- [x] dismissed · `comment-noise` · 5 flagged-kept comments (dialog-actions header, className escape-hatch, shell design-contract, save-preset header, sync-button appendItem) — load-bearing rationale or pre-existing/untouched. Keep.
- [x] dismissed · `feature-first`/`cohesion`/`scatter` · `ui/dialog-actions.tsx` + `ui/form-dialog-shell.tsx` · correctly placed (tier-3 domain-free primitives beside dialog.tsx/confirm-dialog.tsx/button.tsx), one concern each, PropsT colocated, all consumers import the right path. No change.
- [x] fixed · `scatter` · `src/components/ui/form-dialog.tsx` · relocated the generic domain-free `FormDialog` from `components/dialogs/` to `components/ui/` (`git mv`), rewrote all 8 consumer imports. Now sits beside `dialog.tsx` / `form-dialog-shell.tsx` / `dialog-actions.tsx` — one home for generic dialog primitives. typecheck green.
- [x] fixed · `simplify` · `form-dialog-shell.tsx:31,32` · removed speculative `cancelLabel` + `contentClassName` props — no shell caller passes either (all 3 use the `sm:max-w-sm` + `'Anuluj'` defaults). YAGNI; typecheck clean after cut.

## Simplify pass

Ran /simplify — 3 applied (comment-noise trims folded above + this props cut), 0 proposed, reuse/efficiency/altitude clean. Findings folded into ## Findings (tagged `simplify`/`comment-noise`).

## Tests & suite

Test disposition: pure view refactor (shell unification, no behavior change) → no correctness finding
owes a regression guard; the one behavior-adjacent item (Anuluj→reset) was dismissed as benign. No new
automated test authored. E2E obligation: refactor carries no new browser behavior — no new spec owed.

- typecheck — pass
- lint — pass (86 warnings, all pre-existing migration `db`-unused; onCreate warning cleared)
- test (unit) — pass (956 passed, 40 skipped; drive.test.ts removed with its subject)
- test:e2e — _not run (view refactor; awaiting go)_
- build — _not run (awaiting go)_

Archive status: all `## Findings` boxes checked. Remaining gate legs before archive:
manual browser verification sign-off + (optional) e2e/build. EX-519 stays In Review until then.
