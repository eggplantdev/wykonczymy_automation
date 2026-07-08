import { useRouter } from 'next/navigation'
import { toastMessage } from '@/lib/utils/toast'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import type { ActionResultT } from '@/types/action'

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
  const router = useRouter()
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
        // The server action revalidates the cache tag; refresh re-renders the RSC
        // tree so the new row is visible without a manual reload.
        router.refresh()
      } else {
        toastMessage(result.error, 'error')
      }
    } else {
      submitOptimistically(
        formId,
        opts.files ?? new Map(),
        opts.action,
        opts.successMessage,
        () => {
          opts.onReset?.()
          router.refresh()
        },
      )
      opts.onSubmitSuccess()
    }
  }

  return { recoveredFiles, submit } as const
}
