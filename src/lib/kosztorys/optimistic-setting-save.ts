import type { ActionResultT } from '@/types/action'
import { toastMessage } from '@/lib/utils/toast'

/**
 * Shared tail of every optimistic „Opcje rozliczenia" write. The caller has already applied its
 * optimistic patch and captured whatever `revert` needs; this persists, then on failure runs
 * `revert` and surfaces the error. Tail-only on purpose: the optimistic apply and the pre-patch
 * capture differ per setting and stay at the call site — only this success-or-rollback tail was
 * identical.
 *
 * No router.refresh() on success: the action's `updateTag` already re-renders the route and streams
 * the fresh `tree` back in the action response, so the refresh was a second full render of the same
 * page per click (EX-597 baseline).
 */
export async function optimisticSettingSave(
  persist: () => Promise<ActionResultT>,
  revert: () => void,
  errorMessage: string,
): Promise<boolean> {
  let res: ActionResultT
  try {
    res = await persist()
  } catch {
    // A transport-level failure (5xx, dropped connection, a deploy mid-flight) never reaches
    // `protectedAction()`'s result contract — Next's own action runtime throws client-side instead.
    // Without this the rollback was skipped and the throw reached the route's error boundary,
    // replacing the editor while the optimistic patch was still on screen.
    revert()
    toastMessage(errorMessage, 'warning', 4000)
    return false
  }
  if (res.success) return true
  revert()
  toastMessage(res.error, 'warning', 4000)
  return false
}

/**
 * The undo half of the same lane: persist through `apply`, then put the move on the undo stack.
 *
 * The entry goes on the stack only when `apply` reports the write LANDED. A failed save has already
 * rolled the screen back, so recording it would leave a step whose undo does nothing visible —
 * the same ghost `handleGlobalDiscountChange` already refuses for a no-op change.
 *
 * Deliberately NOT folded into `optimisticSettingSave` — the percent bulk-apply shares the persist
 * tail but carries no undo entry (owner: recovery is re-typing), so the two halves have different
 * sets of call sites.
 */
export async function reversibleSettingSave<T>(
  apply: (value: T) => Promise<boolean>,
  pushReversible: (label: string, apply: (state: T) => void, before: T, after: T) => void,
  label: string,
  before: T,
  next: T,
): Promise<void> {
  const saved = await apply(next)
  if (saved && before !== next) pushReversible(label, apply, before, next)
}
