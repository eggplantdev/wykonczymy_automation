import { daysLabel } from '@/lib/utils/deadline-label'
import { EXPIRED, type WarrantyBucketT } from '@/lib/equipment/warranty-thresholds'
import { formatPLDate } from '@/lib/utils/format-date'
import { cn } from '@/lib/utils/cn'

type WarrantyCellPropsT = {
  warrantyUntil: string | null
  daysLeft: number | null
  bucket: WarrantyBucketT | null
  /** An item that is sold, lost or retired carries no urgency — its warranty is history. */
  muted?: boolean
}

/**
 * Its own component rather than the fleet's `DeadlineCell`: that one renders „bezterminowo" from an
 * `exempt` flag and „brak danych" per inspection type, two concepts equipment does not have. What
 * they do share — the Polish phrasing of „za ile" — is `daysLabel`, so a cell and a mail can never
 * word the same figure differently.
 *
 * A lapsed warranty is stated, not alarmed: nothing can be done about it, so it renders muted while
 * an approaching one gets the colour.
 */
export function WarrantyCell({ warrantyUntil, daysLeft, bucket, muted }: WarrantyCellPropsT) {
  // No date is not an alarm — plenty of tools are bought without one, and a column of red would
  // train the owner to ignore the column.
  if (!warrantyUntil || daysLeft === null) {
    return <span className="text-muted-foreground text-xs">—</span>
  }

  const expired = bucket === EXPIRED
  const urgent = !muted && !expired && bucket !== null

  return (
    <div className="flex flex-col leading-tight">
      <span
        className={cn(
          'text-sm',
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
