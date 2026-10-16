import type { DepositFormApiT } from '@/components/forms/deposit-form/deposit-form-api'
import { useEffect, useRef } from 'react'
import type { VatPlaneT } from '@/lib/constants/transfers'
import { netSuggestion } from '@/lib/utils/net-suggestion'

type PlaneAmountFieldPropsT = {
  form: DepositFormApiT
  vatRate: number
  plane: VatPlaneT
  fieldClassName?: string
}

export function PlaneAmountField({ form, vatRate, plane, fieldClassName }: PlaneAmountFieldPropsT) {
  const suggested = useRef<string | null>(null)

  const suggestNet = (gross: string, rate: number) => {
    const next = netSuggestion(form.getFieldValue('amount') ?? '', gross, suggested.current, rate)
    if (next === null) return
    suggested.current = next
    form.setFieldValue('amount', next)
  }

  useEffect(() => {
    if (plane !== 'GROSS') return
    suggestNet(form.getFieldValue('amountGross') ?? '', vatRate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vatRate, plane])

  if (plane === 'NET') {
    return (
      <form.AppField key="amount-net" name="amount">
        {(field) => (
          <field.Input
            label="Kwota (PLN)"
            placeholder="0.00"
            type="number"
            showError
            fieldClassName={fieldClassName}
          />
        )}
      </form.AppField>
    )
  }

  return (
    <>
      <form.AppField
        key="amount-gross"
        name="amountGross"
        listeners={{ onChange: ({ value }: { value: string }) => suggestNet(value, vatRate) }}
      >
        {(field) => (
          <field.Input
            label="Kwota brutto (PLN)"
            placeholder="0.00"
            type="number"
            showError
            fieldClassName={fieldClassName}
          />
        )}
      </form.AppField>
      <form.AppField key="amount-faktura-net" name="amount">
        {(field) => (
          <field.Input
            label="Kwota netto z faktury (PLN)"
            placeholder="0.00"
            type="number"
            showError
            fieldClassName={fieldClassName}
          />
        )}
      </form.AppField>
    </>
  )
}
