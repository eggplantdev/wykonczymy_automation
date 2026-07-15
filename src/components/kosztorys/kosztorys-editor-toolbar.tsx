'use client'

import { Button } from '@/components/ui/button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { KosztorysActionsMenu } from '@/components/kosztorys/kosztorys-actions-menu'
import { KosztorysGlobalSettings } from '@/components/kosztorys/kosztorys-global-settings'
import { ColumnToggleMenu, type ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import { Slash, User, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PriceViewT } from '@/lib/kosztorys/calc'

// Three views over one dataset: they only change the active price and its derived values.
const ICON_CLASS = 'size-4'
const VIEWS: { value: PriceViewT; label: string; icon: ReactNode }[] = [
  { value: 'client', label: 'Klient', icon: <User className={ICON_CLASS} /> },
  { value: 'w_tools', label: 'Z narzędziami', icon: <Wrench className={ICON_CLASS} /> },
  {
    value: 'own_tools',
    label: 'Bez narzędzi',
    // No native crossed-wrench glyph — overlay two mirrored Slashes into an X to read as "tools off".
    icon: (
      <span className="relative inline-flex">
        <Wrench className={ICON_CLASS} />
        <Slash className="absolute inset-0 size-4" />
        <Slash className="absolute inset-0 size-4 -scale-x-100" />
      </span>
    ),
  },
]

const VIEW_LEGEND = [
  'Widoki cen:',
  '👤 Klient — cena dla klienta.',
  '🔧 Stawka wykonawcy z narzędziami.',
  '🚫 Stawka wykonawcy bez narzędzi.',
].join('\n')

type PropsT = {
  investmentId: number
  investmentName: string
  onOpenVersions: () => void
  view: PriceViewT
  onViewChange: (view: PriceViewT) => void
  search: string
  onSearchChange: (search: string) => void
  // Section the ＋ pozycja button adds to: the filtered section if one is active, else the last
  // section (resolved by the caller). Always set while ≥1 section exists, so the button stays
  // visible on a fresh single-section kosztorys instead of hiding until a filter is picked (EX-463).
  addItemSectionId: number | null
  onAddItem: (sectionId: number) => void
  onAddSection: () => void
  onAddStage: () => void
  columnToggleItems: ColumnToggleItemT[]
  onToggleColumn: (id: string) => void
  globalCoeffs: { wTools: number; ownTools: number }
  vatRate: number
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
  onVatChange: (vatRate: number) => void
  summaryOpen: boolean
  onToggleSummary: () => void
}

export function KosztorysEditorToolbar({
  investmentId,
  investmentName,
  onOpenVersions,
  view,
  onViewChange,
  search,
  onSearchChange,
  addItemSectionId,
  onAddItem,
  onAddSection,
  onAddStage,
  columnToggleItems,
  onToggleColumn,
  globalCoeffs,
  vatRate,
  onGlobalCoeffChange,
  onVatChange,
  summaryOpen,
  onToggleSummary,
}: PropsT) {
  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
        <SimpleTooltip
          content={VIEW_LEGEND}
          delayDuration={500}
          className="max-w-xs whitespace-pre-line"
        >
          <span className="inline-flex">
            <ToggleGroup
              options={VIEWS}
              value={view}
              onChange={onViewChange}
              aria-label="Widok cen"
            />
          </span>
        </SimpleTooltip>
        <SearchFilterInput
          value={search}
          onChange={onSearchChange}
          placeholder="Szukaj pozycji / sekcji…"
          debounceMs={200}
        />
        {addItemSectionId != null && (
          <Button size="sm" variant="outline" onClick={() => onAddItem(addItemSectionId)}>
            ＋ pozycja
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onAddSection}>
          ＋ sekcja
        </Button>
        <Button size="sm" variant="outline" onClick={onAddStage}>
          ＋ etap
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <KosztorysActionsMenu investmentId={investmentId} onOpenVersions={onOpenVersions} />
          {/* ml-0: the picker's default ml-auto is for flat toolbars — this group is already
              floated right. */}
          <ColumnToggleMenu items={columnToggleItems} onToggle={onToggleColumn} className="ml-0" />
          <Button size="sm" variant={summaryOpen ? 'default' : 'outline'} onClick={onToggleSummary}>
            Sekcje
          </Button>
        </div>
      </div>
      <div className="border-border border-t px-4 py-1.5">
        <KosztorysGlobalSettings
          globalCoeffs={globalCoeffs}
          vatRate={vatRate}
          onGlobalCoeffChange={onGlobalCoeffChange}
          onVatChange={onVatChange}
        />
      </div>
    </div>
  )
}
