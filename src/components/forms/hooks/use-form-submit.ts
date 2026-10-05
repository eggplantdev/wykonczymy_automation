import { useI18nContext } from '@/hooks/use-translation'
import { failureMessage } from '@/lib/i18n/failure-message'
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
  /** After a confirmed write — unlike `onSubmitSuccess`, which the optimistic path fires first. */
  onSaved?: () => void
  /**
   * Wait for the result before closing, for a form with no draft: the open dialog is the only copy
   * of what was typed, so an optimistic close loses it on a failed save.
   */
  awaitBeforeClose?: boolean
}

export function useFormSubmit(formId: string) {
  const submission = useOptimisticFormStore((s) => s.submission)
  const submitOptimistically = useOptimisticFormStore((s) => s.submitOptimistically)
  const clearSubmission = useOptimisticFormStore((s) => s.clearSubmission)
  const { locale } = useI18nContext()

  const isRecovering = submission?.formId === formId && submission.status === 'failed'
  const recoveredFiles = isRecovering ? submission.invoiceFiles : undefined

  // Settled here rather than in the store, so a lost request is worded in the reader's language too.
  const settleInLocale = (action: () => Promise<ActionResultT>) => async () => {
    const result = await settleAction(action)
    return result.success ? result : { ...result, error: failureMessage(locale, result) }
  }

  async function submit(keepOpen: boolean, opts: SubmitOptionsT) {
    if (isRecovering) clearSubmission()
    const action = settleInLocale(opts.action)

    if (keepOpen || opts.awaitBeforeClose) {
      const result = await action()
      if (result.success) {
        toastMessage(opts.successMessage, 'success')
        if (result.warning) toastMessage(result.warning, 'warning', 6000)
        opts.onReset()
        if (!keepOpen) opts.onSubmitSuccess()
        opts.onSaved?.()
      } else {
        toastMessage(result.error, 'error')
      }
    } else {
      submitOptimistically(formId, opts.files ?? new Map(), action, opts.successMessage, () => {
        opts.onReset()
        opts.onSaved?.()
      })
      opts.onSubmitSuccess()
    }
  }

  return { recoveredFiles, submit } as const
}
