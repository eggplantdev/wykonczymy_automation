import { daysLabel } from '@/lib/utils/deadline-label'
import { EXPIRED, type WarrantyBucketT } from '@/lib/equipment/warranty-thresholds'
import { formatPLDate } from '@/lib/utils/format-date'
import { cn } from '@/lib/utils/cn'

type WarrantyCellPropsT = {
  warrantyUntil: string | null
  daysLeft: number | null
  bucket: WarrantyBucketT | null
  muted?: boolean
}

export function WarrantyCell({ warrantyUntil, daysLeft, bucket, muted }: WarrantyCellPropsT) {
  if (!warrantyUntil || daysLeft === null) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const expired = bucket === EXPIRED
  const urgent = !muted && !expired && bucket !== null

  return (
    <div className="flex flex-col leading-tight">
      <span
        className={cn(
          urgent && 'text-chart-orange font-medium',
          (muted || expired) && 'text-muted-foreground',
        )}
      >
        {formatPLDate(warrantyUntil)}
      </span>
      <span className={cn('text-xs', urgent ? 'text-chart-orange' : 'text-muted-foreground')}>
        {expired ? 'gwarancja wygasła' : daysLabel(daysLeft)}
      </span>
    </div>
  )
}
