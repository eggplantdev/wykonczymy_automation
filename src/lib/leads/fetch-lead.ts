import { serverEnv } from '@/lib/env/server'

/**
 * Meta's webhook carries only a `leadgen_id`; the field data lives behind a
 * second authenticated Graph call with the Page token. Returns the raw JSON —
 * the caller runs it through `leadSchema.safeParse` (never trust it typed).
 *
 * Throws on a recoverable Graph failure (non-2xx, or a body carrying an `error`
 * object — e.g. rate-limit 613, transient #2, Graph 500). This is load-bearing:
 * a thrown error lands in the route's catch → non-200 → Meta redelivers. If we
 * returned the error body instead it would fail `leadSchema` and get ACKed 200,
 * so Meta would never retry and the lead would be lost.
 */
export async function fetchLead(leadgenId: string): Promise<unknown> {
  const url = `https://graph.facebook.com/v21.0/${leadgenId}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${serverEnv.META_PAGE_ACCESS_TOKEN}` },
  })

  const body = await res.json()
  if (!res.ok || (body && typeof body === 'object' && 'error' in body)) {
    throw new Error(`Graph lead fetch failed for ${leadgenId} (status ${res.status})`)
  }
  return body
}
