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
import { today } from '@/lib/utils/date'
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
import { isBookableInvestment } from '@/lib/constants/investment-lock'

type DepositFormPropsT = {
  referenceData: ReferenceDataT
  onSubmitSuccess: () => void
  keepOpen?: boolean
}

const FORM_ID = 'deposit'

export function DepositForm({ referenceData, onSubmitSuccess, keepOpen }: DepositFormPropsT) {
  // COMPANY_FUNDING visible only to admin/owner — managers see other deposit types
  const depositTypes = isAdminOrOwnerRole(referenceData.currentUserRole)
    ? DEPOSIT_UI_TYPES
    : DEPOSIT_UI_TYPES.filter((t) => t !== 'COMPANY_FUNDING')

  // Fills the select only when it would otherwise be empty — a draft that already names an
  // investment keeps it, so navigating between investments never rewrites a half-filled form.
  const investmentFromUrl = useInvestmentFromUrl(referenceData.investments)

  // The stawka the netto suggestion is computed at is the investment's own — before one is picked,
  // the default keeps the suggestion usable rather than freezing it.
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
      date: today(),
      type: 'INVESTOR_DEPOSIT',
      paymentMethod: 'CASH',
      vatPlane: 'NET',
      sourceRegister: getDefaultCashRegister(referenceData),
      investment: investmentFromUrl,
    },
    mergeStored: (stored) => {
      const investment = stored.investment || investmentFromUrl
      // The method is the plane, so a draft never restores the two out of step — whatever it stored
      // in `vatPlane` (including a value from before the method drove it) gives way to the method.
      const vatPlane = planeFor(stored.type, stored.paymentMethod)
      // A draft saved before the two kwota fields existed holds one amount, on the side its own
      // plane named: a przelew therefore restores with its netto merely suggested, and a gotówka
      // with no brutto at all — that kwota never existed.
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
    successMessage: 'Wpłata dodana',
    onSubmitSuccess,
    action: createTransferAction,
    // Asked, never refused. The wpłata happened — the owner is told what booking it this way costs
    // and decides. Refusing would only teach him to mistype the method to get past the door, and the
    // tag cannot be corrected afterwards (anulowanie + zaksięgowanie na nowo is the only path).
    //
    // The remedy it names is the TRYB, not the wpłata (owner, 2026-08-23): an investment taking money
    // both ways is a mieszana one, and switching it rescues this kwota — where re-booking a gotówka
    // as a przelew would be typing a faktura that does not exist.
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
      // `amount` is always the money that moved, on the plane `vatPlane` names.
      amount: Number(value.vatPlane === 'GROSS' ? value.amountGross : value.amount),
      // …and a przelew carries the faktura's netto beside it. Stored, not derived — the settlement
      // reads it back rather than dividing by a rate that does not fit the whole bill. A gotówka
      // sends nothing: it has no netto twin, it IS the netto.
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
      // has a default, so both would ride along on a type that carries neither. The hook
      // would null the investment server-side, but a submitted vatPlane has no such guard.
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
                // Blanked, not reset — see clear-fields-for-type.
                form.setFieldValue(
                  'investment',
                  investmentForType(value, form.getFieldValue('investment'), investmentFromUrl),
                )
                // Not reset but rederived — the method survives the type change, and a plane that
                // disagreed with it would put the wrong kwota on screen.
                form.setFieldValue(
                  'vatPlane',
                  planeFor(form.getFieldValue('type'), form.getFieldValue('paymentMethod')),
                )
                // Both kwota fields go with it — the pair belongs to the wpłata being typed, and half
                // of a previous one is worse than none.
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

          {/* Directly under the type, same slot the wydatek form gives it — the investment is what the
            rest of the form is about, not a trailing detail. Which types offer it is the predicate's
            call, not this form's — the netto/brutto kwota pair is a separate, INVESTOR_DEPOSIT-only
            axis. */}
          {showsInvestment(currentType) && (
            <EntityComboboxField
              form={form}
              variant="investment"
              items={referenceData.investments.filter(isBookableInvestment)}
            />
          )}

          <DescriptionField form={form} placeholder="Opis wpłaty" />

          {/* Above the kwota, because on a wpłata od inwestora it is the method that decides WHICH
            kwoty are being typed: gotówka is one, przelew is two off the faktura. The date rides
            here rather than beside them — a przelew already puts two inputs in that row, and a
            third squeezed the labels into two lines. */}
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

        <FormFooter className="mt-6" />
      </FormShell>

      <ConfirmDialog {...submitConfirm} />
    </>
  )
}
