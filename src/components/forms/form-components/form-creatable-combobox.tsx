'use client'

import { Combobox } from '@/components/ui/combobox'
import FormBase from './form-base'
import { FormControlPropsT } from '../types/form-types'
import { useFieldContext } from '../hooks/form-context'

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
        variant="field"
        invalid={field.state.meta.errors.length > 0}
        className="w-full"
        contentClassName="w-(--radix-popover-trigger-width)"
        placeholder={placeholder}
      />
    </FormBase>
  )
}
