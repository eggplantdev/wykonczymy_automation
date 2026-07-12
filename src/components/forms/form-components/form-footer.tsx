import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useFormContext } from '../hooks/form-hooks'
import { useFormStatus } from '../hooks/use-form-status'
import { useOptimisticFormStore } from '@/stores/optimistic-form-store'
import { Loader } from '@/components/ui/loader/loader'

type FormFooterPropsT = {
  label?: string
  submittingLabel?: string
  className?: string
}

export default function FormFooter({
  label = 'Dodaj',
  submittingLabel,
  className,
}: FormFooterPropsT) {
  const form = useFormContext()
  const keepOpen = useOptimisticFormStore((s) => s.keepOpen)
  const showKeepOpen = useOptimisticFormStore((s) => s.showKeepOpen)
  const setKeepOpen = useOptimisticFormStore((s) => s.setKeepOpen)

  const { isInvalid, isSubmitting } = useFormStatus(form)

  return (
    <>
      <footer className={className}>
        <div className="flex items-center gap-4">
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting && submittingLabel ? submittingLabel : label}
          </Button>
          {showKeepOpen && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm select-none">
              <Checkbox
                checked={keepOpen}
                onCheckedChange={(checked) => setKeepOpen(checked === true)}
              />
              Nie zamykaj po zapisaniu
            </label>
          )}
        </div>
        {isInvalid && (
          <p className="text-destructive mt-2 text-sm font-medium">Formularz zawiera błędy</p>
        )}
      </footer>
      <Loader loading={isSubmitting} portal />
    </>
  )
}
