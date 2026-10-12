'use client'

import { useOptimistic, useTransition } from 'react'
import {
  BookOpenCheck,
  ClipboardList,
  FolderInput,
  SearchCheck,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { SimpleSelect } from '@/components/ui/simple-select'
import { AI_PROGRESS_OUTLINE_TONES } from '@/components/investments/ai-progress-badge'
import { setInvestmentAiStageAction } from '@/lib/actions/investments'
import {
  AI_STAGE_GATHERING,
  INVESTMENT_AI_STAGES,
  INVESTMENT_AI_STAGE_LABELS,
  isInvestmentAiStage,
  type InvestmentAiStageT,
} from '@/lib/constants/investment-ai-stage'
import { settleAction } from '@/lib/utils/settle-action'
import { toastMessage } from '@/lib/utils/toast'

// Radix Select refuses an empty-string item value, so „Uzupełnianie informacji” (no stored stage) needs a sentinel.
const NO_STAGE = 'none'

const STAGE_ICONS: Record<InvestmentAiStageT, LucideIcon> = {
  ready_for_analysis: ClipboardList,
  analyzed: Sparkles,
  review_done: SearchCheck,
  knowledge_extracted: BookOpenCheck,
}

const OPTIONS = [
  {
    value: NO_STAGE,
    label: AI_STAGE_GATHERING.pl,
    icon: FolderInput,
    description: AI_STAGE_GATHERING.description,
    tone: AI_PROGRESS_OUTLINE_TONES.none,
  },
  ...INVESTMENT_AI_STAGES.map((stage) => ({
    value: stage,
    label: INVESTMENT_AI_STAGE_LABELS[stage].pl,
    icon: STAGE_ICONS[stage],
    description: INVESTMENT_AI_STAGE_LABELS[stage].description,
    tone: AI_PROGRESS_OUTLINE_TONES[stage],
  })),
]

type PropsT = {
  investmentId: number
  aiStage: InvestmentAiStageT | null
}

export function AiStageSelect({ investmentId, aiStage }: PropsT) {
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
    <SimpleSelect
      variant="toolbarSm"
      value={value ?? NO_STAGE}
      onValueChange={handleChange}
      options={OPTIONS}
      disabled={isPending}
      className={AI_PROGRESS_OUTLINE_TONES[value ?? 'none']}
    />
  )
}
