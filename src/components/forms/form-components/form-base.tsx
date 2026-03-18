import * as React from 'react'
import { ReactNode } from 'react'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field'
import { FormControlPropsT } from '../types/form-types'
import { useFieldContext } from '../hooks/form-hooks'

type FormBasePropsT = FormControlPropsT & {
  children: ReactNode
  horizontal?: boolean
  controlFirst?: boolean
}

export default function FormBase({
  children,
  label,
  labelExtra,
  description,
  controlFirst,
  horizontal,
  showError,
  fieldClassName,
}: FormBasePropsT) {
  const field = useFieldContext()
  const isInvalid = field.state.meta.errors.length > 0
  const errorElem = showError && isInvalid && <FieldError errors={field.state.meta.errors} />

  const labelElem =
    label &&
    (labelExtra ? (
      <div className="flex items-center justify-between">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {labelExtra}
      </div>
    ) : (
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
    ))

  return (
    <Field
      data-invalid={isInvalid}
      orientation={horizontal ? 'horizontal' : undefined}
      className={fieldClassName}
    >
      {controlFirst ? (
        <>
          {children}
          <FieldContent>
            {labelElem}
            {description && <FieldDescription>{description}</FieldDescription>}
            {errorElem}
          </FieldContent>
        </>
      ) : (
        <>
          {labelElem}
          {children}
          {description && <FieldDescription>{description}</FieldDescription>}
          {errorElem}
        </>
      )}
    </Field>
  )
}
