'use client'

import { CoeffField } from '@/components/kosztorys/coeff-field'
import { SimpleSelect } from '@/components/ui/simple-select'
import { HintTooltip } from '@/components/ui/tooltip'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { DiscountTypeT, GlobalDiscountT } from '@/lib/kosztorys/types'

// Radix Select rejects an empty-string item value, so "brak" (clear the discount) carries this.
const NONE = 'none'

const DISCOUNT_MODE_OPTIONS = [
  { value: NONE, label: 'brak', className: 'text-muted-foreground' },
  { value: 'amount', label: 'zł' },
  { value: 'percent', label: '%' },
]

const COEFF_TIP = [
  'Domyślny mnożnik ceny klienta.',
  'Cena wykonawcy = cena klienta × mnożnik.',
  '0,65 = wykonawca dostaje 65% ceny klienta.',
  'Dziedziczą go pozycje ze źródłem ceny „auto".',
  'Sekcja może go nadpisać — inny mnożnik dla każdej sekcji (panel Sekcje).',
  'Możesz go też nadpisać per pozycja własnym mnożnikiem lub kwotą stałą.',
].join('\n')

const VAT_TIP = [
  'Stawka VAT dla całej inwestycji.',
  'Ceny wpisujesz netto — Brutto i Suma brutto liczą się z tej stawki.',
].join('\n')

const DISCOUNT_TIP = [
  'Rabat za całość wykonanych prac, wpisywany raz na cały kosztorys.',
  'Gdy ustawiony, nadpisuje rabaty per pozycja — ich kolumny znikają i przestają liczyć (dane zostają).',
  'Odejmuje się raz od sumy wykonanych prac; wpisujesz netto (kwota) lub punkty procentowe.',
].join('\n')

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  // VAT rate as a fraction (0.08); the field shows/accepts a percent.
  vatRate: number
  globalDiscount: GlobalDiscountT
  // Active price view — the mnożnik feeds the wykonawca price, so the „Klient" view has no use for
  // it, and each wykonawca view only edits its own coefficient.
  view: PriceViewT
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
  onVatChange: (vatRate: number) => void
  onGlobalDiscountChange: (next: GlobalDiscountT) => void
}

export function KosztorysGlobalSettings({
  globalCoeffs,
  vatRate,
  globalDiscount,
  view,
  onGlobalCoeffChange,
  onVatChange,
  onGlobalDiscountChange,
}: PropsT) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {view === 'w_tools' && (
        <CoeffField
          label="Mnożnik ceny wykonawcy z narzędziami"
          hint={COEFF_TIP}
          value={globalCoeffs.wTools}
          onCommit={(n) => n != null && onGlobalCoeffChange({ wToolsCoeff: n })}
        />
      )}
      {view === 'own_tools' && (
        <CoeffField
          label="Mnożnik ceny wykonawcy bez narzędzi"
          hint={COEFF_TIP}
          value={globalCoeffs.ownTools}
          onCommit={(n) => n != null && onGlobalCoeffChange({ ownToolsCoeff: n })}
        />
      )}
      {/* VAT is stored as a fraction but entered as a percent: show ×100, commit ÷100. */}
      <CoeffField
        label="VAT %"
        hint={VAT_TIP}
        value={vatRate * 100}
        valueClassName="text-foreground"
        onCommit={(n) => n != null && onVatChange(n / 100)}
      />
      <div className="flex items-center gap-2">
        <HintTooltip content={DISCOUNT_TIP} className="text-muted-foreground text-xs">
          Rabat
        </HintTooltip>
        {globalDiscount.type != null && (
          <CoeffField
            label=""
            value={globalDiscount.value}
            valueClassName="text-chart-green"
            onCommit={(n) => onGlobalDiscountChange({ type: globalDiscount.type, value: n ?? 0 })}
          />
        )}
        {/* "brak" clears the discount (type null); the value field shows only once a mode is
            chosen. Value entered netto (zł) or as percentage points (%). */}
        <SimpleSelect
          value={globalDiscount.type ?? NONE}
          onValueChange={(v) => {
            const type = v === NONE ? null : (v as DiscountTypeT)
            onGlobalDiscountChange({ type, value: type == null ? 0 : globalDiscount.value })
          }}
          options={DISCOUNT_MODE_OPTIONS}
          variant="soft"
          className={globalDiscount.type == null ? 'text-muted-foreground' : undefined}
        />
      </div>
    </div>
  )
}
