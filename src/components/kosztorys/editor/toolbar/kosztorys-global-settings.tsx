'use client'

import { DecimalField } from '@/components/ui/decimal-field'
import { InfoTooltip } from '@/components/ui/info-tooltip'

const COEFF_TIP = [
  'Cena wykonawcy = cena klienta × mnożnik.',
  '0,65 = wykonawca dostaje 65% ceny klienta.',
  'Dziedziczą go pozycje ze źródłem ceny „auto".',
].join('\n')

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
}

export function KosztorysGlobalSettings({ globalCoeffs, onGlobalCoeffChange }: PropsT) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
        Mnożnik ceny:
        <InfoTooltip content={COEFF_TIP} label="Jak działa mnożnik ceny" />
      </span>
      <DecimalField
        label="z narzędziami"
        value={globalCoeffs.wTools}
        onCommit={(n) => onGlobalCoeffChange({ wToolsCoeff: n })}
      />
      <DecimalField
        label="bez narzędzi"
        value={globalCoeffs.ownTools}
        onCommit={(n) => onGlobalCoeffChange({ ownToolsCoeff: n })}
      />
    </div>
  )
}
