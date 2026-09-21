'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysActiveFiltersBar } from '@/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar'
import { KosztorysAddMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { SaveTemplateButton } from '@/components/kosztorys/editor/toolbar/save-template-button'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { ToolbarToggle } from '@/components/ui/toolbar-toggle'
import {
  VIEWS,
  VIEW_LEGEND,
} from '@/components/kosztorys/editor/toolbar/kosztorys-view-axis-options'
import { KosztorysViewMenu } from '@/components/kosztorys/editor/toolbar/kosztorys-view-menu'
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'
import { KosztorysSectionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-sections-menu'
import { KosztorysProblemsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-problems-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { cn } from '@/lib/utils/cn'

export function KosztorysEditorToolbar() {
  const { search, setSearch, view, setView, subtotals, readOnly } = useKosztorysEditorContext()
  // Phone only — both groups below are `sm:contents`, so from 768 up this flag stops mattering.
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <div className="border-border relative shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        {/* Stays on screen when the rest is folded: these two change what the rozpiska shows. */}
        <div className="flex w-full items-center gap-x-3 sm:contents">
          <KosztorysTotalsPanelToggle disabled={subtotals.length === 0} />
          <ToolbarToggle
            legend={VIEW_LEGEND}
            options={VIEWS}
            value={view}
            onChange={setView}
            aria-label="Widok cen"
          />
          <button
            type="button"
            onClick={() => setToolsOpen(!toolsOpen)}
            aria-expanded={toolsOpen}
            aria-label={toolsOpen ? 'Schowaj narzędzia' : 'Pokaż narzędzia'}
            className="text-muted-foreground ml-auto cursor-pointer p-1 sm:hidden"
          >
            <ChevronDown className={cn('size-5 transition-transform', toolsOpen && 'rotate-180')} />
          </button>
        </div>

        {/* Floats over the rozpiska: in flow it shortened the grid's flex track on every open/close,
            remeasuring the virtualized window. `sm:contents` generates no box from 768 up, so these
            classes stop applying there on their own. */}
        <div
          className={cn(
            'bg-background border-border absolute inset-x-0 top-full z-30 w-full flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 shadow-md sm:contents',
            toolsOpen ? 'flex' : 'hidden',
          )}
        >
          {/* A closed kosztorys keeps every lens; only the entries that would write are gone. */}
          {!readOnly && <KosztorysAddMenu />}
          <SimpleTooltip content="Szukaj pozycji / sekcji">
            {/* SearchFilterInput takes no ref, so the tooltip anchors to a wrapper */}
            <div>
              <SearchFilterInput
                value={search}
                onChange={setSearch}
                placeholder="Szukaj…"
                debounceMs={200}
                className={SEARCH_FILTER_TOOLBAR_WIDTH}
              />
            </div>
          </SimpleTooltip>
          {/* Claims free space only from `sm`: five menus are wider than a phone, and below `sm` the
              group already has its own line. */}
          <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
            <SaveTemplateButton />
            {/* Spans both menus, not just „Opcje": „Porównaj z katalogiem" is now read from
                „Problemy" while its window is still mounted beside the other „Opcje" dialogs, so the
                trigger and the dialog only reach the same state under one shared provider. */}
            <KosztorysActionsProvider>
              <KosztorysActionsMenu />
              {/* Absent when nothing is wrong, so it sits where the eye lands, not between two
                  permanent controls. */}
              <KosztorysProblemsMenu />
            </KosztorysActionsProvider>
            <KosztorysFiltersMenu />
            <KosztorysSectionsMenu />
            <KosztorysViewMenu />
          </div>
        </div>
      </div>
      {/* A second line inside the toolbar's block, not a strip of its own, so the border stays one
          edge between chrome and grid however many chips are on. */}
      <KosztorysActiveFiltersBar />
    </div>
  )
}
