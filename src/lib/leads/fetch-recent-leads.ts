import { z } from 'zod'
import { serverEnv } from '@/lib/env/server'

const GRAPH = 'https://graph.facebook.com/v21.0'

export type LeadFormSummaryT = {
  id: string
  name: string
  leadsCount: number
}

const leadFormsResponseSchema = z.object({
  data: z
    .array(
      z.object({ id: z.string(), name: z.string().optional(), leads_count: z.number().optional() }),
    )
    .optional(),
})

const recentLeadsResponseSchema = z.object({ data: z.array(z.unknown()).optional() })

/**
 * Throws on a non-2xx or an `error`
 * body so a caller (the reconcile action) can surface a real failure instead of
 * silently treating an auth error as "no leads".
 */
async function graphGet(path: string): Promise<unknown> {
  const res = await fetch(`${GRAPH}/${path}`, {
    headers: { Authorization: `Bearer ${serverEnv.META_PAGE_ACCESS_TOKEN}` },
  })
  const body = await res.json()
  if (!res.ok || (body && typeof body === 'object' && 'error' in body)) {
    throw new Error(`Graph request failed for ${path} (status ${res.status})`)
  }
  return body
}

export async function listLeadForms(): Promise<LeadFormSummaryT[]> {
  const body = await graphGet(
    `${serverEnv.META_PAGE_ID}/leadgen_forms?fields=id,name,leads_count&limit=100`,
  )
  const parsed = leadFormsResponseSchema.safeParse(body)
  if (!parsed.success) return []
  return (parsed.data.data ?? []).map((form) => ({
    id: form.id,
    name: form.name ?? '',
    leadsCount: form.leads_count ?? 0,
  }))
}

export async function fetchRecentLeads(formId: string, limit: number): Promise<unknown[]> {
  const body = await graphGet(`${formId}/leads?fields=id,created_time,field_data&limit=${limit}`)
  const parsed = recentLeadsResponseSchema.safeParse(body)
  if (!parsed.success) return []
  return parsed.data.data ?? []
}
