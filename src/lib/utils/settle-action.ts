import { logError } from '@/lib/utils/log-error'

const REQUEST_FAILED = 'Brak połączenia z serwerem — sprawdź internet albo odśwież stronę.'

// A server action never rejects on a handler throw — `protectedAction` catches those. It rejects only
// when the request itself failed (offline, a deploy invalidating the action id), and inside a
// `startTransition` that rejection escapes unhandled: no toast, and any pending flag the caller set stays
// set. Folding it into the failure branch lets the caller's `!res.success` path report it.
export async function settleAction<R extends { success: boolean }>(
  call: () => Promise<R>,
): Promise<R | { success: false; error: string; code?: undefined }> {
  try {
    return await call()
  } catch (err) {
    // TODO(EX-449) SENTRY-REQUIRED: transport failure on a server action
    logError('[SERVER_ACTION]', err)
    return { success: false, error: REQUEST_FAILED }
  }
}
