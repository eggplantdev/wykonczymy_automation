'use client'

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SettlementModeSelect } from '@/components/kosztorys/summary/settings/settlement-mode-select'
import { MaterialsNetPricingControl } from '@/components/kosztorys/summary/settings/materials-net-pricing-control'
import { VatRateField } from '@/components/kosztorys/summary/settings/vat-rate-field'
import { GlobalDiscountControl } from '@/components/kosztorys/summary/settings/global-discount-control'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

type PropsT = {
  vatRate: number
  settlementMode: SettlementModeT
  onSettlementModeChange: (mode: SettlementModeT) => void
  // The materiały netto rate in EFFECT as a fraction; null = the investor is billed the receipt.
  materialsNetRate: number | null
  onMaterialsNetRateChange: (rate: number | null) => void
  pricingLockedReason?: string
  isSaving?: boolean
  // Reads the editor context, so only a host inside KosztorysEditorProvider may turn it on.
  showSettingsBar?: boolean
}

// A Popover, not a DropdownMenu: these are form controls (selects, a number field), and a menu's
// roving focus and typeahead fight nested inputs.
export function SummaryInvestmentSettings({
  vatRate,
  settlementMode,
  onSettlementModeChange,
  materialsNetRate,
  onMaterialsNetRateChange,
  pricingLockedReason,
  isSaving = false,
  showSettingsBar = false,
}: PropsT) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          Opcje rozliczenia
          <ChevronDown />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        // Radix would autofocus the first tabbable node, which is a hint's (i) button — and a
        // tooltip trigger opens on focus, so the popover appeared with a hint already up.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
        }}
        className="max-h-(--radix-popover-content-available-height) w-fit overflow-y-auto p-0"
      >
        <div className="divide-border flex flex-col divide-y">
          <SettlementModeSelect
            value={settlementMode}
            onChange={onSettlementModeChange}
            vatRate={vatRate}
            disabled={isSaving}
          />
          <MaterialsNetPricingControl
            vatRate={vatRate}
            materialsNetRate={materialsNetRate}
            onMaterialsNetRateChange={onMaterialsNetRateChange}
            disabled={isSaving}
            lockedReason={pricingLockedReason}
          />
          {showSettingsBar && <VatRateField disabled={isSaving} />}
          {showSettingsBar && <GlobalDiscountControl disabled={isSaving} />}
        </div>
      </PopoverContent>
    </Popover>
  )
}
