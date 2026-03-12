import * as React from 'react'

export type FormControlPropsT = {
  label?: string
  labelExtra?: React.ReactNode
  description?: string
  placeholder?: string
  showError?: boolean
  disabled?: boolean
  type?: React.ComponentProps<'input'>['type']
  autoComplete?: React.ComponentProps<'input'>['autoComplete']
  className?: string
}

/**
 * Field API type for use in form.AppField render children.
 * Mirrors the registered field components from form-hooks.ts.
 */
export type AppFieldComponentsT = {
  Input: React.FC<FormControlPropsT>
  Select: React.FC<FormControlPropsT & { children: React.ReactNode }>
  Combobox: React.FC<
    FormControlPropsT & {
      items: { value: string; label: string }[]
      searchPlaceholder?: string
      emptyMessage?: string
    }
  >
  Checkbox: React.FC<FormControlPropsT>
  Textarea: React.FC<FormControlPropsT & { rows?: number }>
  FileInput: React.FC<FormControlPropsT>
}
