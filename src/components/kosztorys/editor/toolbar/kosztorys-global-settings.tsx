'use client'

import { DecimalField } from '@/components/ui/decimal-field'
import type { PriceViewT } from '@/lib/kosztorys/calc'

const COEFF_TIP = [
  'Domyślny mnożnik ceny klienta.',
  'Cena wykonawcy = cena klienta × mnożnik.',
  '0,65 = wykonawca dostaje 65% ceny klienta.',
  'Dziedziczą go pozycje ze źródłem ceny „auto".',
  'Sekcja może go nadpisać — inny mnożnik dla każdej sekcji (panel Sekcje).',
  'Możesz go też nadpisać per pozycja własnym mnożnikiem lub kwotą stałą.',
].join('\n')

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  // Active price view — the mnożnik feeds the wykonawca price, so the „Klient" view has no use for
  // it, and each wykonawca view only edits its own coefficient.
  view: PriceViewT
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
}

export function KosztorysGlobalSettings({ globalCoeffs, view, onGlobalCoeffChange }: PropsT) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {view === 'w_tools' && (
        <DecimalField
          label="Mnożnik ceny wykonawcy z narzędziami"
          hint={COEFF_TIP}
          value={globalCoeffs.wTools}
          onCommit={(n) => n != null && onGlobalCoeffChange({ wToolsCoeff: n })}
        />
      )}
      {view === 'own_tools' && (
        <DecimalField
          label="Mnożnik ceny wykonawcy bez narzędzi"
          hint={COEFF_TIP}
          value={globalCoeffs.ownTools}
          onCommit={(n) => n != null && onGlobalCoeffChange({ ownToolsCoeff: n })}
        />
      )}
    </div>
  )
}
