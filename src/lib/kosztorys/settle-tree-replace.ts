import type { FailureT } from '@/types/action'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type SucceededT<R> = Extract<R, { success: true }>

/**
 * once the grid's pending cell saves have landed: one still in its debounce would hit an id the
 * replacement deleted, or miss the auto version taken before it. `null` means refused and already
 * toasted — the dialog stays open.
 */
export async function settleTreeReplace<R extends { success: true } | FailureT>(
  flushPendingSaves: () => Promise<void>,
  call: () => Promise<R>,
  interrupted: string,
  onSuccess: (result: SucceededT<R>) => void,
): Promise<{ refetch: boolean; stale?: boolean } | null> {
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
  return result.code === 'NOT_FOUND' ? { refetch: true, stale: true } : null
}
