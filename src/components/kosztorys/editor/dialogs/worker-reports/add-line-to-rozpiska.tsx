'use client'

import { useState } from 'react'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { NewItemDialog } from '@/components/kosztorys/editor/dialogs/new-item/new-item-dialog'
import { CatalogueSwapDialog } from '@/components/kosztorys/editor/dialogs/worker-reports/catalogue-swap-dialog'
import type {
  catalogueSwap,
  LineDraftT,
} from '@/components/kosztorys/editor/dialogs/worker-reports/line-draft'
import { reviewedDescription } from '@/lib/kosztorys/worker-report/reviewed-description'
import { insertCatalogueItemsAction } from '@/lib/actions/catalogue-to-kosztorys'
import { pointReportLineAction } from '@/lib/actions/accept-worker-report'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { KosztorysItemT } from '@/lib/kosztorys/types'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import type { ReportLineT } from '@/lib/kosztorys/worker-report/types'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  line: ReportLineT
  // A podpowiedź opens the katalog on its own praca.
  entryId: number | undefined
  onChange: (lineId: number, patch: Partial<LineDraftT>) => void
  onClose: () => void
}

// The praca goes into the rozpiska now, not on „Zapisz zmiany”: from here on the line is an ordinary
// rozpiska line, and the server remembers its pozycja so a review closed unsaved finds it again. A
// pozycja the sekcja already holds takes the ilość instead of a twin.
export function AddLineToRozpiska({ line, entryId, onChange, onClose }: PropsT) {
  const {
    investmentId,
    rows,
    sections,
    workCatalogue,
    isTemplate,
    handleAppendedCatalogueItems,
    placeNewItem,
    recoverStaleTree,
  } = useKosztorysEditorContext()
  const catalogue = workCatalogue ?? []
  const [newItem, setNewItem] = useState<{ sectionId: number; description: string }>()

  const pointAt = (item: Pick<KosztorysItemT, 'id' | 'catalogueItemId'>) => {
    onChange(line.id, {
      catalogueId: item.catalogueItemId ?? undefined,
      matchedItemIds: [item.id],
      itemId: item.id,
    })
    if (line.kind !== 'extra') return
    void settleAction(() => pointReportLineAction(investmentId, line.id, item.id)).then(
      (result) => {
        if (!result.success) toastMessage(result.error, 'error')
      },
    )
  }

  const swapInto = async (
    entry: WorkCatalogueItemT,
    sectionId: number,
    held: ReturnType<typeof catalogueSwap>,
  ) => {
    if (held.matchedItemIds.length > 0) {
      onChange(line.id, held)
      return true
    }
    const result = await settleAction(() => insertCatalogueItemsAction(sectionId, [entry.id]))
    if (!result.success) {
      toastMessage(result.error ?? 'Nie udało się dodać pracy do rozpiski', 'error')
      return false
    }
    for (const warning of result.data.warnings) toastMessage(warning, 'warning', 6000)
    handleAppendedCatalogueItems(result.data.section, false)
    const [item] = result.data.section.items
    pointAt(item)
    return true
  }

  if (newItem) {
    return (
      <NewItemDialog
        placement={{ kind: 'end', sectionId: newItem.sectionId }}
        sectionName={
          sections.find((section) => section.sectionId === newItem.sectionId)?.sectionName ??
          DEFAULT_SECTION_NAME
        }
        initialValues={{ description: newItem.description, unit: line.unit }}
        workCatalogue={catalogue}
        isTemplate={isTemplate}
        kosztorysUnits={rows.flatMap((row) => (row.unit ? [row.unit] : []))}
        canKeepOpen={false}
        onPlaced={(item, placement) => {
          placeNewItem(item, placement)
          pointAt(item)
        }}
        onStaleTree={recoverStaleTree}
        onClose={onClose}
      />
    )
  }

  return (
    <CatalogueSwapDialog
      catalogue={catalogue}
      kosztorysItems={rows}
      sectionOptions={sections.map((section) => ({
        value: String(section.sectionId),
        label: section.sectionName,
      }))}
      initialSectionId={String(
        sections.find((section) => section.sectionName === line.sectionName)?.sectionId ?? '',
      )}
      initialSelectedId={entryId}
      reported={{ description: reviewedDescription(line), unit: line.unit }}
      onPick={swapInto}
      onNewItem={(sectionId, searchTerm) =>
        setNewItem({ sectionId, description: searchTerm || reviewedDescription(line) })
      }
      onClose={onClose}
    />
  )
}
