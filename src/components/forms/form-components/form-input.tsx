import { Input } from '@/components/ui/input'
import { FormControlPropsT } from '../types/form-types'
import FormBase from './form-base'
import { useFieldContext } from '../hooks/form-hooks'

/** Normalize pasted numeric text: strip spaces, swap comma for dot. */
function sanitizeNumericInput(raw: string): string {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  return cleaned
}

export function FormInput(props: FormControlPropsT) {
  const field = useFieldContext<string>()
  const isInvalid = field.state.meta.errors.length > 0
  const isNumeric = props.type === 'number'

  return (
    <FormBase {...props}>
      <Input
        placeholder={props.placeholder}
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => {
          const value = isNumeric ? sanitizeNumericInput(e.target.value) : e.target.value
          field.handleChange(value)
        }}
        aria-invalid={isInvalid}
        type={isNumeric ? 'text' : props.type}
        inputMode={isNumeric ? 'decimal' : undefined}
        autoComplete={props.autoComplete}
        className={props.className}
      />
    </FormBase>
  )
}
