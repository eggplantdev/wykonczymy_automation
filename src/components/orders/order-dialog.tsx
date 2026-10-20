'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ExpenseForm } from '@/components/forms/expense-form/expense-form'
import { OrderPickStep, type OrderPickT } from '@/components/orders/order-pick-step'
import { orderFormValues } from '@/components/orders/order-form-values'
import { OrderSettingsButton } from '@/components/orders/order-settings-button'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { ORDER_ACTION_LABEL } from '@/lib/constants/orders'
import { composeOrderSms, orderSmsHref } from '@/lib/orders/compose-order-sms'
import { navigateTo } from '@/lib/utils/navigate-to'
import type { BulkExpenseFormValuesT } from '@/components/forms/expense-form/bulk-expense-form'
import type { SiteAddressT } from '@/lib/investments/format-address'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataT } from '@/types/reference-data'

export type OrderInvestmentT = SiteAddressT & { id: number; name: string; siteManagerId?: number }

type OrderInvestmentSourceT = Omit<OrderInvestmentT, 'street'> & { address: string }

export const toOrderInvestment = ({
  id,
  name,
  address,
  postalCode,
  city,
  siteManagerId,
}: OrderInvestmentSourceT): OrderInvestmentT => ({
  id,
  name,
  street: address,
  postalCode,
  city,
  siteManagerId,
})

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
} as const

export function OrderDialog({ open, onOpenChange, ...flow }: OrderDialogPropsT) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-sm sm:has-data-[step=form]:max-w-dialog-lg">
        <OrderFlow {...flow} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

type OrderFlowPropsT = Omit<OrderDialogPropsT, 'open' | 'onOpenChange'> & { onClose: () => void }

function OrderFlow({ investment, referenceData, orderSettings, onClose }: OrderFlowPropsT) {
  const [pick, setPick] = useState<OrderPickT>()
  const [formValues, setFormValues] = useState<BulkExpenseFormValuesT>()
  const canEditSettings = isAdminOrOwnerRole(referenceData.currentUserRole)

  const step = formValues ? 'form' : 'pick'

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

  function handleBooked() {
    if (pick) {
      navigateTo(
        orderSmsHref(pick.supplierPhone, composeOrderSms({ ...pick, address: investment })),
      )
    }
    onClose()
  }

  return (
    <div data-step={step}>
      <DialogHeader title={STEP_TITLES[step]} description={investment.name} />
      <div className="mt-6 pr-1">
        {step === 'pick' && (
          <OrderPickStep
            orderSettings={orderSettings}
            investmentId={investment.id}
            workers={referenceData.workers}
            siteManagerId={investment.siteManagerId}
            settingsButton={canEditSettings && <OrderSettingsButton settings={orderSettings} />}
            onNext={handlePick}
          />
        )}
        {step === 'form' && formValues && (
          <ExpenseForm
            formId="order"
            referenceData={referenceData}
            orderValues={formValues}
            onSubmitSuccess={handleBooked}
          />
        )}
      </div>
    </div>
  )
}
