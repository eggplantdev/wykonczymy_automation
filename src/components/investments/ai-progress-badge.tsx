import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { AI_PROGRESS_LABELS, type AiProgressStepT } from '@/lib/constants/investment-ai-stage'

const STEP_CLASSNAMES: Record<AiProgressStepT, string> = {
  none: BADGE_TONE.muted,
  ready_for_analysis: BADGE_TONE.pending,
  analyzed: 'bg-neon-cyan/15 text-cyan-700 dark:text-neon-cyan',
  review_done: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  knowledge_extracted: BADGE_TONE.positive,
}

export function AiProgressBadge({ step }: { step: AiProgressStepT }) {
  return <span className={cn(BADGE_BASE, STEP_CLASSNAMES[step])}>{AI_PROGRESS_LABELS[step]}</span>
}
