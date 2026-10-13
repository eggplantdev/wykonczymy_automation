import { Textarea } from '@/components/ui/textarea'
import FormBase from './form-base'
import { FormControlPropsT } from '../types/form-types'
import { useFieldContext } from '../hooks/form-hooks'

export function FormTextarea(props: FormControlPropsT & { rows?: number }) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.errors.length > 0

  return (
    <FormBase {...props}>
      <Textarea
        placeholder={props.placeholder}
        rows={props.rows}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        aria-invalid={isInvalid}
        disabled={props.disabled}
        className={props.className}
      />
    </FormBase>
  )
}
