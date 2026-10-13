import { useState } from 'react'
import { makeLineItem, type BulkLineItemT } from '@/components/forms/expense-form/bulk-expense-form'
import { lineItemForPart } from '@/components/worker-expenses/draft-prefill'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import { bookedReceipt, mergeLineItems } from '@/lib/worker-expenses/merge-receipts'
import type { DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'

export type ReceiptGroupingT = {
  selectableIds: Set<string>
  selectedIds: Set<string>
  mergedIds: Set<string>
  disabled: boolean
  onToggle: (id: string) => void
  onSplit: (id: string) => void
}

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

/**
 * The paragony behind each row of a worker's zgłoszenie, and „Połącz” / „Rozłącz” over them. A merge
 * or split rewrites the parts, the rows and their files in one handler: a merged-away row left in the
 * parts would be booked as a refused paragon.
 */
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
  // A merged Kwota summed over a paragon the AI could not read is short, and must say so.
  const [incompleteIds, setIncompleteIds] = useState(() => new Set<string>())

  const rowIds = new Set(lineItems.map((item) => item.id))
  const selectedIds = new Set([...selected].filter((id) => rowIds.has(id)))
  const selectedItems = lineItems.filter((item) => selectedIds.has(item.id))
  const mergedIds = new Set(
    lineItems.filter((item) => (receipts.get(item.id)?.length ?? 0) > 1).map((item) => item.id),
  )

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function merge() {
    if (!source || selectedItems.length < 2) return
    const { values, isAmountIncomplete } = mergeLineItems(selectedItems)
    const merged = makeLineItem(values)
    const parts = selectedItems.flatMap((item) => receipts.get(item.id) ?? [])
    const mergedAwayIds = selectedItems.map((item) => item.id)
    const pages = bookedReceipt(parts).mediaIds.flatMap((id) => source.pagesByMediaId.get(id) ?? [])

    const at = lineItems.findIndex((item) => item.id === mergedAwayIds[0])
    const rest = lineItems.filter((item) => !selectedIds.has(item.id))
    setLineItems([...rest.slice(0, at), merged, ...rest.slice(at)])
    replaceRows(mergedAwayIds, [[merged.id, pages]])
    setReceipts((prev) => {
      const next = new Map(prev)
      mergedAwayIds.forEach((id) => next.delete(id))
      return next.set(merged.id, parts)
    })
    setIncompleteIds((prev) => {
      const next = new Set(prev)
      mergedAwayIds.forEach((id) => next.delete(id))
      return isAmountIncomplete ? next.add(merged.id) : next
    })
    setSelected(new Set())
  }

  // Rebuilt from the stored read, not from the merged row: what the manager typed into it is lost.
  function split(id: string) {
    const parts = receipts.get(id)
    const at = lineItems.findIndex((item) => item.id === id)
    if (!source || !parts || parts.length < 2 || at === -1) return
    const { expenseCategory, worker } = lineItems[at]
    const rows = parts.map((part) => {
      const read = part.readRow === undefined ? undefined : source.aiReadRows[part.readRow]
      const { lineItem, pages } = lineItemForPart(
        part,
        read,
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
    setReceipts((prev) => {
      const next = new Map(prev)
      next.delete(id)
      rows.forEach((row) => next.set(row.lineItem.id, [row.part]))
      return next
    })
    setIncompleteIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  function itemIdOfReadRow(readRow: number): string | undefined {
    return [...receipts].find(
      ([id, parts]) => rowIds.has(id) && parts.some((part) => part.readRow === readRow),
    )?.[0]
  }

  const grouping: ReceiptGroupingT | undefined = source && {
    // A row the manager added himself stands for no paragon, so there is nothing to merge it with.
    selectableIds: new Set([...rowIds].filter((id) => receipts.has(id))),
    selectedIds,
    mergedIds,
    disabled: isBusy,
    onToggle: toggle,
    onSplit: split,
  }

  return {
    receipts,
    grouping,
    selectedCount: selectedIds.size,
    merge,
    incompleteIds: new Set([...incompleteIds].filter((id) => rowIds.has(id))),
    itemIdOfReadRow,
  }
}
