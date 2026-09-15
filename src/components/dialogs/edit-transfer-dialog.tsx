'use client'

import { EditButton } from '@/components/ui/row-actions/edit-button'
import { FormDialog } from '@/components/ui/form-dialog'
import { EditTransferForm } from '@/components/forms/edit-transfer-form/edit-transfer-form'
import { TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import { formatPLN } from '@/lib/utils/format-currency'
import type { TransferRowT } from '@/types/transfers'
import type { ReferenceDataBaseT } from '@/types/reference-data'

type EditTransferDialogPropsT = {
  row: TransferRowT
  referenceData: ReferenceDataBaseT
  canEdit: boolean
  /** What the tooltip says when `canEdit` is false. Defaults to the ownership rule. */
  disabledReason?: string
}

export function EditTransferDialog({
  row,
  referenceData,
  canEdit,
  disabledReason = 'Możesz edytować tylko swoje transakcje',
}: EditTransferDialogPropsT) {
  if (!canEdit) return <EditButton label="Edytuj transakcję" tooltip={disabledReason} disabled />

  return (
    <FormDialog
      formId={`edit-transfer-${row.id}`}
      showKeepOpen={false}
      trigger={<EditButton label="Edytuj transakcję" />}
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
