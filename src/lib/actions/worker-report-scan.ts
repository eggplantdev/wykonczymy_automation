'use server'

import { after } from 'next/server'
import { investmentAction } from '@/lib/actions/investment-action'
import { validateAction } from '@/lib/actions/run-action'
import { translateReportExtras } from '@/lib/actions/translate-report-lines'
import { investmentEntityOpts } from '@/lib/cache/tags'
import { getDb } from '@/lib/db/get-db'
import { readReportTarget } from '@/lib/db/worker-report-share'
import { insertScannedReport } from '@/lib/db/worker-reports'
import { REPORT_REFUSALS, type ReportRefusalKeyT } from '@/lib/kosztorys/worker-report/refusals'
import { reportUnits, treeItems } from '@/lib/kosztorys/worker-report/report-lines'
import { resolveScanLines } from '@/lib/kosztorys/worker-report/resolve-scan'
import { createScannedReportSchema } from '@/lib/kosztorys/worker-report/schemas'
import { reportShareRefusal } from '@/lib/kosztorys/worker-report/share-refusal'
import type { CreateScannedReportInputT } from '@/lib/kosztorys/worker-report/types'
import { WORKER_SCOPE_BLOCK_MESSAGES } from '@/lib/kosztorys/worker-view/labels'
import { resolveWorkerScope } from '@/lib/kosztorys/worker-view/scope'
import { buildKosztorysTree } from '@/lib/queries/kosztorys'
import type { ActionResultT } from '@/types/action'

// The worker-facing „Twoje konto…" would address the wrong person here.
const INACTIVE_WORKER = 'Konto pracownika jest nieaktywne — aktywuj je, zanim wczytasz jego kartkę.'

const refusalMessage = (refusal: ReportRefusalKeyT): string =>
  refusal === 'inactiveWorker' ? INACTIVE_WORKER : REPORT_REFUSALS[refusal]

/**
 * The kierownik files a zgłoszenie from the worker's paper. It passes the same gates as the worker's
 * own send — closed investment, szablon, inactive worker, blocked etapy — because it lands in the
 * same review and the same etap quantities.
 */
export async function createScannedReportAction(
  input: CreateScannedReportInputT,
): Promise<ActionResultT<{ reportId: number }>> {
  const parsed = validateAction(createScannedReportSchema, input)
  if (!parsed.success) return parsed
  const { investmentId, workerId, pages, mediaIds } = parsed.data

  return investmentAction<{ reportId: number }>(
    'createScannedReportAction',
    { investmentId },
    async ({ payload, user }) => {
      const db = await getDb(payload)

      const target = await readReportTarget(db, investmentId, workerId)
      if (!target) return { success: false, error: 'Pracownik nie ma etapu na tej inwestycji.' }
      const refusal = await reportShareRefusal(db, target)
      if (refusal) return { success: false, error: refusalMessage(refusal) }

      const tree = await buildKosztorysTree(investmentId)
      const scope = resolveWorkerScope(tree.stages, workerId)
      if (scope.kind === 'blocked') {
        return { success: false, error: WORKER_SCOPE_BLOCK_MESSAGES[scope.reason] }
      }

      const lines = resolveScanLines(pages, tree, reportUnits(treeItems(tree)))
      if (lines.length === 0) {
        return { success: false, error: 'Na zdjęciach nie odczytano żadnej wpisanej ilości.' }
      }

      const reportId = await insertScannedReport(db, {
        investmentId,
        workerId,
        lines,
        createdById: user.id,
        mediaIds,
      })
      if (reportId === null)
        return { success: false, error: 'Nie udało się dołączyć zdjęć kartki.' }

      if (lines.some((line) => line.kind === 'extra')) {
        after(() => translateReportExtras(db, reportId))
      }
      return { success: true, data: { reportId } }
    },
    undefined,
    investmentEntityOpts(investmentId),
  )
}
