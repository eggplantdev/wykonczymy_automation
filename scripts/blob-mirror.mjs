import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) { console.error('BLOB_READ_WRITE_TOKEN missing'); process.exit(1) }
const stamp = process.env.SNAPSHOT_STAMP
if (!stamp) { console.error('SNAPSHOT_STAMP missing (the runner sets it)'); process.exit(1) }

const prevManifestPath = arg('--prev-manifest')
const outDir = arg('--out', './blob-out')
const minBlobs = Number(arg('--min-blobs', '0'))
const LIST_API = 'https://blob.vercel-storage.com'
const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

// `list()` reports the LOGICAL pathname; when a blob was uploaded with addRandomSuffix the real
// storage key — the one Payload stores in `media.filename` and asks for on read — lives in the
// URL instead (`foo.heic` vs `foo-T9Y1iW9h….heic`).
const storageKey = (blob) => decodeURIComponent(new URL(blob.url).pathname.slice(1))

async function listAll() {
  const blobs = []
  let cursor
  do {
    const url = new URL(LIST_API)
    url.searchParams.set('limit', '1000')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`)
    const page = await res.json()
    blobs.push(...page.blobs)
    cursor = page.hasMore ? page.cursor : undefined
  } while (cursor)
  return blobs
}

async function loadKnown(path) {
  if (!path) return new Set()
  try {
    const raw = await readFile(path, 'utf8')
    if (!raw.trim()) return new Set()
    const parsed = JSON.parse(raw)
    return new Set((parsed.blobs ?? []).map((b) => b.key ?? b.pathname))
  } catch (err) {
    if (err.code === 'ENOENT') return new Set() // no prior manifest => full seed
    throw err
  }
}

const current = await listAll()
const totalBytes = current.reduce((sum, b) => sum + b.size, 0)
if (current.length < minBlobs) {
  console.error(`FAIL floor: list() returned ${current.length} < min-blobs ${minBlobs} — empty/wrong store?`)
  process.exit(1)
}

const known = await loadKnown(prevManifestPath)
const fresh = current.filter((b) => !known.has(storageKey(b)))
console.log(`\nVercel: ${current.length} blobs, ${fmtMB(totalBytes)} · known: ${known.size} · new: ${fresh.length}\n`)

const mediaDir = join(outDir, 'media')
await mkdir(mediaDir, { recursive: true })
let done = 0
const failures = []
const RETRIES = 4
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function download(url) {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url) // public blob, no auth header
    if (res.ok || attempt > RETRIES) return res
    await sleep(1000 * 2 ** (attempt - 1))
  }
}

for (const b of fresh) {
  const key = storageKey(b)
  const res = await download(b.downloadUrl ?? b.url)
  if (!res.ok) { console.error(`  FAIL ${res.status}  ${key}`); failures.push({ key, status: res.status }); continue }
  const buf = Buffer.from(await res.arrayBuffer())
  const dest = join(mediaDir, key)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  done += 1
  console.log(`  ${String(done).padStart(4)}/${fresh.length}  ${key}`)
}

// Merge, not replace: a blob deleted from Vercel stays in the manifest so it is never dropped.
const byPath = new Map()
if (prevManifestPath) {
  try {
    const prev = JSON.parse(await readFile(prevManifestPath, 'utf8') || '{}')
    for (const b of prev.blobs ?? []) byPath.set(b.key ?? b.pathname, b)
  } catch (err) { if (err.code !== 'ENOENT') throw err }
}
for (const b of current) byPath.set(storageKey(b), { key: storageKey(b), pathname: b.pathname, url: b.url, size: b.size })
const mergedBlobs = [...byPath.values()]
await writeFile(
  join(outDir, `manifest-${stamp}.json`),
  JSON.stringify({ stamp, count: mergedBlobs.length, vercelCount: current.length, newThisRun: done, failures, blobs: mergedBlobs }, null, 2),
)

const covered = current.every((b) => byPath.has(storageKey(b)))
console.log(`\nNew files downloaded: ${done}/${fresh.length} · manifest total: ${mergedBlobs.length}`)
if (!covered) { console.error('FAIL completeness: a live blob is missing from the manifest'); process.exit(1) }
if (failures.length) { console.error(`FAIL: ${failures.length} downloads errored — see manifest`); process.exit(1) }
console.log('OK\n')
