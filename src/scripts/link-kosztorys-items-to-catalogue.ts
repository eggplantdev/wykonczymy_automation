// One-off (EX-1017): links existing pozycje to their katalog prac entry
// (`kosztorys_items.catalogue_item_id`). Every investment is covered — szablony and kosztorysy, live
// and in the kosz.
//
//   node --env-file=.env --import tsx src/scripts/link-kosztorys-items-to-catalogue.ts [--apply]
//
// Production, run by a human after `pnpm db:dump` and after the migration adding the column:
//
//   DB_POSTGRES_URL="$DB_POSTGRES_URL_PROD" node --env-file=.env --import tsx \
//     src/scripts/link-kosztorys-items-to-catalogue.ts --apply
//
// A kosztorys pozycja links on opis + j.m. alone. A szablon row links only when it equals the entry
// in every katalog field, since a linked szablon row shows the katalog's values — every difference is
// listed and must be settled in the szablon or the katalog (the szablon wins, owner 2026-10-08)
// before a re-run. Re-runnable: only rows with no link are read, so a second --apply writes 0.
//
// Raw SQL skips the cache tags: flush the szablony and kosztorysy with any edit after an --apply.
import { sql } from '@payloadcms/db-vercel-postgres'
import { getPayload } from 'payload'
import config from '../payload.config'
import { getDb, type DbExecutorT } from '../lib/db/get-db'
import { withPayloadTransaction } from '../lib/db/with-payload-transaction'
import { listCatalogueItems } from '../lib/db/work-catalogue'
import { numOrNull } from '../lib/db/row-coerce'
import { toDescriptionTranslations } from '../lib/i18n/description-translations'
import {
  planCatalogueLinks,
  type CatalogueLinkT,
  type LinkRowT,
} from '../lib/kosztorys/work-catalogue/plan-catalogue-links'

const BATCH = 1000

async function readUnlinkedRows(db: DbExecutorT): Promise<LinkRowT[]> {
  const res = await db.execute(sql`
    SELECT ki.id, inv.name AS investment_name, inv.status, s.name AS section_name,
           ki.description, ki.description_translations, ki.unit, ki.client_price,
           ki.w_tools_override_value, ki.own_tools_override_value,
           ki.w_tools_override_coeff, ki.own_tools_override_coeff
    FROM kosztorys_items ki
    JOIN investments inv ON inv.id = ki.investment_id
    JOIN kosztorys_sections s ON s.id = ki.section_id
    WHERE ki.catalogue_item_id IS NULL
      AND btrim(coalesce(ki.description, '')) <> ''
  `)
  return res.rows.map((row) => ({
    itemId: Number(row.id),
    investmentName: String(row.investment_name),
    isTemplate: row.status === 'szablon',
    source: {
      description: String(row.description),
      descriptionTranslations: toDescriptionTranslations(row.description_translations),
      unit: String(row.unit ?? ''),
      sectionName: String(row.section_name),
      clientPrice: Number(row.client_price ?? 0),
      wToolsOverrideValue: numOrNull(row.w_tools_override_value),
      ownToolsOverrideValue: numOrNull(row.own_tools_override_value),
      wToolsOverrideCoeff: numOrNull(row.w_tools_override_coeff),
      ownToolsOverrideCoeff: numOrNull(row.own_tools_override_coeff),
    },
  }))
}

// Guarded on the NULL read above, so a row linked meanwhile by the app keeps its own link.
async function write(db: DbExecutorT, links: CatalogueLinkT[]): Promise<number> {
  let written = 0
  for (let start = 0; start < links.length; start += BATCH) {
    const values = links
      .slice(start, start + BATCH)
      .map((link) => sql`(${link.itemId}::int, ${link.catalogueItemId}::int)`)
    const res = await db.execute(sql`
      UPDATE kosztorys_items AS t
      SET catalogue_item_id = v.catalogue_item_id
      FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, catalogue_item_id)
      WHERE t.id = v.id AND t.catalogue_item_id IS NULL
      RETURNING t.id
    `)
    written += res.rows.length
  }
  return written
}

async function main() {
  const payload = await getPayload({ config })
  const db = await getDb(payload)
  const rows = await readUnlinkedRows(db)
  const plan = planCatalogueLinks(rows, await listCatalogueItems(db))

  const unmatchedTemplate = plan.unmatched.filter((row) => row.isTemplate)
  console.log(`pozycje bez powiązania: ${rows.length}`)
  console.log(`do powiązania: ${plan.links.length}`)
  console.log(`szablony — różnią się od katalogu (niepowiązane): ${plan.templateMismatches.length}`)
  for (const mismatch of plan.templateMismatches) {
    console.log(
      `  ${mismatch.investmentName}: ${mismatch.description} — ${mismatch.fields.join(', ')}`,
    )
  }
  console.log(`szablony — prace bez wpisu w katalogu: ${unmatchedTemplate.length}`)
  for (const row of unmatchedTemplate) {
    console.log(`  ${row.investmentName}: ${row.source.description} [${row.source.unit}]`)
  }
  console.log(
    `kosztorysy — prace bez wpisu w katalogu: ${plan.unmatched.length - unmatchedTemplate.length}`,
  )

  if (!process.argv.includes('--apply') || plan.links.length === 0) {
    console.log(
      plan.links.length === 0
        ? '\nNic do zapisania.'
        : '\nPRÓBA — nic nie zapisano (--apply zapisuje)',
    )
    process.exit(0)
  }

  const written = await withPayloadTransaction(
    payload,
    async (req) => write(await getDb(payload, req), plan.links),
    {},
  )
  console.log(`\nZAPISANE — ${written} pozycji powiązanych`)
  process.exit(0)
}

void main().catch((error) => {
  console.error('\nPRZERWANE — nic nie zapisano:', error)
  process.exit(1)
})
