'use client'

import { useState } from 'react'
import { ChevronDown, WandSparkles } from 'lucide-react'
import { SearchFilterInput } from '@/components/filters/search-filter-input'
import { BUTTON_ANIMATION_CLASSES, Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { KosztorysActiveFiltersBar } from '@/components/kosztorys/editor/toolbar/kosztorys-active-filters-bar'
import { KosztorysAddMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-add-menu'
import { KosztorysActionsMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-actions-menu'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
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
import { WorkerReportsButton } from '@/components/kosztorys/editor/toolbar/worker-reports-button'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { cn } from '@/lib/utils/cn'
import type { AcceptanceProtocolSourceT } from '@/components/kosztorys/editor/dialogs/acceptance-protocol-dialog'
import type { WorkerReportsSeedT } from '@/lib/kosztorys/types'

export function KosztorysEditorToolbar({
  protocolSource,
  workerReports,
}: {
  protocolSource?: AcceptanceProtocolSourceT
  workerReports?: WorkerReportsSeedT
}) {
  const {
    search,
    setSearch,
    view,
    setView,
    subtotals,
    readOnly,
    isTemplate,
    offer,
    aiReviewAvailable,
    aiReview,
    setAiReview,
  } = useKosztorysEditorContext()
  const [toolsOpen, setToolsOpen] = useState(false)

  return (
    <div className="border-border relative shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-2">
        <div className="flex w-full items-center gap-x-1 sm:contents">
          {!isTemplate && <KosztorysTotalsPanelToggle hasRows={subtotals.length > 0} />}
          {/* The workbench has a closed column list, so both crews' stawki are already on screen and
              this switch would move no column — while still moving the „Cena j.m." sort key and the
              filter list. */}
          {!isTemplate && !offer && (
            <ToolbarToggle
              legend={VIEW_LEGEND}
              options={VIEWS}
              value={view}
              onChange={setView}
              aria-label="Widok cen"
            />
          )}
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
            remeasuring the virtualized window. */}
        <div
          className={cn(
            'bg-background border-border absolute inset-x-0 top-full z-30 w-full flex-wrap items-center gap-x-1 gap-y-2 border-b px-4 py-2 shadow-md sm:contents',
            toolsOpen ? 'flex' : 'hidden',
          )}
        >
          {!readOnly && <KosztorysAddMenu />}
          <SimpleTooltip content="Szukaj pozycji / sekcji">
            {/* SearchFilterInput takes no ref, so the tooltip anchors to a wrapper */}
            <div>
              <SearchFilterInput
                value={search}
                onChange={setSearch}
                placeholder="Szukaj…"
                debounceMs={200}
                className={cn(
                  'w-full transition-[width] duration-150 sm:w-28 sm:focus-within:w-64',
                  search && 'sm:w-64',
                )}
              />
            </div>
          </SimpleTooltip>
          <div className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:ml-auto">
            {/* „Porównaj z katalogiem" is read from
                „Problemy" while its window is still mounted beside the other „Opcje" dialogs, so the
                trigger and the dialog only reach the same state under one shared provider. */}
            <KosztorysActionsProvider workerReports={isTemplate ? undefined : workerReports}>
              <KosztorysActionsMenu protocolSource={protocolSource} />
              <KosztorysProblemsMenu />
              <WorkerReportsButton />
            </KosztorysActionsProvider>
            <KosztorysFiltersMenu />
            <KosztorysSectionsMenu />
            {aiReviewAvailable && (
              <Button
                size="sm"
                variant="outline"
                aria-pressed={aiReview}
                onClick={() => setAiReview(!aiReview)}
                className="relative"
              >
                {/* The `ai` look as a layer over the outline button: its
                    border is a background gradient, which snaps instead of interpolating, while the
                    layer's opacity can fade. */}
                <span
                  aria-hidden
                  className={cn(
                    'gradient-border neon-glow-duo pointer-events-none absolute -inset-px rounded-[inherit] transition-opacity duration-300',
                    aiReview
                      ? [
                          BUTTON_ANIMATION_CLASSES.comet,
                          BUTTON_ANIMATION_CLASSES.breathe,
                          'opacity-100',
                        ]
                      : 'opacity-0',
                  )}
                />
                <WandSparkles
                  className={cn(
                    'relative transition-colors duration-300',
                    aiReview && 'text-neon-cyan',
                  )}
                />
                <span
                  className={cn(
                    'relative transition-colors duration-300',
                    aiReview && 'text-neon-cyan',
                  )}
                >
                  Przegląd AI
                </span>
              </Button>
            )}
            <KosztorysViewMenu />
          </div>
        </div>
      </div>
      <KosztorysActiveFiltersBar />
    </div>
  )
}
