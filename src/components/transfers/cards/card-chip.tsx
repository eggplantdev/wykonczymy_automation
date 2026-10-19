import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
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
    <Badge
      tone="muted"
      appearance="outline"
      className={cn('max-w-full gap-1 font-normal', CHIP_BORDER[kind])}
    >
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="truncate">{children}</span>
    </Badge>
  )
}
