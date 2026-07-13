// Vercel Blob → FTP mirror, incremental (EX-459 Phase 2). Runs daily in CI.
// Dependency-free: Node built-ins + the Blob REST API only, so it runs even if node_modules
// is broken (a backup/recovery tool must not depend on the thing that might be broken).
//
// Rung-3 "manifest-diff" strategy: the caller (workflow) pulls the latest manifest from FTP;
// this script diffs it against a live `list()` IN MEMORY and downloads ONLY new blobs — ~3 FTP
// round-trips regardless of store size, instead of one stat-per-file. MIRROR-ONLY: a blob that
// vanished from Vercel is never removed from backup (that is the whole point — threat #1).
//
// SAFETY: strictly one-way, Vercel -> local disk (the workflow then pushes to FTP). The
// BLOB_READ_WRITE_TOKEN reaches exactly ONE endpoint — the read-only `list` API. Downloads are
// anonymous GETs of public blob URLs. This script never calls put/del/copy/empty on the store.
//
// Usage (the workflow wires these):
//   BLOB_READ_WRITE_TOKEN=... SNAPSHOT_STAMP=$(date +%Y%m%d-%H%M%S) \
//   node scripts/blob-mirror.mjs --prev-manifest prev.json --out ./blob-out [--min-blobs 1500]
//
//   --prev-manifest <path>  previous manifest pulled from FTP (absent/empty file => full seed)
//   --out <dir>             output dir: <dir>/media/<pathname> + <dir>/manifest-<stamp>.json
//   --min-blobs <n>         floor: fail if `list()` returns fewer (catches empty/wrong store)

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

// --- enumerate (read-only REST list) ---
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

// --- load previous manifest (known pathnames) ---
async function loadKnown(path) {
  if (!path) return new Set()
  try {
    const raw = await readFile(path, 'utf8')
    if (!raw.trim()) return new Set()
    const parsed = JSON.parse(raw)
    return new Set((parsed.blobs ?? []).map((b) => b.pathname))
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
const fresh = current.filter((b) => !known.has(b.pathname))
console.log(`\nVercel: ${current.length} blobs, ${fmtMB(totalBytes)} · known: ${known.size} · new: ${fresh.length}\n`)

// --- download only the new blobs (anonymous GET) ---
const mediaDir = join(outDir, 'media')
await mkdir(mediaDir, { recursive: true })
let done = 0
const failures = []
for (const b of fresh) {
  const res = await fetch(b.downloadUrl ?? b.url) // public blob, no auth header
  if (!res.ok) { console.error(`  FAIL ${res.status}  ${b.pathname}`); failures.push({ pathname: b.pathname, status: res.status }); continue }
  const buf = Buffer.from(await res.arrayBuffer())
  const dest = join(mediaDir, b.pathname)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  done += 1
  console.log(`  ${String(done).padStart(4)}/${fresh.length}  ${b.pathname}`)
}

// --- emit the new manifest = union of everything ever seen (mirror-only) ---
// Merge, not replace: a blob deleted from Vercel stays in the manifest so it is never dropped.
const byPath = new Map()
if (prevManifestPath) {
  try {
    const prev = JSON.parse(await readFile(prevManifestPath, 'utf8') || '{}')
    for (const b of prev.blobs ?? []) byPath.set(b.pathname, b)
  } catch (err) { if (err.code !== 'ENOENT') throw err }
}
for (const b of current) byPath.set(b.pathname, { pathname: b.pathname, url: b.url, size: b.size })
const mergedBlobs = [...byPath.values()]
await writeFile(
  join(outDir, `manifest-${stamp}.json`),
  JSON.stringify({ stamp, count: mergedBlobs.length, vercelCount: current.length, newThisRun: done, failures, blobs: mergedBlobs }, null, 2),
)

// --- completeness: every live blob must be represented in the manifest ---
const covered = current.every((b) => byPath.has(b.pathname))
console.log(`\nNew files downloaded: ${done}/${fresh.length} · manifest total: ${mergedBlobs.length}`)
if (!covered) { console.error('FAIL completeness: a live blob is missing from the manifest'); process.exit(1) }
if (failures.length) { console.error(`FAIL: ${failures.length} downloads errored — see manifest`); process.exit(1) }
console.log('OK\n')
