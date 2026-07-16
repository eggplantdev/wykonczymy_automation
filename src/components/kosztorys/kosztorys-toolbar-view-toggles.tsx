'use client'

import { KosztorysToolbarToggle } from '@/components/kosztorys/kosztorys-toolbar-toggle'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'
import {
  AXIS_LEGEND,
  MONEY_AXES,
  PROGRESS_DISPLAYS,
  PROGRESS_DISPLAY_LEGEND,
  VIEWS,
  VIEW_LEGEND,
} from '@/components/kosztorys/kosztorys-toolbar-options'

export function KosztorysToolbarViewToggles() {
  const { view, setView, moneyAxis, setMoneyAxis, progressDisplay, setProgressDisplay } =
    useKosztorysEditorContext()

  return (
    <>
      <KosztorysToolbarToggle
        legend={VIEW_LEGEND}
        options={VIEWS}
        value={view}
        onChange={setView}
        aria-label="Widok cen"
      />
      <KosztorysToolbarToggle
        legend={AXIS_LEGEND}
        options={MONEY_AXES}
        value={moneyAxis}
        onChange={setMoneyAxis}
        aria-label="Kwoty w tabeli"
      />
      <KosztorysToolbarToggle
        legend={PROGRESS_DISPLAY_LEGEND}
        options={PROGRESS_DISPLAYS}
        value={progressDisplay}
        onChange={setProgressDisplay}
        aria-label="Etapy w tabeli"
      />
    </>
  )
}
