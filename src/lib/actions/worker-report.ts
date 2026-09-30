'use server'

import { z } from 'zod'
import { validateAction } from '@/lib/actions/run-action'
import { tokenAction } from '@/lib/actions/token-action'
import { insertWorkerReport, type WorkerReportLineInputT } from '@/lib/db/worker-reports'
import { cleanUnit } from '@/lib/kosztorys/clean-unit'
import { unitOptions } from '@/lib/kosztorys/worker-report/unit-options'
import type { SendReportLineT } from '@/lib/kosztorys/worker-report/types'
import type { ActionResultT } from '@/types/action'

const QTY_MESSAGE = 'Ilość musi być większa od zera'
const MAX_LINES = 2000

const lineSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rozpiska'),
    itemId: z.number().int().positive(),
    qty: z.number().positive(QTY_MESSAGE),
  }),
  z.object({
    kind: z.literal('extra'),
    description: z.string().trim().min(1, 'Opisz dopisaną pracę').max(1000),
    unit: z.string().trim().min(1, 'Wybierz j.m. dopisanej pracy').max(40),
    qty: z.number().positive(QTY_MESSAGE),
  }),
])

const linesSchema = z
  .array(lineSchema)
  .min(1, 'Zgłoszenie nie ma żadnej pozycji')
  .max(MAX_LINES, 'Za dużo pozycji w jednym zgłoszeniu')

/**
 * A rozpiska line carries only its pozycja and ilość: opis, j.m. and sekcja are copied here from the
 * live pozycja, so what the kierownik reviews is what the rozpiska said at send time — never text
 * the client made up. No cache tags: every report read is uncached.
 */
export async function sendWorkerReportAction(
  token: string,
  lines: SendReportLineT[],
): Promise<ActionResultT<{ reportId: number }>> {
  const parsed = validateAction(linesSchema, lines)
  if (!parsed.success) return parsed

  const itemIds = parsed.data.flatMap((line) => (line.kind === 'rozpiska' ? [line.itemId] : []))
  if (new Set(itemIds).size !== itemIds.length) {
    return { success: false, error: 'Pozycja powtarza się w zgłoszeniu' }
  }

  return tokenAction<{ reportId: number }>(
    'sendWorkerReportAction',
    { token, itemIds },
    async ({ db, investmentId, workerId, tree }) => {
      const itemById = new Map(
        tree.sections.flatMap((section) =>
          section.items.map((item) => [item.id, { item, sectionName: section.name }] as const),
        ),
      )
      const allowedUnits = new Set(
        unitOptions(
          [...itemById.values()].map(({ item }) => item.unit ?? ''),
          '',
        ),
      )

      const stored: WorkerReportLineInputT[] = []
      for (const line of parsed.data) {
        if (line.kind === 'rozpiska') {
          const found = itemById.get(line.itemId)
          if (!found) continue // unreachable: tokenAction refuses an itemId outside this rozpiska
          const { item, sectionName } = found
          stored.push({
            kind: 'rozpiska',
            itemId: item.id,
            description: item.description ?? '',
            unit: item.unit ?? '',
            sectionName,
            reportedQty: line.qty,
          })
          continue
        }
        const unit = cleanUnit(line.unit)
        if (!allowedUnits.has(unit)) {
          return { success: false, error: `Nieznana j.m. „${line.unit}”` }
        }
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
      return { success: true, data: { reportId } }
    },
  )
}
