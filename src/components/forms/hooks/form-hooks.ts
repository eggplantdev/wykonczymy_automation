import type { ReactNode } from 'react'
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

import { useStore } from '@tanstack/react-form'

import { FormCheckbox } from '../form-components/form-checkbox'
import { FormCombobox } from '../form-components/form-combobox'
import { FormDatePicker } from '../form-components/form-date-picker'
import { FormSelect } from '../form-components/form-select'
import { FormTextarea } from '../form-components/form-textarea'
import { FormInput } from '../form-components/form-input'
const fieldComponents = {
  Input: FormInput,
  Select: FormSelect,
  Combobox: FormCombobox,
  DatePicker: FormDatePicker,
  Checkbox: FormCheckbox,
  Textarea: FormTextarea,
}

/**
 * Derived from the registration above, never restated — a hand-written copy once declared a `rows`
 * prop the real Textarea never accepted, and tsc checked call sites against the copy.
 */
type AppFieldComponentsT = typeof fieldComponents

/**
 * The minimum a `form-fields/` wrapper needs from a form — one wrapper serves several forms, and
 * restating TanStack's thirteen generics is not viable. Checks the field NAME only: TanStack opens
 * an unknown name at `undefined`, so a renamed schema field would otherwise render an empty input
 * that saves nothing, with a green typecheck.
 */
export type FormWithFieldT<TName extends string> = {
  AppField: (props: {
    name: TName
    // Stays `any`: TanStack types a listener by the field's VALUE, which this type declines to name.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners?: any
    children: (field: AppFieldComponentsT) => ReactNode
  }) => ReactNode | Promise<ReactNode>
  resetField: (name: TName) => void
  setFieldValue: (name: TName, value: string) => void
  // Only `useFieldValue` reaches for it, and it re-types the store itself.
  store: unknown
}

const { useAppForm, withForm } = createFormHook({
  fieldComponents,
  formComponents: {},
  fieldContext,
  formContext,
})

export { useFieldContext, useFormContext, useStore }

export { useAppForm, withForm }
