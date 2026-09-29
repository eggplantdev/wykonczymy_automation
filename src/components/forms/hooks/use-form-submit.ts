import { settleAction } from '@/lib/utils/settle-action'
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
      const result = await settleAction(opts.action)
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
