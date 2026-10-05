// No `server-only` here (half of src/lib/db skips it too): the bulk script runs these same helpers
// under tsx, where that import throws.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { textOrNull } from '@/lib/db/row-coerce'
import { fillDescriptionTranslations } from '@/lib/db/fill-description-translations'
import type { RowWriteT } from '@/lib/i18n/ai-translation-fill'
import {
  toDescriptionTranslations,
  type DescriptionTranslationsT,
} from '@/lib/i18n/description-translations'

// The two hand-typed text columns travel together: one button cleans both, and a praca with a blank
// opis can still carry a j.m. worth tidying. The translations ride along because their `source` has
// to follow a cleaned opis.
export type ItemTextRowT = {
  id: number
  description: string | null
  unit: string | null
  descriptionTranslations: DescriptionTranslationsT
}

export async function getItemTexts(db: DbExecutorT, investmentId: number): Promise<ItemTextRowT[]> {
  const res = await db.execute(sql`
    SELECT id, description, unit, description_translations
    FROM kosztorys_items
    WHERE investment_id = ${investmentId}
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    description: textOrNull(row.description),
    unit: textOrNull(row.unit),
    descriptionTranslations: toDescriptionTranslations(row.description_translations),
  }))
}

/** One statement, because a kosztorys runs to hundreds of rows and one button drives all of them. */
export async function setItemTexts(
  db: DbExecutorT,
  investmentId: number,
  rows: readonly ItemTextRowT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(
    ({ id, description, unit, descriptionTranslations }) =>
      sql`(${id}::int, ${description}::text, ${unit}::text, ${JSON.stringify(descriptionTranslations)}::jsonb)`,
  )
  const res = await db.execute(sql`
    UPDATE kosztorys_items AS i
    SET description = v.description, unit = v.unit,
        description_translations = v.description_translations, updated_at = now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, description, unit, description_translations)
    WHERE i.id = v.id AND i.investment_id = ${investmentId}
    RETURNING i.id
  `)
  // The editor reseeds its grid off the investment's revision token — the same reason
  // setSheetMeasuredQty bumps it.
  if (res.rows.length > 0)
    await db.execute(sql`UPDATE investments SET updated_at = now() WHERE id = ${investmentId}`)
  return res.rows.length
}

/** The AI fill's writer — translations only, never the opis or j.m. a manager may be editing. */
export async function setItemTranslations(
  db: DbExecutorT,
  investmentId: number,
  rows: readonly RowWriteT[],
): Promise<number> {
  const written = await fillDescriptionTranslations(db, 'kosztorys_items', rows, investmentId)
  if (written.length > 0)
    await db.execute(sql`UPDATE investments SET updated_at = now() WHERE id = ${investmentId}`)
  return written.length
}

export async function getSectionNames(db: DbExecutorT, investmentId: number): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT name FROM kosztorys_sections
    WHERE investment_id = ${investmentId} AND trim(coalesce(name, '')) <> ''
  `)
  return res.rows.map((row) => String(row.name))
}
