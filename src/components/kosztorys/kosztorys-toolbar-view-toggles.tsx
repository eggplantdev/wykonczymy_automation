'use client'

import { KosztorysToolbarToggle } from '@/components/kosztorys/kosztorys-toolbar-toggle'
import { KosztorysViewMenu } from '@/components/kosztorys/kosztorys-view-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'
import { VIEWS, VIEW_LEGEND } from '@/components/kosztorys/kosztorys-toolbar-options'

export function KosztorysToolbarViewToggles() {
  const { view, setView } = useKosztorysEditorContext()

  return (
    <>
      <KosztorysToolbarToggle
        legend={VIEW_LEGEND}
        options={VIEWS}
        value={view}
        onChange={setView}
        aria-label="Widok cen"
      />
      <KosztorysViewMenu />
    </>
  )
}
