'use server'

import type { ActionResultT } from '@/types/action'
import { protectedAction } from './run-action'
import { getOpenRouterBalance, type OpenRouterBalanceT } from '@/lib/ai/openrouter-balance'

// Read-only: expose the shared OpenRouter wallet balance to authenticated users so the nav can show
// remaining credit. TopNav is a client component, so it reaches the server-only key through here.
// No mutation, no cache revalidation.
export async function getOpenRouterBalanceAction(): Promise<
  ActionResultT<OpenRouterBalanceT | null>
> {
  return protectedAction('getOpenRouterBalanceAction', async () => {
    const balance = await getOpenRouterBalance()
    return { success: true, data: balance }
  })
}
