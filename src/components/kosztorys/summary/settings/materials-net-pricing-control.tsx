'use client'

import { SettingsSection } from '@/components/kosztorys/summary/settings/settings-section'
import {
  PRICING_MODE_DESCRIPTIONS,
  PRICING_MODE_OPTIONS,
} from '@/components/kosztorys/summary/model/materials-pricing-options'
import { materialsNetRateForMode, pricingModeOf } from '@/lib/kosztorys/materials-pricing-mode'
import { SimpleSelect } from '@/components/ui/simple-select'
import { DecimalField } from '@/components/ui/decimal-field'
import { ratePercent } from '@/lib/kosztorys/format'

type PropsT = {
  vatRate: number
  materialsNetRate: number | null
  onMaterialsNetRateChange: (rate: number | null) => void
  disabled?: boolean
  lockedReason?: string
}

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
