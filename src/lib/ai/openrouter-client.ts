import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { serverEnv } from '@/lib/env/server'

// Importing `serverEnv` (which is `import 'server-only'`) makes this module server-only too:
// never pull it into the Payload CLI graph (payload.config.ts / collections), or
// `payload generate:types` throws.

// Built from AbortController + setTimeout (not AbortSignal.timeout) so it's fakeable.
export function timeoutSignal(ms: number, label: string): AbortSignal {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error(`${label} timed out after ${ms}ms`)), ms)
  timer.unref?.() // don't keep the process alive on the timer alone
  return controller.signal
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
