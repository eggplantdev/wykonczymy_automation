'use client'

import { Combobox } from '@/components/ui/combobox'
import FormBase from './form-base'
import { FormControlPropsT } from '../types/form-types'
import { useFieldContext } from '../hooks/form-hooks'

// Styled like `Input`, so it reads as a field you can type into rather than as a caption.
export function FormCreatableCombobox({
  options,
  disabled,
  placeholder = 'Wybierz lub wpisz nową…',
  ...props
}: FormControlPropsT & { options: readonly string[] }) {
  const field = useFieldContext<string>()

  return (
    <FormBase {...props} showError>
      <Combobox
        value={field.state.value}
        onChange={field.handleChange}
        options={options}
        allowCustom
        disabled={disabled}
        modal
        className="border-input bg-background h-9 w-full rounded-md border px-3"
        contentClassName="w-(--radix-popover-trigger-width)"
        placeholder={placeholder}
      />
    </FormBase>
  )
}
