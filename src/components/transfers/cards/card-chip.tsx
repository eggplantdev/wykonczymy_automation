import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

const CHIP_BORDER = {
  register: 'border-chart-blue',
  worker: 'border-chart-yellow',
  category: 'border-chart-purple',
  paymentMethod: 'border-chart-teal',
  createdBy: 'border-border',
} as const

type ChipKindT = keyof typeof CHIP_BORDER

export function CardChip({
  kind,
  label,
  children,
}: {
  kind: ChipKindT
  label: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs',
        CHIP_BORDER[kind],
      )}
    >
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="truncate">{children}</span>
    </span>
  )
}
