'use client'

import { useState } from 'react'
import { INVESTOR_IMPACT_TITLE } from '@/lib/kosztorys/investor-impact'

/**
 * The dialog that stands in front of every setting whose consequence lands on the investor's link —
 * tryb rozliczenia robocizny and tryb rozliczenia materiałów. Both share one failure: a misclick in a
 * picker whose consequence is not on the screen the picker sits on, so both get the same window and
 * the same title.
 *
 * Holds the staged action rather than running it: the answer only arrives when the owner presses
 * „Potwierdź", and undo/redo replay the underlying apply directly, so a Ctrl+Z never lands here.
 */
export function useInvestorImpactConfirm() {
  const [staged, setStaged] = useState<{ description: string; apply: () => void } | null>(null)

  return {
    stageInvestorImpact: (description: string, apply: () => void) =>
      setStaged({ description, apply }),
    investorImpactConfirm: {
      open: staged !== null,
      title: INVESTOR_IMPACT_TITLE,
      description: staged?.description,
      onConfirm: () => {
        staged?.apply()
        setStaged(null)
      },
      onCancel: () => setStaged(null),
    },
  }
}
