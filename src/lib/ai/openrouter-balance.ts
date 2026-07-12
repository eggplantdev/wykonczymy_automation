import 'server-only'

import { serverEnv } from '@/lib/env/server'

// OpenRouter meters spend in USD credits, not tokens — `remaining` is the wallet balance to show.
type OpenRouterBalanceT = {
  remaining: number
  total: number
  used: number
}

// Returns null on failure/timeout — callers render null as "nothing to show", so a slow/flaky
// OpenRouter can never block or break render.
export async function getOpenRouterBalance(): Promise<OpenRouterBalanceT | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${serverEnv.OPENROUTER_API_KEY}` },
      next: { revalidate: 60 },
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
