import { createFormHook, createFormHookContexts } from '@tanstack/react-form'

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts()

import { useStore } from '@tanstack/react-form'

import { FormCheckbox } from '../form-components/form-checkbox'
import { FormCombobox } from '../form-components/form-combobox'
import { FormFileInput } from '../form-components/form-file-input'
import { FormSelect } from '../form-components/form-select'
import { FormTextarea } from '../form-components/form-textarea'
import { FormInput } from '../form-components/form-input'
// Create the full form hook with field components
const { useAppForm } = createFormHook({
  fieldComponents: {
    Input: FormInput,
    Select: FormSelect,
    Combobox: FormCombobox,
    Checkbox: FormCheckbox,
    Textarea: FormTextarea,
    FileInput: FormFileInput,
  },
  formComponents: {},
  fieldContext,
  formContext,
})

export { useFieldContext, useFormContext, useStore }

// Export form hook
export { useAppForm }
