import type { ActionResultT } from '@/types/action'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

/**
 * Shared persist-or-rollback tail for every optimistic „Opcje rozliczenia" write.
 * No `router.refresh()` on success — `updateTag` already re-renders and streams back the fresh
 * `tree`, so refreshing too would double-render per click (EX-597).
 */
export async function optimisticSettingSave(
  persist: () => Promise<ActionResultT>,
  revert: () => void,
  errorMessage: string,
): Promise<boolean> {
  const res = await settleAction(persist)
  if (res.success) return true
  revert()
  toastMessage(res.code === 'REQUEST_FAILED' ? errorMessage : res.error, 'warning', 4000)
  return false
}

/**
 * Undo half: persist via `apply`, push onto the undo stack only if the write landed. Separate from
 * `optimisticSettingSave` — the percent bulk-apply has no undo entry (owner: recovery is re-typing).
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
