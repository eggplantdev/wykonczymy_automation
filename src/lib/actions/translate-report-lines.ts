import 'server-only'
import type { DbExecutorT } from '@/lib/db/get-db'
import {
  listReportExtras,
  setLineTranslations,
  type LineTranslationT,
} from '@/lib/db/worker-report-line-translations'
import { logError } from '@/lib/utils/log-error'
import { translateToPolish } from '@/lib/ai/translate'

/** A line the model skipped is left out — it stays „Brak tłumaczenia" for the manager to retry. */
export async function translateLines(
  lines: readonly { id: number; description: string }[],
  model?: string,
): Promise<LineTranslationT[]> {
  const answers = await translateToPolish(
    lines.map((line) => line.description),
    { model },
  )
  return lines.flatMap((line) => {
    const answer = answers.get(line.description.trim())
    if (!answer) return []
    return [{ id: line.id, polishDescription: answer.polish, descriptionLanguage: answer.language }]
  })
}

/** Runs in after() on send: the worker's send never waits on, or fails with, the AI. */
export async function translateReportExtras(db: DbExecutorT, reportId: number): Promise<void> {
  try {
    const extras = await listReportExtras(db, reportId)
    await setLineTranslations(db, await translateLines(extras), { onlyUntranslated: true })
  } catch (error) {
    logError('translateReportExtras', error)
  }
}
