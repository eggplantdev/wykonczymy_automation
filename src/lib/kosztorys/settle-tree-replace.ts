import type { FailureT } from '@/types/action'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type SucceededT<R> = Extract<R, { success: true }>

/**
 * Settle a write that wipes and reinserts the whole tree, once the grid's pending cell saves have
 * landed: one still in its debounce would hit an id the replacement deleted, or miss the auto version
 * taken before it. `null` means refused and already toasted — the dialog stays open. Otherwise the
 * caller closes and reseeds, refetching when the request never
 * completed (it may still have committed, so the grid may be rendering rows that no longer exist) or
 * when the refusal is `NOT_FOUND`: the editor's copy is stale, and a retry would resend it.
 */
export async function settleTreeReplace<R extends { success: true } | FailureT>(
  flushPendingSaves: () => Promise<void>,
  call: () => Promise<R>,
  interrupted: string,
  onSuccess: (result: SucceededT<R>) => void,
): Promise<{ refetch: boolean } | null> {
  await flushPendingSaves()
  const result = await settleAction(call)
  if (result.success) {
    onSuccess(result as SucceededT<R>)
    return { refetch: false }
  }
  if (result.code === 'REQUEST_FAILED') {
    toastMessage(interrupted, 'error', 6000)
    return { refetch: true }
  }
  toastMessage(result.error, 'error', 6000)
  return result.code === 'NOT_FOUND' ? { refetch: true } : null
}
