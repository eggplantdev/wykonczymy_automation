'use client'

import { SelectItem } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FieldGroup } from '@/components/ui/field'
import { useStore } from '@/components/forms/hooks/form-hooks'
import { useManagedForm } from '@/components/forms/hooks/use-managed-form'
import { useInvestmentFromUrl } from '@/components/forms/hooks/use-investment-from-url'
import { investmentForType } from '@/lib/transfers/clear-fields-for-type'
import { FormShell } from '@/components/forms/form-components/form-shell'
import {
  DEPOSIT_UI_TYPES,
  TRANSFER_TYPE_LABELS,
  showsInvestment,
  isVatPlane,
  planeFor,
  PAYMENT_METHOD_PLANE_LABELS,
  carriesPaymentMethod,
  type PaymentMethodT,
} from '@/lib/constants/transfers'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { transferFormSchema } from '@/lib/schemas/transfer-form'
import type { CreateTransferFormT } from '@/lib/schemas/transfer'
import type { ReferenceDataT } from '@/types/reference-data'
import { getDefaultCashRegister } from '@/lib/utils/default-cash-register'
import { warsawToday } from '@/lib/utils/days'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { strandsDeposit } from '@/lib/kosztorys/off-plane-deposits'
import { DEPOSIT_PLANE_INSTRUMENTAL } from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/utils/format-currency'
import { netFromGross } from '@/lib/kosztorys/net-gross-amounts'
import {
  AmountField,
  CashRegisterField,
  DateField,
  DescriptionField,
  EntityComboboxField,
  PaymentMethodField,
} from '@/components/forms/form-fields'
import { PlaneAmountField } from '@/components/forms/deposit-form/plane-amount-field'
import FormFooter from '../form-components/form-footer'
import { createTransferAction } from '@/lib/actions/transfers'
import { useDepositFormStore } from '@/stores/form-stores'
import type { DepositFormValuesT } from './deposit-form-api'
import { isBookableInvestment, isOfferedForBooking } from '@/lib/constants/investment-lock'

type DepositFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

const FORM_ID = 'deposit'

export function DepositForm({ referenceData, onSubmitSuccess, keepOpen }: DepositFormPropsT) {
  const depositTypes = isAdminOrOwnerRole(referenceData.currentUserRole)
    ? DEPOSIT_UI_TYPES
    : DEPOSIT_UI_TYPES.filter((t) => t !== 'COMPANY_FUNDING')

  const investmentFromUrl = useInvestmentFromUrl(referenceData.investments)

  const investmentFor = (investmentId: string | undefined) =>
    referenceData.investments.find((i) => String(i.id) === investmentId)

  const rateFor = (investmentId: string | undefined) =>
    investmentFor(investmentId)?.vatRate ?? DEFAULT_VAT

  const { form, reset, submitConfirm } = useManagedForm<DepositFormValuesT, CreateTransferFormT>({
    formId: FORM_ID,
    useFormStore: useDepositFormStore,
    schema: transferFormSchema,
    defaultValues: {
      description: '',
      amount: '',
      amountGross: '',
      date: warsawToday(),
      type: 'INVESTOR_DEPOSIT',
      paymentMethod: 'CASH',
      vatPlane: 'NET',
      sourceRegister: getDefaultCashRegister(referenceData),
      investment: investmentFromUrl,
    },
    mergeStored: (stored) => {
      const investment = stored.investment || investmentFromUrl
      const vatPlane = planeFor(stored.type, stored.paymentMethod)
      // A draft saved before the two kwota fields existed holds one amount, on the side its own
      // plane named
      const restored =
        stored.amountGross === undefined
          ? vatPlane === 'GROSS'
            ? {
                amount: netFromGross(stored.amount, rateFor(investment)),
                amountGross: stored.amount,
              }
            : { amount: stored.amount, amountGross: '' }
          : { amount: stored.amount, amountGross: stored.amountGross }

      return { ...stored, ...restored, investment, vatPlane }
    },
    keepOpen,
    keepAfterSave: ['date'],
    successMessage: 'Wpłata dodana',
    onSubmitSuccess,
    action: createTransferAction,
    confirmBeforeSubmit: (value) => {
      const mode = investmentFor(value.investment)?.settlementMode
      if (value.type !== 'INVESTOR_DEPOSIT' || !mode) return null
      if (!strandsDeposit(planeFor(value.type, value.paymentMethod), mode)) return null

      return {
        title: 'Ta wpłata nie policzy się w rozliczeniu',
        description: `Inwestycja jest rozliczana brutto, a wpłata ${DEPOSIT_PLANE_INSTRUMENTAL.NET} nie ma kwoty brutto — ${formatPLN(Number(value.amount))} zostanie poza rozliczeniem. Jeśli klient płaci obiema drogami, ustaw tej inwestycji rozliczenie mieszane.`,
        confirmLabel: 'Zapisz mimo to',
        cancelLabel: 'Popraw',
      }
    },
    toData: (value) => ({
      description: value.description,
      amount: Number(value.vatPlane === 'GROSS' ? value.amountGross : value.amount),
      netAmount:
        value.type === 'INVESTOR_DEPOSIT' && value.vatPlane === 'GROSS'
          ? Number(value.amount)
          : undefined,
      date: value.date,
      type: value.type as CreateTransferFormT['type'],
      paymentMethod: carriesPaymentMethod(value.type)
        ? (value.paymentMethod as PaymentMethodT)
        : null,
      // Hiding a field does not clear it: the investment is seeded from the URL and vatPlane
      // has a default, so both would ride along on a type that carries neither.
      vatPlane:
        value.type === 'INVESTOR_DEPOSIT' && isVatPlane(value.vatPlane)
          ? value.vatPlane
          : undefined,
      sourceRegister: Number(value.sourceRegister),
      investment:
        showsInvestment(value.type) && value.investment ? Number(value.investment) : undefined,
    }),
  })

  const currentType = useStore(form.store, (s) => s.values.type)
  const currentInvestment = useStore(form.store, (s) => s.values.investment)
  const currentPlane = useStore(form.store, (s) => s.values.vatPlane)
  const vatRate = rateFor(currentInvestment)

  return (
    <>
      <FormShell form={form} onReset={reset}>
        <FieldGroup>
          <form.AppField
            name="type"
            listeners={{
              onChange: ({ value }) => {
                form.setFieldValue(
                  'investment',
                  investmentForType(value, form.getFieldValue('investment'), investmentFromUrl),
                )
                form.setFieldValue(
                  'vatPlane',
                  planeFor(form.getFieldValue('type'), form.getFieldValue('paymentMethod')),
                )
                form.setFieldValue('amount', '')
                form.setFieldValue('amountGross', '')
              },
            }}
          >
            {(field) => (
              <field.Select label="Typ wpłaty" showError>
                {depositTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TRANSFER_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </field.Select>
            )}
          </form.AppField>

          {showsInvestment(currentType) && (
            <EntityComboboxField
              form={form}
              variant="investment"
              items={referenceData.investments.filter(isBookableInvestment)}
              fixedFilter={isOfferedForBooking}
            />
          )}

          <DescriptionField form={form} placeholder="Opis wpłaty" />

          <div className="flex items-start gap-4">
            {carriesPaymentMethod(currentType) && (
              <PaymentMethodField
                form={form}
                listeners={{
                  onChange: ({ value }) =>
                    form.setFieldValue('vatPlane', planeFor(form.getFieldValue('type'), value)),
                }}
                fieldClassName="min-w-0 flex-1"
                labels={PAYMENT_METHOD_PLANE_LABELS}
              />
            )}
            <DateField form={form} fieldClassName="w-40" />
          </div>

          <div className="flex items-start gap-4">
            {currentType === 'INVESTOR_DEPOSIT' ? (
              <PlaneAmountField
                form={form}
                vatRate={vatRate}
                plane={isVatPlane(currentPlane) ? currentPlane : 'NET'}
                fieldClassName="min-w-0 flex-1"
              />
            ) : (
              <AmountField form={form} fieldClassName="min-w-0 flex-1" />
            )}
          </div>

          <CashRegisterField
            form={form}
            name="sourceRegister"
            cashRegisters={referenceData.cashRegisters}
          />
        </FieldGroup>

        <FormFooter className="mt-6" awaitingAnswer={submitConfirm.open} />
      </FormShell>

      <ConfirmDialog {...submitConfirm} />
    </>
  )
}
