'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { sessionAction, validateAction } from '@/lib/actions/run-action'
import { getDb } from '@/lib/db/get-db'
import { deletePushSubscription, upsertPushSubscription } from '@/lib/db/push-subscriptions'
import type { ActionResultT } from '@/types/action'

// Every browser's push service is https; anything else did not come from `pushManager.subscribe`.
const endpointSchema = z.url({ protocol: /^https$/ }).max(2048)

const keySchema = z.string().min(1).max(256)

const subscribeSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({ p256dh: keySchema, auth: keySchema }),
})

export type PushSubscriptionInputT = z.infer<typeof subscribeSchema>

/** Registers THIS device for the session's account — whose device it is is never an argument. */
export async function subscribePushAction(input: PushSubscriptionInputT): Promise<ActionResultT> {
  const parsed = validateAction(subscribeSchema, input)
  if (!parsed.success) return parsed
  const { endpoint, keys } = parsed.data

  return sessionAction('subscribePushAction', async ({ payload, user }) => {
    const userAgent = (await headers()).get('user-agent') ?? undefined
    await upsertPushSubscription(await getDb(payload), user.id, { endpoint, ...keys, userAgent })
    return { success: true }
  })
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionResultT> {
  const parsed = validateAction(endpointSchema, endpoint)
  if (!parsed.success) return parsed

  return sessionAction('unsubscribePushAction', async ({ payload, user }) => {
    await deletePushSubscription(await getDb(payload), user.id, parsed.data)
    return { success: true }
  })
}
