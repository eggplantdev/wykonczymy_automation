import type { WorkerReportLineInputT } from '@/lib/db/worker-reports'
import type { KosztorysTreeT } from '@/lib/kosztorys/types'
import { parseFormRef } from '@/lib/kosztorys/worker-report/check-digit'
import { rozpiskaLine, treeItems } from '@/lib/kosztorys/worker-report/report-lines'
import type { ScanPageT } from '@/lib/kosztorys/worker-report/types'
import { round6 } from '@/lib/utils/round'

const positiveQty = (qty: number | null): number | undefined => {
  if (qty === null) return undefined
  const rounded = round6(qty)
  return rounded > 0 ? rounded : undefined
}

/**
 * One printed form is one zgłoszenie, so every row becomes a line — a number read twice (the same
 * sheet photographed twice) stays two lines for the kierownik to spot, never a sum. A number that
 * does not resolve still becomes a line, unassigned, rather than refusing the whole paper.
 */
export function resolveScanLines(
  pages: readonly ScanPageT[],
  tree: Pick<KosztorysTreeT, 'sections'>,
  allowedUnits: ReadonlySet<string>,
): WorkerReportLineInputT[] {
  const byRef = new Map(
    treeItems(tree).flatMap((found) =>
      found.item.ref === undefined ? [] : [[found.item.ref, found] as const],
    ),
  )
  const lines: WorkerReportLineInputT[] = []

  for (const page of pages) {
    for (const row of page.rows) {
      const qty = positiveQty(row.qty)
      if (qty === undefined) continue
      const ref = parseFormRef(row.ref)
      const found = ref === undefined ? undefined : byRef.get(ref)
      if (found) {
        lines.push({ ...rozpiskaLine(found, qty), isUncertain: row.isUncertain })
        continue
      }
      lines.push({
        kind: 'rozpiska',
        itemId: null,
        description: row.description?.trim() || row.ref,
        unit: '',
        sectionName: null,
        reportedQty: qty,
        isUncertain: row.isUncertain,
        scannedRef: row.ref,
      })
    }
    for (const extra of page.extras) {
      const qty = positiveQty(extra.qty)
      const description = extra.description.trim()
      if (qty === undefined || !description) continue
      lines.push({
        kind: 'extra',
        itemId: null,
        description,
        unit: extra.unit !== null && allowedUnits.has(extra.unit) ? extra.unit : '',
        sectionName: null,
        reportedQty: qty,
        isUncertain: extra.isUncertain,
      })
    }
  }
  return lines
}
