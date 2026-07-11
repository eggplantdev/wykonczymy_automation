'use server'

import type { ActionResultT } from '@/types/action'
import { protectedAction } from './run-action'
import { getOpenRouterCredits, type OpenRouterCreditsT } from '@/lib/ai/openrouter-credits'

// Read-only: expose the shared OpenRouter wallet balance to authenticated users so the nav can show
// remaining credit. TopNav is a client component, so it reaches the server-only key through here.
// No mutation, no cache revalidation.
export async function getOpenRouterCreditsAction(): Promise<
  ActionResultT<OpenRouterCreditsT | null>
> {
  return protectedAction('getOpenRouterCreditsAction', async () => {
    const credits = await getOpenRouterCredits()
    return { success: true, data: credits }
  })
}
