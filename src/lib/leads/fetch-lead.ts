import { serverEnv } from '@/lib/env.server'

/**
 * Meta's webhook carries only a `leadgen_id`; the field data lives behind a
 * second authenticated Graph call with the Page token. Returns the raw JSON —
 * the caller runs it through `leadSchema.safeParse` (never trust it typed).
 */
export async function fetchLead(leadgenId: string): Promise<unknown> {
  const url = `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${serverEnv.META_PAGE_ACCESS_TOKEN}`
  const res = await fetch(url)
  return res.json()
}
