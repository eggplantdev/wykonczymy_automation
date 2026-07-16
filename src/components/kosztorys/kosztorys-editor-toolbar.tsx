'use client'

import { SearchFilterInput } from '@/components/ui/search-filter-input'
import { KosztorysGlobalSettings } from '@/components/kosztorys/kosztorys-global-settings'
import { KosztorysProgressCounter } from '@/components/kosztorys/kosztorys-progress-counter'
import { KosztorysToolbarActions } from '@/components/kosztorys/kosztorys-toolbar-actions'
import { KosztorysToolbarAddButtons } from '@/components/kosztorys/kosztorys-toolbar-add-buttons'
import { KosztorysToolbarViewToggles } from '@/components/kosztorys/kosztorys-toolbar-view-toggles'
import { useKosztorysEditorContext } from '@/components/kosztorys/use-kosztorys-editor-context'

export function KosztorysEditorToolbar() {
  const {
    investmentName,
    search,
    setSearch,
    tree,
    view,
    globalDiscount,
    totalNet,
    totalPlannedNet,
    moneyAxis,
    handleGlobalCoeffChange,
    handleVatChange,
    handleGlobalDiscountChange,
  } = useKosztorysEditorContext()

  return (
    <div className="border-border shrink-0 border-b">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <h1 className="text-foreground text-sm font-medium">Kosztorys — {investmentName}</h1>
        <KosztorysToolbarViewToggles />
        <SearchFilterInput
          value={search}
          onChange={setSearch}
          placeholder="Szukaj pozycji / sekcji…"
          debounceMs={200}
        />
        <KosztorysToolbarAddButtons />
        <KosztorysToolbarActions />
      </div>
      <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-4 py-1.5">
        <KosztorysGlobalSettings
          globalCoeffs={tree.globalCoeffs}
          vatRate={tree.vatRate}
          globalDiscount={globalDiscount}
          view={view}
          onGlobalCoeffChange={handleGlobalCoeffChange}
          onVatChange={handleVatChange}
          onGlobalDiscountChange={handleGlobalDiscountChange}
        />
        <div className="ml-auto">
          <KosztorysProgressCounter
            doneNet={totalNet}
            plannedNet={totalPlannedNet}
            vatRate={tree.vatRate}
            moneyAxis={moneyAxis}
          />
        </div>
      </div>
    </div>
  )
}
