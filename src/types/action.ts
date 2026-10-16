/**
 * `REQUEST_FAILED` is
 * set only client-side by `settleAction`: the request never completed, so whether the write
 * committed is unknown.
 */
export type ActionErrorCodeT = 'NOT_FOUND' | 'REQUEST_FAILED' | 'DATABASE_ERROR' | 'ALREADY_DECIDED'

export type FailureT = {
  success: false
  error: string
  code?: ActionErrorCodeT
  messageKey?: string
  messageParams?: Record<string, string | number>
}

export type ActionResultT<TData = undefined> = TData extends undefined
  ? { success: true; warning?: string } | FailureT
  : { success: true; data: TData; warning?: string } | FailureT
