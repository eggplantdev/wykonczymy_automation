'use client'

import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormDialog } from '@/components/ui/form-dialog'
import { EquipmentForm } from '@/components/forms/equipment-form/equipment-form'
import { updateEquipmentAction } from '@/lib/actions/equipment'
import { makeModel } from '@/lib/equipment/rows'
import type { EquipmentRowT } from '@/lib/equipment/types'

export function EditEquipmentDialog({ equipment }: { equipment: EquipmentRowT }) {
  const formId = `edit-equipment-${equipment.id}`

  return (
    <FormDialog
      formId={formId}
      showKeepOpen={false}
      trigger={
        <Button size="sm" variant="outline" aria-label="Edytuj sprzęt">
          <Pencil />
          <span>Edytuj</span>
        </Button>
      }
      title="Edytuj sprzęt"
      description={makeModel(equipment)}
    >
      {(onSubmitSuccess, keepOpen) => (
        <EquipmentForm
          formId={formId}
          defaultValues={{
            name: equipment.name,
            serialNumber: equipment.serialNumber,
            make: equipment.make,
            model: equipment.model,
            purchaseDate: equipment.purchaseDate ?? '',
            warrantyUntil: equipment.warrantyUntil ?? '',
            purchasePrice: equipment.purchasePrice === null ? '' : String(equipment.purchasePrice),
            note: equipment.note,
            status: equipment.status,
          }}
          action={(data) => updateEquipmentAction(equipment.id, data)}
          successMessage="Sprzęt zaktualizowany"
          submitLabel="Zapisz"
          submittingLabel="Zapisywanie..."
          onSubmitSuccess={onSubmitSuccess}
          keepOpen={keepOpen}
          persistDraft={false}
        />
      )}
    </FormDialog>
  )
}
