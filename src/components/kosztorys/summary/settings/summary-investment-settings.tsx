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
  // Why the choice cannot be made right now, or undefined when it can. Passed in rather than derived
  // from the mode here, so this and the Materiały tab's copy of the control lock in step.
  pricingLockedReason?: string
  // One flag for all four: they are set-once decisions nobody edits two at a time, and none of them
  // is optimistic — the figures they move are recomputed on the server.
  isSaving?: boolean
  // VAT + rabat globalny editing. Reads the editor context, so only a host inside
  // KosztorysEditorProvider may turn it on.
  showSettingsBar?: boolean
}

// Every set-once decision about the deal — settlement mode, materiały netto pricing, VAT + rabat
// globalny — behind one trigger in the panel's pinned top bar.
//
// A Popover, not a DropdownMenu: these are form controls (selects, a number field), and a menu's
// roving focus and typeahead fight nested inputs. And an overlay rather than the inline collapsible
// this replaced — portalled content is out of flow, so the block can grow without adding height to
// the bar. That is the whole point: it lived in this bar once as an inline section and had to be
// evicted because growing it squeezed the scroll region below into a sliver.
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
      {/* Capped at the space Radix measured between the trigger and the viewport edge, so a short
          window scrolls the options instead of clipping them. */}
      <PopoverContent
        align="start"
        // Radix would autofocus the first tabbable node, which is a hint's (i) button — and a
        // tooltip trigger opens on focus, so the popover appeared with a hint already up. Park
        // focus on the content container instead: still inside the popover, so Tab and Escape
        // behave, but no control is entered.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus()
        }}
        // p-0: each section owns its own padding (SettingsSection), so the rule between two of them
        // runs edge to edge instead of floating inside a gutter.
        className="max-h-(--radix-popover-content-available-height) w-fit overflow-y-auto p-0"
      >
        {/* divide-y rather than explicit separators: a hidden section leaves no node, so the rules
            never double up or dangle when the host drops one. */}
        <div className="divide-border flex flex-col divide-y">
          <SettlementModeSelect
            value={settlementMode}
            onChange={onSettlementModeChange}
            vatRate={vatRate}
            disabled={isSaving}
          />
          {/* Greyed out at tryb brutto, not hidden: a control that disappears reads as a bug, so it
              stays and says why. */}
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
