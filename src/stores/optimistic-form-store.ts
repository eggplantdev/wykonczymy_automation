import { create } from 'zustand'
import { toastMessage } from '@/components/toasts'
import type { ActionResultT } from '@/lib/actions/utils'

type PendingSubmissionT = {
  formId: string
  formValues: Record<string, unknown>
  invoiceFiles: Map<number, File>
  status: 'pending' | 'failed'
  error: string | null
}

type OptimisticFormStoreT = {
  // Dialog open/close — which formId is currently open (null = all closed)
  openFormId: string | null
  openDialog: (formId: string) => void
  closeDialog: () => void

  // Submission state
  submission: PendingSubmissionT | null
  submitOptimistically: (
    formId: string,
    formValues: Record<string, unknown>,
    invoiceFiles: Map<number, File>,
    action: () => Promise<ActionResultT>,
    successMessage: string,
  ) => void
  clearSubmission: () => void
}

export const useOptimisticFormStore = create<OptimisticFormStoreT>()((set) => ({
  openFormId: null,
  submission: null,

  openDialog: (formId) => set({ openFormId: formId }),
  closeDialog: () => set({ openFormId: null }),

  submitOptimistically: (formId, formValues, invoiceFiles, action, successMessage) => {
    // Close dialog + save form snapshot
    set({
      openFormId: null,
      submission: { formId, formValues, invoiceFiles, status: 'pending', error: null },
    })

    // Fire-and-forget — runs after dialog unmounts
    action()
      .then((result) => {
        if (result.success) {
          set({ submission: null })
          toastMessage(successMessage, 'success', 1000)
        } else {
          // Reopen dialog with failed state
          set((state) => ({
            openFormId: formId,
            submission: state.submission
              ? { ...state.submission, status: 'failed', error: result.error }
              : null,
          }))
          toastMessage(result.error, 'error', 5000)
        }
      })
      .catch((err) => {
        console.error('[OPTIMISTIC_SUBMIT]', err)
        const errorMessage = err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd'
        set((state) => ({
          openFormId: formId,
          submission: state.submission
            ? { ...state.submission, status: 'failed', error: errorMessage }
            : null,
        }))
        toastMessage(errorMessage, 'error', 5000)
      })
  },

  clearSubmission: () => set({ submission: null }),
}))
