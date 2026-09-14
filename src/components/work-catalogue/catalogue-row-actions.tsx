'use client'

import { useState, useTransition } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EditCatalogueItemDialog } from '@/components/dialogs/edit-catalogue-item-dialog'
import { clearLegacyMarkerAction, deleteCatalogueItemAction } from '@/lib/actions/work-catalogue'
import { hasLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'
import { toastMessage } from '@/lib/utils/toast'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

const LEGACY_ACTION_LABEL = 'Zdejmij dopisek „stary arkusz"'

type PropsT = {
  item: WorkCatalogueItemT
  categorySuggestions: readonly string[]
}

export function CatalogueRowActions({ item, categorySuggestions }: PropsT) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const onClearMarker = () => {
    startTransition(async () => {
      const res = await clearLegacyMarkerAction(item.id)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się zdjąć dopisku', 'error')
      toastMessage('Zdjęto dopisek „stary arkusz".', 'success')
    })
  }

  const onDelete = () => {
    startTransition(async () => {
      const res = await deleteCatalogueItemAction(item.id)
      if (!res.success) return toastMessage(res.error ?? 'Nie udało się usunąć pozycji', 'error')
      toastMessage('Usunięto pozycję z katalogu.', 'success')
      setConfirming(false)
    })
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {hasLegacyMarker(item.description) && (
        <SimpleTooltip content={LEGACY_ACTION_LABEL}>
          <Button
            size="xs"
            variant="ghost"
            className="px-1.5"
            aria-label={LEGACY_ACTION_LABEL}
            disabled={pending}
            onClick={onClearMarker}
          >
            <Check />
          </Button>
        </SimpleTooltip>
      )}

      <EditCatalogueItemDialog item={item} categorySuggestions={categorySuggestions} />

      <SimpleTooltip content="Usuń z katalogu">
        <Button
          size="xs"
          variant="ghostDestructive"
          className="px-1.5"
          aria-label="Usuń z katalogu"
          onClick={() => setConfirming(true)}
        >
          <Trash2 />
        </Button>
      </SimpleTooltip>

      <ConfirmDialog
        open={confirming}
        title="Usunąć pozycję z katalogu?"
        description="Kosztorysy, do których tę pracę już wstawiono, zostają bez zmian — mają własną kopię ceny i stawek."
        confirmLabel="Usuń"
        pending={pending}
        pendingLabel="Usuwam…"
        onConfirm={onDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  )
}
