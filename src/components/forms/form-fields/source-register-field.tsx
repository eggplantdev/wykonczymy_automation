import { CashRegisterField } from './cash-register-field'
import { SaldoDisplay } from '@/components/ui/saldo-display'
import type { ReferenceItemT } from '@/types/reference-data'

type SourceRegisterFieldPropsT = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any
  cashRegisters: ReferenceItemT[]
  label?: string
  saldo: number | null
  isSaldoLoading: boolean
  fetchSaldo: (registerId: string) => void
}

export function SourceRegisterField({
  form,
  cashRegisters,
  label = 'Kasa',
  saldo,
  isSaldoLoading,
  fetchSaldo,
}: SourceRegisterFieldPropsT) {
  return (
    <>
      <CashRegisterField
        form={form}
        cashRegisters={cashRegisters}
        label={label}
        listeners={{ onChange: ({ value }: { value: string }) => fetchSaldo(value) }}
      />
      {isSaldoLoading && <p className="text-muted-foreground text-sm">Ładowanie salda...</p>}
      {saldo !== null && !isSaldoLoading && <SaldoDisplay saldo={saldo} label="Aktualne saldo" />}
    </>
  )
}
