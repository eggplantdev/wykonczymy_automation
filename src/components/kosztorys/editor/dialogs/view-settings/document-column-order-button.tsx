'use client'

import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ColumnOrderDialog } from '@/components/ui/column-order-dialog'
import {
  documentBaseRanks,
  orderDocumentKeys,
  unpinned,
} from '@/lib/kosztorys/columns/document-column-order'
import type { ColumnRanksT } from '@/lib/table/column-order'
import { sameItems } from '@/lib/utils/same-items'

type ValueT = { hiddenColumns: string[]; columnRanks: ColumnRanksT }

type PropsT<T extends ValueT> = {
  keys: readonly string[]
  labelFor: (key: string) => string | undefined
  value: T
  onChange: (value: T) => void
  resetRanks: ColumnRanksT
  disabled?: boolean
}

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
  const items = unpinned(ordered).map((key) => ({
    id: key,
    label: labelFor(key) ?? key,
    visible: !hidden.has(key),
  }))

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
        resetDisabled={sameItems(ordered, orderDocumentKeys(keys, resetRanks))}
        description="„Opis prac” zawsze jest pierwszy. Kolejność zapisuje się razem z ustawieniami — przyciskiem „Zapisz”."
      />
    </>
  )
}
