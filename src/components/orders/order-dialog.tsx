'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import { OrderPickStep, type OrderPickT } from '@/components/orders/order-pick-step'
import { OrderSmsStep, type OrderAddressT } from '@/components/orders/order-sms-step'
import { orderFormValues } from '@/lib/orders/order-form-values'
import { isActiveRef } from '@/lib/utils/is-active-ref'
import { ORDER_ACTION_LABEL } from '@/lib/constants/orders'
import type { BulkExpenseFormValuesT } from '@/components/forms/expense-form/bulk-expense-form'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataT } from '@/types/reference-data'

export type OrderInvestmentT = OrderAddressT & { id: number; siteManagerId?: number }

type OrderDialogPropsT = {
  investment: OrderInvestmentT
  referenceData: ReferenceDataT
  orderSettings: OrderSettingsT
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STEP_TITLES = {
  pick: ORDER_ACTION_LABEL,
  form: 'Wydatek za zamówienie',
  sms: 'SMS do dostawcy',
} as const

export function OrderDialog({ open, onOpenChange, ...flow }: OrderDialogPropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-lg">
        <OrderFlow {...flow} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type OrderFlowPropsT = Omit<OrderDialogPropsT, 'open' | 'onOpenChange'> & { onClose: () => void }

function OrderFlow({ investment, referenceData, orderSettings, onClose }: OrderFlowPropsT) {
  const [pick, setPick] = useState<OrderPickT>()
  const [formValues, setFormValues] = useState<BulkExpenseFormValuesT>()
  const [isBooked, setIsBooked] = useState(false)

  const step = isBooked ? 'sms' : formValues ? 'form' : 'pick'
  const siteManager = referenceData.workers.find(
    (worker) => worker.id === investment.siteManagerId && isActiveRef(worker),
  )

  function handlePick(next: OrderPickT) {
    setPick(next)
    setFormValues(
      orderFormValues({
        ...next,
        investmentId: investment.id,
        prices: orderSettings,
        referenceData,
      }),
    )
  }

  return (
    <div className="h-auto">
      <DialogHeader title={STEP_TITLES[step]} />
      <div className="mt-6 pr-1">
        {step === 'pick' && <OrderPickStep prices={orderSettings} onNext={handlePick} />}
        {step === 'form' && formValues && (
          <ExpenseForm
            formId="order"
            referenceData={referenceData}
            orderValues={formValues}
            onSubmitSuccess={() => setIsBooked(true)}
          />
        )}
        {step === 'sms' && pick && (
          <OrderSmsStep
            pick={pick}
            address={investment}
            siteManager={siteManager}
            orderSettings={orderSettings}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
