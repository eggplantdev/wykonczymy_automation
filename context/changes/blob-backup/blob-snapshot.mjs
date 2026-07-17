// One-off Vercel Blob snapshot / recovery tool (EX-459). Dependency-free on purpose:
// only Node built-ins + the Blob REST API, so it runs even if node_modules is broken
// (a recovery tool must not depend on the thing that might be broken).
//
// SAFETY: strictly one-way, Vercel -> local disk. The BLOB_READ_WRITE_TOKEN is sent to
// exactly ONE endpoint — the read-only `list` API — which has no destructive variant.
// Downloads are anonymous GETs of public blob URLs, no credential. This script never
// calls put/del/copy/empty. There is no code path here that can mutate the store.
//
//   node --env-file=.env context/changes/blob-backup/blob-snapshot.mjs
//       -> DRY RUN: list only. No download, no writes.
//
//   SNAPSHOT_STAMP=$(date +%Y%m%d-%H%M%S) \
//   node --env-file=.env context/changes/blob-backup/blob-snapshot.mjs --download
//       -> download every blob to ~/backups/wykonczymy-blob/blob-snapshot-<stamp>/

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) {
  console.error('BLOB_READ_WRITE_TOKEN missing — run with `node --env-file=.env`')
  process.exit(1)
}

const DOWNLOAD = process.argv.includes('--download')
const OUT_ROOT = join(homedir(), 'backups', 'wykonczymy-blob') // durable, outside the repo
const LIST_API = 'https://blob.vercel-storage.com'
const fmtMB = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`

// --- Phase 1: enumerate (read-only REST list) ---
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

const blobs = await listAll()
const totalBytes = blobs.reduce((sum, b) => sum + b.size, 0)
console.log(`\nBlob store: ${blobs.length} files, ${fmtMB(totalBytes)} total\n`)
console.log('Sample (first 10):')
for (const b of blobs.slice(0, 10)) console.log(`  ${fmtMB(b.size).padStart(10)}  ${b.pathname}`)
if (blobs.length > 10) console.log(`  … and ${blobs.length - 10} more`)

if (!DOWNLOAD) {
  console.log('\nDRY RUN — nothing downloaded. Re-run with --download to snapshot.\n')
  process.exit(0)
}

// --- Phase 2: download (anonymous GET of public URLs, no token) ---
const stamp = process.env.SNAPSHOT_STAMP
if (!stamp) {
  console.error(
    'SNAPSHOT_STAMP missing (the runner sets it) — aborting so the dir is never unnamed',
  )
  process.exit(1)
}
const outDir = join(OUT_ROOT, `blob-snapshot-${stamp}`)
await mkdir(outDir, { recursive: true })
console.log(`\nDownloading ${blobs.length} files -> ${outDir}\n`)

let done = 0
let downloadedBytes = 0
const failures = []
for (const b of blobs) {
  const res = await fetch(b.downloadUrl ?? b.url) // public blob, no auth header
  if (!res.ok) {
    console.error(`  FAIL ${res.status}  ${b.pathname}`)
    failures.push({ pathname: b.pathname, status: res.status })
    continue
  }
  const buf = Buffer.from(await res.arrayBuffer())
  const dest = join(outDir, b.pathname)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  done += 1
  downloadedBytes += buf.length
  console.log(`  ${String(done).padStart(4)}/${blobs.length}  ${b.pathname}`)
}

// Manifest beside the files: filename is the join key back to media rows (EX-459 restore).
await writeFile(
  join(outDir, '_manifest.json'),
  JSON.stringify({ stamp, count: blobs.length, downloaded: done, failures, blobs }, null, 2),
)

console.log(`\nDone: ${done}/${blobs.length} files, ${fmtMB(downloadedBytes)} written to ${outDir}`)
if (failures.length) console.log(`WARNING: ${failures.length} failed — see _manifest.json`)
console.log('')
