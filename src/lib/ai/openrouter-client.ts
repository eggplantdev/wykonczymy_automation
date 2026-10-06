import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { serverEnv } from '@/lib/env/server'
import { logError } from '@/lib/utils/log-error'

// Importing `serverEnv` (which is `import 'server-only'`) makes this module server-only too:
// never pull it into the Payload CLI graph (payload.config.ts / collections), or
// `payload generate:types` throws.

// Built from AbortController + setTimeout (not AbortSignal.timeout) so it's fakeable.
export function timeoutSignal(ms: number, label: string): AbortSignal {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(new Error(`${label} timed out after ${ms}ms`)),
    ms,
  )
  timer.unref?.() // don't keep the process alive on the timer alone
  return controller.signal
}

// Known-good fallback: a call retries once with this when its (cheaper, on-trial) primary throws,
// so a wrong/unavailable model id degrades to slower-but-working instead of failing. Confirmed
// reads the Stimulsoft/Quartz receipt PDFs + images.
export const FALLBACK_MODEL = 'google/gemini-2.5-flash'

export async function withModelFallback<T>(
  label: string,
  primary: string,
  call: (model: string) => Promise<T>,
): Promise<T> {
  try {
    return await call(primary)
  } catch (primaryError) {
    // TODO(EX-449) SENTRY-REQUIRED: a silent fallback hides that the primary model is broken.
    logError(`[${label}] primary model ${primary} failed — falling back`, primaryError)
    return call(FALLBACK_MODEL)
  }
}

export const openrouter = createOpenRouter({
  apiKey: serverEnv.OPENROUTER_API_KEY,
  // Attribution headers OpenRouter surfaces on its dashboard; omitted when unset.
  headers: {
    ...(serverEnv.OPENROUTER_HTTP_REFERER
      ? { 'HTTP-Referer': serverEnv.OPENROUTER_HTTP_REFERER }
      : {}),
    ...(serverEnv.OPENROUTER_APP_NAME ? { 'X-Title': serverEnv.OPENROUTER_APP_NAME } : {}),
  },
})
