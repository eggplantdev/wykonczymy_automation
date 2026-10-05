'use server'

import { investmentAction } from '@/lib/actions/investment-action'
import { FALLBACK_MODEL } from '@/lib/ai/openrouter-client'
import { translateLines } from '@/lib/actions/translate-report-lines'
import { getDb } from '@/lib/db/get-db'
import {
  readPendingExtra,
  setLineTranslations,
  type LineTranslationT,
} from '@/lib/db/worker-report-line-translations'
import type { ActionResultT } from '@/types/action'

const STALE_LINE = 'Tej pracy nie można już przetłumaczyć — odśwież zgłoszenie.'

// Straight to the stronger model: a retry follows a bad or missing answer, and the cheap one tends to
// repeat itself. Nothing reads these columns through a cache, so there is no tag to expire.
export async function retranslateReportLineAction(
  investmentId: number,
  lineId: number,
): Promise<ActionResultT<Omit<LineTranslationT, 'id'>>> {
  return investmentAction('retranslateReportLineAction', { investmentId }, async ({ payload }) => {
    const db = await getDb(payload)
    const line = await readPendingExtra(db, investmentId, lineId)
    if (!line) return { success: false, error: STALE_LINE }
    const [translated] = await translateLines([line], FALLBACK_MODEL)
    if (!translated)
      return { success: false, error: 'Nie udało się przetłumaczyć. Spróbuj ponownie.' }
    const [stored] = await setLineTranslations(db, [translated], { onlyUntranslated: false })
    if (!stored) return { success: false, error: STALE_LINE }
    return {
      success: true,
      data: {
        polishDescription: stored.polishDescription,
        descriptionLanguage: stored.descriptionLanguage,
      },
    }
  })
}
