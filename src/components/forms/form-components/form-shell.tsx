import type { ComponentType, ReactNode } from 'react'
import { FormClearButton } from './form-clear-button'

// The pieces of a useAppForm instance this shell drives — kept structural so any
// form (regardless of its value generics) satisfies it.
type ShellFormT = {
  AppForm: ComponentType<{ children?: ReactNode }>
  handleSubmit: () => void | Promise<void>
}

type FormShellPropsT = {
  form: ShellFormT
  onReset: () => void
  children: ReactNode
}

/**
 * Shared outer chrome for the transfer forms: the AppForm provider, the clear
 * button, and the native <form> whose submit defers to TanStack. Callers supply
 * their own FieldGroup + footer as children.
 */
export function FormShell({ form, onReset, children }: FormShellPropsT) {
  return (
    <form.AppForm>
      <FormClearButton onReset={onReset} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        {children}
      </form>
    </form.AppForm>
  )
}
