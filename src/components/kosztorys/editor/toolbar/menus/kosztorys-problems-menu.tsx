'use client'

import { RefreshCw, RotateCcw, TriangleAlert } from 'lucide-react'
import {
  FilterTriggerButton,
  TOOLBAR_FILTER_TRIGGER_CLASS,
} from '@/components/filters/filter-trigger-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  keepMenuOpen,
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

  const engaged = problemToggles.find((toggle) => toggle.active)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTriggerButton
          active={Boolean(engaged)}
          tone="destructive"
          icon={TriangleAlert}
          className={TOOLBAR_FILTER_TRIGGER_CLASS}
        >
          Problemy
        </FilterTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-112">
        {engaged && (
          <>
            <DropdownMenuLabel>Zawężenie</DropdownMenuLabel>
            {/* Scoped to the problems — the sekcje folds and the
                „Filtry" toggles are that menu's to undo, and a reset here that reached them would
                undo things this menu never did. */}
            <DropdownMenuItem
              onSelect={keepMenuOpen(() => toggleConditionExclusive(engaged.id, PROBLEM_IDS))}
              className="text-muted-foreground"
            >
              <RotateCcw />
              Zresetuj filtry
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={keepMenuOpen(refreshProblemRows)}>
              <RefreshCw />
              Odśwież — ukryj poprawione
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
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
