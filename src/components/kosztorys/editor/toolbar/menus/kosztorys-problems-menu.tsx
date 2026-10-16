'use client'

import { TriangleAlert } from 'lucide-react'
import {
  FilterTriggerButton,
  TOOLBAR_FILTER_TRIGGER_CLASS,
} from '@/components/filters/filter-trigger-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownCheckGroups } from '@/components/ui/dropdown-check-groups'
import { CatalogueCompareMenuItem } from '@/components/kosztorys/editor/actions/catalogue-compare-action'
import { problemsMenuModel } from '@/components/kosztorys/editor/toolbar/menus/problems-menu-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

export function KosztorysProblemsMenu() {
  const {
    engagedConditionIds,
    toggleConditionExclusive,
    conditionCounts,
    refreshProblemRows,
    isTemplate,
  } = useKosztorysEditorContext()

  const problemToggles = problemsMenuModel({
    engagedIds: engagedConditionIds,
    counts: conditionCounts,
  })

  if (problemToggles.length === 0) return null

  const isEngaged = problemToggles.some((toggle) => toggle.active)

  return (
    <DropdownMenu onOpenChange={(open) => open && refreshProblemRows()}>
      <DropdownMenuTrigger asChild>
        <FilterTriggerButton
          active={isEngaged}
          tone="destructive"
          icon={TriangleAlert}
          className={TOOLBAR_FILTER_TRIGGER_CLASS}
        >
          Problemy
        </FilterTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-112">
        <DropdownCheckGroups
          items={problemToggles}
          onSelect={(id) => toggleConditionExclusive(id, PROBLEM_IDS)}
        />
        {!isTemplate && (
          <>
            <DropdownMenuSeparator />
            <CatalogueCompareMenuItem />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
