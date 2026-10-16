import { useState } from 'react'
import {
  makeLineItem,
  type BulkLineItemT,
  type ReceiptGroupingT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { mergeLineItems } from '@/components/forms/expense-form/merge-line-items'
import { lineItemForPart, pagesFor } from '@/components/worker-expenses/draft-prefill'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import {
  paragonDecisions,
  type ParagonDecisionT,
  type ParagonOutcomesT,
} from '@/lib/worker-expenses/paragon-decisions'
import { paragonProgress } from '@/lib/worker-expenses/paragon-progress'
import {
  bookedReceipt,
  mergeParts,
  readRowOf,
  splitParts,
  type DraftReceiptT,
} from '@/lib/worker-expenses/receipt-decision'

type DraftReceiptsSourceT = ParagonOutcomesT & {
  receipts: Map<string, DraftReceiptT[]>
  aiReadRows: ExpenseDraftReadRowT[]
  pagesByMediaId: Map<number, File>
}

type OptionsT = {
  source: DraftReceiptsSourceT | undefined
  lineItems: BulkLineItemT[]
  setLineItems: (lineItems: BulkLineItemT[]) => void
  replaceRows: (removeIds: string[], add: [id: string, files: File[]][]) => void
  isBusy: boolean
}

// A merge or split rewrites the parts, the rows and their files in one handler: a merged-away row
// left in the parts would be booked as a refused paragon.
export function useDraftReceipts({
  source,
  lineItems,
  setLineItems,
  replaceRows,
  isBusy,
}: OptionsT) {
  const [receipts, setReceipts] = useState(
    () => source?.receipts ?? new Map<string, DraftReceiptT[]>(),
  )
  const [selected, setSelected] = useState(() => new Set<string>())
  const [decisions, setDecisions] = useState(() =>
    source ? paragonDecisions(source.receipts, source) : new Map<string, ParagonDecisionT>(),
  )
  const [incompleteIds, setIncompleteIds] = useState(() => new Set<string>())

  const rowIds = new Set(lineItems.map((item) => item.id))
  const pendingIds = new Set([...rowIds].filter((id) => !decisions.has(id)))
  const selectedIds = new Set([...selected].filter((id) => pendingIds.has(id)))
  const selectedItems = lineItems.filter((item) => selectedIds.has(item.id))

  function merge() {
    if (!source || selectedItems.length < 2) return
    const { values, isAmountIncomplete } = mergeLineItems(selectedItems)
    const merged = makeLineItem(values)
    const mergedAwayIds = selectedItems.map((item) => item.id)
    const parts = mergedAwayIds.flatMap((id) => receipts.get(id) ?? [])
    const isIncomplete = isAmountIncomplete || mergedAwayIds.some((id) => incompleteIds.has(id))

    const at = lineItems.findIndex((item) => item.id === mergedAwayIds[0])
    const rest = lineItems.filter((item) => !selectedIds.has(item.id))
    setLineItems([...rest.slice(0, at), merged, ...rest.slice(at)])
    replaceRows(mergedAwayIds, [
      [merged.id, pagesFor(bookedReceipt(parts).mediaIds, source.pagesByMediaId)],
    ])
    setReceipts((prev) => mergeParts(prev, mergedAwayIds, merged.id))
    if (isIncomplete) setIncompleteIds((prev) => new Set(prev).add(merged.id))
    setSelected(new Set([merged.id]))
  }

  function split(id: string) {
    const parts = receipts.get(id)
    const at = lineItems.findIndex((item) => item.id === id)
    if (!source || !parts || parts.length < 2 || at === -1) return
    const { expenseCategory, worker } = lineItems[at]
    const rows = parts.map((part) => {
      const { lineItem, pages } = lineItemForPart(
        part,
        source.aiReadRows,
        source.pagesByMediaId,
        expenseCategory,
      )
      return { part, pages, lineItem: { ...lineItem, worker } }
    })

    setLineItems([
      ...lineItems.slice(0, at),
      ...rows.map((row) => row.lineItem),
      ...lineItems.slice(at + 1),
    ])
    replaceRows(
      [id],
      rows.map((row) => [row.lineItem.id, row.pages]),
    )
    setReceipts((prev) =>
      splitParts(
        prev,
        id,
        rows.map((row) => [row.lineItem.id, row.part]),
      ),
    )
  }

  function decide(ids: string[], decision: ParagonDecisionT) {
    setDecisions((prev) => new Map([...prev, ...ids.map((id) => [id, decision] as const)]))
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))))
  }

  function undecide(id: string) {
    setDecisions((prev) => new Map([...prev].filter(([key]) => key !== id)))
  }

  function resync(outcomes: ParagonOutcomesT) {
    const next = paragonDecisions(receipts, outcomes)
    setDecisions(next)
    setSelected((prev) => new Set([...prev].filter((id) => !next.has(id))))
  }

  function itemIdOfReadRow(readRow: number): string | undefined {
    return [...receipts].find(([, parts]) => parts.some((part) => part.readRow === readRow))?.[0]
  }

  const progress = paragonProgress(receipts, [...rowIds], decisions)

  const grouping: ReceiptGroupingT | undefined = source && {
    selectableIds: new Set([...pendingIds].filter((id) => receipts.has(id))),
    selectedIds,
    mergedIds: new Set([...rowIds].filter((id) => (receipts.get(id)?.length ?? 0) > 1)),
    incompleteIds,
    disabled: isBusy,
    onToggle: (id) => setSelected((prev) => toggleInSet(prev, id)),
    onMerge: merge,
    onSplit: split,
    readRowOf: (id) => readRowOf(receipts.get(id) ?? []),
    statusOf: (id) => decisions.get(id) ?? 'pending',
  }

  return { receipts, grouping, itemIdOfReadRow, pendingIds, progress, decide, undecide, resync }
}
