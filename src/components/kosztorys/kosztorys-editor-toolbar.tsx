'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PriceViewT } from '@/lib/kosztorys/calc'

// Three views over one dataset: they only change the active price and its derived values.
const VIEWS: { value: PriceViewT; label: string }[] = [
  { value: 'client', label: 'Robocizna' },
  { value: 'w_tools', label: 'Z narzędziami' },
  { value: 'own_tools', label: 'Bez narzędzi' },
]

type PropsT = {
  investmentName: string
  view: PriceViewT
  onViewChange: (view: PriceViewT) => void
  search: string
  onSearchChange: (search: string) => void
  activeSectionId: number | null
  onAddItem: (sectionId: number) => void
  itemCount: number
  summaryOpen: boolean
  onToggleSummary: () => void
}

export function KosztorysEditorToolbar({
  investmentName,
  view,
  onViewChange,
  search,
  onSearchChange,
  activeSectionId,
  onAddItem,
  itemCount,
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
      </div>
      <Input
        placeholder="Szukaj pozycji / sekcji…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 max-w-xs"
      />
      {activeSectionId != null && (
        <Button size="sm" variant="outline" onClick={() => onAddItem(activeSectionId)}>
          ＋ pozycja
        </Button>
      )}
      <span className="text-muted-foreground text-sm">{itemCount} pozycji</span>
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant={summaryOpen ? 'default' : 'outline'} onClick={onToggleSummary}>
          Sekcje
        </Button>
      </div>
    </div>
  )
}
