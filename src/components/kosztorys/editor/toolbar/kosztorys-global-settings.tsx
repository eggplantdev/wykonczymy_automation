'use client'

import { DecimalField } from '@/components/ui/decimal-field'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { planeIcon } from '@/components/kosztorys/editor/plane-icons'
import { FLAGGED_TONE } from '@/components/kosztorys/flagged-tone'
import { PLANE_LABELS } from '@/lib/kosztorys/labels'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import type { ToolPlaneT } from '@/lib/kosztorys/types'
import {
  clientShareCeilingLabel,
  coeffWarning,
  isCoeffFlagged,
} from '@/lib/kosztorys/subcontractor-price-guard'
import { NOTICE_MS } from '@/lib/utils/notice'
import { toastMessage } from '@/lib/utils/toast'

// Sourced from the constant rather than typed as „0,65": a hardcoded ceiling here would drift from
// the rule the cells enforce, and the field would promise a limit it no longer has. Both progi are
// named, because they differ per plane and the tooltip sits above both fields at once.
const COEFF_DESCRIPTION = [
  'Cena wykonawcy = cena dla inwestora × mnożnik.',
  '0,65 = wykonawca dostaje 65% ceny dla inwestora.',
  'Dziedziczą go pozycje ze źródłem ceny „auto".',
  ...TOOL_PLANES.map(
    (plane) =>
      `${PLANE_LABELS[plane]}: powyżej ${clientShareCeilingLabel(plane)} ceny wykonawca zjada marżę — wolno, ale na czerwono.`,
  ),
  '0 = wykonawca nie dostaje nic — też na czerwono.',
].join('\n')

function CoeffField({
  plane,
  value,
  onCommit,
}: {
  plane: ToolPlaneT
  value: number
  onCommit: (n: number) => void
}) {
  return (
    <DecimalField
      label={
        <span className="inline-flex items-center gap-1">
          {planeIcon(plane, 'size-3.5')}
          {PLANE_LABELS[plane]}
        </span>
      }
      value={value}
      // A hard refusal, unlike the ceiling above it: a negative mnożnik prices work at less than
      // nothing and is a typo, not a deal (owner, 2026-09-21).
      min={0}
      valueClassName={isCoeffFlagged(value, plane) ? FLAGGED_TONE : undefined}
      onCommit={(n) => {
        // DecimalField commits on every blur — it re-parses the input rather than comparing it to
        // the value it was given — so without this, merely tabbing through a field already over the
        // ceiling toasts, saves and stacks an undo entry for a change nobody made.
        if (n === value) return
        const warning = coeffWarning(n, plane)
        if (warning) toastMessage(warning, 'warning', NOTICE_MS)
        onCommit(n)
      }}
    />
  )
}

type PropsT = {
  globalCoeffs: { wTools: number; ownTools: number }
  onGlobalCoeffChange: (patch: { wToolsCoeff?: number; ownToolsCoeff?: number }) => void
}

export function KosztorysGlobalSettings({ globalCoeffs, onGlobalCoeffChange }: PropsT) {
  return (
    <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1">
      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
        Mnożnik ceny
        <InfoTooltip content={COEFF_DESCRIPTION} label="Więcej o: mnożnik ceny" />
      </span>
      <CoeffField
        plane="w_tools"
        value={globalCoeffs.wTools}
        onCommit={(n) => onGlobalCoeffChange({ wToolsCoeff: n })}
      />
      <CoeffField
        plane="own_tools"
        value={globalCoeffs.ownTools}
        onCommit={(n) => onGlobalCoeffChange({ ownToolsCoeff: n })}
      />
    </div>
  )
}
