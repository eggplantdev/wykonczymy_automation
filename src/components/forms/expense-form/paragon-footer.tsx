'use client'

import type {
  BulkLineItemT,
  ReceiptGroupingT,
} from '@/components/forms/expense-form/bulk-expense-form'
import { ReceiptSelectionActions } from '@/components/forms/expense-form/receipt-selection-actions'
import { Description } from '@/components/ui/description'
import {
  DecisionProgressBadge,
  type DecisionStatusT,
} from '@/components/ui/decision-progress-badge'
import { Label } from '@/components/ui/label'
import type { DraftProgressT } from '@/lib/db/worker-expense-drafts'
import { formatPLN } from '@/lib/utils/format-currency'
import { toggleInSet } from '@/lib/utils/toggle-in-set'

type ParagonFooterPropsT = {
  progress: DraftProgressT
  hiddenStatuses: ReadonlySet<DecisionStatusT>
  onHiddenStatusesChange: (statuses: ReadonlySet<DecisionStatusT>) => void
  grouping: ReceiptGroupingT
  lineItems: BulkLineItemT[]
}

export function ParagonFooter({
  progress,
  hiddenStatuses,
  onHiddenStatusesChange,
  grouping,
  lineItems,
}: ParagonFooterPropsT) {
  const selected = lineItems.filter((item) => grouping.selectedIds.has(item.id))
  const selectedTotal = selected.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  return (
    <div className="bg-background sticky -bottom-4 z-10 -mx-4 mt-6 -mb-4 flex flex-wrap items-center gap-2 px-4 pt-3 pb-4 sm:-bottom-6 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6">
      <div className="space-y-2">
        <DecisionProgressBadge
          {...progress}
          hidden={hiddenStatuses}
          onToggle={(status) => onHiddenStatusesChange(toggleInSet(hiddenStatuses, status))}
        />
        <Description size="xs">Kliknij etykietę, aby ukryć lub pokazać te paragony.</Description>
      </div>
      <div className="ml-auto flex flex-col items-end gap-2">
        {selected.length > 0 && (
          <Label>
            Suma zaznaczonych ({selected.length}): {formatPLN(selectedTotal)}
          </Label>
        )}
        <ReceiptSelectionActions grouping={grouping} />
      </div>
    </div>
  )
}
