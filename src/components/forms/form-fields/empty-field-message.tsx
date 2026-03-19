import type { ReactNode } from 'react'
import FormBase from '@/components/forms/form-components/form-base'

type EmptyFieldMessagePropsT = {
  label: string
  message: string
  labelExtra?: ReactNode
}

export function EmptyFieldMessage({ label, message, labelExtra }: EmptyFieldMessagePropsT) {
  return (
    <FormBase label={label} labelExtra={labelExtra}>
      <p className="text-muted-foreground text-sm">{message}</p>
    </FormBase>
  )
}
