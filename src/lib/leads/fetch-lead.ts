import { serverEnv } from '@/lib/env/server'

/**
 * Returning the error body instead would fail `leadSchema` and get ACKed 200, so the lead would be lost.
 */
export async function fetchLead(leadgenId: string): Promise<unknown> {
  // `fields` is load-bearing: Graph returns ONLY what it is asked for, and its default set for a
  // leadgen node omits `form_id`.
  const url = `https://graph.facebook.com/v21.0/${leadgenId}?fields=id,created_time,form_id,field_data`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${serverEnv.META_PAGE_ACCESS_TOKEN}` },
  })

  const body = await res.json()
  if (!res.ok || (body && typeof body === 'object' && 'error' in body)) {
    throw new Error(`Graph lead fetch failed for ${leadgenId} (status ${res.status})`)
  }
  return body
}
