import { toastMessage } from '@/components/toasts'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ActionResultT } from '@/lib/actions/utils'

type ResettableFormT = { reset: () => void }

type SubmitOptionsT = {
  form: ResettableFormT
  action: () => Promise<ActionResultT>
  successMessage: string
  files?: Map<number, File>
  onSubmitSuccess: () => void
  onReset?: () => void
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
      const result = await opts.action()
      if (result.success) {
        toastMessage(opts.successMessage, 'success')
        opts.form.reset()
        opts.onReset?.()
      } else {
        toastMessage(result.error, 'error')
      }
    } else {
      submitOptimistically(formId, opts.files ?? new Map(), opts.action, opts.successMessage, () =>
        opts.onReset?.(),
      )
      opts.onSubmitSuccess()
    }
  }

  return { recoveredFiles, submit } as const
}
