'use server'

import { investmentAction } from '@/lib/actions/investment-action'
import { FALLBACK_MODEL } from '@/lib/ai/openrouter'
import { translateLines } from '@/lib/ai/translate-report-lines'
import { getDb } from '@/lib/db/get-db'
import { readPendingExtra, setLineTranslations } from '@/lib/db/worker-reports'
import type { ActionResultT } from '@/types/action'

/**
 * The manager's „Przetłumacz" on one praca spoza rozpiski. Goes straight to the stronger model: a
 * retry follows a bad or missing answer, and the cheap one tends to repeat itself. Nothing reads
 * these columns through a cache, so there is no tag to expire.
 */
export async function retranslateReportLineAction(
  investmentId: number,
  lineId: number,
): Promise<ActionResultT<{ polishDescription: string | null; descriptionLanguage: string }>> {
  return investmentAction(
    'retranslateReportLineAction',
    { investmentId },
    async ({ payload }) => {
      const db = await getDb(payload)
      const line = await readPendingExtra(db, investmentId, lineId)
      if (!line) {
        return { success: false, error: 'Tej pracy nie można już przetłumaczyć — odśwież zgłoszenie.' }
      }
      const [translated] = await translateLines([line], FALLBACK_MODEL)
      if (!translated) return { success: false, error: 'Nie udało się przetłumaczyć. Spróbuj ponownie.' }
      await setLineTranslations(db, [translated], { onlyUntranslated: false })
      return {
        success: true,
        data: {
          polishDescription: translated.polishDescription,
          descriptionLanguage: translated.descriptionLanguage,
        },
      }
    },
  )
}
