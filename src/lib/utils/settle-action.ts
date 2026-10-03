import { unstable_rethrow } from 'next/navigation'
import type { FailureT } from '@/types/action'
import { logError } from '@/lib/utils/log-error'

const REQUEST_FAILED = 'Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.'

type RequestFailedT = FailureT & { code: 'REQUEST_FAILED' }

// A server action never rejects on a handler throw — `protectedAction` catches those. It rejects only
// when the request itself failed (offline, a deploy invalidating the action id), and inside a
// `startTransition` that rejection escapes unhandled: no toast, and any pending flag the caller set stays
// set. The code lets a caller whose write may have committed anyway (a tree replace) refetch instead of
// reverting.
export async function settleAction<R extends { success: boolean }>(
  call: () => Promise<R>,
): Promise<R | RequestFailedT> {
  try {
    return await call()
  } catch (err) {
    // A redirecting action rejects client-side by design — that rejection IS the navigation.
    unstable_rethrow(err)
    // TODO(EX-449) SENTRY-REQUIRED: transport failure on a server action
    logError('[SERVER_ACTION]', err)
    return { success: false, error: REQUEST_FAILED, code: 'REQUEST_FAILED' }
  }
}
