'use client'

import { Button } from '@/components/ui/button'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { SaveAsButton } from '@/components/kosztorys/save-as-button'
import type { PriceViewT } from '@/lib/kosztorys/calc'

// Three views over one dataset: they only change the active price and its derived values.
const VIEWS: { value: PriceViewT; label: string }[] = [
  { value: 'client', label: 'Klient' },
  { value: 'w_tools', label: 'Z narzędziami' },
  { value: 'own_tools', label: 'Bez narzędzi' },
]

const VIEW_LEGEND = [
  'Widoki cen:',
  'Klient — cena dla klienta.',
  'Z narzędziami / Bez narzędzi — ceny podwykonawcy, liczone ze współczynnika narzutu.',
  '',
  'Tryb ceny pozycji:',
  'auto — ze współczynnika · × mnożnik ceny klienta · kwota (zł).',
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
  onAddStage: () => void
  itemCount: number
  bruttoVisible: boolean
  onToggleBrutto: () => void
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
  onAddStage,
  itemCount,
  bruttoVisible,
  onToggleBrutto,
  summaryOpen,
  onToggleSummary,
}: PropsT) {
  return (
    <div className="border-border flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
      <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
      <div className="flex items-center gap-1">
        {VIEWS.map((v) => (
          <Button
            key={v.value}
            size="sm"
            variant={v.value === view ? 'default' : 'outline'}
            onClick={() => onViewChange(v.value)}
          >
            {v.label}
          </Button>
        ))}
        <InfoTooltip content={VIEW_LEGEND} label="Co oznaczają widoki cen" className="ml-0.5" />
      </div>
      <Button
        size="sm"
        variant={bruttoVisible ? 'default' : 'outline'}
        onClick={onToggleBrutto}
        title="Pokaż kolumnę i sumę brutto (netto × (1 + VAT))"
      >
        Brutto
      </Button>
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
      <Button size="sm" variant="outline" onClick={onAddStage}>
        ＋ etap
      </Button>
      <span className="text-muted-foreground text-sm">{itemCount} pozycji</span>
      <div className="ml-auto flex items-center gap-1">
        <SaveAsButton investmentId={investmentId} />
        <Button size="sm" variant="outline" onClick={onOpenVersions}>
          Wersje
        </Button>
        <Button size="sm" variant={summaryOpen ? 'default' : 'outline'} onClick={onToggleSummary}>
          Sekcje
        </Button>
      </div>
    </div>
  )
}
