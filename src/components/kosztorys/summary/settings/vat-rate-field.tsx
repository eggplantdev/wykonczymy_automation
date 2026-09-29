'use client'

import { SettingsSection } from '@/components/kosztorys/summary/settings/settings-section'
import { DecimalField } from '@/components/ui/decimal-field'
import { ratePercent } from '@/lib/kosztorys/format'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

const VAT_TIP = [
  'Stawka VAT dla całej inwestycji.',
  'Ceny wpisujesz netto — Brutto i Suma brutto liczą się z tej stawki.',
].join('\n')

// Reads the setter straight from the editor context (the panel renders inside the provider), so no
// prop threads through KosztorysTotalsPanel.
export function VatRateField({ disabled = false }: { disabled?: boolean }) {
  const { tree, handleVatChange } = useKosztorysEditorContext()

  return (
    <SettingsSection title="VAT" subtitle="Wybierz stawkę vat" hint={VAT_TIP}>
      {/* VAT is stored as a fraction but entered as a percent: show ×100, commit ÷100. */}
      <DecimalField
        suffix="%"
        withSave
        value={ratePercent(tree.vatRate)}
        valueClassName="text-foreground"
        min={0}
        max={100}
        disabled={disabled}
        onCommit={(n) => handleVatChange(n / 100)}
      />
    </SettingsSection>
  )
}
