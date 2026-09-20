'use client'

import { DecimalField } from '@/components/ui/decimal-field'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { PLANE_LABELS } from '@/lib/kosztorys/constants'
import { MAX_CLIENT_SHARE } from '@/lib/kosztorys/subcontractor-price-guard'

// Sourced from the constant rather than typed as „0,65": a hardcoded ceiling here would drift from
// the rule the cells enforce, and the field would promise a limit it no longer has.
const COEFF_DESCRIPTION = [
  'Cena wykonawcy = cena dla inwestora × mnożnik.',
  '0,65 = wykonawca dostaje 65% ceny dla inwestora.',
  'Dziedziczą go pozycje ze źródłem ceny „auto".',
  `Maksymalnie ${MAX_CLIENT_SHARE.toLocaleString('pl-PL')} — wyżej wykonawca zjada marżę.`,
].join('\n')

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
}

export function KosztorysGlobalSettings({ globalCoeffs, onGlobalCoeffChange }: PropsT) {
  // One row, label first — the same shape as the rozliczenie selects on the other tabs, so every tab
  // opens on a line of controls rather than each inventing its own header block.
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        Mnożnik ceny
        <InfoTooltip content={COEFF_DESCRIPTION} label="Więcej o: mnożnik ceny" />
      </span>
      <DecimalField
        label={
          <span className="inline-flex items-center gap-1">
            {planeIcon('w_tools', 'size-3.5')}
            {PLANE_LABELS.w_tools}
          </span>
        }
        value={globalCoeffs.wTools}
        min={0}
        max={MAX_CLIENT_SHARE}
        onCommit={(n) => onGlobalCoeffChange({ wToolsCoeff: n })}
      />
      <DecimalField
        label={
          <span className="inline-flex items-center gap-1">
            {planeIcon('own_tools', 'size-3.5')}
            {PLANE_LABELS.own_tools}
          </span>
        }
        value={globalCoeffs.ownTools}
        min={0}
        max={MAX_CLIENT_SHARE}
        onCommit={(n) => onGlobalCoeffChange({ ownToolsCoeff: n })}
      />
    </div>
  )
}
