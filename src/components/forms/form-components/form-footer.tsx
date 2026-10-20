import { Button } from '@/components/ui/button'
import { CheckboxRow } from '@/components/ui/checkbox-row'
import { Description } from '@/components/ui/description'
import { useFormContext } from '../hooks/form-context'
import { useFormStatus } from '../hooks/use-form-status'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { Loader } from '@/components/ui/loader/loader'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'

type FormFooterPropsT = {
  label?: string
  submittingLabel?: string
  className?: string
  align?: 'start' | 'end'
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
  align = 'start',
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
        <div className={cn('flex items-center gap-4', align === 'end' && 'justify-end')}>
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
            <CheckboxRow
              variant="plain"
              checked={keepOpen}
              onCheckedChange={setKeepOpen}
              className="ml-auto select-none"
            >
              {t('keepOpen')}
            </CheckboxRow>
          )}
        </div>
        {isInvalid && (
          <Description tone="error" withIcon={false} className="mt-2 font-medium">
            {t('formHasErrors')}
          </Description>
        )}
      </footer>
      <Loader loading={isSubmitting && !awaitingAnswer} portal />
    </>
  )
}
