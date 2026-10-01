// Bulk run of the „Popraw literówki" cleanup (opis prac + j.m.) — the same rules the Opcje button
// applies, but over many inwestycje at once — szablony included, since a szablon is an investment.
// Dry by default; pass APPLY=1 to write.
//
//   INV=90 node --env-file=.env --import tsx src/scripts/fix-kosztorys-descriptions.ts
//   INV=all APPLY=1 node --env-file=.env --import tsx src/scripts/fix-kosztorys-descriptions.ts
//
//   INV        investment id, or `all` for every investment (default: all)
//   APPLY      1 = write, anything else = dry run that only prints the diff
//   CATALOGUE  1 = clean „Katalog prac" too, and only it (skips inwestycje)
//
// Raw SQL expires no cache: after an APPLY the deployed app keeps serving the old texts until their
// tags expire. One edit in the katalog, one szablon save and one kosztorys cell edit flush them.
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { getItemTexts, setItemTexts } from '../lib/db/kosztorys-item-texts'
import { cleanDescription } from '../lib/kosztorys/clean-description'
import { cleanItemTexts } from '../lib/kosztorys/clean-item-texts'
import { cleanUnit } from '../lib/kosztorys/clean-unit'
import { listCatalogueItems } from '../lib/db/work-catalogue'
import { catalogueKey } from '../lib/kosztorys/work-catalogue/catalogue-key'
import { restampTranslations } from '../lib/i18n/description-translations'

const INV = process.env.INV ?? 'all'
const APPLY = process.env.APPLY === '1'
const CATALOGUE = process.env.CATALOGUE === '1'

async function investmentIds(db: DbExecutorT): Promise<number[]> {
  if (INV !== 'all') return [Number(INV)]
  const res = await db.execute(
    sql`SELECT DISTINCT investment_id FROM kosztorys_items ORDER BY investment_id`,
  )
  return res.rows.map((row) => Number(row.investment_id))
}

async function fixItems(db: DbExecutorT): Promise<void> {
  let scanned = 0
  let touched = 0
  for (const investmentId of await investmentIds(db)) {
    const rows = await getItemTexts(db, investmentId)
    const changed = cleanItemTexts(rows)
    const before = new Map(rows.map((row) => [row.id, row]))
    scanned += rows.length
    touched += changed.length
    for (const row of changed) {
      const old = before.get(row.id)
      console.log(
        `#${investmentId}/${row.id}\n  - ${old?.description} [${old?.unit}]\n  + ${row.description} [${row.unit}]`,
      )
    }
    if (APPLY && changed.length > 0) await setItemTexts(db, investmentId, changed)
  }
  console.log(`\npozycje: ${touched} do poprawy z ${scanned} przejrzanych`)
}

/**
 * The same rules over the katalog prac. The key is recomputed alongside the texts because
 * `cleanDescription` also fixes punctuation ('ścian(pianka' → 'ścian (pianka') and `cleanUnit` fixes
 * transpositions (`klp` → `kpl`), and either moves the key:
 * left as it was it would point at a name that no longer exists, and the praca would stop matching
 * itself in „Porównaj z cennikiem".
 */
async function fixCatalogue(db: DbExecutorT): Promise<void> {
  const items = await listCatalogueItems(db)
  const cleaned = items.map((item) => {
    const description = cleanDescription(item.description)
    const unit = cleanUnit(item.unit)
    return { item, description, unit, matchKey: catalogueKey(description, unit) }
  })
  const changed = cleaned.filter(
    (entry) =>
      entry.description !== entry.item.description ||
      entry.unit !== entry.item.unit ||
      entry.matchKey !== entry.item.matchKey,
  )

  // The UNIQUE on `match_key` would reject the second UPDATE mid-loop, so collisions are caught
  // before any write — two descriptions folding into one key are a duplicate, and which row survives
  // is not ours to guess.
  const collisions = [...Map.groupBy(cleaned, (entry) => entry.matchKey).values()].filter(
    (bucket) => bucket.length > 1,
  )

  for (const { item, description, unit } of changed)
    console.log(
      `katalog/#${item.id}\n  - ${item.description} [${item.unit}]\n  + ${description} [${unit}]`,
    )
  console.log(`\nkatalog: ${changed.length} pozycji do poprawy z ${items.length} przejrzanych`)

  for (const bucket of collisions) {
    console.log(`\nKOLIZJA na kluczu ${bucket[0]!.matchKey} — do rozstrzygnięcia ręcznie:`)
    for (const { item } of bucket)
      console.log(`  #${item.id} „${item.description}" [${item.unit}] ${item.clientPrice} zł`)
  }
  if (collisions.length > 0) {
    console.error('\nPRZERWANE — najpierw scal albo skasuj kolidujące pozycje.')
    process.exit(1)
  }

  if (!APPLY) return
  for (const { item, description, unit, matchKey } of changed) {
    const translations = restampTranslations(
      item.descriptionTranslations,
      item.description,
      description,
    )
    await db.execute(
      sql`UPDATE work_catalogue_items SET description = ${description}, unit = ${unit}, match_key = ${matchKey}, description_translations = ${JSON.stringify(translations)}::jsonb WHERE id = ${item.id}`,
    )
  }
}

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  if (CATALOGUE) {
    await fixCatalogue(db)
    console.log(APPLY ? 'ZAPISANE' : 'PRÓBA — nic nie zapisano (APPLY=1 zapisuje)')
    process.exit(0)
  }
  await fixItems(db)
  console.log(APPLY ? 'ZAPISANE' : 'PRÓBA — nic nie zapisano (APPLY=1 zapisuje)')
  process.exit(0)
}

void main()
