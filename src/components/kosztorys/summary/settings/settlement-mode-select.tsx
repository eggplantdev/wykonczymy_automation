'use client'

import { SettingsSection } from '@/components/kosztorys/summary/settings/settings-section'
import {
  SETTLEMENT_MODE_DESCRIPTIONS,
  SETTLEMENT_MODE_SELECT_OPTIONS,
} from '@/components/kosztorys/summary/model/settlement-mode-options'
import { SimpleSelect } from '@/components/ui/simple-select'
import { ZeroVatWarning } from '@/components/kosztorys/summary/settings/zero-vat-warning'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'

type PropsT = {
  value: SettlementModeT
  onChange: (mode: SettlementModeT) => void
  vatRate: number
  disabled?: boolean
}

// The stored settlement mode as a block of the Opcje rozliczenia popover — the Podsumowanie tab offers
// the same choice inline (InlineModeSelect), both writing the one figure the investment owns.
//
// Never disabled at VAT 0% (EX-590): the mode is not inert there — Mieszane still splits the panel and
// doubles the grid's money columns, and the materiały netto rate is VAT-independent. The warning below
// explains the one thing VAT 0% *does* flatten.
export function SettlementModeSelect({ value, onChange, vatRate, disabled = false }: PropsT) {
  return (
    <SettingsSection
      title="Robocizna"
      subtitle="Rozliczenie robocizny"
      hint={SETTLEMENT_MODE_DESCRIPTIONS[value]}
    >
      <SimpleSelect
        value={value}
        onValueChange={(next) => onChange(next as SettlementModeT)}
        options={SETTLEMENT_MODE_SELECT_OPTIONS}
        disabled={disabled}
        variant="toolbarSm"
      />
      {vatRate === 0 && <ZeroVatWarning />}
    </SettingsSection>
  )
}
