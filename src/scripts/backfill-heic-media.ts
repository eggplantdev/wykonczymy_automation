//   source .env && DB_POSTGRES_URL="$DB_POSTGRES_URL_PREVIEW" \
//     node --env-file=.env --import tsx src/scripts/backfill-heic-media.ts --dry-run
//
// Payload's cloud-storage afterChange deletes the
// PREVIOUS blob before uploading the replacement, so the moment a row is updated its original is
// gone from the store.
import { execFile } from 'node:child_process'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '../payload.config'
import { PREVIEW_BLOB_STORE_ID, PROD_BLOB_STORE_ID } from '../lib/env/schema'
import { MEDIA_RELATIONS, mediaReferenceWhere } from '@/lib/media/relating-collections'
import { blobPublicUrl, blobStoreIdOf } from '@/lib/media/blob-public-url'

const run = promisify(execFile)

const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const QUALITY = 60

const FETCH_TIMEOUT_MS = 60_000

function fail(message: string): never {
  console.error(`\n${message}\n`)
  process.exit(1)
}

const arg = (name: string, fallback: string) => {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) fail(`${name} needs a value`)
  return value
}
const has = (name: string) => process.argv.includes(name)

// A typo in `--dry-run` is not a no-op: the runbook's line already carries `--allow-prod`, so the
// dry-run guard misses and the destructive run proceeds unprompted.
const KNOWN_FLAGS = [
  '--dry-run',
  '--allow-prod',
  '--force',
  '--verify',
  '--limit',
  '--snapshot-dir',
]
const VALUED_FLAGS = ['--limit', '--snapshot-dir']
const passedArgs = process.argv.slice(2)
for (const [index, token] of passedArgs.entries()) {
  if (!token.startsWith('-')) {
    if (VALUED_FLAGS.includes(passedArgs[index - 1] ?? '')) continue
    fail(`unexpected argument: ${token}`)
  }
  if (!KNOWN_FLAGS.includes(token)) fail(`unknown flag: ${token}`)
}

const SNAPSHOT_DIR = path.resolve(arg('--snapshot-dir', 'dumps/heic-backfill'))
// These filenames predate `sanitizeFileName`, so one with a separator would escape the snapshot dir.
const snapshotFile = (filename: string) => path.join(SNAPSHOT_DIR, path.basename(filename))
const MANIFEST = path.join(SNAPSHOT_DIR, 'manifest.json')
const LIMIT = has('--limit') ? Number(arg('--limit', '0')) : 0
if (has('--limit') && (!Number.isInteger(LIMIT) || LIMIT < 1))
  fail('--limit must be a positive integer')

type PayloadT = Awaited<ReturnType<typeof getPayload>>

type ManifestEntryT = {
  id: number
  oldFilename: string
  newFilename: string
  oldFilesize: number
  newFilesize: number
  linkedTransactions: number
  converted: boolean
  error?: string
}

/**
 * HEIC is not always labelled `image/heic`: Chrome and Firefox often report an empty `File.type`, so
 * `process-upload-file.ts` treats `image/heif` and a bare `.heic`/`.heif` suffix as HEIC too.
 */
const HEIC_WHERE: Where = {
  or: [
    { mimeType: { equals: 'image/heic' } },
    { mimeType: { equals: 'image/heif' } },
    { filename: { like: '.heic' } },
    { filename: { like: '.heif' } },
  ],
}

function resolveTarget() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  const store = token ? blobStoreIdOf(token) : undefined
  if (!store) fail('BLOB_READ_WRITE_TOKEN missing or unrecognised — cannot locate the store')

  const dbUrl = process.env.DB_POSTGRES_URL
  if (!dbUrl) fail('DB_POSTGRES_URL missing')
  const prodDbUrl = process.env.DB_POSTGRES_URL_PROD
  // Byte-equality fails OPEN: Neon's pooled and direct hosts, an added `?sslmode=` or a rotated
  // password all read as non-production, and the guard then waves through a run on PRODUCTION rows.
  if (!prodDbUrl)
    fail('DB_POSTGRES_URL_PROD missing — cannot tell which environment DB_POSTGRES_URL is')
  const dbIdentity = (url: string) => {
    try {
      const parsed = new URL(url)
      return `${parsed.hostname.replace(/-pooler(?=\.)/, '')}${parsed.pathname}`
    } catch {
      return fail(`DB_POSTGRES_URL is not a valid connection URL`)
    }
  }
  const isProdDb = dbIdentity(dbUrl) === dbIdentity(prodDbUrl)
  const isProdStore = store === PROD_BLOB_STORE_ID

  if (isProdDb !== isProdStore) {
    fail(
      `REFUSING: the database and the Blob store are not the same environment.\n` +
        `  database: ${isProdDb ? 'PRODUCTION' : 'non-production'}\n` +
        `  store:    ${isProdStore ? `PRODUCTION (${PROD_BLOB_STORE_ID})` : `non-production (${store})`}\n` +
        `Backfilling across that split deletes originals from one store while pointing rows at the other.`,
    )
  }
  if (!isProdStore && store !== PREVIEW_BLOB_STORE_ID) {
    fail(`REFUSING: BLOB_READ_WRITE_TOKEN targets an unrecognised store (${store}).`)
  }
  if (isProdStore && !has('--allow-prod')) {
    fail(
      `REFUSING: this targets PRODUCTION (store ${PROD_BLOB_STORE_ID}) — real invoices.\n` +
        `Pass --allow-prod if that is genuinely what you want.`,
    )
  }
  if (isProdStore)
    console.log(`\n⚠️  --allow-prod: rewriting PRODUCTION media (${PROD_BLOB_STORE_ID})`)

  return { store }
}

async function fetchBlob(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
}

// EVERY upload relation, from the registry: a HEIC hanging off a relation this missed would count
// 0 before and 0 after, passing verification green with its link dropped.
async function countLinkedDocuments(payload: PayloadT, mediaId: number) {
  const counts = await Promise.all(
    MEDIA_RELATIONS.map(({ collection, field }) =>
      payload.count({ collection, where: mediaReferenceWhere(field, mediaId) }),
    ),
  )
  return counts.reduce((total, { totalDocs }) => total + totalDocs, 0)
}

async function findHeicRows(payload: PayloadT) {
  const { docs } = await payload.find({
    collection: 'media',
    where: HEIC_WHERE,
    limit: 0,
    sort: 'id',
    pagination: false,
  })
  return LIMIT > 0 ? docs.slice(0, LIMIT) : docs
}

/**
 * `heif-convert` picks its encoder from the extension, so a `.jpg`
 * intermediate would encode at q100 and `magick` would then re-encode at q60
 */
async function convert(source: string, target: string) {
  const intermediate = path.join(tmpdir(), `heic-backfill-${path.parse(target).name}.png`)
  try {
    await run('heif-convert', ['-q', '100', source, intermediate])
    // `-auto-orient` bakes the EXIF rotation into the pixels; without it a phone photo lands
    // sideways, because nothing downstream re-reads the orientation tag.
    await run('magick', [
      intermediate,
      '-auto-orient',
      '-resize',
      `${MAX_WIDTH}x${MAX_HEIGHT}>`,
      '-quality',
      String(QUALITY),
      target,
    ])
  } finally {
    await rm(intermediate, { force: true })
  }
}

async function main() {
  const { store } = resolveTarget()
  const payload = await getPayload({ config })

  if (has('--verify')) {
    await verify(payload, store)
    return
  }

  const rows = await findHeicRows(payload)
  console.log(`${rows.length} media row(s) still holding HEIC`)
  if (rows.length === 0) return

  if (has('--dry-run')) {
    for (const row of rows) {
      const linked = await countLinkedDocuments(payload, row.id)
      console.log(
        `  id=${row.id}  ${row.filename}  ${((row.filesize ?? 0) / 1_000_000).toFixed(2)} MB  ` +
          `→ transactions: ${linked}`,
      )
    }
    console.log(`\nDry run — nothing written. Snapshot would land in ${SNAPSHOT_DIR}`)
    return
  }

  if (await stat(MANIFEST).catch(() => null)) {
    if (!has('--force')) {
      fail(
        `${MANIFEST} already exists — a previous run's rollback map.\n` +
          `Move it aside, point --snapshot-dir elsewhere, or pass --force to set it aside and continue.`,
      )
    }
    const archived = MANIFEST.replace(
      /\.json$/,
      `-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    )
    await rename(MANIFEST, archived)
    console.log(`--force: previous manifest kept at ${archived}`)
  }

  // A missing binary would otherwise fail all 18 rows AFTER a full snapshot download.
  for (const binary of ['heif-convert', 'magick']) {
    await run(binary, ['--version']).catch(() => fail(`${binary} is not on PATH`))
  }

  await mkdir(SNAPSHOT_DIR, { recursive: true })
  console.log(`\nSnapshotting ${rows.length} original(s) → ${SNAPSHOT_DIR}`)

  // --- Phase A: snapshot everything, or abort before a single write. ---
  for (const row of rows) {
    const filename = row.filename as string
    const response = await fetchBlob(blobPublicUrl(store, filename))
    if (!response.ok) {
      fail(
        `ABORT before any write: ${filename} (id=${row.id}) is not in the store (${response.status}). ` +
          `Without its bytes there is no rollback for this row, so the whole run stops. ` +
          `Top the preview store up with \`pnpm blob:refresh:preview\` and retry.`,
      )
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0) fail(`ABORT: ${filename} (id=${row.id}) served 0 bytes`)
    if (!row.filesize)
      fail(`ABORT: ${filename} (id=${row.id}) has no recorded filesize to verify against`)
    if (bytes.length !== row.filesize) {
      fail(
        `ABORT: ${filename} (id=${row.id}) served ${bytes.length} B, the row says ${row.filesize} B`,
      )
    }
    const snapshotPath = snapshotFile(filename)
    await writeFile(snapshotPath, bytes)
    const written = await stat(snapshotPath)
    if (written.size !== bytes.length) fail(`ABORT: ${snapshotPath} is short on disk`)
    console.log(`  ✓ ${filename} (${(bytes.length / 1_000_000).toFixed(2)} MB)`)
  }

  console.log(`\nConverting and updating`)
  const manifest: ManifestEntryT[] = []

  for (const row of rows) {
    const oldFilename = row.filename as string
    const newFilename = `${path.parse(oldFilename).name}.jpg`
    const target = path.join(tmpdir(), `heic-backfill-out-${newFilename}`)
    const entry: ManifestEntryT = {
      id: row.id,
      oldFilename,
      newFilename,
      oldFilesize: row.filesize ?? 0,
      newFilesize: 0,
      linkedTransactions: 0,
      converted: false,
    }
    manifest.push(entry)

    try {
      entry.linkedTransactions = await countLinkedDocuments(payload, row.id)

      await convert(snapshotFile(oldFilename), target)
      const jpeg = await readFile(target)

      await payload.update({
        collection: 'media',
        id: row.id,
        data: {},
        file: { data: jpeg, mimetype: 'image/jpeg', name: newFilename, size: jpeg.length },
        // media's afterChange calls revalidateTag, which throws outside a request context
        // ("static generation store missing") and takes the whole transaction down with it.
        context: { skipRevalidation: true },
      })

      entry.newFilesize = jpeg.length
      entry.converted = true
      const saved = 100 - Math.round((jpeg.length / (row.filesize || jpeg.length)) * 100)
      console.log(`  ✓ id=${row.id}  ${oldFilename} → ${newFilename}  (-${saved}%)`)
    } catch (error) {
      entry.error = error instanceof Error ? error.message : String(error)
      // `fail` exits the process, so the `finally` below never runs on this path.
      await rm(target, { force: true })
      // A row can fail with Payload having already deleted its original
      // (delete-then-upload), so every further row is another possible hole in the store while the
      // cause is still unknown.
      await writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
      fail(
        `id=${row.id} ${oldFilename}: ${entry.error}\n` +
          `STOPPED at row ${manifest.length}/${rows.length}. This row's blob may already be deleted ` +
          `from the store — restore it from the snapshot with:\n` +
          `  node scripts/blob-restore.mjs --dir ${SNAPSHOT_DIR}\n` +
          `Manifest (what landed so far): ${MANIFEST}`,
      )
    } finally {
      await rm(target, { force: true })
      // Rewritten after every row: an interrupt at row 10 of 18 must still leave a map of the nine
      // that were converted.
      await writeFile(MANIFEST, JSON.stringify(manifest, null, 2))
    }
  }

  console.log(`\n${manifest.filter((e) => e.converted).length} converted. Manifest: ${MANIFEST}`)
  console.log(
    `\nNOT DONE YET: redeploy the app so the ['media-all'] cache drops its stale filenames — ` +
      `until then every converted invoice 404s. See blob-recovery-runbook.md §5.`,
  )
}

async function verify(payload: PayloadT, store: string) {
  const raw = await readFile(MANIFEST, 'utf8').catch(() => null)
  if (raw === null) {
    fail(`No manifest at ${MANIFEST} — the run never got as far as writing one. Nothing to verify.`)
  }
  const manifest: ManifestEntryT[] = JSON.parse(raw)
  const converted = manifest.filter((entry) => entry.converted)
  console.log(`Verifying ${converted.length} converted row(s) against ${MANIFEST}\n`)

  let failed = 0
  for (const entry of converted) {
    const problems: string[] = []
    const doc = await payload.findByID({ collection: 'media', id: entry.id, disableErrors: true })

    if (!doc) {
      problems.push('row is gone')
    } else {
      if (doc.mimeType !== 'image/jpeg') problems.push(`mime_type = ${doc.mimeType}`)
      if (!doc.filename?.endsWith('.jpg')) problems.push(`filename = ${doc.filename}`)
      if (!doc.width || !doc.height) problems.push('width/height still NULL')
      if (!doc.sizes?.thumbnail?.filename) problems.push('no thumbnail')

      const response = await fetchBlob(blobPublicUrl(store, doc.filename as string), {
        headers: { Range: 'bytes=0-2' },
      })
      if (!response.ok) {
        problems.push(`blob ${response.status}`)
      } else {
        const head = Buffer.from(await response.arrayBuffer())
        if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff)
          problems.push('not JPEG bytes')
      }

      const linked = await countLinkedDocuments(payload, entry.id)
      if (linked !== entry.linkedTransactions) {
        problems.push(`transactions ${linked} ≠ ${entry.linkedTransactions} before`)
      }
    }

    if (problems.length > 0) failed++
    console.log(
      problems.length === 0
        ? `  ✓ id=${entry.id}  ${entry.newFilename}`
        : `  ✗ id=${entry.id}  ${entry.newFilename}: ${problems.join('; ')}`,
    )
  }

  const unconverted = manifest.filter((entry) => !entry.converted)
  for (const entry of unconverted) {
    console.log(
      `  ! id=${entry.id}  ${entry.oldFilename}: never converted — ${entry.error ?? 'run stopped before it'}`,
    )
  }

  console.log(`\n${converted.length - failed}/${converted.length} OK`)

  // A --limit canary deliberately leaves the rest behind, so the sweep assertion would always fail
  // it.
  let remainingProblem = false
  if (LIMIT === 0) {
    const remaining = await payload.count({ collection: 'media', where: HEIC_WHERE })
    console.log(`media rows still holding HEIC: ${remaining.totalDocs}`)
    remainingProblem = remaining.totalDocs > 0
  } else {
    console.log(`--limit ${LIMIT}: skipping the "nothing left" sweep`)
  }

  if (failed > 0 || unconverted.length > 0 || remainingProblem) process.exitCode = 1
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
