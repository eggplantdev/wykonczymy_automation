'use client'

import { useState, startTransition } from 'react'
import { DeleteButton } from '@/components/ui/row-actions/delete-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EditCatalogueItemDialog } from '@/components/dialogs/edit-catalogue-item-dialog'
import { useCatalogueItemTemplates } from '@/hooks/use-catalogue-item-templates'
import { deleteCatalogueItemAction } from '@/lib/actions/work-catalogue'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

type PropsT = {
  item: WorkCatalogueItemT
  categorySuggestions: readonly string[]
}

export function CatalogueRowActions({ item, categorySuggestions }: PropsT) {
  const [confirming, setConfirming] = useState(false)
  const { templateNames, loadTemplateNames } = useCatalogueItemTemplates(item.id)

  const onDelete = () => {
    startTransition(async () => {
      const res = await settleAction(() => deleteCatalogueItemAction(item.id))
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć pozycji', 'error')
      toastMessage('Usunięto pozycję z katalogu.', 'success')
      setConfirming(false)
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <EditCatalogueItemDialog item={item} categorySuggestions={categorySuggestions} />

      <DeleteButton
        label="Usuń z katalogu"
        onClick={() => {
          loadTemplateNames()
          setConfirming(true)
        }}
      />

      <ConfirmDialog
        open={confirming}
        title="Usunąć pozycję z katalogu i szablonów?"
        description={
          <>
            Kosztorysy, do których tę pracę już wstawiono, zostają bez zmian — mają własną kopię
            ceny i stawek.
            {templateNames.length > 0 && (
              <> Zniknie natomiast z szablonów: {templateNames.join(', ')}.</>
            )}
          </>
        }
        confirmLabel="Usuń"
        onConfirm={onDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
