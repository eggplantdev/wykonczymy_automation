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
import { SaveTemplateButton } from '@/components/kosztorys/editor/toolbar/save-template-button'
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
import { cn } from '@/lib/utils/cn'

export function KosztorysEditorToolbar() {
  const { search, setSearch, view, setView, subtotals, readOnly } = useKosztorysEditorContext()
  // Phone only. Both groups below are `sm:contents`, so from 768 up they dissolve into the one
  // wrapping row this has always been and this flag stops meaning anything — no viewport to read,
  // nothing to reconcile on resize.
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        {/* Stays on screen when the rest is folded away: the two controls that change what the whole
            rozpiska SHOWS, as against the ones that edit or narrow it. */}
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

        <div
          className={cn(
            'w-full flex-wrap items-center gap-x-3 gap-y-2 sm:contents',
            toolsOpen ? 'flex' : 'hidden',
          )}
        >
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
          {/* Wraps, and only claims the free space from `sm`: five menus are wider than a phone, and a
              rigid row ran „Filtry" and „Widok" off the side of the screen. Below `sm` the group is
              already on a line of its own, so pushing it right would only strand it there. */}
          <div className="flex flex-wrap items-center gap-1 sm:ml-auto">
            <SaveTemplateButton />
            <KosztorysActionsMenu />
            {/* Before „Filtry", and absent when nothing is wrong — the one control here that appears on
                its own has to be where the eye lands first, not tucked between two permanent ones. */}
            <KosztorysProblemsMenu />
            <KosztorysFiltersMenu />
            <KosztorysViewMenu />
          </div>
        </div>
      </div>
      {/* Inside the toolbar's own bordered block, under the controls that set them — a second line
          rather than a strip of its own, so the border still reads as one edge between chrome and
          grid however many chips are on. */}
      <KosztorysActiveFiltersBar />
    </div>
  )
}
