'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { NewItemDialog } from '@/components/kosztorys/editor/dialogs/new-item/new-item-dialog'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { DEFAULT_SECTION_NAME } from '@/lib/kosztorys/constants'
import type { NewItemPlacementT } from '@/lib/kosztorys/types'

// „Nowa praca" has five triggers across the toolbar, the sekcja band and menu, and a row's „…", so
// like CataloguePickerHost it wraps the whole body. `children` is a prop for the same reason: opening
// the dialog re-renders only this host, never the grid (EX-496). The editor hook reaches it through
// a ref it owns, which this host fills.
export function NewItemHost({ children }: { children: ReactNode }) {
  const {
    rows,
    sections,
    workCatalogue,
    newItemDialogRef,
    placeNewItem,
    recoverStaleTree,
    isTemplate,
  } = useKosztorysEditorContext()
  const [placement, setPlacement] = useState<NewItemPlacementT | null>(null)

  useEffect(() => {
    newItemDialogRef.current = setPlacement
    return () => {
      newItemDialogRef.current = null
    }
  }, [newItemDialogRef])

  // Resolved at render, not at open: the toolbar's zero-sekcje path opens the dialog for a sekcja
  // that reaches context in the same render as the placement.
  const anchorRow =
    placement?.kind === 'next-to'
      ? rows.find((row) => row.id === placement.anchorItemId)
      : undefined
  const sectionId = placement?.kind === 'end' ? placement.sectionId : anchorRow?.sectionId
  const sectionName =
    sections.find((section) => section.sectionId === sectionId)?.sectionName ?? DEFAULT_SECTION_NAME

  return (
    <>
      {children}
      {placement && (
        <NewItemDialog
          placement={placement}
          sectionName={sectionName}
          anchorDescription={anchorRow?.description ?? undefined}
          workCatalogue={workCatalogue ?? []}
          isTemplate={isTemplate}
          kosztorysUnits={rows.flatMap((row) => (row.unit ? [row.unit] : []))}
          onPlaced={placeNewItem}
          onStaleTree={recoverStaleTree}
          onClose={() => setPlacement(null)}
        />
      )}
    </>
  )
}
