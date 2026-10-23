import { cn } from '@/lib/utils/cn'
import { formatWholePercent } from './format'

export type ShareSegmentT = {
  id: string
  label: string
  percent: number
  swatch: string
  detail?: string
}

export function AccuracyShareBar({
  caption,
  segments,
}: {
  caption: string
  segments: ShareSegmentT[]
}) {
  return (
    <figure className="grid gap-2">
      <figcaption className="text-muted-foreground text-xs">{caption}</figcaption>
      <div className="bg-muted flex h-3 gap-0.5 overflow-hidden rounded-full">
        {segments
          .filter((segment) => segment.percent > 0)
          .map((segment) => (
            <div
              key={segment.id}
              className={cn('h-full first:rounded-l-full last:rounded-r-full', segment.swatch)}
              style={{ width: `${segment.percent}%` }}
            />
          ))}
      </div>
      <ul className="grid gap-1 text-xs">
        {segments.map((segment) => (
          <li key={segment.id} className="flex items-center gap-2">
            <span className={cn('size-2.5 shrink-0 rounded-xs', segment.swatch)} />
            <span className="min-w-0 truncate">{segment.label}</span>
            <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
              {segment.detail && `${segment.detail} · `}
              {formatWholePercent(segment.percent)}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
