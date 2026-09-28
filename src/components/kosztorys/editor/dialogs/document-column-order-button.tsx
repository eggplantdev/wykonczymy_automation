'use client'

import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ColumnOrderDialog } from '@/components/ui/column-order-dialog'
import { DOCUMENT_PINNED_COLUMN } from '@/lib/kosztorys/column-config'
import { documentBaseRanks, orderDocumentKeys } from '@/lib/kosztorys/document-column-order'
import type { ColumnRanksT } from '@/lib/table/column-order'

type ValueT = { hiddenColumns: string[]; columnRanks: ColumnRanksT }

type PropsT<T extends ValueT> = {
  // The audience's closed document list — the order window can move a column only within it.
  keys: readonly string[]
  labelFor: (key: string) => string | undefined
  value: T
  onChange: (value: T) => void
  // What „Przywróć domyślną kolejność" returns to: the firm's order for an offer, the built-in one
  // for the worker set.
  resetRanks: ColumnRanksT
  disabled?: boolean
}

function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}

// Edits the draft only, like the ticks beside it — the order reaches a document on „Zapisz" or not at
// all, so closing the settings window discards a drag the same way it discards an untick.
export function DocumentColumnOrderButton<T extends ValueT>({
  keys,
  labelFor,
  value,
  onChange,
  resetRanks,
  disabled,
}: PropsT<T>) {
  const [open, setOpen] = useState(false)
  const hidden = new Set(value.hiddenColumns)
  const ordered = orderDocumentKeys(keys, value.columnRanks)
  const items = ordered
    .filter((key) => key !== DOCUMENT_PINNED_COLUMN)
    .map((key) => ({ id: key, label: labelFor(key) ?? key, visible: !hidden.has(key) }))

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <ArrowUpDown />
        Ustaw kolejność kolumn…
      </Button>
      <ColumnOrderDialog
        open={open}
        onOpenChange={setOpen}
        items={items}
        ranks={value.columnRanks}
        baseRanks={documentBaseRanks(keys)}
        onSetRank={(key, rank) =>
          onChange({ ...value, columnRanks: { ...value.columnRanks, [key]: rank } })
        }
        onReset={() => onChange({ ...value, columnRanks: resetRanks })}
        // Two different rank maps can give one order, so the order is what is compared.
        resetDisabled={sameOrder(ordered, orderDocumentKeys(keys, resetRanks))}
        description="„Opis prac” zawsze jest pierwszy. Kolejność zapisuje się razem z ustawieniami — przyciskiem „Zapisz”."
      />
    </>
  )
}
