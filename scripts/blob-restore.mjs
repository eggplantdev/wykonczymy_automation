// addRandomSuffix is forced to "0": with a suffix the key becomes `filename-xxxx` and
// `/api/media/file/<filename>` 404s.

import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  const value = i !== -1 ? process.argv[i + 1] : undefined
  // A flag is never a value: `--dir --allow-prod` must not swallow the guard flag as the dir.
  return value && !value.startsWith('--') ? value : fallback
}
const has = (name) => process.argv.includes(name)

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) { console.error('BLOB_READ_WRITE_TOKEN missing (must be the TARGET store token)'); process.exit(1) }

// Kept in sync by hand with PROD_BLOB_STORE_ID in src/lib/env/schema.ts — rotate one, rotate both.
const PROD_BLOB_STORE_ID = 'oJHLWhvHKJrsgWiN'
const PREVIEW_BLOB_STORE_ID = 'rNjU0fDb7Sz8bHVA'
// Allow-list, not deny-list, so the tool fails CLOSED: a rotated store, a second production store
// or a token shape this regex doesn't recognise all land in the refusal branch.
const targetStore = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec(token)?.[1]
if (targetStore !== PREVIEW_BLOB_STORE_ID && !has('--allow-prod')) {
  const named = targetStore ? `store ${targetStore}` : 'an unrecognised token shape'
  console.error(`\nREFUSING: BLOB_READ_WRITE_TOKEN targets ${named}, not the preview store.`)
  if (targetStore === PROD_BLOB_STORE_ID) console.error('That is the PRODUCTION store — real invoices.')
  console.error('Pass --allow-prod if that is genuinely what you want; otherwise use the preview token.\n')
  process.exit(1)
}
if (targetStore === PROD_BLOB_STORE_ID) {
  console.log(`\n⚠️  --allow-prod: writing to the PRODUCTION store (${PROD_BLOB_STORE_ID})`)
}

const dir = arg('--dir')
if (!dir) { console.error('--dir <backup dir> required'); process.exit(1) }
const concurrency = Number(arg('--concurrency', '8'))
// `Array.from({ length: NaN })` is empty, so a typo'd value would spawn zero workers, upload
// nothing, print OK and exit 0 — a green no-op is the worst failure mode a recovery tool has.
if (!Number.isInteger(concurrency) || concurrency < 1) {
  console.error('--concurrency must be a positive integer')
  process.exit(1)
}
const limit = Number(arg('--limit', '0'))
const dryRun = has('--dry-run')
const skipExisting = has('--skip-existing')

const API = 'https://blob.vercel-storage.com'
const API_VERSION = '7'
const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

const CONTENT_TYPES = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic', '.avif': 'image/avif',
}

async function walk(root, sub = '') {
  const out = []
  for (const entry of await readdir(join(root, sub), { withFileTypes: true })) {
    const rel = sub ? join(sub, entry.name) : entry.name
    if (entry.isDirectory()) out.push(...(await walk(root, rel)))
    else out.push(rel)
  }
  return out
}

const RETRIES = 4
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function put(pathname, bytes) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`${API}/${encodeURI(pathname)}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'x-api-version': API_VERSION,
        'x-content-type': CONTENT_TYPES[extname(pathname).toLowerCase()] ?? 'application/octet-stream',
        'x-add-random-suffix': '0',
      },
      body: bytes,
    })
    if (res.ok) return res.json()
    const body = await res.text()
    if (attempt > RETRIES || res.status < 500) throw new Error(`${res.status} ${body}`)
    await sleep(500 * 2 ** (attempt - 1))
  }
}

async function listTarget() {
  const seen = new Set()
  let cursor
  do {
    const url = new URL(API)
    url.searchParams.set('limit', '1000')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    for (const blob of page.blobs) seen.add(blob.pathname)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return seen
}

let files = (await walk(dir)).sort()
if (skipExisting) {
  const present = await listTarget()
  const before = files.length
  files = files.filter((f) => !present.has(f))
  console.log(`\nskip-existing: target holds ${present.size} · ${before - files.length} already there`)
}
if (limit) files = files.slice(0, limit)
const totalBytes = (await Promise.all(files.map(async (f) => (await stat(join(dir, f))).size)))
  .reduce((sum, size) => sum + size, 0)
console.log(`\n${files.length} files, ${fmtMB(totalBytes)} → ${dryRun ? 'DRY RUN' : 'upload'} (concurrency ${concurrency})\n`)
if (dryRun) { console.log(files.slice(0, 10).join('\n')); process.exit(0) }

let done = 0
const failures = []
const queue = [...files]
await Promise.all(Array.from({ length: concurrency }, async () => {
  for (let next = queue.shift(); next; next = queue.shift()) {
    try {
      await put(next, await readFile(join(dir, next)))
      done += 1
      if (done % 100 === 0 || done === files.length) console.log(`  ${done}/${files.length}`)
    } catch (err) {
      console.error(`  FAIL ${next}: ${err.message}`)
      failures.push({ pathname: next, error: err.message })
    }
  }
}))

console.log(`\nUploaded ${done}/${files.length}`)
if (failures.length) { console.error(`FAIL: ${failures.length} uploads errored`); process.exit(1) }
// A caller checking the exit code must not read "green" off a run that silently skipped files.
if (done !== files.length) { console.error(`FAIL: ${files.length - done} files never attempted`); process.exit(1) }
console.log('OK\n')
