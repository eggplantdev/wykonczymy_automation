// One-off: rewrite „Katalog prac" texts from the hand-corrected table in
// `data/work-catalogue-fixes.tsv`. Static `cleanDescription` had nothing left to fix here — the
// defects are missing diacritics, KNR line-break hyphenation and broken j.m., none of which a rule
// can reach — so the corrections are data, not code.
//
//   node --env-file=.env --import tsx src/scripts/fix-work-catalogue-texts.ts
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//     src/scripts/fix-work-catalogue-texts.ts --apply
//
// The target database is named EXPLICITLY at the call site, like seed-work-catalogue.ts. Run it
// bare and it hits the local Docker. Prices and rates are never touched.
//
// Raw SQL skips the Payload hooks, so nothing invalidates `collection:work-catalogue-items` — after
// an --apply against produkcja the katalog keeps serving the old texts until that tag expires on its
// own. Touch any praca in /katalog-prac to flush it.
//
// Rows are matched on their CURRENT `match_key`, not on id: the katalog was seeded separately into
// every database, so the same praca carries a different id on production, on the local Docker and in
// the E2E fixture — while the key, being derived from the text, is the same everywhere.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { withPayloadTransaction } from '../lib/db/with-payload-transaction'
import { listCatalogueItems } from '../lib/db/work-catalogue'
import { catalogueKey } from '../lib/kosztorys/work-catalogue/catalogue-key'
import { hasLegacyMarker, stripLegacyMarker } from '../lib/kosztorys/work-catalogue/legacy-marker'
import type { WorkCatalogueItemT } from '../lib/kosztorys/work-catalogue/types'

const APPLY = process.argv.includes('--apply')
const FIXES = join(import.meta.dirname, 'data/work-catalogue-fixes.tsv')

const QA_LEFTOVER = /^QA repro \d+$/u

type FixT = { fromKey: string; category: string; unit: string; description: string }

function readFixes(): FixT[] {
  return readFileSync(FIXES, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [fromKey, category, unit, description] = line.split('\t')
      // A line short of a tab would otherwise carry `undefined` all the way into an UPDATE param.
      if (description === undefined) throw new Error(`Zła linia w tabeli poprawek: ${line}`)
      return { fromKey: fromKey!, category: category!, unit: unit!, description }
    })
}

/**
 * Fixing LETTERS moves `catalogueKey`, so two rows that differed only by a typo now key the same —
 * and the UNIQUE on `match_key` would reject the second UPDATE mid-loop. The twin that goes is the
 * one carrying „[stary arkusz]": the marked row is an import of a praca the wzór already describes,
 * and the wzór is what the katalog is for. Two marked rows colliding keep the lower id, arbitrarily
 * but deterministically.
 */
function resolveCollisions(targets: readonly (FixT & { item: WorkCatalogueItemT })[]) {
  const keep: (FixT & { item: WorkCatalogueItemT; matchKey: string })[] = []
  const drop: { fix: FixT & { item: WorkCatalogueItemT }; survivorId: number }[] = []

  const keyed = targets.map((fix) => ({
    ...fix,
    matchKey: catalogueKey(fix.description, fix.unit),
  }))
  for (const bucket of Map.groupBy(keyed, (fix) => fix.matchKey).values()) {
    if (bucket.length === 1) {
      keep.push(bucket[0]!)
      continue
    }
    const sorted = [...bucket].sort(
      (left, right) =>
        Number(hasLegacyMarker(left.description)) - Number(hasLegacyMarker(right.description)) ||
        left.item.id - right.item.id,
    )
    const survivor = sorted[0]!
    keep.push(survivor)
    for (const loser of sorted.slice(1)) drop.push({ fix: loser, survivorId: survivor.item.id })
  }
  return { keep, drop }
}

async function main() {
  const payload = await getPayload({ config })
  const db: DbExecutorT = await getDb(payload)

  const items = await listCatalogueItems(db)
  const byKey = new Map(items.map((item) => [item.matchKey, item]))
  const fixes = readFixes()

  // A fix whose row is gone is the normal second-run case (this script deletes duplicates), so the
  // unmatched ones are only reported — what must never pass silently is a katalog row NOBODY
  // describes, because that is a praca somebody added by hand and this script would not touch it.
  //
  // Two passes, and a katalog row belongs to at most ONE fix. The first pass matches on the key the
  // row had BEFORE the correction — the normal case. The second matches on the key the correction
  // PRODUCES, so a re-run still recognises the rows it already fixed instead of reporting them as
  // strangers; it must not claim a row the first pass took, or the fix for a duplicate this script
  // deleted would land on the twin that survived and mark it for deletion in turn.
  const claimed = new Set<number>()
  const claim = (fix: FixT, item: WorkCatalogueItemT | undefined) => {
    if (!item || claimed.has(item.id)) return undefined
    claimed.add(item.id)
    // „[stary arkusz]" is not part of the correction — it is the review the owner is doing in the
    // app, praca by praca, and `catalogueKey` is marker-blind so a cleared row still matches its
    // fix. Without this the script would put the marker back on every row already cleared.
    const description =
      hasLegacyMarker(fix.description) && !hasLegacyMarker(item.description)
        ? stripLegacyMarker(fix.description)
        : fix.description
    return { ...fix, description, item }
  }
  const targets: (FixT & { item: WorkCatalogueItemT })[] = []
  const unmatched: FixT[] = []
  for (const fix of fixes) {
    const hit = claim(fix, byKey.get(fix.fromKey))
    if (hit) targets.push(hit)
    else unmatched.push(fix)
  }

  // Pass 2 order decides who gets the row when two fixes produce the same key, so it applies the
  // same tie-break `resolveCollisions` does: the unmarked fix claims first, never the twin.
  unmatched.sort(
    (left, right) =>
      Number(hasLegacyMarker(left.description)) - Number(hasLegacyMarker(right.description)),
  )
  for (const fix of unmatched) {
    const hit = claim(fix, byKey.get(catalogueKey(fix.description, fix.unit)))
    if (hit) targets.push(hit)
  }

  const described = new Set(targets.map((fix) => fix.item.id))
  const foreign = items.filter(
    (item) => !described.has(item.id) && !QA_LEFTOVER.test(item.description),
  )

  const { keep, drop } = resolveCollisions(targets)
  const changed = keep.filter(
    ({ item, description, unit, category, matchKey }) =>
      item.description !== description ||
      item.unit !== unit ||
      item.category !== category ||
      item.matchKey !== matchKey,
  )

  for (const { item, description, unit, category } of changed) {
    console.log(`#${item.id}`)
    if (item.description !== description) console.log(`  - ${item.description}\n  + ${description}`)
    if (item.unit !== unit) console.log(`  j.m. ${item.unit || '(brak)'} → ${unit}`)
    if (item.category !== category)
      console.log(`  kategoria ${item.category ?? '(brak)'} → ${category}`)
  }
  console.log(`\ndo poprawy: ${changed.length} z ${items.length} pozycji w katalogu`)

  if (drop.length > 0) {
    console.log(`\nduplikaty do skasowania (ten sam klucz po poprawce) — ${drop.length}:`)
    for (const { fix, survivorId } of drop)
      console.log(`  #${fix.item.id} „${fix.description}" [${fix.unit}] — zostaje #${survivorId}`)
  }

  const qa = items.filter((item) => QA_LEFTOVER.test(item.description))
  for (const item of qa)
    console.log(`\nśmieć po QA do skasowania: #${item.id} „${item.description}"`)

  if (foreign.length > 0) {
    console.log(`\nNIE RUSZAM — ${foreign.length} pozycji spoza tabeli poprawek:`)
    for (const item of foreign) console.log(`  #${item.id} „${item.description}" [${item.unit}]`)
  }

  // The collision check above only pairs fixes against each other. A row added by hand after the
  // table was exported sits in `foreign` and is never rewritten, so a correction landing on ITS key
  // would hit the UNIQUE mid-run — with half the katalog already parked at `tmp:`.
  const foreignKeys = new Map(foreign.map((item) => [item.matchKey, item]))
  const stealing = changed.flatMap(({ item, description, unit, matchKey }) => {
    const blocker = foreignKeys.get(matchKey)
    return blocker ? [{ item, description, unit, blocker }] : []
  })
  if (stealing.length > 0) {
    console.error(
      `\nPRZERWANE — ${stealing.length} poprawek wchodzi na klucz pozycji spoza tabeli:`,
    )
    for (const { item, description, unit, blocker } of stealing)
      console.error(
        `  #${item.id} „${description}" [${unit}] ← zajęte przez #${blocker.id} „${blocker.description}"`,
      )
    process.exit(1)
  }

  if (!APPLY) {
    console.log('\nPRÓBA — nic nie zapisano (--apply zapisuje)')
    process.exit(0)
  }

  // One transaction, because the middle of this write is a state the app cannot read: `tmp:<id>`
  // carries no `|`, so it can never equal a real `catalogueKey` and those prace would match nothing
  // anywhere („Porównaj z katalogiem" calls them missing, the insert-only wsad makes a second copy).
  // A failure on row 300 of 938 must take the whole run with it.
  const doomed = [...drop.map(({ fix }) => fix.item.id), ...qa.map((item) => item.id)]
  await withPayloadTransaction(
    payload,
    async (req) => {
      const tx = await getDb(payload, req)

      // Deletes first: a dropped twin still holds the key its survivor is about to take.
      if (doomed.length > 0)
        await tx.execute(
          sql`DELETE FROM work_catalogue_items WHERE id IN (${sql.join(
            doomed.map((id) => sql`${id}`),
            sql.raw(', '),
          )})`,
        )

      // Two passes over `match_key`: row A's new key is often row B's CURRENT key (that is what a
      // typo fix does), so a single-pass write trips the UNIQUE on a row it is about to rewrite
      // anyway. The parking value is per-id, hence unique by construction. One statement per pass,
      // like `setItemDescriptions` — the header invites a run against Neon, where ~930 round-trips
      // per pass would hold the write transaction open for a minute.
      const ids = sql.join(
        changed.map(({ item }) => sql`${item.id}`),
        sql.raw(', '),
      )
      await tx.execute(
        sql`UPDATE work_catalogue_items SET match_key = 'tmp:' || id::text WHERE id IN (${ids})`,
      )

      const values = changed.map(
        ({ item, description, unit, category, matchKey }) =>
          sql`(${item.id}::int, ${description}::text, ${unit}::text, ${category}::text, ${matchKey}::text)`,
      )
      await tx.execute(sql`
        UPDATE work_catalogue_items AS i
        SET description = v.description, unit = v.unit,
            category = v.category, match_key = v.match_key, updated_at = now()
        FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, description, unit, category, match_key)
        WHERE i.id = v.id
      `)
    },
    {},
  )

  console.log(`\nZAPISANE — poprawiono ${changed.length}, skasowano ${doomed.length}`)
  process.exit(0)
}

void main().catch((error) => {
  console.error('\nPRZERWANE — nic nie zapisano:', error)
  process.exit(1)
})
