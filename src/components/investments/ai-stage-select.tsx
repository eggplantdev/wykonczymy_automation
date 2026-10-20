'use client'

import { useOptimistic, useTransition } from 'react'
import { BadgeSelect } from '@/components/ui/badge-select'
import { AiProgressBadge } from '@/components/investments/ai-progress-badge'
import { setInvestmentAiStageAction } from '@/lib/actions/investments'
import {
  AI_PROGRESS_STEPS,
  AI_STAGE_GATHERING,
  INVESTMENT_AI_STAGE_LABELS,
  isInvestmentAiStage,
  type InvestmentAiStageT,
} from '@/lib/constants/investment-ai-stage'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

const OPTIONS = AI_PROGRESS_STEPS.map((step) => ({
  value: step,
  badge: <AiProgressBadge step={step} />,
  description:
    step === 'none' ? AI_STAGE_GATHERING.description : INVESTMENT_AI_STAGE_LABELS[step].description,
}))

type PropsT = {
  investmentId: number
  aiStage: InvestmentAiStageT | null
  hideChevron?: boolean
}

export function AiStageSelect({ investmentId, aiStage, hideChevron }: PropsT) {
  const [value, setValue] = useOptimistic(aiStage)
  const [isPending, startTransition] = useTransition()

  function handleChange(next: string) {
    const stage = isInvestmentAiStage(next) ? next : null
    startTransition(async () => {
      setValue(stage)
      const result = await settleAction(() => setInvestmentAiStageAction(investmentId, stage))
      if (!result.success) toastMessage(result.error, 'error')
    })
  }

  return (
    <BadgeSelect
      value={value ?? 'none'}
      options={OPTIONS}
      onValueChange={handleChange}
      disabled={isPending}
      hideChevron={hideChevron}
    />
  )
}
