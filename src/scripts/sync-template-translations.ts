// One-off (EX-1017): carries a szablon's opis translations into the katalog prac before the szablon
// starts reading them from there. The kierownik corrects translations in the szablon, so the
// szablon's text wins — it fills an empty katalog translation AND overwrites a different one.
//
//   node --env-file=.env --import tsx src/scripts/sync-template-translations.ts [--apply]
//   TEMPLATE='Kosztorys 2026 kolory' (default) picks the szablon.
//
// Production, run by a human after `pnpm db:dump`:
//
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//     src/scripts/sync-template-translations.ts --apply
//
// A praca matches its katalog entry by opis + j.m. (`match_key`). Skipped: a szablon translation made
// from another opis (a renamed praca — a decision, not a copy), and a praca standing in the szablon
// twice with two different texts. Re-runnable: a second --apply writes 0.
//
// Raw SQL skips the cache tags: flush the katalog with any katalog edit after an --apply.
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { withPayloadTransaction } from '../lib/db/with-payload-transaction'
import {
  toDescriptionTranslations,
  type DescriptionTranslationsT,
} from '../lib/i18n/description-translations'
import { TRANSLATION_LANGUAGES, type TranslationLanguageT } from '../lib/i18n/languages'
import { catalogueKey } from '../lib/kosztorys/work-catalogue/catalogue-key'

const TEMPLATE = process.env.TEMPLATE ?? 'Kosztorys 2026 kolory'

type TemplateRowT = {
  sectionName: string
  description: string
  unit: string
  translations: DescriptionTranslationsT
}

type CatalogueRowT = {
  id: number
  description: string
  matchKey: string
  translations: DescriptionTranslationsT
}

type WriteT = {
  catalogue: CatalogueRowT
  language: TranslationLanguageT
  from: string
  to: string
}

async function readTemplate(db: DbExecutorT): Promise<TemplateRowT[]> {
  const investments = await db.execute(sql`
    SELECT id FROM investments WHERE status = 'szablon' AND name = ${TEMPLATE} AND trashed_at IS NULL
  `)
  if (investments.rows.length !== 1) {
    throw new Error(`Szablon „${TEMPLATE}": ${investments.rows.length} trafień, oczekiwano 1.`)
  }
  const res = await db.execute(sql`
    SELECT s.name AS section_name, ki.description, coalesce(ki.unit, '') AS unit,
           ki.description_translations
    FROM kosztorys_items ki
    JOIN kosztorys_sections s ON s.id = ki.section_id
    WHERE ki.investment_id = ${investments.rows[0].id}
      AND btrim(coalesce(ki.description, '')) <> ''
  `)
  return res.rows.map((row) => ({
    sectionName: String(row.section_name),
    description: String(row.description),
    unit: String(row.unit),
    translations: toDescriptionTranslations(row.description_translations),
  }))
}

async function readCatalogue(db: DbExecutorT): Promise<CatalogueRowT[]> {
  const res = await db.execute(sql`
    SELECT id, description, match_key, description_translations FROM work_catalogue_items
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    description: String(row.description),
    matchKey: String(row.match_key),
    translations: toDescriptionTranslations(row.description_translations),
  }))
}

type PlanT = {
  writes: WriteT[]
  conflicts: { description: string; language: TranslationLanguageT; texts: string[] }[]
  staleInTemplate: number
  withoutCatalogue: string[]
}

function plan(template: TemplateRowT[], catalogue: CatalogueRowT[]): PlanT {
  const catalogueByKey = new Map(catalogue.map((row) => [row.matchKey, row]))
  const out: PlanT = { writes: [], conflicts: [], staleInTemplate: 0, withoutCatalogue: [] }

  const textsBySlot = new Map<string, { entry: CatalogueRowT; texts: Set<string> }>()
  for (const row of template) {
    const entry = catalogueByKey.get(catalogueKey(row.description, row.unit))
    if (!entry) {
      out.withoutCatalogue.push(`${row.sectionName}: ${row.description} [${row.unit}]`)
      continue
    }
    for (const language of TRANSLATION_LANGUAGES) {
      const translation = row.translations[language]
      const text = translation?.text.trim() ?? ''
      if (text === '') continue
      if (translation?.source !== row.description) {
        out.staleInTemplate++
        continue
      }
      const slot = `${entry.id}#${language}`
      const texts = textsBySlot.get(slot)?.texts ?? new Set<string>()
      textsBySlot.set(slot, { entry, texts: texts.add(text) })
    }
  }

  for (const [slot, { entry, texts }] of textsBySlot) {
    const language = slot.split('#')[1] as TranslationLanguageT
    if (texts.size > 1) {
      out.conflicts.push({ description: entry.description, language, texts: [...texts] })
      continue
    }
    const [to] = texts
    const current = entry.translations[language]
    const from = current?.text.trim() ?? ''
    if (from === to && current?.source === entry.description) continue
    out.writes.push({ catalogue: entry, language, from, to })
  }
  return out
}

async function write(db: DbExecutorT, writes: WriteT[]): Promise<number> {
  const patches = Map.groupBy(writes, (write) => write.catalogue.id)
  const values = [...patches].map(([id, rows]) => {
    const { description } = rows[0].catalogue
    const patch = Object.fromEntries(
      rows.map((row) => [row.language, { text: row.to, source: description }]),
    )
    return sql`(${id}::int, ${description}::text, ${JSON.stringify(patch)}::jsonb)`
  })
  // Guarded on the opis read above: a katalog entry renamed meanwhile keeps its own translations.
  const res = await db.execute(sql`
    UPDATE work_catalogue_items AS t
    SET description_translations = coalesce(t.description_translations, '{}'::jsonb) || v.patch,
        updated_at = now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, description, patch)
    WHERE t.id = v.id AND t.description = v.description
    RETURNING t.id
  `)
  return res.rows.length
}

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const result = plan(await readTemplate(db), await readCatalogue(db))
  const fills = result.writes.filter((write) => write.from === '')
  const overwrites = result.writes.filter((write) => write.from !== '')

  console.log(`szablon „${TEMPLATE}"`)
  console.log(`uzupełnienia (katalog pusty): ${fills.length}`)
  console.log(`nadpisania (katalog miał inny tekst): ${overwrites.length}`)
  for (const write of overwrites) {
    console.log(`  [${write.language}] ${write.catalogue.description}`)
    console.log(`    było: ${write.from}`)
    console.log(`    będzie: ${write.to}`)
  }
  console.log(`pominięte — w szablonie dwa różne teksty: ${result.conflicts.length}`)
  for (const conflict of result.conflicts) {
    console.log(`  [${conflict.language}] ${conflict.description}: ${conflict.texts.join(' | ')}`)
  }
  console.log(`pominięte — tłumaczenie z innego opisu: ${result.staleInTemplate}`)
  console.log(`prace szablonu bez wpisu w katalogu: ${result.withoutCatalogue.length}`)
  for (const line of result.withoutCatalogue) console.log(`  ${line}`)

  if (!process.argv.includes('--apply') || result.writes.length === 0) {
    console.log(
      result.writes.length === 0
        ? '\nNic do zapisania.'
        : '\nPRÓBA — nic nie zapisano (--apply zapisuje)',
    )
    process.exit(0)
  }

  const written = await withPayloadTransaction(
    payload,
    async (req) => write(await getDb(payload, req), result.writes),
    {},
  )
  console.log(`\nZAPISANE — ${written} wpisów katalogu (${result.writes.length} tłumaczeń)`)
  process.exit(0)
}

void main().catch((error) => {
  console.error('\nPRZERWANE — nic nie zapisano:', error)
  process.exit(1)
})
