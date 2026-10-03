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
  // Dialog open/close — which formId is currently open (null = all closed)
  openFormId: string | null
  openDialog: (formId: string, showKeepOpen?: boolean) => void
  closeDialog: () => void

  // "Keep dialog open after save" toggle — dialog UI state, read by FormFooter (the checkbox)
  // and FormDialog (handleSuccess). Only one dialog is open at a time, so a single field suffices.
  keepOpen: boolean
  showKeepOpen: boolean
  setKeepOpen: (keepOpen: boolean) => void

  // Submission state
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

  // Reset keepOpen on every fresh open so a prior "keep open" choice doesn't stick across reopens
  // (the Dialog is always mounted, so local state would persist). A failed submit reopens via
  // submitOptimistically, which leaves keepOpen untouched — preserving the choice for the retry.
  openDialog: (formId, showKeepOpen = true) =>
    set({ openFormId: formId, keepOpen: false, showKeepOpen }),
  // Closing the dialog must not abort in-flight work: the optimistic submit path closes the
  // dialog *while* the save runs, so a 'pending' submission has to survive (the global indicator
  // reads it). Only a settled/failed submission clears on dismiss.
  // `showKeepOpen` resets too: a dialog that never calls `openDialog` would otherwise inherit the
  // previous one's checkbox, which it has no way to honour.
  closeDialog: () =>
    set((state) => ({
      openFormId: null,
      showKeepOpen: false,
      submission: state.submission?.status === 'pending' ? state.submission : null,
    })),
  setKeepOpen: (keepOpen) => set({ keepOpen }),

  submitOptimistically: (formId, invoiceFiles, action, successMessage, onSuccess) => {
    // Close dialog + save file snapshot
    set({
      openFormId: null,
      submission: { formId, invoiceFiles, status: 'pending', error: null },
    })

    // This store owns recovery state (which dialog to reopen, which files to restore); the pill is
    // raised through the generic pending store so the indicator has one source instead of two.
    // Keyed on formId, so two dialogs saving at once can't clear each other's pill.
    usePendingStore.getState().start(formId, 'Zapisywanie…')

    // Fire-and-forget — runs after dialog unmounts
    settleAction(action)
      .then((result) => {
        if (result.success) {
          set({ submission: null })
          onSuccess()
          toastMessage(successMessage, 'success', 1000)
          if (result.warning) toastMessage(result.warning, 'warning', 6000)
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
      // finally, not a stop() per branch: a throw inside a handler (toast, onSuccess) would
      // otherwise leave the pill up forever with no dialog on screen to explain it.
      .finally(() => usePendingStore.getState().stop(formId))
  },

  clearSubmission: () => set({ submission: null }),
}))
