import 'server-only'

import { serverEnv } from '@/lib/env/server'

const CREDITS_URL = 'https://openrouter.ai/api/v1/credits'

// OpenRouter meters spend in USD credits, not tokens — `remaining` is the wallet balance to show.
export type OpenRouterCreditsT = {
  remaining: number
  total: number
  used: number
}

// Reads the shared OpenRouter wallet via /credits with the server key. Returns null when the live
// call fails or times out — callers render null as "nothing to show", so a slow/flaky OpenRouter
// can never block or break render.
export async function getOpenRouterCredits(): Promise<OpenRouterCreditsT | null> {
  try {
    const res = await fetch(CREDITS_URL, {
      headers: { Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}` },
      cache: 'no-store', // wallet balance is live state — never serve a stale number
      signal: AbortSignal.timeout(4000), // OpenRouter hiccup ≠ hung request
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { total_credits?: number; total_usage?: number }
    }
    const { total_credits: total, total_usage: used } = json.data ?? {}
    if (typeof total !== 'number' || typeof used !== 'number') return null
    return { remaining: total - used, total, used }
  } catch {
    return null
  }
}
