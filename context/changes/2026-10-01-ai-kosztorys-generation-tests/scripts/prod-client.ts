// Talks to PRODUCTION through the app itself, never the database: the same server actions the browser
// calls (permissions, lock, revalidation) and the same browser→Blob upload path. The session is a
// user's `payload-token`, read from a file outside the repo.
import { readFileSync } from 'node:fs'
import { put } from '@vercel/blob'
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
  section: { id: number; name: string; displayOrder: number }
}

export type MediaKindT = 'projekt' | 'zdjecie' | 'inne'

export const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

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
