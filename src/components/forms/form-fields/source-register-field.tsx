import type { FormWithFieldT } from '@/components/forms/hooks/form-hooks'
import { CashRegisterField } from './cash-register-field'
import { SaveDefaultRegisterButton } from './save-default-register-button'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'
import type { ReferenceItemT } from '@/types/reference-data'

type SourceRegisterFieldPropsT = {
  form: FormWithFieldT<'sourceRegister'>
  cashRegisters: ReferenceItemT[]
  label?: string
  registerBalance: number | null
  isRegisterBalanceLoading: boolean
  fetchRegisterBalance: (registerId: string) => void
  // Opt-in: only the expense form books register after register in one sitting, which is what makes
  // re-pinning the default from inside the form worth a control.
  showSaveAsDefault?: boolean
  defaultCashRegisterId?: number
}

export function SourceRegisterField({
  form,
  cashRegisters,
  label = 'Kasa',
  registerBalance,
  isRegisterBalanceLoading,
  fetchRegisterBalance,
  showSaveAsDefault,
  defaultCashRegisterId,
}: SourceRegisterFieldPropsT) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <CashRegisterField
          form={form}
          name="sourceRegister"
          cashRegisters={cashRegisters}
          label={label}
          listeners={{ onChange: ({ value }: { value: string }) => fetchRegisterBalance(value) }}
        />
        {showSaveAsDefault && (
          <SaveDefaultRegisterButton form={form} defaultCashRegisterId={defaultCashRegisterId} />
        )}
      </div>
      {isRegisterBalanceLoading && (
        <p className="text-muted-foreground text-sm">Ładowanie salda...</p>
      )}
      {registerBalance !== null && !isRegisterBalanceLoading && (
        <SignedMoneyDisplay amount={registerBalance} label="Aktualne saldo" />
      )}
    </>
  )
}
