'use client'

import { SearchSelect, type SearchSelectItemT } from '@/components/ui/search-select'
import FormBase from './form-base'
import { FormControlPropsT } from '../types/form-types'
import { useFieldContext } from '../hooks/form-hooks'

type FormComboboxPropsT = FormControlPropsT & {
  items: SearchSelectItemT[]
  searchPlaceholder?: string
  emptyMessage?: string
}

export function FormCombobox({
  items,
  searchPlaceholder,
  emptyMessage,
  disabled,
  ...props
}: FormComboboxPropsT) {
  const field = useFieldContext<string>()

  return (
    <FormBase {...props}>
      <SearchSelect
        value={field.state.value}
        onChange={(value) => field.handleChange(value)}
        items={items}
        placeholder={props.placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        disabled={disabled}
        id={field.name}
        onBlur={field.handleBlur}
        isInvalid={field.state.meta.errors.length > 0}
        className={props.className}
      />
    </FormBase>
  )
}
