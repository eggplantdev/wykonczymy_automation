'use client'

import { useState } from 'react'
import { formatPLN } from '@/lib/format-currency'
import { REGISTER_TYPE_BORDER_COLORS, REGISTER_TYPE_LABELS } from '@/lib/tables/cash-registers'
import { cn } from '@/lib/cn'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import { Button } from '../ui/button'
import { CashRegisterTypeT } from '../../types/reference-data'
import { Description } from '../ui/description'

function valueColor(value: number): string {
  return value >= 0 ? 'var(--color-chart-green)' : 'var(--color-destructive)'
}

type RegisterBalanceChartPropsT = {
  readonly data: readonly CashRegisterRowT[]
}

export function RegisterBalanceChart({ data }: RegisterBalanceChartPropsT) {
  const [hidden, setHidden] = useState<Set<CashRegisterTypeT>>(new Set())

  function toggle(type: CashRegisterTypeT) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  // Group by type — track balance and count
  const groups = new Map<CashRegisterTypeT, { balance: number; count: number }>()
  for (const cr of data) {
    const prev = groups.get(cr.type) ?? { balance: 0, count: 0 }
    groups.set(cr.type, { balance: prev.balance + cr.balance, count: prev.count + 1 })
  }

  const entries = Array.from(groups.entries())
  const total = entries
    .filter(([type]) => !hidden.has(type))
    .reduce((sum, [, { balance }]) => sum + balance, 0)

  if (entries.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {entries.map(([type, { balance, count }]) => {
          return (
            <Button
              variant="outline"
              key={type}
              onClick={() => toggle(type)}
              className={cn('border-2', hidden.has(type) && 'opacity-40')}
              style={{ borderColor: REGISTER_TYPE_BORDER_COLORS[type] }}
            >
              <span className="text-muted-foreground">
                {REGISTER_TYPE_LABELS[type]} ({count}):
              </span>
              <span className="font-medium" style={{ color: valueColor(balance) }}>
                {formatPLN(balance)}
              </span>
            </Button>
          )
        })}
      </div>

      <Description>
        Naciśnij wybraną kategorię lub wybierz filtry aby zaktualizować saldo.
      </Description>

      <Description>
        <span>Saldo: </span>
        <span className={cn('font-semibold', total >= 0 ? 'text-chart-green' : 'text-destructive')}>
          {formatPLN(total)}
        </span>
      </Description>
    </div>
  )
}
