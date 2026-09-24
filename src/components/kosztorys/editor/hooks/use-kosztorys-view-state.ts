'use client'

import { useState } from 'react'
import { useEngagedConditions } from '@/components/kosztorys/editor/hooks/use-engaged-conditions'
import { useFitRowsToContent } from '@/components/kosztorys/editor/hooks/use-fit-rows-to-content'
import { usePriceView } from '@/components/kosztorys/editor/hooks/use-price-view'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import {
  clientConditionIds,
  engagedPlane,
  isFoldSuppressed,
} from '@/lib/kosztorys/row-conditions/queries'
import type { SortPickT, SortStateT } from '@/lib/kosztorys/row-view'

type ArgsT = {
  investmentId: number
  preview: boolean
  // The investment's stored client-view settings. Only consumed under `preview`.
  clientView?: ClientViewSettingsT
  // The szablon workbench, which pins the base plane — see `view` below.
  isWorkshop?: boolean
}

const EMPTY_COLLAPSED: ReadonlySet<number> = new Set()

// How the grid is being read — plane, search, sort, folds, guides. Touches no rows, stages or actions.
export function useKosztorysViewState({
  investmentId,
  preview,
  clientView,
  isWorkshop = false,
}: ArgsT) {
  const [persistedView, setView] = usePriceView(investmentId)
  const [search, setSearch] = useState('')
  // Persisted per investment, so yesterday's filter is still on. Under the preview the owner's picks
  // are dropped and `clientConditionIds` answers — it owns what may reach a client.
  const {
    engagedIds: persistedConditionIds,
    toggle: toggleCondition,
    toggleExclusive: toggleConditionExclusive,
    setMany: setConditions,
    clear: clearConditions,
  } = useEngagedConditions(investmentId)
  // „Pokaż wszystkie pozycje" — the investor's one-visit override of the owner's hide. Not persisted:
  // every visit opens on the document the owner curated.
  const [showAllRows, setShowAllRows] = useState(false)
  const engagedConditionIds = preview
    ? clientConditionIds(clientView?.hideEmptyRows && !showAllRows)
    : persistedConditionIds
  // Rides the engaged problem on top of the stored plane, never written to it. Derived, not
  // remembered: the problem persists and a plane wouldn't, so a reload would restore the narrowing
  // without the view it is judged on. An explicit switch still overrules it, problem left engaged.
  const [viewPickedManually, setViewPickedManually] = useState(false)
  const problemPlane = viewPickedManually ? undefined : engagedPlane(engagedConditionIds)
  // Second half of the disclosure lock (allowlist is the first — see `assertDisclosurePair`). The
  // public page ships the full tree, so an unpinned plane would render a subcontractor view to any
  // client who set localStorage['kosztorys-view:<id>'].
  //
  // The workbench pins the BASE plane for a different reason: its column list is closed
  // (WORKSHOP_VISIBLE_COLUMNS), so both crews' stawki are on screen at once and there is nothing for a
  // plane to choose — which is why the toolbar offers it no switch. The pin is what makes removing
  // that switch safe: `pickView` is the only writer of the stored view, so a browser parked on a crew
  // plane would otherwise stay there forever with no control to come back. The problem overlay stays
  // above it, because that is the gesture that walks the reader to a fault.
  const view = preview ? 'client' : (problemPlane ?? (isWorkshop ? 'client' : persistedView))
  const [sort, setSort] = useState<SortStateT>(null)
  // Folded sections, driven by a band's chevron and by the „Sekcje" menu (unticking folds rather
  // than filtering, so a hidden section still shows its total). Not persisted: a remembered fold
  // greets the next visit with rows the user can't see and doesn't remember hiding.
  const [storedCollapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  // Suppressed folds fold nothing, so the grid answers to this set, not the stored one — hence the
  // plain name here. `storedCollapsedSectionIds` has one legitimate reader: the „Widoczne sekcje"
  // ticks, which edit the selection and must show what applies once the narrowing comes off.
  const collapsedSectionIds = isFoldSuppressed(search, engagedConditionIds)
    ? EMPTY_COLLAPSED
    : storedCollapsedSectionIds

  // Persisted, unlike the folds: this only makes rows taller, it hides nothing. A dragged row still
  // wins — resolveRowHeight checks its override before the content.
  const [fitRowsToContent, toggleFitRowsToContent] = useFitRowsToContent()

  // A guide at the cursor instead of re-laying out the grid: that would be a re-render per pixel.
  // guideY is the row-resize twin.
  const [guideX, setGuideX] = useState<number | null>(null)
  const [guideY, setGuideY] = useState<number | null>(null)

  function pickView(next: PriceViewT) {
    setViewPickedManually(true)
    setView(next)
  }

  // Engaging a problem takes the reader to the plane it judges, because a stawka wykonawcy renders on
  // one plane only — narrowing to „z ujemną stawką wykonawcy … bez narzędzi" while sitting in „Inwestor"
  // showed the right pozycje with the wrong number in the column the problem had just revealed. Every
  // pick hands the plane back to the problem list, so a problem about no particular plane (bez ceny
  // j.m., etapy) reads in the stored plane, and so does the grid once no problem is engaged at all.
  function pickProblem(id: string, within: Iterable<string>) {
    toggleConditionExclusive(id, within)
    setViewPickedManually(false)
  }

  // „Zresetuj filtry" is one button wherever it appears, so it undoes everything that hides pozycje:
  // the conditions, the folds and the search phrase alike. Two half-resets would leave the user
  // clicking one and still facing a short grid.
  //
  // Sort is deliberately untouched: it reorders pozycje, it never removes one, so clearing it would
  // undo something the button doesn't claim to.
  function resetFilters() {
    clearConditions()
    setViewPickedManually(false)
    setCollapsedSectionIds(new Set())
    setSearch('')
  }

  function setSortField(field: string, pick: SortPickT | null) {
    setSort(pick ? { field, ...pick } : null)
  }

  // A row added into a folded section would be invisible, so the add unfolds it. Same reference back
  // when the section is already open, so an add elsewhere doesn't re-render the grid.
  function unfoldSection(sectionId: number) {
    setCollapsedSectionIds((prev) => {
      if (!prev.has(sectionId)) return prev
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
  }

  function toggleSectionCollapsed(sectionId: number) {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(sectionId)) next.add(sectionId)
      return next
    })
  }

  return {
    view,
    setView: pickView,
    search,
    setSearch,
    engagedConditionIds,
    showAllRows,
    setShowAllRows,
    toggleCondition,
    setConditions,
    toggleConditionExclusive: pickProblem,
    sort,
    setSort,
    setSortField,
    collapsedSectionIds,
    storedCollapsedSectionIds,
    setCollapsedSectionIds,
    toggleSectionCollapsed,
    unfoldSection,
    resetFilters,
    guideX,
    setGuideX,
    guideY,
    setGuideY,
    fitRowsToContent,
    toggleFitRowsToContent,
  }
}
