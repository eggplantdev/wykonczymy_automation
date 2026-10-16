//   node --env-file=.env --conditions=react-server --import tsx \
//     src/scripts/fill-translations-from-catalogue.ts [--ai] [--apply]
//
// Raw SQL skips the cache tags: a rozpiska keeps serving the old texts until any cell edit but a
// tłumaczenie flushes it, and the katalog until any katalog edit.
import { sql } from '@payloadcms/db-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { fillSectionNameTranslations } from '../lib/actions/translate-section-name'
import { fillCatalogueTranslations } from '../lib/ai/fill-catalogue-translations'
import { translateRows } from '../lib/ai/translate-new-row'
import { fillDescriptionTranslations } from '../lib/db/fill-description-translations'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { listCatalogueItems, listCatalogueTranslationsByMatchKey } from '../lib/db/work-catalogue'
import { planAiFill, type FillRowT } from '../lib/i18n/ai-translation-fill'
import {
  countNeedingTranslation,
  toDescriptionTranslations,
} from '../lib/i18n/description-translations'
import { TRANSLATION_LANGUAGES } from '../lib/i18n/languages'

type LiveItemT = FillRowT & { investment: string }

async function readLiveItems(db: DbExecutorT): Promise<LiveItemT[]> {
  const res = await db.execute(sql`
    SELECT ki.id, ki.description, ki.unit, ki.description_translations, i.name AS investment
    FROM kosztorys_items ki
    JOIN investments i ON i.id = ki.investment_id
    WHERE i.trashed_at IS NULL
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    description: row.description === null ? null : String(row.description),
    unit: row.unit === null ? null : String(row.unit),
    descriptionTranslations: toDescriptionTranslations(row.description_translations),
    investment: String(row.investment),
  }))
}

async function readLiveSectionNames(db: DbExecutorT): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT s.name
    FROM kosztorys_sections s
    JOIN investments i ON i.id = s.investment_id
    WHERE i.trashed_at IS NULL AND trim(coalesce(s.name, '')) <> ''
  `)
  return res.rows.map((row) => String(row.name))
}

async function fillFromCatalogueOnly(db: DbExecutorT, apply: boolean) {
  const items = await readLiveItems(db)
  const plan = planAiFill(items, await listCatalogueTranslationsByMatchKey(db))
  const writes = plan.fromCatalogue

  const investmentById = new Map(items.map((item) => [item.id, item.investment]))
  const perInvestment = Map.groupBy(writes, (write) => investmentById.get(write.id) ?? '?')
  const stillMissing = plan.toTranslate.flatMap(({ rows }) => rows)

  console.log(`pozycje inwestycji: ${items.length}`)
  console.log(`do uzupełnienia z katalogu: ${writes.length} pozycji`)
  for (const language of TRANSLATION_LANGUAGES) {
    const count = writes.filter((write) => write.translations[language]).length
    console.log(`  ${language}: ${count}`)
  }
  for (const [investment, rows] of [...perInvestment].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${investment}: ${rows.length}`)
  }
  console.log(
    `nadal bez tłumaczenia (brak w katalogu): ${stillMissing.length} pozycji, ` +
      `${plan.toTranslate.length} różnych opisów`,
  )

  if (!apply || writes.length === 0) {
    console.log(
      writes.length === 0 ? '\nNic do zapisania.' : '\nPRÓBA — nic nie zapisano (--apply zapisuje)',
    )
    return
  }
  const written = await fillDescriptionTranslations(db, 'kosztorys_items', writes)
  console.log(`\nZAPISANE — ${written} pozycji`)
}

async function fillWithAi(db: DbExecutorT, apply: boolean) {
  const catalogue = await listCatalogueItems(db)
  const items = await readLiveItems(db)
  const itemsPlan = planAiFill(items, await listCatalogueTranslationsByMatchKey(db))

  console.log(`katalog — wpisów bez tłumaczenia: ${countNeedingTranslation(catalogue)}`)
  console.log(`pozycje — z katalogu od razu: ${itemsPlan.fromCatalogue.length}`)
  console.log(
    `pozycje — do AI (część pokryje katalog po kroku 1): ` +
      `${itemsPlan.toTranslate.flatMap(({ rows }) => rows).length} pozycji, ` +
      `${itemsPlan.toTranslate.length} różnych opisów`,
  )

  if (!apply) {
    console.log('\nPRÓBA — AI nie wywołane, nic nie zapisano (--apply wywołuje i zapisuje)')
    return
  }

  const catalogueFill = await fillCatalogueTranslations(db)
  console.log(
    `\n1. katalog: zapisano ${catalogueFill.items}, AI nie przetłumaczyło ${catalogueFill.failed}`,
  )

  const itemsFill = await translateRows(
    await readLiveItems(db),
    await listCatalogueTranslationsByMatchKey(db),
  )
  const itemsWritten = await fillDescriptionTranslations(db, 'kosztorys_items', itemsFill.writes)
  console.log(`2. pozycje: zapisano ${itemsWritten}, AI nie przetłumaczyło ${itemsFill.failed}`)

  const sections = await fillSectionNameTranslations(db, await readLiveSectionNames(db))
  console.log(`3. sekcje: zapisano ${sections.written}, AI nie przetłumaczyło ${sections.failed}`)
}

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const apply = process.argv.includes('--apply')
  if (process.argv.includes('--ai')) await fillWithAi(db, apply)
  else await fillFromCatalogueOnly(db, apply)
  process.exit(0)
}

void main().catch((error) => {
  console.error('\nPRZERWANE:', error)
  process.exit(1)
})
