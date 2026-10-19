import { formOptions } from '@tanstack/react-form'
import type { ComponentProps } from 'react'

import { withForm } from '@/components/forms/hooks/form-hooks'

function _formApiProbe<TValues>() {
  return withForm({ ...formOptions({ defaultValues: {} as TValues }), render: () => null })
}

export type FormApiOfT<TValues> = ComponentProps<ReturnType<typeof _formApiProbe<TValues>>>['form']

export type ArrayFieldT<RowT> = {
  state: { value: RowT[] }
  pushValue: (value: RowT) => void
  removeValue: (index: number) => void
}
