# Improvements

Tracked improvements and known issues to address in future work.

## Optimistic form submissions don't refresh the page

**Affected:** All forms using `FormDialog` + `submitOptimistically` (transfers, investments, deposits, etc.)

**Problem:** After editing via a dialog, the updated data is not visible until the user manually refreshes the page. The server-side cache is correctly revalidated (`revalidateTag`), but the client doesn't re-render because the fire-and-forget pattern in `useOptimisticFormStore.submitOptimistically` doesn't trigger `router.refresh()` after the action succeeds.

**Root cause:** `src/stores/optimistic-form-store.ts` — the `.then()` success handler clears submission state and shows a toast, but never tells the Next.js client router to re-fetch server component data.

**Fix:** Add `router.refresh()` in the optimistic store's success handler, or restructure to use `startTransition` + `router.refresh()` after the action completes. This is a global fix that will benefit all form dialogs.

**Discovered:** 2026-03-25

## `lib/` utility scatter — consolidate competing helper homes

**Affected:** `src/lib/` pure-helper / utility files and their importers.

**Problem:** The "utils" kind lives in **four competing homes** with no rule predicting which a new helper lands in — so every added helper makes it worse:

- `src/lib/utils/` — the canonical dir, but holds only `default-cash-register.ts`
- `src/lib/date-utils.ts` — flat outlier
- `src/lib/validation-utils.ts` — flat outlier
- `src/lib/actions/utils.ts` — catch-all mixing types + generic helpers + domain logic
- `src/components/toasts.ts` — a non-component helper parked at the `components/` root

**Root cause:** No enforced placement rule; helpers were added next to where they were first used instead of in `lib/utils/`. (Found via the `structure-scatter-audit` skill — convention vs. scatter classification; the per-form schema/hook colocation under `components/forms/<form>/` is a deliberate convention and is **not** in scope here.)

**Fix:** Consolidate into `src/lib/utils/` (the canonical dir; one concern per file, kebab-case, matching `default-cash-register.ts`). Do **one move per commit** so each diff is small and revertable; run `pnpm typecheck` after each. Use the `@/` alias for all updated imports.

1. **`lib/date-utils.ts` → `lib/utils/date.ts`** (exports `today`, `getMonthDateRange`). Update ~5 importers. `pnpm typecheck`.
2. **`lib/validation-utils.ts` → `lib/utils/validation.ts`** (exports `getAmountError`, `refineAmount`, `refineDate`). Update ~5 importers. `pnpm typecheck`.
3. **`components/toasts.ts` → `lib/utils/toast.ts`** (exports `toastMessage`, `ToastType`, `ToastPosition`). Update ~14 importers — largest blast radius, do as its own commit. `pnpm typecheck`.
4. **Split `lib/actions/utils.ts`** (catch-all — also a `module-cohesion-audit` concern, not a pure move):
   - `ActionResultT` (generic, app-wide) → `src/types/action.ts`.
   - `getErrorMessage`, `validateAction`, `protectedAction` (action-runner infra) → `lib/actions/run-action.ts` (concern-named; stays under `actions/`, just not in a `utils.ts`).
   - `validateSourceRegister` + `ValidateSourceRegisterResultT` (domain logic) → the relevant domain module (decide: transfers vs. cash-registers — needs domain judgment, don't dump in `lib/utils/`).
   - Update ~7 importers per new path. `pnpm typecheck`.

After all four: `src/lib/utils/` is the single home for pure helpers; no flat `lib/*-utils.ts`; no `utils.ts` catch-all; no helper stranded in `components/`. Then add a one-line note to `AGENTS.md` so future helpers land in `lib/utils/` by default.

**Discovered:** 2026-06-08 (structure-scatter-audit)
