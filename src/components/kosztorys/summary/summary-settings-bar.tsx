'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { DecimalField } from '@/components/ui/decimal-field'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PercentRabatTool } from '@/components/kosztorys/summary/percent-rabat-tool'
import { HintTooltip } from '@/components/ui/tooltip'

const VAT_TIP = [
  'Stawka VAT dla całej inwestycji.',
  'Ceny wpisujesz netto — Brutto i Suma brutto liczą się z tej stawki.',
].join('\n')

const DISCOUNT_TIP = [
  'Gdy ustawiony, nadpisuje rabaty per pozycja — ich kolumny znikają i przestają liczyć (dane zostają).',
  'Odejmuje się raz od sumy wykonanych prac; wpisujesz kwotę netto.',
].join('\n')

// VAT + rabat, lifted out of the toolbar to sit at the top of the Podsumowanie tab. Reads the setters
// straight from the editor context (the panel renders inside the provider), so no props thread through
// KosztorysTotalsPanel.
export function SummarySettingsBar() {
  const {
    tree,
    globalDiscount,
    handleVatChange,
    handleGlobalDiscountChange,
    handleApplyPercentRabat,
  } = useKosztorysEditorContext()

  return (
    <div className="flex w-full flex-col gap-2">
      {/* VAT is stored as a fraction but entered as a percent: show ×100, commit ÷100. */}
      <DecimalField
        label="VAT %"
        hint={VAT_TIP}
        value={tree.vatRate * 100}
        valueClassName="text-foreground"
        onCommit={(n) => handleVatChange(n / 100)}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          {/* Checked = amount discount on (netto zł); unchecking clears it (type null). Percent is
              never a stored mode here — that's the one-shot PercentRabatTool beside this. */}
          <label className="flex items-center gap-2">
            <Checkbox
              checked={globalDiscount.type != null}
              onCheckedChange={(c) =>
                handleGlobalDiscountChange({
                  type: c === true ? 'amount' : null,
                  value: c === true ? globalDiscount.value : 0,
                })
              }
            />
            <HintTooltip content={DISCOUNT_TIP} className="text-muted-foreground text-xs">
              Rabat kwotowy
            </HintTooltip>
          </label>
          {globalDiscount.type != null && (
            <DecimalField
              label=""
              value={globalDiscount.value}
              valueClassName="text-chart-green"
              onCommit={(n) => handleGlobalDiscountChange({ type: 'amount', value: n })}
            />
          )}
        </div>
        <PercentRabatTool
          onApply={handleApplyPercentRabat}
          disabled={globalDiscount.type != null}
        />
      </div>
    </div>
  )
}
