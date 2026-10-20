import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { BADGE_BORDER_CLASS, type BadgeBorderT } from '@/components/ui/badge-border'
import { cn } from '@/lib/utils/cn'

const CHIP_BORDER = {
  register: 'chart-blue',
  worker: 'chart-yellow',
  category: 'chart-purple',
  paymentMethod: 'chart-teal',
  createdBy: 'border',
} as const satisfies Record<string, BadgeBorderT>

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
      appearance="outline"
      className={cn('max-w-full gap-1 font-normal', BADGE_BORDER_CLASS[CHIP_BORDER[kind]])}
    >
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="truncate">{children}</span>
    </Badge>
  )
}
