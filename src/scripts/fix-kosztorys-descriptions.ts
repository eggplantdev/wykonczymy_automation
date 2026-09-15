// Bulk run of the „Opis prac" cleanup — the same rules the Opcje button applies, but over many
// inwestycje and over saved szablony at once. Dry by default; pass APPLY=1 to write.
//
//   INV=90 node --env-file=.env --import tsx src/scripts/fix-kosztorys-descriptions.ts
//   INV=all APPLY=1 PRESETS=1 node --env-file=.env --import tsx src/scripts/fix-kosztorys-descriptions.ts
//
//   INV        investment id, or `all` for every investment (default: all)
//   APPLY      1 = write, anything else = dry run that only prints the diff
//   PRESETS    1 = clean saved preset payloads as well
//   CATALOGUE  1 = clean „Katalog prac" too, and only it (skips inwestycje)
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { getItemTexts, setItemTexts } from '../lib/db/kosztorys-item-texts'
import { cleanDescription } from '../lib/kosztorys/clean-description'
import { listCatalogueItems } from '../lib/db/work-catalogue'
import { catalogueKey } from '../lib/kosztorys/work-catalogue/catalogue-key'

const INV = process.env.INV ?? 'all'
const APPLY = process.env.APPLY === '1'
const PRESETS = process.env.PRESETS === '1'
const CATALOGUE = process.env.CATALOGUE === '1'

type PresetPayloadT = { items?: { description?: string }[] }

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
    const changed = rows.flatMap((row) => {
      if (!row.description) return []
      const description = cleanDescription(row.description)
      return description === row.description ? [] : [{ ...row, cleaned: description }]
    })
    scanned += rows.length
    touched += changed.length
    for (const row of changed)
      console.log(`#${investmentId}/${row.id}\n  - ${row.description}\n  + ${row.cleaned}`)
    if (APPLY && changed.length > 0)
      await setItemTexts(
        db,
        investmentId,
        changed.map(({ id, unit, cleaned }) => ({ id, unit, description: cleaned })),
      )
  }
  console.log(`\nopisy: ${touched} do poprawy z ${scanned} przejrzanych`)
}

async function fixPresets(db: DbExecutorT): Promise<void> {
  const res = await db.execute(sql`SELECT id, name, payload FROM kosztorys_presets`)
  for (const row of res.rows) {
    const preset = row.payload as PresetPayloadT
    let touched = 0
    for (const item of preset.items ?? []) {
      if (typeof item.description !== 'string') continue
      const cleaned = cleanDescription(item.description)
      if (cleaned === item.description) continue
      item.description = cleaned
      touched += 1
    }
    console.log(`szablon „${String(row.name)}": ${touched} opisów do poprawy`)
    if (APPLY && touched > 0)
      await db.execute(
        sql`UPDATE kosztorys_presets SET payload = ${JSON.stringify(preset)}::jsonb WHERE id = ${Number(row.id)}`,
      )
  }
}

/**
 * The same rules over the katalog prac. The key is recomputed alongside the description because
 * `cleanDescription` also fixes punctuation ('ścian(pianka' → 'ścian (pianka'), which moves the key:
 * left as it was it would point at a name that no longer exists, and the praca would stop matching
 * itself in „Porównaj z cennikiem".
 */
async function fixCatalogue(db: DbExecutorT): Promise<void> {
  const items = await listCatalogueItems(db)
  const cleaned = items.map((item) => {
    const description = cleanDescription(item.description)
    return { item, description, matchKey: catalogueKey(description, item.unit) }
  })
  const changed = cleaned.filter(
    (entry) =>
      entry.description !== entry.item.description || entry.matchKey !== entry.item.matchKey,
  )

  // The UNIQUE on `match_key` would reject the second UPDATE mid-loop, so collisions are caught
  // before any write — two descriptions folding into one key are a duplicate, and which row survives
  // is not ours to guess.
  const collisions = [...Map.groupBy(cleaned, (entry) => entry.matchKey).values()].filter(
    (bucket) => bucket.length > 1,
  )

  for (const { item, description } of changed)
    console.log(`katalog/#${item.id}\n  - ${item.description}\n  + ${description}`)
  console.log(`\nkatalog: ${changed.length} opisów do poprawy z ${items.length} przejrzanych`)

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
  for (const { item, description, matchKey } of changed)
    await db.execute(
      sql`UPDATE work_catalogue_items SET description = ${description}, match_key = ${matchKey} WHERE id = ${item.id}`,
    )
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
  if (PRESETS) await fixPresets(db)
  console.log(APPLY ? 'ZAPISANE' : 'PRÓBA — nic nie zapisano (APPLY=1 zapisuje)')
  process.exit(0)
}

void main()
