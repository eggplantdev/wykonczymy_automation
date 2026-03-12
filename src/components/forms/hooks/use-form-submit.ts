import { toastMessage } from '@/components/toasts'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ActionResultT } from '@/lib/actions/utils'

type SubmitOptionsT = {
  action: () => Promise<ActionResultT>
  successMessage: string
  formValues: Record<string, unknown>
  files?: Map<number, File>
  onSubmitSuccess: () => void
  onKeepOpenSuccess: () => void
}

export function useFormSubmit<TValues>(formId: string) {
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)

  const isRecovering = submission?.formId === formId && submission.status === 'failed'
  const recoveredValues = isRecovering ? (submission.formValues as TValues) : undefined
  const recoveredFiles = isRecovering ? submission.invoiceFiles : undefined

  async function submit(keepOpen: boolean, opts: SubmitOptionsT) {
    if (isRecovering) clearSubmission()

    if (keepOpen) {
      const result = await opts.action()
      if (result.success) {
        toastMessage(opts.successMessage, 'success')
        opts.onKeepOpenSuccess()
      } else {
        toastMessage(result.error, 'error')
      }
    } else {
      submitOptimistically(
        formId,
        opts.formValues,
        opts.files ?? new Map(),
        opts.action,
        opts.successMessage,
      )
      opts.onSubmitSuccess()
    }
  }

  return { isRecovering, recoveredValues, recoveredFiles, submit } as const
}
