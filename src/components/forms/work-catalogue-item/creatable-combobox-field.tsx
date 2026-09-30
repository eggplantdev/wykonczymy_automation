'use client'

import { Combobox } from '@/components/ui/combobox'
import { useFieldContext } from '@/components/forms/hooks/form-hooks'
import FormBase from '@/components/forms/form-components/form-base'

// Styled like `Input`, so it reads as a field you can type into rather than as a caption.
export function CreatableComboboxField({
  label,
  options,
}: {
  label: string
  options: readonly string[]
}) {
  const field = useFieldContext<string>()

  return (
    <FormBase label={label} showError>
      <Combobox
        value={field.state.value}
        onChange={field.handleChange}
        options={options}
        allowCustom
        modal
        className="border-input bg-background h-9 w-full rounded-md border px-3"
        contentClassName="w-(--radix-popover-trigger-width)"
        placeholder="Wybierz lub wpisz nową…"
      />
    </FormBase>
  )
}
