// Creates the case's investment on PRODUCTION and fills its kosztorys — through the app itself, never
// the database: the same server actions the browser calls (permissions, lock, revalidation) and the
// same browser→Blob upload path. The session is a user's `payload-token`, read from a file outside
// the repo; the investment's client fields come from a JSON export of the local copy (PII stays out
// of git). Server-action ids are read from the deployed client chunks, so they must be re-read after
// every deploy.
//   TOKEN_FILE=… SOURCE_JSON=… DRY=1 node --import tsx <this file>
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { put } from '@vercel/blob'
import { uniqueFileName } from '@/lib/utils/unique-file-name'

const BASE = 'https://wykonczymy.vercel.app'
const PRESET_ID = 165
const DRY = process.env.DRY === '1'
const TOKEN = readFileSync(process.env.TOKEN_FILE ?? '', 'utf8').trim()
const SOURCE = JSON.parse(readFileSync(process.env.SOURCE_JSON ?? '', 'utf8'))
const CASE = path.join(import.meta.dirname, '..')
const PDF_DIR = '/Users/konradantonik/Downloads/Pliki dla wyceny wykończenia mieszkania 2'
const FILES: { name: string; kind: 'projekt' | 'inne' }[] = [
  { name: '1_Projekt_mieszkania_dokumentacja_techniczna.pdf', kind: 'projekt' },
  { name: '2_RYS.6_-_ELEKTRYKA.pdf', kind: 'projekt' },
  { name: '3_RYS_7_-_OŚWIETLENIE.pdf', kind: 'projekt' },
  { name: '4_Modyfikacje_Ethernet.pdf', kind: 'projekt' },
  { name: '5_Lista_zakupowa_plytki_okładziny_armatura.pdf', kind: 'inne' },
]
const ACTIONS = {
  createInvestmentAction: '404ff7cf310f548b6a72380120254f269c9283505b',
  addItemAction: '4011a64afa17a234b9cae8d8084ca991e2b125ea0e',
  updateItemFieldAction: '6047f5e1ec87b14c6740f2f3f8752fabcf32650145',
}

type NewWorkT = {
  section: string
  catalogueId: number | null
  description?: string
  unit?: string
  qty: number
  clientPrice?: number
  note: string
}
type ItemT = {
  id: number
  description: string | null
  plannedQty: number
  clientPrice: number
  section: { id: number; name: string }
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const readJson = <T>(file: string): T => JSON.parse(readFileSync(path.join(CASE, file), 'utf8'))

// Every request to the app carries the session.
const plainFetch = globalThis.fetch
globalThis.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!url.startsWith(BASE)) return plainFetch(input, init)
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `JWT ${TOKEN}`)
  return plainFetch(input, { ...init, headers })
}

async function api<T>(route: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${route}`, init)
  const body = await res.json()
  if (!res.ok) throw new Error(`${route} ${res.status} ${JSON.stringify(body)}`)
  return body
}

async function callAction<T>(
  name: keyof typeof ACTIONS,
  page: string,
  args: unknown[],
): Promise<T> {
  const res = await fetch(`${BASE}${page}`, {
    method: 'POST',
    headers: {
      'Next-Action': ACTIONS[name],
      Accept: 'text/x-component',
      'Content-Type': 'text/plain;charset=UTF-8',
      Cookie: `payload-token=${TOKEN}`,
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

const itemsOf = async (investmentId: number) =>
  (
    await api<{ docs: ItemT[] }>(
      `/kosztorys-items?where[investment][equals]=${investmentId}&depth=1&limit=0&pagination=false`,
    )
  ).docs

function keyed(items: ItemT[]) {
  const byKey = new Map<string, ItemT[]>()
  for (const item of items) {
    const key = `${norm(item.section.name)}|${norm(item.description ?? '')}`
    byKey.set(key, [...(byKey.get(key) ?? []), item])
  }
  return byKey
}

async function run() {
  const rozpiska = new Map<number, string>()
  for (const line of readFileSync(path.join(CASE, 'inputs/rozpiska-szablon-165.txt'), 'utf8').split(
    '\n',
  )) {
    if (!line.trim()) continue
    const [, section, id, desc] = line.split(' | ').map((s) => s.trim())
    rozpiska.set(Number(id), `${norm(section)}|${norm(desc)}`)
  }
  const rows = readJson<{ id: number; qty: number; note: string }[]>('measure/przedmiar-v2.json')
  const newWorks = readJson<NewWorkT[]>('measure/new-works.json')

  // A run that died after the rows landed is finished with RESUME_ID: only the new works remain.
  const resumeId = Number(process.env.RESUME_ID) || null
  if (resumeId) return addNewWorks(resumeId, newWorks)

  const taken = await api<{ totalDocs: number }>(
    `/investments?where[name][equals]=${encodeURIComponent(SOURCE.name)}&limit=1&depth=0`,
  )
  if (taken.totalDocs) throw new Error(`an investment named „${SOURCE.name}" already exists`)

  // Matching against the szablon itself proves every row lands before anything is written.
  const templateKeys = keyed(await itemsOf(PRESET_ID))
  for (const { id } of rows) {
    const key = rozpiska.get(id)
    const n = key ? (templateKeys.get(key)?.length ?? 0) : 0
    if (n !== 1) throw new Error(`rozpiska ${id} matches ${n} szablon items (${key})`)
  }
  for (const f of FILES) readFileSync(path.join(PDF_DIR, f.name))
  console.log(
    `ok: ${rows.length} rows match the szablon, ${newWorks.length} new works, ${FILES.length} PDFs`,
  )
  if (DRY) return

  const assets: number[] = []
  for (const f of FILES) {
    const bytes = readFileSync(path.join(PDF_DIR, f.name))
    const file = new File([bytes], f.name, { type: 'application/pdf' })
    const filename = uniqueFileName(f.name)
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
    await put(filename, bytes, { access: 'public', contentType: file.type, token: clientToken })
    const form = new FormData()
    form.set(
      'file',
      JSON.stringify({
        clientUploadContext: { prefix: '' },
        collectionSlug: 'media',
        filename,
        mimeType: file.type,
        size: file.size,
      }),
    )
    form.set('_payload', JSON.stringify({ kind: f.kind }))
    const { doc } = await api<{ doc: { id: number } }>('/media', { method: 'POST', body: form })
    assets.push(doc.id)
    console.log(`media #${doc.id} ${filename}`)
  }

  await callAction('createInvestmentAction', '/inwestycje', [
    { ...SOURCE, review: '', presetId: String(PRESET_ID), assets },
  ])
  const created = await api<{ docs: { id: number }[] }>(
    `/investments?where[name][equals]=${encodeURIComponent(SOURCE.name)}&sort=-id&limit=1&depth=0`,
  )
  const investmentId = created.docs[0].id
  const page = `/inwestycje/${investmentId}/kosztorys_v2`
  console.log(`investment #${investmentId}`)

  const items = await itemsOf(investmentId)
  const byKey = keyed(items)
  for (const { id, qty, note } of rows) {
    const [item] = byKey.get(rozpiska.get(id) ?? '') ?? []
    await callAction('updateItemFieldAction', page, [item.id, { plannedQty: qty, note }])
  }
  console.log(`${rows.length} rows filled`)
  await addNewWorks(investmentId, newWorks)
}

// Production runs `main`, where „Dodaj pracę" adds a blank row and the grid fills it cell by cell —
// so this does the same, one patch per row.
async function addNewWorks(investmentId: number, newWorks: NewWorkT[]) {
  const page = `/inwestycje/${investmentId}/kosztorys_v2`
  const items = await itemsOf(investmentId)
  for (const work of newWorks) {
    const section = items.find((i) => norm(i.section.name) === norm(work.section))?.section
    if (!section) throw new Error(`no section ${work.section}`)
    const catalogue = work.catalogueId
      ? await api<Record<string, unknown>>(`/work-catalogue-items/${work.catalogueId}?depth=0`)
      : null
    const added = await callAction<{ data: { id: number } }>('addItemAction', page, [section.id])
    await callAction('updateItemFieldAction', page, [
      added.data.id,
      {
        description: catalogue?.description ?? work.description,
        unit: catalogue?.unit ?? work.unit,
        clientPrice: catalogue?.clientPrice ?? work.clientPrice ?? 0,
        wToolsOverrideValue: catalogue?.wToolsRate ?? null,
        wToolsOverrideCoeff: catalogue?.wToolsRateCoeff ?? null,
        ownToolsOverrideValue: catalogue?.ownToolsRate ?? null,
        ownToolsOverrideCoeff: catalogue?.ownToolsRateCoeff ?? null,
        plannedQty: work.qty,
        note: work.note,
      },
    ])
  }
  console.log(`${newWorks.length} new works added`)

  const total = (await itemsOf(investmentId)).reduce(
    (sum, i) => sum + i.plannedQty * i.clientPrice,
    0,
  )
  console.log(`Wartość netto przedmiar: ${Math.round(total)} zł → ${BASE}${page}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
