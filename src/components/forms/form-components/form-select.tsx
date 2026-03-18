import { Select, SelectContent, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ReactNode } from 'react'
import FormBase from './form-base'
import { FormControlPropsT } from '../types/form-types'
import { useFieldContext } from '../hooks/form-hooks'

export function FormSelect({
  children,
  disabled,
  ...props
}: FormControlPropsT & { children: ReactNode }) {
  const field = useFieldContext<string>()
  return (
    <FormBase {...props}>
      <Select
        value={field.state.value ?? ''}
        onValueChange={(e) => e !== '' && field.handleChange(e)}
        disabled={disabled}
      >
        <SelectTrigger
          aria-invalid={field.state.meta.errors.length > 0}
          id={field.name}
          onBlur={field.handleBlur}
          className={props.className}
        >
          <SelectValue placeholder={props.placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </FormBase>
  )
}
