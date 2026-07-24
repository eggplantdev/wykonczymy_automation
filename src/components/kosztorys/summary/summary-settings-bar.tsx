'use client'

import { DecimalField } from '@/components/ui/decimal-field'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { SimpleSelect } from '@/components/ui/simple-select'
import { HintTooltip } from '@/components/ui/tooltip'
import type { DiscountTypeT } from '@/lib/kosztorys/types'

// Radix Select rejects an empty-string item value, so "brak" (clear the discount) carries this.
const NONE = 'none'

const DISCOUNT_MODE_OPTIONS = [
  { value: NONE, label: 'brak', className: 'text-muted-foreground' },
  { value: 'amount', label: 'zł' },
  { value: 'percent', label: '%' },
]

const VAT_TIP = [
  'Stawka VAT dla całej inwestycji.',
  'Ceny wpisujesz netto — Brutto i Suma brutto liczą się z tej stawki.',
].join('\n')

const DISCOUNT_TIP = [
  'Rabat za całość wykonanych prac, wpisywany raz na cały kosztorys.',
  'Gdy ustawiony, nadpisuje rabaty per pozycja — ich kolumny znikają i przestają liczyć (dane zostają).',
  'Odejmuje się raz od sumy wykonanych prac; wpisujesz netto (kwota) lub punkty procentowe.',
].join('\n')

// VAT + rabat, lifted out of the toolbar to sit at the top of the Podsumowanie tab. Reads the setters
// straight from the editor context (the panel renders inside the provider), so no props thread through
// KosztorysTotalsPanel.
export function SummarySettingsBar() {
  const { tree, globalDiscount, handleVatChange, handleGlobalDiscountChange } =
    useKosztorysEditorContext()

  return (
    <div className="flex w-full flex-wrap items-center gap-x-4">
      {/* VAT is stored as a fraction but entered as a percent: show ×100, commit ÷100. */}
      <DecimalField
        label="VAT %"
        hint={VAT_TIP}
        value={tree.vatRate * 100}
        valueClassName="text-foreground"
        onCommit={(n) => n != null && handleVatChange(n / 100)}
      />
      <div className="flex items-center gap-2">
        <HintTooltip content={DISCOUNT_TIP} className="text-muted-foreground text-xs">
          Rabat całościowy
        </HintTooltip>
        {globalDiscount.type != null && (
          <DecimalField
            label=""
            value={globalDiscount.value}
            valueClassName="text-chart-green"
            onCommit={(n) =>
              handleGlobalDiscountChange({ type: globalDiscount.type, value: n ?? 0 })
            }
          />
        )}
        {/* "brak" clears the discount (type null); the value field shows only once a mode is
            chosen. Value entered netto (zł) or as percentage points (%). */}
        <SimpleSelect
          value={globalDiscount.type ?? NONE}
          onValueChange={(v) => {
            const type = v === NONE ? null : (v as DiscountTypeT)
            handleGlobalDiscountChange({ type, value: type == null ? 0 : globalDiscount.value })
          }}
          options={DISCOUNT_MODE_OPTIONS}
          variant="soft"
          className={globalDiscount.type == null ? 'text-muted-foreground' : undefined}
        />
      </div>
    </div>
  )
}
