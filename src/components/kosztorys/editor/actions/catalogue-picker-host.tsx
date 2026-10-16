'use client'

import { createContext, use, useCallback, useState, type ReactNode } from 'react'
import { AddItemsFromCatalogueDialog } from '@/components/kosztorys/editor/dialogs/catalogue/add-items-from-catalogue-dialog'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

type OpenCataloguePickerT = (sectionId?: number) => void

const CataloguePickerContext = createContext<OpenCataloguePickerT | null>(null)

// `children` is a prop, not JSX built inside: opening the picker changes only this component's
// state, and React skips a subtree whose element identity is unchanged. That is what keeps the grid
// out of the re-render (EX-496).
export function CataloguePickerHost({ children }: { children: ReactNode }) {
  const {
    investmentId,
    rows,
    sections,
    workCatalogue,
    handleAppendedCatalogueItems,
    handleAddItem,
    handleAddSection,
  } = useKosztorysEditorContext()
  // `null` = closed; a member `sectionId` of `null` = open with no section chosen yet.
  const [target, setTarget] = useState<{ sectionId: number | null } | null>(null)
  const open = useCallback<OpenCataloguePickerT>(
    (sectionId) => setTarget({ sectionId: sectionId ?? null }),
    [],
  )

  return (
    <CataloguePickerContext value={open}>
      {children}
      {target && (
        <AddItemsFromCatalogueDialog
          investmentId={investmentId}
          catalogue={workCatalogue ?? []}
          sections={sections}
          kosztorysItems={rows}
          initialSectionId={target.sectionId}
          open
          onOpenChange={() => setTarget(null)}
          onInserted={handleAppendedCatalogueItems}
          onNewItem={async (sectionId, description) => {
            setTarget(null)
            const landing = sectionId ?? (await handleAddSection())
            if (landing !== undefined) handleAddItem(landing, description)
          }}
        />
      )}
    </CataloguePickerContext>
  )
}

export function useCataloguePicker() {
  const open = use(CataloguePickerContext)
  if (!open) throw new Error('useCataloguePicker must be used within CataloguePickerHost')
  return open
}
