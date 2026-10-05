// No `server-only` here: kosztorys-item-texts.ts and work-catalogue.ts skip it for the tsx scripts,
// and both import this.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { mergeRowWrites, type RowWriteT } from '@/lib/i18n/ai-translation-fill'

// A language lands only while the stored one is still missing, blank or made from another opis.
const STILL_UNTRANSLATED = sql`(
  t.description_translations -> e.key IS NULL
  OR coalesce(trim(t.description_translations -> e.key ->> 'text'), '') = ''
  OR t.description_translations -> e.key ->> 'source' IS DISTINCT FROM t.description
)`

/**
 * Compare-and-set over an AI wait: a row is written only while it still carries the opis that was
 * translated, and per language only while that language still needs one. A grid edit or a
 * hand-typed translation made during the wait therefore wins. Returns how many rows were written.
 */
export async function fillDescriptionTranslations(
  db: DbExecutorT,
  table: 'kosztorys_items' | 'work_catalogue_items',
  rows: readonly RowWriteT[],
  investmentId?: number,
): Promise<number> {
  if (rows.length === 0) return 0
  const values = mergeRowWrites(rows).map(
    ({ id, description, translations }) =>
      sql`(${id}::int, ${description}::text, ${JSON.stringify(translations)}::jsonb)`,
  )
  const res = await db.execute(sql`
    UPDATE ${sql.raw(table)} AS t
    SET description_translations = t.description_translations || (
          SELECT jsonb_object_agg(e.key, e.value)
          FROM jsonb_each(v.translations) AS e
          WHERE ${STILL_UNTRANSLATED}
        ),
        updated_at = now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, description, translations)
    WHERE t.id = v.id
      AND t.description IS NOT DISTINCT FROM v.description
      AND EXISTS (SELECT 1 FROM jsonb_each(v.translations) AS e WHERE ${STILL_UNTRANSLATED})
      ${investmentId === undefined ? sql`` : sql`AND t.investment_id = ${investmentId}`}
    RETURNING t.id
  `)
  return res.rows.length
}
