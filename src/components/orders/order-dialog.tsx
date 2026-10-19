'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import { OrderPickStep, type OrderPickT } from '@/components/orders/order-pick-step'
import { OrderSmsStep } from '@/components/orders/order-sms-step'
import { orderFormValues } from '@/components/orders/order-form-values'
import { OrderSettingsButton } from '@/components/orders/order-settings-button'
import { useCurrentUser } from '@/hooks/use-current-user'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { ORDER_ACTION_LABEL } from '@/lib/constants/orders'
import type { BulkExpenseFormValuesT } from '@/components/forms/expense-form/bulk-expense-form'
import type { SiteAddressT } from '@/lib/investments/format-address'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataT } from '@/types/reference-data'

export type OrderInvestmentT = SiteAddressT & { id: number; name: string; siteManagerId?: number }

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
      <DialogContent className="sm:max-w-dialog-sm sm:has-data-[step=sms]:max-w-dialog sm:has-data-[step=form]:max-w-dialog-lg">
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
  const canEditSettings = isAdminOrOwnerRole(useCurrentUser().role)

  const step = isBooked ? 'sms' : formValues ? 'form' : 'pick'

  function handlePick(next: OrderPickT) {
    setPick(next)
    setFormValues(
      orderFormValues({
        ...next,
        investmentId: investment.id,
        referenceData,
      }),
    )
  }

  return (
    <div data-step={step}>
      <DialogHeader title={STEP_TITLES[step]} description={investment.name} />
      <div className="mt-6 pr-1">
        {step === 'pick' && (
          <OrderPickStep
            key={`${orderSettings.bigBagPrice}:${orderSettings.containerPrice}`}
            prices={orderSettings}
            investmentId={investment.id}
            workers={referenceData.workers}
            siteManagerId={investment.siteManagerId}
            settings={canEditSettings && <OrderSettingsButton settings={orderSettings} />}
            onNext={handlePick}
          />
        )}
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
            orderSettings={orderSettings}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}
