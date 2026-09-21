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
} from '@/components/ui/dropdown-menu'
import { DropdownCheckGroups } from '@/components/ui/dropdown-check-groups'
import { CatalogueCompareMenuItem } from '@/components/kosztorys/editor/actions/catalogue-compare-action'
import { problemsMenuModel } from '@/components/kosztorys/editor/toolbar/menus/problems-menu-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

/**
 * „Co jest tu zepsute" — its own trigger rather than a group inside „Filtry", because it is not the
 * same question: a filter says what the reader wants to see, a problem says what the kosztorys is
 * waiting on. Folded into the filters it was a warning behind a closed dropdown, one heading down a
 * list about something else.
 *
 * The button exists only while something is wrong. A permanently present „Problemy (0)" would be
 * chrome to skip past; a button that appears IS the alarm, which is why the trigger carries the
 * triangle and the destructive tone rather than a neutral icon plus a badge.
 *
 * One problem at a time (owner): each pick narrows the grid to that problem's own matches and reveals
 * that problem's columns, so two at once showed the sum of two unrelated sets with nothing on screen
 * to say which row belonged to which. Picking the engaged one again turns it off — there is no
 * „wszystkie problemy" row, because the union is exactly what makes no sense here.
 */
export function KosztorysProblemsMenu() {
  const { engagedConditionIds, toggleConditionExclusive, conditionCounts, refreshProblemRows } =
    useKosztorysEditorContext()

  const problemToggles = problemsMenuModel({
    engagedIds: engagedConditionIds,
    counts: conditionCounts,
  })

  if (problemToggles.length === 0) return null

  const engaged = problemToggles.find((toggle) => toggle.active)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The toolbar's shared filter trigger, same as „Filtry" and every filter on the transfers
            side, minus the „(n)": one problem narrows at a time, so the count could only ever be 1 and
            the active styling already says that. Only the tone and the triangle are this menu's —
            they are what the button says that the others don't. */}
        <FilterTriggerButton
          active={Boolean(engaged)}
          tone="destructive"
          icon={TriangleAlert}
          className={TOOLBAR_FILTER_TRIGGER_CLASS}
        >
          Problemy
        </FilterTriggerButton>
      </DropdownMenuTrigger>
      {/* Every row is a sentence, not a label: at the default width they wrapped to three or four
          lines each. */}
      <DropdownMenuContent align="end" className="w-112">
        {/* A poprawiona pozycja is held in place while it is being fixed, so something has to say
            „skończyłem, przelicz to teraz" — and that gesture is this, not toggling the problem off
            and on again to get the same effect sideways. Shown only while one is engaged, because
            with nothing narrowed there is nothing being held to release. */}
        {engaged && (
          <>
            <DropdownMenuLabel>Zawężenie</DropdownMenuLabel>
            {/* The engaged problem is turned off by picking it again, which is a gesture you have to
                already know; this says it out loud. Scoped to the problems — the sekcje folds and the
                „Filtry" toggles are that menu's to undo, and a reset here that reached them would
                undo things this menu never did. */}
            <DropdownMenuItem
              onSelect={() => toggleConditionExclusive(engaged.id, PROBLEM_IDS)}
              className="text-muted-foreground"
            >
              <RotateCcw />
              Zresetuj filtry
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={refreshProblemRows}>
              <RefreshCw />
              Odśwież — ukryj poprawione
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {/* Grouped by the part of the rozpiska the fix happens in, and headed by the shared primitive,
            so the headings sit at the same level as the „Sekcje" menu's beside it. */}
        <DropdownCheckGroups
          items={problemToggles}
          onSelect={(id) => toggleConditionExclusive(id, PROBLEM_IDS)}
        />
        {/* The rows above narrow the rozpiska to one problem at a time; this opens the whole katalog
            report they are counted from, praca by praca, with the „Dodaj / Edytuj w katalogu" writes
            the grid has no room for. It reads as the last step of the same question, which is why it
            left „Opcje" — there it sat under a heading of its own, next to szablony and arkusz. */}
        <DropdownMenuSeparator />
        <CatalogueCompareMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
