'use client'

import { useHeaderFieldsStore } from '@/stores/header-fields-store'
import { formatPLN } from '@/lib/format-currency'
import { BILANS_LABEL, calculateBilans } from '@/lib/export/header-fields'
import { StatCard } from '@/components/ui/stat-card'
import { cn } from '@/lib/cn'
import type { HeaderFieldT } from '@/types/export'

type InvestmentStatsPropsT = {
  readonly fields: readonly HeaderFieldT[]
}

export function InvestmentStats({ fields }: InvestmentStatsPropsT) {
  const visibility = useHeaderFieldsStore((s) => s.visibility)
  const toggle = useHeaderFieldsStore((s) => s.toggle)

  const bilans = calculateBilans(fields, visibility)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map((field) => {
        const isVisible = visibility[field.label] !== false
        const isBilans = field.label === BILANS_LABEL
        const displayValue = isBilans ? formatPLN(bilans) : field.value

        return (
          <button
            key={field.label}
            type="button"
            onClick={() => toggle(field.label)}
            className="text-left"
            aria-pressed={isVisible}
            aria-label={`${isVisible ? 'Ukryj' : 'Pokaż'} ${field.label}`}
          >
            <StatCard
              label={field.label}
              value={displayValue}
              className={cn(
                'transition-opacity',
                !isVisible && 'opacity-40',
                isVisible && 'hover:ring-primary/50 cursor-pointer hover:ring-2',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
