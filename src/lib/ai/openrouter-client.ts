import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { serverEnv } from '@/lib/env/server'
import { logError } from '@/lib/utils/log-error'

// Built from AbortController + setTimeout (not AbortSignal.timeout) so it's fakeable.
export function timeoutSignal(ms: number, label: string): AbortSignal {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error(`${label} timed out after ${ms}ms`)),
    ms,
  )
  timer.unref?.()
  return controller.signal
}

export const FALLBACK_MODEL = 'google/gemini-2.5-flash'

export async function withModelFallback<T>(
  label: string,
  primary: string,
  call: (model: string) => Promise<T>,
): Promise<T> {
  try {
    return await call(primary)
  } catch (primaryError) {
    // TODO(EX-958) SENTRY-REQUIRED: a silent fallback hides that the primary model is broken.
    logError(`[${label}] primary model ${primary} failed — falling back`, primaryError)
    return call(FALLBACK_MODEL)
  }
}

export const openrouter = createOpenRouter({
  apiKey: serverEnv.OPENROUTER_API_KEY,
  headers: {
    ...(serverEnv.OPENROUTER_HTTP_REFERER
      ? { 'HTTP-Referer': serverEnv.OPENROUTER_HTTP_REFERER }
      : {}),
    ...(serverEnv.OPENROUTER_APP_NAME ? { 'X-Title': serverEnv.OPENROUTER_APP_NAME } : {}),
  },
})
