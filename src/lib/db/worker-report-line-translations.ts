import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'
import { text, textOrNull } from './row-coerce'

export type LineTranslationT = {
  id: number
  polishDescription: string | null
  descriptionLanguage: string
}

export async function listReportExtras(
  db: DbExecutorT,
  reportId: number,
): Promise<{ id: number; description: string }[]> {
  const res = await db.execute(sql`
    SELECT id, description FROM worker_report_lines
    WHERE report_id = ${reportId} AND kind = 'extra'
    ORDER BY position
  `)
  return res.rows.map((row) => ({ id: Number(row.id), description: text(row.description) }))
}

// A line a retry may touch: an extra of a report still pending, not accepted yet. The writer
// re-checks it, because the AI wait sits between the read and the write.
const STILL_PENDING_EXTRA = sql`l.kind = 'extra' AND l.accepted_qty IS NULL
  AND EXISTS (SELECT 1 FROM worker_reports r WHERE r.id = l.report_id AND r.status = 'pending')`

export async function readPendingExtra(
  db: DbExecutorT,
  investmentId: number,
  lineId: number,
): Promise<{ id: number; description: string } | null> {
  const res = await db.execute(sql`
    SELECT l.id, l.description
    FROM worker_report_lines l
    JOIN worker_reports r ON r.id = l.report_id
    WHERE l.id = ${lineId} AND r.investment_id = ${investmentId} AND ${STILL_PENDING_EXTRA}
  `)
  const row = res.rows[0]
  return row ? { id: Number(row.id), description: text(row.description) } : null
}

// A Polish reading never wipes a stored translation — the model misread the language, not the line.
// `onlyUntranslated` is the after()-on-send write: it must never clobber a line a manager's retry
// already translated while the first call was still running. Returns what the written lines now
// hold; a line the re-check refused is missing.
export async function setLineTranslations(
  db: DbExecutorT,
  rows: LineTranslationT[],
  { onlyUntranslated }: { onlyUntranslated: boolean },
): Promise<LineTranslationT[]> {
  if (rows.length === 0) return []
  const values = rows.map(
    (row) =>
      sql`(${row.id}::int, ${row.polishDescription}::text, ${row.descriptionLanguage}::text)`,
  )
  const keepsStored = sql`v.polish IS NULL AND l.polish_description IS NOT NULL`
  const res = await db.execute(sql`
    UPDATE worker_report_lines l
    SET polish_description = CASE WHEN ${keepsStored} THEN l.polish_description ELSE v.polish END,
        description_language = CASE WHEN ${keepsStored} THEN l.description_language ELSE v.language END
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(line_id, polish, language)
    WHERE l.id = v.line_id AND ${STILL_PENDING_EXTRA}
      ${onlyUntranslated ? sql`AND l.description_language IS NULL` : sql``}
    RETURNING l.id, l.polish_description, l.description_language
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    polishDescription: textOrNull(row.polish_description),
    descriptionLanguage: text(row.description_language),
  }))
}
