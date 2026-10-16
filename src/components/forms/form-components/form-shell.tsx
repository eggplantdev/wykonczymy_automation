import type { ComponentType, ReactNode } from 'react'
import { FormClearButton } from './form-clear-button'

type ShellFormT = {
  AppForm: ComponentType<{ children?: ReactNode }>
  handleSubmit: () => void | Promise<void>
}

type FormShellPropsT = {
  form: ShellFormT
  onReset?: () => void
  children: ReactNode
}

export function FormShell({ form, onReset, children }: FormShellPropsT) {
  return (
    <form.AppForm>
      {onReset && <FormClearButton onReset={onReset} />}
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
