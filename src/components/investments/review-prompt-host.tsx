'use client'

import { RequestReviewDialog } from '@/components/dialogs/request-review-dialog'
import { REVIEW_PROMPT_FORM_ID, useReviewPromptStore } from '@/stores/review-prompt-store'

export function ReviewPromptHost() {
  const target = useReviewPromptStore((s) => s.target)
  if (!target) return null

  return <RequestReviewDialog investment={target} formId={REVIEW_PROMPT_FORM_ID} trigger={null} />
}
