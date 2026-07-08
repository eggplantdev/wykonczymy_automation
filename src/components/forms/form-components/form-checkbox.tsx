import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils/cn'
import { useFieldContext } from '../hooks/form-hooks'
import { FormControlPropsT } from '../types/form-types'
import FormBase from './form-base'

export function FormCheckbox(props: FormControlPropsT) {
  const field = useFieldContext<boolean>()
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid

  return (
    <FormBase {...props} controlFirst horizontal>
      <Checkbox
        id={field.name}
        name={field.name}
        checked={field.state.value}
        onBlur={field.handleBlur}
        onCheckedChange={(e) => field.handleChange(e === true)}
        aria-invalid={isInvalid}
        className={cn('mr-2', props.className)}
      />
    </FormBase>
  )
}
