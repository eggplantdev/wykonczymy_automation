import type { ReactNode } from 'react'
import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

import { useStore } from '@tanstack/react-form'

import { FormCheckbox } from '../form-components/form-checkbox'
import { FormCombobox } from '../form-components/form-combobox'
import { FormCreatableCombobox } from '../form-components/form-creatable-combobox'
import { FormDatePicker } from '../form-components/form-date-picker'
import { FormSelect } from '../form-components/form-select'
import { FormTextarea } from '../form-components/form-textarea'
import { FormInput } from '../form-components/form-input'
const fieldComponents = {
  Input: FormInput,
  Select: FormSelect,
  Combobox: FormCombobox,
  CreatableCombobox: FormCreatableCombobox,
  DatePicker: FormDatePicker,
  Checkbox: FormCheckbox,
  Textarea: FormTextarea,
}

type AppFieldComponentsT = typeof fieldComponents

/**
 * TanStack opens
 * an unknown name at `undefined`, so a renamed schema field would otherwise render an empty input
 * that saves nothing, with a green typecheck.
 */
export type FormWithFieldT<TName extends string> = {
  AppField: (props: {
    name: TName
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listeners?: any
    children: (field: AppFieldComponentsT) => ReactNode
  }) => ReactNode | Promise<ReactNode>
  resetField: (name: TName) => void
  setFieldValue: (name: TName, value: string) => void
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
