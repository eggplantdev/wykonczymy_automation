'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { FormDialog } from '@/components/dialogs/form-dialog'
import { EditTransferForm } from '@/components/forms/edit-transfer-form/edit-transfer-form'
import { TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/format-currency'
import type { TransferRowT } from '@/lib/tables/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'

type EditTransferDialogPropsT = {
  readonly row: TransferRowT
  readonly referenceData: ReferenceDataBaseT
  readonly canEdit: boolean
}

export function EditTransferDialog({ row, referenceData, canEdit }: EditTransferDialogPropsT) {
  if (!canEdit) {
    return (
      <SimpleTooltip content="Możesz edytować tylko swoje transakcje">
        <span tabIndex={0}>
          <Button variant="ghost" size="icon" disabled aria-label="Edytuj transakcję">
            <Pencil className="h-4 w-4" />
          </Button>
        </span>
      </SimpleTooltip>
    )
  }

  return (
    <FormDialog
      formId={`edit-transfer-${row.id}`}
      showKeepOpen={false}
      trigger={
        <Button variant="ghost" size="icon" aria-label="Edytuj transakcję">
          <Pencil className="h-4 w-4" />
        </Button>
      }
      title="Edytuj transakcję"
      description={`${TRANSFER_TYPE_LABELS[row.type]} · ${formatPLN(row.amount)}`}
    >
      {(onSubmitSuccess, keepOpen) => (
        <EditTransferForm
          row={row}
          referenceData={referenceData}
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
        />
      )}
    </FormDialog>
  )
}
