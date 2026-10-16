'use client'

import { useState } from 'react'
import { INVESTOR_IMPACT_TITLE } from '@/lib/kosztorys/investor-impact'

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
