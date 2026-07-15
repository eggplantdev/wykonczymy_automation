'use client'

import { CoeffField } from '@/components/kosztorys/coeff-field'
import { SimpleTooltip } from '@/components/ui/tooltip'

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

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  // VAT rate as a fraction (0.08); the field shows/accepts a percent.
  vatRate: number
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
  onVatChange: (vatRate: number) => void
}

export function KosztorysGlobalSettings({
  globalCoeffs,
  vatRate,
  onGlobalCoeffChange,
  onVatChange,
}: PropsT) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <SimpleTooltip
          delayDuration={500}
          className="max-w-xs whitespace-pre-line"
          content={COEFF_TIP}
        >
          <span className="text-muted-foreground w-fit cursor-help text-xs">
            Domyślny mnożnik ceny klienta
          </span>
        </SimpleTooltip>
        <CoeffField
          label="z narzędziami"
          value={globalCoeffs.wTools}
          onCommit={(n) => n != null && onGlobalCoeffChange({ wToolsCoeff: n })}
        />
        <CoeffField
          label="bez narzędzi"
          value={globalCoeffs.ownTools}
          onCommit={(n) => n != null && onGlobalCoeffChange({ ownToolsCoeff: n })}
        />
      </div>
      {/* VAT is stored as a fraction but entered as a percent: show ×100, commit ÷100. */}
      <SimpleTooltip delayDuration={500} className="max-w-xs whitespace-pre-line" content={VAT_TIP}>
        <span className="inline-flex">
          <CoeffField
            label="VAT %"
            value={vatRate * 100}
            onCommit={(n) => n != null && onVatChange(n / 100)}
          />
        </span>
      </SimpleTooltip>
    </div>
  )
}
