'use client'

import { useState } from 'react'
import { Truck } from 'lucide-react'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { OrderDialog, type OrderInvestmentT } from '@/components/orders/order-dialog'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataT } from '@/types/reference-data'

type OrderButtonPropsT = {
  investment: OrderInvestmentT
  referenceData: ReferenceDataT
  orderSettings: OrderSettingsT
}

export function OrderButton(props: OrderButtonPropsT) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <RowActionButton icon={Truck} label="Kontener" showLabel onClick={() => setOpen(true)} />
      <OrderDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  )
}
