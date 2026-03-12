import { Button } from '@/components/ui/button'
import { useFormContext } from '../hooks/form-hooks'
import { useFormStatus } from '../hooks/use-form-status'
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

  const { isInvalid, isSubmitting } = useFormStatus(form)

  return (
    <>
      <footer className={className}>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting && submittingLabel ? submittingLabel : label}
        </Button>
        {isInvalid && (
          <p className="text-destructive mt-2 text-sm font-medium">Formularz zawiera błędy</p>
        )}
      </footer>
      <Loader loading={isSubmitting} portal />
    </>
  )
}
