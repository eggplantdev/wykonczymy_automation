'use client'

import {
  SEARCH_FILTER_TOOLBAR_WIDTH,
  SearchFilterInput,
} from '@/components/filters/search-filter-input'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysActiveFiltersBar } from '@/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar'
import { KosztorysAddMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { KosztorysTotalsPanelToggle } from '@/components/kosztorys/summary/kosztorys-totals-panel-toggle'
import { ToolbarToggle } from '@/components/ui/toolbar-toggle'
import {
  VIEWS,
  VIEW_LEGEND,
} from '@/components/kosztorys/editor/toolbar/kosztorys-view-axis-options'
import { KosztorysViewMenu } from '@/components/kosztorys/editor/toolbar/kosztorys-view-menu'
import { KosztorysFiltersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-filters-menu'
import { KosztorysProblemsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-problems-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function KosztorysEditorToolbar() {
  const { search, setSearch, view, setView, subtotals, readOnly } = useKosztorysEditorContext()

  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <KosztorysTotalsPanelToggle disabled={subtotals.length === 0} />
        <ToolbarToggle
          legend={VIEW_LEGEND}
          options={VIEWS}
          value={view}
          onChange={setView}
          aria-label="Widok cen"
        />

        {/* Reading a closed kosztorys keeps every lens — search, filters, views. Only the entries
            that would write are gone, and the banner above says why. */}
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
        <div className="ml-auto flex items-center gap-1">
          <KosztorysActionsMenu />
          {/* Before „Filtry", and absent when nothing is wrong — the one control here that appears on
              its own has to be where the eye lands first, not tucked between two permanent ones. */}
          <KosztorysProblemsMenu />
          <KosztorysFiltersMenu />
          <KosztorysViewMenu />
        </div>
      </div>
      {/* Inside the toolbar's own bordered block, under the controls that set them — a second line
          rather than a strip of its own, so the border still reads as one edge between chrome and
          grid however many chips are on. */}
      <KosztorysActiveFiltersBar />
    </div>
  )
}
