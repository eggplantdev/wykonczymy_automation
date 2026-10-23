import type { LucideIcon } from 'lucide-react'
import { Panel } from '@/components/ui/panel'
import { EYEBROW_CLASS } from '@/components/ui/section-header'
import { cn } from '@/lib/utils/cn'

const ACCENTS = {
  red: {
    stripe: 'from-chart-red to-chart-orange',
    icon: 'bg-chart-red/15 text-destructive',
    stat: 'text-destructive',
  },
  orange: {
    stripe: 'from-chart-orange to-chart-pink',
    icon: 'bg-chart-orange/15 text-section-orange-deep dark:text-chart-orange',
    stat: 'text-section-orange-deep dark:text-chart-orange',
  },
  pink: {
    stripe: 'from-chart-pink to-chart-purple',
    icon: 'bg-chart-pink/20 text-section-purple-deep dark:text-chart-pink',
    stat: 'text-section-purple-deep dark:text-chart-pink',
  },
  purple: {
    stripe: 'from-chart-purple to-chart-blue',
    icon: 'bg-chart-purple/15 text-section-purple-deep dark:text-chart-purple',
    stat: 'text-section-purple-deep dark:text-chart-purple',
  },
} as const

type PropsT = {
  order: number
  icon: LucideIcon
  accent: keyof typeof ACCENTS
  title: string
  stat?: string
  statCaption?: string
  children: React.ReactNode
}

export function AccuracyCauseCard({
  order,
  icon: Icon,
  accent,
  title,
  stat,
  statCaption,
  children,
}: PropsT) {
  const tone = ACCENTS[accent]

  return (
    <Panel
      as="section"
      className="relative grid content-start gap-4 overflow-hidden p-5 pt-6 shadow-sm"
    >
      <div aria-hidden className={cn('absolute inset-x-0 top-0 h-1 bg-linear-to-r', tone.stripe)} />
      <div className="flex items-center gap-3">
        <span className={cn('grid size-9 place-content-center rounded-full', tone.icon)}>
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className={EYEBROW_CLASS}>Powód {order}</span>
      </div>
      <h3 className="text-lg leading-snug font-semibold text-balance">{title}</h3>
      {stat && (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className={cn('text-4xl font-bold tabular-nums', tone.stat)}>{stat}</span>
          <span className="text-muted-foreground text-sm">{statCaption}</span>
        </p>
      )}
      <div className="grid gap-4 text-sm leading-relaxed">{children}</div>
    </Panel>
  )
}
