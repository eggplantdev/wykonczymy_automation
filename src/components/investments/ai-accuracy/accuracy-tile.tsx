import { Panel } from '@/components/ui/panel'
import { cn } from '@/lib/utils/cn'

const TONES = {
  default: '',
  success: 'text-chart-green',
  error: 'text-destructive',
} as const

type PropsT = {
  label?: string
  value: string
  caption: string
  tone?: keyof typeof TONES
}

export function AccuracyTile({ label, value, caption, tone = 'default' }: PropsT) {
  return (
    <Panel className="grid content-start gap-1 p-4">
      {label && <span className="text-muted-foreground text-xs">{label}</span>}
      <span className={cn('text-3xl font-semibold tabular-nums', TONES[tone])}>{value}</span>
      <span className="text-sm">{caption}</span>
    </Panel>
  )
}
