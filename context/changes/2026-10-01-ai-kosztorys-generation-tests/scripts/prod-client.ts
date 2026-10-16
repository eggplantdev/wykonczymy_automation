// Talks to PRODUCTION through the app itself, never the database: the same server actions the browser
// calls (permissions, lock, revalidation) and the same browser→Blob upload path. The session is a
// user's `payload-token`, read from a file outside the repo.
import { readFileSync } from 'node:fs'
import { put } from '@vercel/blob'
import type { ReviewStatusT } from '@/lib/kosztorys/types'
import { uniqueFileName } from '@/lib/utils/unique-file-name'

export const BASE = 'https://wykonczymy.vercel.app'
const TOKEN = readFileSync(process.env.TOKEN_FILE ?? '', 'utf8').trim()

export type ItemT = {
  id: number
  displayOrder: number
  description: string | null
  unit: string | null
  plannedQty: number
  clientPrice: number
  wToolsOverrideValue: number | null
  wToolsOverrideCoeff: number | null
  ownToolsOverrideValue: number | null
  ownToolsOverrideCoeff: number | null
  aiPlannedQty: number | null
  aiMissingData: string | null
  aiAssumptions: string | null
  reviewStatus: ReviewStatusT | null
  changeReason: string | null
  catalogueItemId: number | null
  // EX-1057. REST returns a field only once the deployed code declares it, migrated or not.
  aiNewInformation?: string | null
  section: { id: number; name: string; displayOrder: number }
}

export type MediaKindT = 'projekt' | 'zdjecie' | 'inne'

export type AssetT = {
  id: number
  kind: string | null
  mimeType: string
  filename: string
  url: string
  createdAt: string
}

// When the upload dialog started promising that only files marked „Do analizy AI” reach the AI. A file
// uploaded before then was left unmarked under the old meaning of the tick („Rzut/projekt”), not to
// keep it from the AI, so it still goes in.
const MARKER_PROMISE_SINCE = new Date('2026-10-15T00:00:00+02:00')
export const forAiAnalysis = (asset: AssetT) =>
  asset.kind === 'projekt' || new Date(asset.createdAt) < MARKER_PROMISE_SINCE

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// Without it a round reads every Nowe informacje as empty: the re-run guard passes and the baseline
// the next round diffs against loses what is already there.
export function assertRoundFieldsDeployed(items: readonly ItemT[]) {
  if (items.some((item) => !('aiNewInformation' in item)))
    throw new Error('production does not return aiNewInformation yet — deploy EX-1057 first')
}

// Every request to the app carries the session.
const plainFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.startsWith(BASE)) return plainFetch(input, init)
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `JWT ${TOKEN}`)
  headers.set('Cookie', `payload-token=${TOKEN}`)
  return plainFetch(input, { ...init, headers })
}

export async function api<T>(route: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${route}`, init)
  const body = await res.json()
  if (!res.ok) throw new Error(`${route} ${res.status} ${JSON.stringify(body)}`)
  return body
}

// Action ids change with every deploy, so they are read from the deployed client chunks of the page
// that calls them, where each one is `createServerReference)("<id>",…,"<name>")`.
const actionIds = new Map<string, string>()
export async function resolveActions(page: string, names: string[]) {
  const html = await (await fetch(`${BASE}${page}`)).text()
  const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[^"\\]+\.js/g) ?? [])]
  for (const chunk of chunks) {
    const js = await (await fetch(`${BASE}${chunk}`)).text()
    for (const [, id, name] of js.matchAll(
      /createServerReference\)\("([0-9a-f]+)",[^)]{0,80}?"(\w+)"\)/g,
    )) {
      actionIds.set(name, id)
    }
  }
  const missing = names.filter((name) => !actionIds.has(name))
  if (missing.length) throw new Error(`no action id for ${missing.join(', ')} on ${page}`)
}

export async function callAction<T>(name: string, page: string, args: unknown[]): Promise<T> {
  const id = actionIds.get(name)
  if (!id) throw new Error(`${name} not resolved — call resolveActions first`)
  const res = await fetch(`${BASE}${page}`, {
    method: 'POST',
    headers: {
      'Next-Action': id,
      Accept: 'text/x-component',
      'Content-Type': 'text/plain;charset=UTF-8',
    },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  const line = text.split('\n').find((l) => l.startsWith('1:'))
  if (!res.ok || !line) throw new Error(`${name} ${res.status}: ${text.slice(0, 300)}`)
  const result = JSON.parse(line.slice(2))
  if (!result.success) throw new Error(`${name}: ${JSON.stringify(result)}`)
  return result
}

export const itemsOf = async (investmentId: number) =>
  (
    await api<{ docs: ItemT[] }>(
      `/kosztorys-items?where[investment][equals]=${investmentId}&depth=1&limit=0&pagination=false`,
    )
  ).docs

type TemplateItemDocT = {
  id: number
  displayOrder: number
  section: { id: number; name: string; displayOrder: number }
  catalogueItem: { id: number; description: string; unit: string | null; clientPrice: number | null }
}

// A szablon praca is only a katalog ref, so its opis, j.m. and cena are the katalog entry's — the
// same values a kosztorys seeded from it starts with. The rest is a blank pozycja.
export async function itemsOfTemplate(templateId: number): Promise<ItemT[]> {
  const { docs } = await api<{ docs: TemplateItemDocT[] }>(
    `/template-items?where[section.template][equals]=${templateId}&depth=1&limit=0&pagination=false`,
  )
  return docs.map(({ id, displayOrder, section, catalogueItem }) => ({
    id,
    displayOrder,
    description: catalogueItem.description,
    unit: catalogueItem.unit,
    plannedQty: 0,
    clientPrice: catalogueItem.clientPrice ?? 0,
    wToolsOverrideValue: null,
    wToolsOverrideCoeff: null,
    ownToolsOverrideValue: null,
    ownToolsOverrideCoeff: null,
    aiPlannedQty: null,
    aiMissingData: null,
    aiAssumptions: null,
    reviewStatus: null,
    changeReason: null,
    catalogueItemId: catalogueItem.id,
    section: { id: section.id, name: section.name, displayOrder: section.displayOrder },
  }))
}

export function keyed(items: ItemT[]) {
  const byKey = new Map<string, ItemT[]>()
  for (const item of items) {
    const key = `${norm(item.section.name)}|${norm(item.description ?? '')}`
    byKey.set(key, [...(byKey.get(key) ?? []), item])
  }
  return byKey
}

export async function uploadMedia(name: string, bytes: Buffer, mimeType: string, kind: MediaKindT) {
  const filename = uniqueFileName(name)
  // `upload()` refuses to run outside a browser, so its two steps are spelled out: the app's token
  // route mints a client token for this key, and the bytes go to Blob with it.
  const tokenRoute = `${BASE}/api/vercel-blob-client-upload-route`
  const { clientToken } = await (
    await fetch(tokenRoute, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'blob.generate-client-token',
        payload: {
          pathname: filename,
          callbackUrl: tokenRoute,
          clientPayload: 'media',
          multipart: false,
        },
      }),
    })
  ).json()
  await put(filename, bytes, { access: 'public', contentType: mimeType, token: clientToken })
  const form = new FormData()
  form.set(
    'file',
    JSON.stringify({
      clientUploadContext: { prefix: '' },
      collectionSlug: 'media',
      filename,
      mimeType,
      size: bytes.length,
    }),
  )
  form.set('_payload', JSON.stringify({ kind }))
  const { doc } = await api<{ doc: { id: number } }>('/media', { method: 'POST', body: form })
  return doc.id
}
