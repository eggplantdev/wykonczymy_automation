'use client'

import { Button } from '@/components/ui/button'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysToolbarAddButtons() {
  const { activeSectionId, subtotals, handleAddItem, handleAddSection, handleAddStage } =
    useKosztorysEditorContext()

  // Section the ＋ pozycja button adds to: the filtered section if one is active, else the last
  // section. Always set while ≥1 section exists, so the button stays visible on a fresh
  // single-section kosztorys instead of hiding until a filter is picked (EX-463).
  const addItemSectionId = activeSectionId ?? subtotals.at(-1)?.sectionId ?? null

  return (
    <>
      {addItemSectionId != null && (
        <Button size="sm" variant="outline" onClick={() => handleAddItem(addItemSectionId)}>
          ＋ pozycja
        </Button>
      )}
      <Button size="sm" variant="outline" onClick={handleAddSection}>
        ＋ sekcja
      </Button>
      <Button size="sm" variant="outline" onClick={handleAddStage}>
        ＋ etap
      </Button>
    </>
  )
}
