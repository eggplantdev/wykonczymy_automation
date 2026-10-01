// Re-runnable: fills the empty opis translations of the katalog and of the pozycje of open
// investments (szablony included) from a hand-made table in `data/`.
//
//   node --env-file=.env --import tsx src/scripts/fill-description-translations.ts export --lang uk \
//     > /tmp/untranslated-uk.json
//   node --env-file=.env --import tsx src/scripts/fill-description-translations.ts \
//     import src/scripts/data/description-translations-uk.tsv --lang uk [--apply]
//
// Production, run by a human after `pnpm db:dump`, naming the database at the call site:
//
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//     src/scripts/fill-description-translations.ts import <file> --lang uk --apply
//
// The table is `<opis po polsku>\t<tłumaczenie>` per line, matched on the exact trimmed Polish text.
// Only an EMPTY translation is filled — one typed in the app is never overwritten — so a second
// --apply fills 0. Without --apply nothing is written.
//
// Raw SQL skips the cache tags: after an --apply the katalog and the rozpiski keep serving the old
// texts until their tags expire. Any katalog edit or rozpiska cell edit flushes them.
import { readFileSync } from 'node:fs'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { withPayloadTransaction } from '../lib/db/with-payload-transaction'
import { toDescriptionTranslations } from '../lib/i18n/description-translations'
import { isTranslationLanguage, type TranslationLanguageT } from '../lib/i18n/languages'
import {
  exportUntranslated,
  parseTranslationFile,
  planTranslationFill,
  type TranslationFillRowT,
  type TranslationFillT,
  type TranslationFillTableT,
} from '../lib/i18n/translation-fill'

const USAGE =
  'użycie: fill-description-translations.ts export --lang uk|ru\n' +
  '        fill-description-translations.ts import <plik.tsv> --lang uk|ru [--apply]'

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function readLanguage(): TranslationLanguageT {
  const value = process.argv[process.argv.indexOf('--lang') + 1]
  if (!process.argv.includes('--lang') || value === undefined || !isTranslationLanguage(value))
    fail(USAGE)
  return value
}

async function readRows(db: DbExecutorT): Promise<TranslationFillRowT[]> {
  const res = await db.execute(sql`
    SELECT 'work_catalogue_items' AS source_table, id, description, description_translations
    FROM work_catalogue_items
    UNION ALL
    SELECT 'kosztorys_items', ki.id, ki.description, ki.description_translations
    FROM kosztorys_items ki
    JOIN investments i ON i.id = ki.investment_id
    WHERE i.status <> 'completed' AND i.trashed_at IS NULL
  `)
  return res.rows.map((row) => ({
    table: row.source_table as TranslationFillTableT,
    id: Number(row.id),
    description: String(row.description ?? ''),
    descriptionTranslations: toDescriptionTranslations(row.description_translations),
  }))
}

async function writeFills(
  db: DbExecutorT,
  table: TranslationFillTableT,
  fills: TranslationFillT[],
) {
  if (fills.length === 0) return
  const values = fills.map(
    ({ row, descriptionTranslations }) =>
      sql`(${row.id}::int, ${JSON.stringify(descriptionTranslations)}::jsonb)`,
  )
  await db.execute(sql`
    UPDATE ${sql.identifier(table)} AS t
    SET description_translations = v.description_translations, updated_at = now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, description_translations)
    WHERE t.id = v.id
  `)
}

async function main() {
  const [command, file] = process.argv.slice(2)
  if (command !== 'export' && command !== 'import') fail(USAGE)
  const language = readLanguage()
  const payload = await getPayload({ config })
  const rows = await readRows(await getDb(payload))

  if (command === 'export') {
    console.log(JSON.stringify(exportUntranslated(rows, language), null, 2))
    process.exit(0)
  }

  if (file === undefined || file.startsWith('--')) fail(USAGE)
  const plan = planTranslationFill(rows, parseTranslationFile(readFileSync(file, 'utf8')), language)
  const byTable = Map.groupBy(plan.fills, (fill) => fill.row.table)

  console.log(`katalog: do uzupełnienia ${byTable.get('work_catalogue_items')?.length ?? 0}`)
  console.log(`pozycje: do uzupełnienia ${byTable.get('kosztorys_items')?.length ?? 0}`)
  console.log(`już przetłumaczone: ${plan.alreadyTranslated}`)
  console.log(`brak w pliku: ${plan.missing.length} opisów`)
  for (const description of plan.missing.slice(0, 20)) console.log(`  „${description}"`)
  if (plan.missing.length > 20) console.log(`  … i ${plan.missing.length - 20} więcej`)

  if (!process.argv.includes('--apply')) {
    console.log('\nPRÓBA — nic nie zapisano (--apply zapisuje)')
    process.exit(0)
  }

  await withPayloadTransaction(
    payload,
    async (req) => {
      const tx = await getDb(payload, req)
      for (const [table, fills] of byTable) await writeFills(tx, table, fills)
    },
    {},
  )
  console.log(`\nZAPISANE — uzupełniono ${plan.fills.length}`)
  process.exit(0)
}

void main().catch((error) => {
  console.error('\nPRZERWANE — nic nie zapisano:', error)
  process.exit(1)
})
