'use server'

import { after } from 'next/server'
import { z } from 'zod'
import { translateReportExtras } from '@/lib/actions/translate-report-lines'
import { validateAction } from '@/lib/actions/run-action'
import { tokenAction } from '@/lib/actions/token-action'
import { insertWorkerReport, type WorkerReportLineInputT } from '@/lib/db/worker-reports'
import { cleanUnit } from '@/lib/kosztorys/clean-unit'
import { noticeFailure, noticeKeyOf } from '@/lib/i18n/notice-failure'
import { reportUnits, rozpiskaLine, treeItems } from '@/lib/kosztorys/worker-report/report-lines'
import { sendLineSchema } from '@/lib/kosztorys/worker-report/schemas'
import type { SendReportLineT } from '@/lib/kosztorys/worker-report/types'
import type { ActionResultT } from '@/types/action'

const MAX_LINES = 2000

const linesSchema = z
  .array(sendLineSchema)
  .min(1, 'Zgłoszenie nie ma żadnej pracy')
  .max(MAX_LINES, 'Za dużo prac w jednym zgłoszeniu')

/** A rozpiska line carries only its pozycja and ilość. No cache tags: every report read is uncached. */
export async function sendWorkerReportAction(
  token: string,
  lines: SendReportLineT[],
): Promise<ActionResultT<{ reportId: number }>> {
  const parsed = validateAction(linesSchema, lines)
  if (!parsed.success) return { ...parsed, messageKey: noticeKeyOf(parsed.error) }

  const itemIds = parsed.data.flatMap((line) => (line.kind === 'rozpiska' ? [line.itemId] : []))
  if (new Set(itemIds).size !== itemIds.length) {
    return { success: false, error: 'Pozycja powtarza się w zgłoszeniu' }
  }

  return tokenAction<{ reportId: number }>(
    'sendWorkerReportAction',
    { token, itemIds },
    async ({ db, investmentId, workerId, tree }) => {
      const items = treeItems(tree)
      const itemById = new Map(items.map((found) => [found.item.id, found]))
      const allowedUnits = reportUnits(items)

      const stored: WorkerReportLineInputT[] = []
      for (const line of parsed.data) {
        if (line.kind === 'rozpiska') {
          const found = itemById.get(line.itemId)
          if (!found) continue // unreachable: tokenAction refuses an itemId outside this rozpiska
          stored.push(rozpiskaLine(found, line.qty))
          continue
        }
        const unit = cleanUnit(line.unit)
        if (!allowedUnits.has(unit)) return noticeFailure('unknownUnit')
        stored.push({
          kind: 'extra',
          itemId: null,
          description: line.description,
          unit,
          sectionName: null,
          reportedQty: line.qty,
        })
      }

      // One CTE statement, so it is atomic without a transaction of its own.
      const reportId = await insertWorkerReport(db, { investmentId, workerId, lines: stored })
      if (stored.some((line) => line.kind === 'extra')) {
        after(() => translateReportExtras(db, reportId))
      }
      return { success: true, data: { reportId } }
    },
  )
}
