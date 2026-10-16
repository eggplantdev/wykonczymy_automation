import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { cn } from '@/lib/utils/cn'
import { AI_PROGRESS_LABELS, type AiProgressStepT } from '@/lib/constants/investment-ai-stage'

const AI_PROGRESS_TONES: Record<AiProgressStepT, string> = {
  none: BADGE_TONE.muted,
  ready_for_analysis: BADGE_TONE.pending,
  analyzed: 'bg-neon-cyan/15 text-cyan-700 dark:text-neon-cyan',
  review_done: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
  knowledge_extracted: BADGE_TONE.positive,
  new_information: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

export const AI_PROGRESS_OUTLINE_TONES: Record<AiProgressStepT, string> = {
  none: '',
  ready_for_analysis: 'border-amber-400 text-amber-700 dark:border-amber-700 dark:text-amber-300',
  analyzed: 'border-neon-cyan text-cyan-700 dark:text-neon-cyan',
  review_done: 'border-violet-400 text-violet-700 dark:border-violet-700 dark:text-violet-300',
  knowledge_extracted:
    'border-emerald-400 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300',
  new_information: 'border-orange-400 text-orange-700 dark:border-orange-700 dark:text-orange-300',
}

export function AiProgressBadge({ step }: { step: AiProgressStepT }) {
  return <span className={cn(BADGE_BASE, AI_PROGRESS_TONES[step])}>{AI_PROGRESS_LABELS[step]}</span>
}
