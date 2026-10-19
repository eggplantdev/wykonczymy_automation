import { Badge, type BadgeToneT } from '@/components/ui/badge'
import { AI_PROGRESS_LABELS, type AiProgressStepT } from '@/lib/constants/investment-ai-stage'

export const AI_PROGRESS_TONES: Record<AiProgressStepT, BadgeToneT> = {
  none: 'muted',
  ready_for_analysis: 'pending',
  analyzed: 'cyan',
  review_done: 'violet',
  knowledge_extracted: 'positive',
  new_information: 'orange',
}

export function AiProgressBadge({ step }: { step: AiProgressStepT }) {
  return <Badge tone={AI_PROGRESS_TONES[step]}>{AI_PROGRESS_LABELS[step]}</Badge>
}
