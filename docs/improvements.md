# Improvements

Tracked improvements and known issues to address in future work.

## Optimistic form submissions don't refresh the page

**Affected:** All forms using `FormDialog` + `submitOptimistically` (transfers, investments, deposits, etc.)

**Problem:** After editing via a dialog, the updated data is not visible until the user manually refreshes the page. The server-side cache is correctly revalidated (`revalidateTag`), but the client doesn't re-render because the fire-and-forget pattern in `useOptimisticFormStore.submitOptimistically` doesn't trigger `router.refresh()` after the action succeeds.

**Root cause:** `src/stores/optimistic-form-store.ts` — the `.then()` success handler clears submission state and shows a toast, but never tells the Next.js client router to re-fetch server component data.

**Fix:** Add `router.refresh()` in the optimistic store's success handler, or restructure to use `startTransition` + `router.refresh()` after the action completes. This is a global fix that will benefit all form dialogs.

**Discovered:** 2026-03-25
