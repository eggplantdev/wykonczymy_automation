'use client'

import { useState } from 'react'
import { useEngagedConditions } from '@/components/kosztorys/editor/hooks/use-engaged-conditions'
import { usePriceView } from '@/components/kosztorys/editor/hooks/use-price-view'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view-settings'
import { engagedPlane, isFoldSuppressed } from '@/lib/kosztorys/row-conditions/queries'
import { clientConditionIds } from '@/lib/kosztorys/row-conditions/registry'
import type { SortPickT, SortStateT } from '@/lib/kosztorys/row-view'

type ArgsT = {
  investmentId: number
  preview: boolean
  // The investment's stored client-view settings. Only consumed under `preview`.
  clientView?: ClientViewSettingsT
}

const EMPTY_COLLAPSED: ReadonlySet<number> = new Set()

// How the grid is being read — plane, search, sort, folds, the resize guides. Depends on nothing in
// the data plane: no rows, no stages, no actions.
export function useKosztorysViewState({ investmentId, preview, clientView }: ArgsT) {
  const [persistedView, setView] = usePriceView(investmentId)
  const [search, setSearch] = useState('')
  // Which named conditions are hiding pozycje — persisted per investment, so a filter set yesterday
  // is still on today. Under the preview the owner's own picks are dropped wholesale like `view`
  // above and `clientConditionIds` answers instead — it owns which conditions may reach a client.
  const {
    engagedIds: persistedConditionIds,
    toggle: toggleCondition,
    toggleExclusive: toggleConditionExclusive,
    clear: clearConditions,
  } = useEngagedConditions(investmentId)
  const engagedConditionIds = preview
    ? clientConditionIds(clientView?.hideEmptyRows)
    : persistedConditionIds
  // Where an engaged problem has taken the reader, on top of the stored plane and never written to it
  // — the same rule as the columns a problem reveals: it rides the gesture, and switching the problem
  // off puts back the view the reader was working in.
  //
  // DERIVED from the engaged problem rather than remembered as its own plane, because the problem is
  // persisted and a remembered plane is not: a reload would then restore the narrowing without the
  // view it is judged on, and „ze zbyt wysoką stawką … bez narzędzi" would list its pozycje with the
  // inwestor's cena in the column it just revealed. What IS remembered is that the reader overruled
  // it — an explicit switch stands on its own with the problem left engaged, or the toolbar's most
  // visible control would be dead while a filter is on.
  const [viewPickedManually, setViewPickedManually] = useState(false)
  const problemPlane = viewPickedManually ? undefined : engagedPlane(engagedConditionIds)
  // Pinning the plane under `preview` is the second half of the disclosure lock (the allowlist is
  // the first — why the two only work as a pair is at `assertDisclosurePair`, which enforces it).
  // Pinning it HERE is also what closes the attack where a client sets
  // localStorage['kosztorys-view:<id>'] to a subcontractor view: the public page ships the full
  // tree, coefficients included, so an unpinned plane would simply render it.
  const view = preview ? 'client' : (problemPlane ?? persistedView)
  const [sort, setSort] = useState<SortStateT>(null)
  // Which sections are folded shut under their band — the single description of what the grid shows,
  // driven both by a band's own chevron and by the „Sekcje" menu (unticking folds rather than
  // filtering the rows away, so a hidden section still announces itself and its total). Deliberately
  // NOT persisted: a fold is a reading gesture for the current session, and a remembered one would
  // greet the next visit with rows the user can't see and doesn't remember hiding.
  const [storedCollapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  // Suppressed folds fold nothing, so what the grid and its controls answer to is this set, not the
  // stored one — a consumer reading the stored set while a narrowing is on says „zwinięte" over a
  // section whose rows are all on screen. It therefore takes the plain name and the stored set takes
  // the qualified one: a new consumer that reaches for the obvious identifier gets the safe answer.
  // `storedCollapsedSectionIds` has exactly one legitimate reader — the „Widoczne sekcje" ticks,
  // which EDIT the selection and so must show what will apply once the narrowing comes off.
  const collapsedSectionIds = isFoldSuppressed(search, engagedConditionIds)
    ? EMPTY_COLLAPSED
    : storedCollapsedSectionIds

  // During a column resize we only show a vertical guide (guideX = cursor X), without touching the
  // grid — a re-layout per pointermove would be a re-render per pixel. guideY is the row-resize
  // twin: same reason, rotated.
  const [guideX, setGuideX] = useState<number | null>(null)
  const [guideY, setGuideY] = useState<number | null>(null)

  function pickView(next: PriceViewT) {
    setViewPickedManually(true)
    setView(next)
  }

  // Engaging a problem takes the reader to the plane it judges, because a stawka wykonawcy renders on
  // one plane only — narrowing to „ze zbyt wysoką stawką … bez narzędzi" while sitting in „Inwestor"
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
    toggleCondition,
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
  }
}
