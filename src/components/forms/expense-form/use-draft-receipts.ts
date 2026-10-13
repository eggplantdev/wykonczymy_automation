import { useState } from 'react'
import {
  makeLineItem,
  type BulkLineItemT,
  type ReceiptGroupingT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { mergeLineItems } from '@/components/forms/expense-form/merge-line-items'
import { lineItemForPart, pagesFor, readOf } from '@/components/worker-expenses/draft-prefill'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import { toggleInSet } from '@/lib/utils/toggle-in-set'
import {
  bookedReceipt,
  mergeParts,
  splitParts,
  type DraftReceiptT,
} from '@/lib/worker-expenses/receipt-decision'

type DraftReceiptsSourceT = {
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
  // Grows only: a row id is never reused, so a merged-away or split row's id can't match again.
  const [incompleteIds, setIncompleteIds] = useState(() => new Set<string>())

  const rowIds = new Set(lineItems.map((item) => item.id))
  const selectedIds = new Set([...selected].filter((id) => rowIds.has(id)))
  const selectedItems = lineItems.filter((item) => selectedIds.has(item.id))

  function merge() {
    if (!source || selectedItems.length < 2) return
    const { values, isAmountIncomplete } = mergeLineItems(selectedItems)
    const merged = makeLineItem(values)
    const mergedAwayIds = selectedItems.map((item) => item.id)
    const parts = mergedAwayIds.flatMap((id) => receipts.get(id) ?? [])
    // Named like the rows it came from, so the merged invoice doesn't upload under camera names.
    const filename = parts.map((part) => readOf(part, source.aiReadRows)?.filename).find(Boolean)
    // A merged-in row's own blank Kwota is already hidden inside its sum.
    const isIncomplete = isAmountIncomplete || mergedAwayIds.some((id) => incompleteIds.has(id))

    const at = lineItems.findIndex((item) => item.id === mergedAwayIds[0])
    const rest = lineItems.filter((item) => !selectedIds.has(item.id))
    setLineItems([...rest.slice(0, at), merged, ...rest.slice(at)])
    replaceRows(mergedAwayIds, [
      [merged.id, pagesFor(bookedReceipt(parts).mediaIds, source.pagesByMediaId, filename)],
    ])
    setReceipts((prev) => mergeParts(prev, mergedAwayIds, merged.id))
    if (isIncomplete) setIncompleteIds((prev) => new Set(prev).add(merged.id))
    setSelected(new Set())
  }

  // Rebuilt from the stored read, not from the merged row: what the manager typed into it is lost.
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

  function itemIdOfReadRow(readRow: number): string | undefined {
    return [...receipts].find(
      ([id, parts]) => rowIds.has(id) && parts.some((part) => part.readRow === readRow),
    )?.[0]
  }

  const grouping: ReceiptGroupingT | undefined = source && {
    selectableIds: new Set([...rowIds].filter((id) => receipts.has(id))),
    selectedIds,
    mergedIds: new Set([...rowIds].filter((id) => (receipts.get(id)?.length ?? 0) > 1)),
    incompleteIds,
    disabled: isBusy,
    onToggle: (id) => setSelected((prev) => toggleInSet(prev, id)),
    onMerge: merge,
    onSplit: split,
  }

  return { receipts, grouping, itemIdOfReadRow }
}
