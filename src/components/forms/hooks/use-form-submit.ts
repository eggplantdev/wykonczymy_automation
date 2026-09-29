import { logError } from '@/lib/utils/log-error'
import { toastMessage } from '@/lib/utils/toast'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ActionResultT } from '@/types/action'

type SubmitOptionsT = {
  action: () => Promise<ActionResultT>
  successMessage: string
  files?: Map<number, File[]>
  onSubmitSuccess: () => void
  /** Clearing in full, the form reset included — this hook never touches the form. */
  onReset: () => void
}

export function useFormSubmit(formId: string) {
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  const isRecovering = submission?.formId === formId && submission.status === 'failed'
  const recoveredFiles = isRecovering ? submission.invoiceFiles : undefined

  async function submit(keepOpen: boolean, opts: SubmitOptionsT) {
    if (isRecovering) clearSubmission()

    if (keepOpen) {
      let result: ActionResultT
      try {
        result = await opts.action()
      } catch (err) {
        // A save that throws rather than returning a failure — dropped connection, a deploy
        // invalidating the action id — would otherwise end in silence, the form looking untouched.
        logError('[FORM_SUBMIT]', err)
        toastMessage(
          err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd',
          'error',
          5000,
        )
        return
      }
      if (result.success) {
        toastMessage(opts.successMessage, 'success')
        if (result.warning) toastMessage(result.warning, 'warning', 6000)
        opts.onReset()
      } else {
        toastMessage(result.error, 'error')
      }
    } else {
      submitOptimistically(
        formId,
        opts.files ?? new Map(),
        opts.action,
        opts.successMessage,
        opts.onReset,
      )
      opts.onSubmitSuccess()
    }
  }

  return { recoveredFiles, submit } as const
}
