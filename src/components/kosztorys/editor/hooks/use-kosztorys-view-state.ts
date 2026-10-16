'use client'

import { useState } from 'react'
import { useEngagedConditions } from '@/components/kosztorys/editor/hooks/use-engaged-conditions'
import { useFitRowsToContent } from '@/components/kosztorys/editor/hooks/use-fit-rows-to-content'
import { usePriceView } from '@/components/kosztorys/editor/hooks/use-price-view'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { ClientViewSettingsT } from '@/lib/kosztorys/client-view/settings'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import {
  clientConditionIds,
  editorConditionIds,
  engagedPlane,
  isFoldSuppressed,
} from '@/lib/kosztorys/row-conditions/queries'
import {
  HAS_PLANNED_OR_AI_QTY_CONDITION_ID,
  NO_PLANNED_OR_AI_QTY_CONDITION_ID,
} from '@/lib/kosztorys/row-conditions/registry'
import type { SortPickT, SortStateT } from '@/lib/kosztorys/row-view'
import { toggleInSet } from '@/lib/utils/toggle-in-set'

type ArgsT = {
  investmentId: number
  preview: boolean
  clientView?: ClientViewSettingsT
  workerPlane?: ToolPlaneT
  isTemplate?: boolean
  aiDraft?: boolean
}

const EMPTY_COLLAPSED: ReadonlySet<number> = new Set()

export function useKosztorysViewState({
  investmentId,
  preview,
  clientView,
  workerPlane,
  isTemplate = false,
  aiDraft = false,
}: ArgsT) {
  const [persistedView, setView] = usePriceView(investmentId, isTemplate)
  const [search, setSearch] = useState('')
  const {
    engagedIds: persistedConditionIds,
    toggle: toggleCondition,
    toggleExclusive: toggleConditionExclusive,
    setMany: setConditions,
    clear: clearConditions,
  } = useEngagedConditions(investmentId, isTemplate)
  // „Pokaż wszystkie pozycje" — the investor's one-visit override of the owner's hide. Not persisted:
  // every visit opens on the document the owner curated.
  const [showAllRows, setShowAllRows] = useState(false)
  const [reportedOnly, setReportedOnly] = useState(false)
  const offerAvailable = !preview && !isTemplate
  const [offerPicked, setOffer] = useState(false)
  const [aiReviewPicked, setAiReview] = useState(false)
  const aiReviewAvailable = offerAvailable && aiDraft
  const aiReview = aiReviewPicked && aiReviewAvailable
  const engagedConditionIds = preview
    ? clientConditionIds(clientView?.hideEmptyRows && !showAllRows, reportedOnly)
    : editorConditionIds(persistedConditionIds, aiReview)
  const [viewPickedManually, setViewPickedManually] = useState(false)
  const problemPlane = viewPickedManually ? undefined : engagedPlane(engagedConditionIds)
  // The public page ships the full tree, so an unpinned plane would render a subcontractor view to any
  // client who set localStorage['kosztorys-view:<id>'].
  const offer = offerPicked && offerAvailable
  const view: PriceViewT = preview
    ? (workerPlane ?? 'client')
    : offer
      ? 'client'
      : (problemPlane ?? (isTemplate ? 'client' : persistedView))
  const [sort, setSort] = useState<SortStateT>(null)
  const [storedCollapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  )
  const collapsedSectionIds = isFoldSuppressed(search, engagedConditionIds)
    ? EMPTY_COLLAPSED
    : storedCollapsedSectionIds

  const [fitRowsToContent, toggleFitRowsToContent] = useFitRowsToContent()

  const [guideX, setGuideX] = useState<number | null>(null)
  const [guideY, setGuideY] = useState<number | null>(null)

  // On every switch-on, not just the first: the view always opens on what someone priced, whatever
  // was re-ticked during the last pass — the other half included, or the pair would hide every row.
  function pickAiReview(next: boolean) {
    setAiReview(next)
    if (!next) return
    setConditions([NO_PLANNED_OR_AI_QTY_CONDITION_ID], true)
    setConditions([HAS_PLANNED_OR_AI_QTY_CONDITION_ID], false)
  }

  function pickView(next: PriceViewT) {
    setViewPickedManually(true)
    setView(next)
  }

  function pickProblem(id: string, within: Iterable<string>) {
    toggleConditionExclusive(id, within)
    setViewPickedManually(false)
  }

  function resetFilters() {
    clearConditions()
    setViewPickedManually(false)
    setCollapsedSectionIds(new Set())
    setSearch('')
  }

  function setSortField(field: string, pick: SortPickT | null) {
    setSort(pick ? { field, ...pick } : null)
  }

  // Same reference back when the section is already open, so an add elsewhere doesn't re-render the grid.
  function unfoldSection(sectionId: number) {
    setCollapsedSectionIds((prev) => {
      if (!prev.has(sectionId)) return prev
      const next = new Set(prev)
      next.delete(sectionId)
      return next
    })
  }

  function toggleSectionCollapsed(sectionId: number) {
    setCollapsedSectionIds((prev) => toggleInSet(prev, sectionId))
  }

  return {
    view,
    setView: pickView,
    offerAvailable,
    offer,
    setOffer,
    aiReviewAvailable,
    aiReview,
    setAiReview: pickAiReview,
    search,
    setSearch,
    engagedConditionIds,
    showAllRows,
    setShowAllRows,
    reportedOnly,
    setReportedOnly,
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
