import { Fragment } from 'react'
import Link from 'next/link'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import { Description } from '@/components/ui/description'
import { formatPLN } from '@/lib/utils/format-currency'
import type { RegisterBalanceMapT } from '@/lib/queries/balances'
import type { CashRegisterRefT } from '@/types/reference-data'

const COLS = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`

// An inactive kasa is still listed: it goes to the Kosz with its owner like any other.
export function OwnedRegistersSection({
  registers,
  balances,
  linkable,
}: {
  registers: CashRegisterRefT[]
  balances: RegisterBalanceMapT
  // `/kasa/[id]` is management-only, so the worker's own view lists the names as text.
  linkable: boolean
}) {
  const rows = registers.map((register) => ({
    ...register,
    balance: balances[String(register.id)] ?? 0,
  }))
  const total = rows.reduce((sum, row) => sum + row.balance, 0)

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Przypisane kasy</h2>
      {rows.length === 0 ? (
        <Description>Nie ma żadnej kasy.</Description>
      ) : (
        <SummaryTable cols={COLS} className="w-fit">
          <SummaryHeaderCell variant="label">Kasa</SummaryHeaderCell>
          <SummaryHeaderCell>Saldo</SummaryHeaderCell>
          {rows.map((row) => (
            <Fragment key={row.id}>
              <SummaryLabelCell note={row.active ? null : { text: 'nieaktywna' }}>
                {linkable ? (
                  <Link href={`/kasa/${row.id}`} className="hover:underline">
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}
              </SummaryLabelCell>
              <SummaryValueCell tone={row.balance < 0 ? 'error' : 'default'}>
                {formatPLN(row.balance)}
              </SummaryValueCell>
            </Fragment>
          ))}
          <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
          <SummaryValueCell weight="bold" tone={total < 0 ? 'error' : 'default'}>
            {formatPLN(total)}
          </SummaryValueCell>
        </SummaryTable>
      )}
    </div>
  )
}
