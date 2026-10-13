import { useState } from 'react'
import {
  makeLineItem,
  type BulkLineItemT,
  type ReceiptGroupingT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { mergeLineItems } from '@/components/forms/expense-form/merge-line-items'
import { lineItemForPart, pagesFor } from '@/components/worker-expenses/draft-prefill'
import type { LineItemStatusT } from '@/components/forms/form-fields/collapsible-line-item'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import type { RejectedReceiptT } from '@/lib/db/worker-expense-drafts'
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
  acceptedReadRows?: number[]
  rejectedReceipts?: RejectedReceiptT[]
}

type DecisionT = Exclude<LineItemStatusT, 'pending'>

// A paragon's refusal names it by its read row, or by its photos when the read never covered it.
export const isReceiptOf = (receipt: RejectedReceiptT, part: DraftReceiptT) =>
  receipt.readRow === null
    ? part.readRow === undefined && receipt.mediaIds.every((id) => part.mediaIds.includes(id))
    : receipt.readRow === part.readRow

function initialDecisions(source: DraftReceiptsSourceT | undefined) {
  const decisions = new Map<string, DecisionT>()
  const accepted = new Set(source?.acceptedReadRows ?? [])
  for (const [id, [part]] of source?.receipts ?? []) {
    if (part.readRow !== undefined && accepted.has(part.readRow)) decisions.set(id, 'accepted')
    else if (source?.rejectedReceipts?.some((receipt) => isReceiptOf(receipt, part)))
      decisions.set(id, 'rejected')
  }
  return decisions
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
  const [decisions, setDecisions] = useState(() => initialDecisions(source))
  // Grows only: a row id is never reused, so a merged-away or split row's id can't match again.
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
    // A merged-in row's own blank Kwota is already hidden inside its sum.
    const isIncomplete = isAmountIncomplete || mergedAwayIds.some((id) => incompleteIds.has(id))

    const at = lineItems.findIndex((item) => item.id === mergedAwayIds[0])
    const rest = lineItems.filter((item) => !selectedIds.has(item.id))
    setLineItems([...rest.slice(0, at), merged, ...rest.slice(at)])
    replaceRows(mergedAwayIds, [
      [merged.id, pagesFor(bookedReceipt(parts).mediaIds, source.pagesByMediaId)],
    ])
    setReceipts((prev) => mergeParts(prev, mergedAwayIds, merged.id))
    if (isIncomplete) setIncompleteIds((prev) => new Set(prev).add(merged.id))
    // Kept selected, so the merged paragon is the one the footer's actions and sum now name.
    setSelected(new Set([merged.id]))
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

  function decide(ids: string[], decision: DecisionT) {
    setDecisions((prev) => new Map([...prev, ...ids.map((id) => [id, decision] as const)]))
    setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))))
  }

  function undecide(id: string) {
    setDecisions((prev) => new Map([...prev].filter(([key]) => key !== id)))
  }

  function itemIdOfReadRow(readRow: number): string | undefined {
    return [...receipts].find(
      ([id, parts]) => pendingIds.has(id) && parts.some((part) => part.readRow === readRow),
    )?.[0]
  }

  // Counted in read rows, like the list's badge: a merged booking still covers each paragon it took.
  const countReadRows = (ids: Iterable<string>) =>
    [...ids].flatMap((id) => receipts.get(id) ?? []).filter((part) => part.readRow !== undefined)
      .length
  const idsDecided = (decision: DecisionT) =>
    [...rowIds].filter((id) => decisions.get(id) === decision)
  const progress = {
    accepted: countReadRows(idsDecided('accepted')),
    rejected: countReadRows(idsDecided('rejected')),
    pending: countReadRows(pendingIds),
  }

  const grouping: ReceiptGroupingT | undefined = source && {
    selectableIds: new Set([...pendingIds].filter((id) => receipts.has(id))),
    selectedIds,
    mergedIds: new Set([...rowIds].filter((id) => (receipts.get(id)?.length ?? 0) > 1)),
    incompleteIds,
    disabled: isBusy,
    onToggle: (id) => setSelected((prev) => toggleInSet(prev, id)),
    onMerge: merge,
    onSplit: split,
    readRowOf: (id) => {
      const readRows = (receipts.get(id) ?? []).flatMap((part) => part.readRow ?? [])
      return readRows.length > 0 ? Math.min(...readRows) : undefined
    },
    statusOf: (id) => decisions.get(id) ?? 'pending',
  }

  return { receipts, grouping, itemIdOfReadRow, pendingIds, progress, decide, undecide }
}
