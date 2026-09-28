'use client'

import { SettingsSection } from '@/components/kosztorys/summary/settings-section'
import {
  PRICING_MODE_DESCRIPTIONS,
  PRICING_MODE_OPTIONS,
} from '@/components/kosztorys/summary/materials-pricing-options'
import { materialsNetRateForMode, pricingModeOf } from '@/lib/kosztorys/materials-pricing-mode'
import { SimpleSelect } from '@/components/ui/simple-select'
import { DecimalField } from '@/components/ui/decimal-field'
import { ratePercent } from '@/lib/kosztorys/format'

type PropsT = {
  // Opening value when the owner switches the concession on: billing materiały netto at the VAT rate
  // is the case this feature was built for, so it is one click rather than a number to look up.
  vatRate: number
  // The investment's saved netto rate (fraction) and its writer — persisted, not browser-local.
  materialsNetRate: number | null
  onMaterialsNetRateChange: (rate: number | null) => void
  disabled?: boolean
  // Why this choice cannot be made right now. Present = the control greys out and prints this instead
  // of the rate field. Shown rather than hidden: a control that vanishes reads as a bug, and the owner
  // then hunts for a setting that was never lost.
  lockedReason?: string
}

// Sits with the settlement mode rather than in the wydatki view: which plane the investment settles on
// and whether its wydatki are billed netto are one decision about the deal.
export function MaterialsNetPricingControl({
  vatRate,
  materialsNetRate,
  onMaterialsNetRateChange,
  disabled = false,
  lockedReason,
}: PropsT) {
  const mode = pricingModeOf(materialsNetRate)
  const materialsNetPercent = ratePercent(materialsNetRate ?? vatRate)

  return (
    <SettingsSection
      title="Materiały"
      subtitle="Sposób rozliczenia materiałów"
      hint={PRICING_MODE_DESCRIPTIONS[mode]}
    >
      <SimpleSelect
        value={mode}
        onValueChange={(next) => onMaterialsNetRateChange(materialsNetRateForMode(next, vatRate))}
        options={PRICING_MODE_OPTIONS}
        disabled={disabled || lockedReason !== undefined}
        variant="toolbarSm"
      />
      {lockedReason !== undefined && (
        <p className="text-muted-foreground max-w-3xs text-xs">{lockedReason}</p>
      )}
      {lockedReason === undefined && mode === 'net' && (
        <DecimalField
          label="Stawka vat na materiały"
          labelAbove
          suffix="%"
          withSave
          value={materialsNetPercent}
          disabled={disabled}
          min={0}
          max={100}
          onCommit={(percent) => onMaterialsNetRateChange(percent / 100)}
        />
      )}
    </SettingsSection>
  )
}
