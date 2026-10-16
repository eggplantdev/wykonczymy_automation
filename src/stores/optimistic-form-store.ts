import { create } from 'zustand'
import { usePendingStore } from '@/stores/pending-store'
import { toastMessage } from '@/lib/utils/toast'
import { logError } from '@/lib/utils/log-error'
import { settleAction } from '@/lib/utils/settle-action'
import type { ActionResultT } from '@/types/action'

type PendingSubmissionT = {
  formId: string
  invoiceFiles: Map<number, File[]>
  status: 'pending' | 'failed'
  error: string | null
}

type OptimisticFormStoreT = {
  openFormId: string | null
  openDialog: (formId: string, showKeepOpen?: boolean) => void
  closeDialog: () => void

  keepOpen: boolean
  showKeepOpen: boolean
  setKeepOpen: (keepOpen: boolean) => void

  submission: PendingSubmissionT | null
  submitOptimistically: (
    formId: string,
    invoiceFiles: Map<number, File[]>,
    action: () => Promise<ActionResultT>,
    successMessage: string,
    onSuccess: () => void,
  ) => void
  clearSubmission: () => void
}

export const useOptimisticFormStore = create<OptimisticFormStoreT>()((set) => ({
  openFormId: null,
  submission: null,
  keepOpen: false,
  showKeepOpen: false,

  openDialog: (formId, showKeepOpen = true) =>
    set({ openFormId: formId, keepOpen: false, showKeepOpen }),
  // Closing the dialog must not abort in-flight work: the optimistic submit path closes the
  // dialog *while* the save runs, so a 'pending' submission has to survive (the global indicator
  // reads it).
  closeDialog: () =>
    set((state) => ({
      openFormId: null,
      showKeepOpen: false,
      submission: state.submission?.status === 'pending' ? state.submission : null,
    })),
  setKeepOpen: (keepOpen) => set({ keepOpen }),

  submitOptimistically: (formId, invoiceFiles, action, successMessage, onSuccess) => {
    set({
      openFormId: null,
      submission: { formId, invoiceFiles, status: 'pending', error: null },
    })

    usePendingStore.getState().start(formId, 'Zapisywanie…')

    settleAction(action)
      .then((result) => {
        if (result.success) {
          set({ submission: null })
          onSuccess()
          toastMessage(successMessage, 'success', 1000)
          if (result.warning) toastMessage(result.warning, 'warning', 6000)
        } else {
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
        // Only our own handlers land here (`settleAction` folds a failed request into the result), so
        // their message is a developer's, not the user's.
        logError('[OPTIMISTIC_SUBMIT]', err)
        const errorMessage = 'Wystąpił nieoczekiwany błąd'
        set((state) => ({
          openFormId: formId,
          submission: state.submission
            ? { ...state.submission, status: 'failed', error: errorMessage }
            : null,
        }))
        toastMessage(errorMessage, 'error', 5000)
      })
      // a throw inside a handler (toast, onSuccess) would
      // otherwise leave the pill up forever with no dialog on screen to explain it.
      .finally(() => usePendingStore.getState().stop(formId))
  },

  clearSubmission: () => set({ submission: null }),
}))
