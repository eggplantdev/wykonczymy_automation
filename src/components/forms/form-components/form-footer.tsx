import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useFormContext } from '../hooks/form-hooks'
import { useFormStatus } from '../hooks/use-form-status'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { Loader } from '@/components/ui/loader/loader'
import { useTranslation } from '@/hooks/use-translation'

type FormFooterPropsT = {
  label?: string
  submittingLabel?: string
  className?: string
  // Block submit on top of the form's own isSubmitting — e.g. while files are still ingesting, so a
  // row can't save before its processed file lands in the ref (would upload nothing for that row).
  disabled?: boolean
  // The form counts as submitting while its question is open, and the full-screen loader would cover
  // the question.
  awaitingAnswer?: boolean
  onCancel?: () => void
  secondaryAction?: React.ReactNode
}

export default function FormFooter({
  label,
  submittingLabel,
  className,
  disabled = false,
  awaitingAnswer = false,
  onCancel,
  secondaryAction,
}: FormFooterPropsT) {
  const form = useFormContext()
  const { t } = useTranslation('common')
  const keepOpen = useOptimisticFormStore((s) => s.keepOpen)
  const showKeepOpen = useOptimisticFormStore((s) => s.showKeepOpen)
  const setKeepOpen = useOptimisticFormStore((s) => s.setKeepOpen)

  const { isInvalid, isSubmitting } = useFormStatus(form)

  return (
    <>
      <footer className={className}>
        <div className="flex items-center gap-4">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {t('cancel')}
            </Button>
          )}
          <Button disabled={isSubmitting || disabled} type="submit">
            {isSubmitting && submittingLabel ? submittingLabel : (label ?? t('add'))}
          </Button>
          {secondaryAction}
          {showKeepOpen && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm select-none">
              <Checkbox
                checked={keepOpen}
                onCheckedChange={(checked) => setKeepOpen(checked === true)}
              />
              {t('keepOpen')}
            </label>
          )}
        </div>
        {isInvalid && (
          <p className="text-destructive mt-2 text-sm font-medium">{t('formHasErrors')}</p>
        )}
      </footer>
      <Loader loading={isSubmitting && !awaitingAnswer} portal />
    </>
  )
}
