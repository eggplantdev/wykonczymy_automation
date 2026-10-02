import { create } from 'zustand'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ReviewRequestInvestmentT } from '@/types/reference-data'

export const REVIEW_PROMPT_FORM_ID = 'review-prompt'

type ReviewPromptStoreT = {
  target: ReviewRequestInvestmentT | undefined
  openReviewPrompt: (target: ReviewRequestInvestmentT) => void
}

// The prompt after „Zakończona" cannot live on the row that triggered it: the listing hides
// completed investments by default, so the refresh unmounts that row. The target is held here and
// rendered by `ReviewPromptHost`, which the shell mounts once.
export const useReviewPromptStore = create<ReviewPromptStoreT>()((set) => ({
  target: undefined,
  openReviewPrompt: (target) => {
    set({ target })
    useOptimisticFormStore.getState().openDialog(REVIEW_PROMPT_FORM_ID, false)
  },
}))
