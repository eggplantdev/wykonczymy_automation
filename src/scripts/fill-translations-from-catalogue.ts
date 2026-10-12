// Re-runnable: fills the missing or stale opis translations of the pozycje of open investments
// (szablony included) from the katalog prac — the same reuse „Uzupełnij tłumaczenia (AI)" makes
// before it asks the AI. With --ai it also does what the buttons do, across every open kosztorys at
// once: the katalog's own gaps first (so the pozycje then reuse them), then one AI call per distinct
// opis still missing, then the section names.
//
//   node --env-file=.env --conditions=react-server --import tsx \
//     src/scripts/fill-translations-from-catalogue.ts [--ai] [--apply]
//
// Production, run after `pnpm db:dump`:
//
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --conditions=react-server \
//     --import tsx src/scripts/fill-translations-from-catalogue.ts --ai --apply
//
// A pozycja matches its katalog entry by opis + j.m. (`match_key`), and a language is reused only when
// the katalog's translation was made from an opis that folds like the pozycja's. The stored `source` is
// the pozycja's own opis. The write is compare-and-set: a pozycja whose opis changed since the read,
// or whose language got a translation meanwhile, is left alone — a second --apply writes 0. Without
// --apply the AI is not called and nothing is written.
//
// Raw SQL skips the cache tags: a rozpiska keeps serving the old texts until any cell edit but a
// tłumaczenie flushes it, and the katalog until any katalog edit.
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { fillSectionNameTranslations } from '../lib/actions/translate-section-name'
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

type OpenItemT = FillRowT & { investment: string }

async function readOpenItems(db: DbExecutorT): Promise<OpenItemT[]> {
  const res = await db.execute(sql`
    SELECT ki.id, ki.description, ki.unit, ki.description_translations, i.name AS investment
    FROM kosztorys_items ki
    JOIN investments i ON i.id = ki.investment_id
    WHERE i.status <> 'completed' AND i.trashed_at IS NULL
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    description: row.description === null ? null : String(row.description),
    unit: row.unit === null ? null : String(row.unit),
    descriptionTranslations: toDescriptionTranslations(row.description_translations),
    investment: String(row.investment),
  }))
}

async function readOpenSectionNames(db: DbExecutorT): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT s.name
    FROM kosztorys_sections s
    JOIN investments i ON i.id = s.investment_id
    WHERE i.status <> 'completed' AND i.trashed_at IS NULL AND trim(coalesce(s.name, '')) <> ''
  `)
  return res.rows.map((row) => String(row.name))
}

async function fillFromCatalogueOnly(db: DbExecutorT, apply: boolean) {
  const items = await readOpenItems(db)
  const plan = planAiFill(items, await listCatalogueTranslationsByMatchKey(db))
  const writes = plan.fromCatalogue

  const investmentById = new Map(items.map((item) => [item.id, item.investment]))
  const perInvestment = Map.groupBy(writes, (write) => investmentById.get(write.id) ?? '?')
  const stillMissing = plan.toTranslate.flatMap(({ rows }) => rows)

  console.log(`pozycje otwartych inwestycji: ${items.length}`)
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
  const items = await readOpenItems(db)
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

  const catalogueFill = await translateRows(catalogue)
  const catalogueWritten = await fillDescriptionTranslations(
    db,
    'work_catalogue_items',
    catalogueFill.writes,
  )
  console.log(
    `\n1. katalog: zapisano ${catalogueWritten}, AI nie przetłumaczyło ${catalogueFill.failed}`,
  )

  const itemsFill = await translateRows(
    await readOpenItems(db),
    await listCatalogueTranslationsByMatchKey(db),
  )
  const itemsWritten = await fillDescriptionTranslations(db, 'kosztorys_items', itemsFill.writes)
  console.log(`2. pozycje: zapisano ${itemsWritten}, AI nie przetłumaczyło ${itemsFill.failed}`)

  const sections = await fillSectionNameTranslations(db, await readOpenSectionNames(db))
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
