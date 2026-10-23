import type { ReactNode } from 'react'
import FormBase from '@/components/forms/form-components/form-base'
import { Description } from '@/components/ui/description'

type EmptyFieldMessagePropsT = {
  label: string
  message: string
  labelExtra?: ReactNode
}

export function EmptyFieldMessage({ label, message, labelExtra }: EmptyFieldMessagePropsT) {
  return (
    <FormBase label={label} labelExtra={labelExtra}>
      <Description withIcon={false}>{message}</Description>
    </FormBase>
  )
}
