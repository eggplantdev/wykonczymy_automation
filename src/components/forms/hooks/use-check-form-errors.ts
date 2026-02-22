import { type AnyFormApi, useStore } from '@tanstack/react-form'

export default function useCheckFormErrors(form: AnyFormApi) {
  const formErrors = useStore(form.store, (s) => s.errors)
  const fieldMeta = useStore(form.store, (s) => s.fieldMeta)

  // 1. Form-level errors (from schema validator)
  if (formErrors.length > 0) {
    console.group('🚫 Form Validation Errors')
    console.table(formErrors[0])
    console.groupEnd()
  }

  // 2. Field-specific errors
  const fieldsWithErrors = (Object.entries(fieldMeta) as [string, { errors: unknown[] }][])
    .filter(([_, meta]) => meta.errors.length > 0)
    .map(([name, meta]) => ({
      field: name,
      errors: meta.errors.map((e: unknown) =>
        typeof e === 'object' && e && 'message' in e
          ? (e as { message?: string }).message
          : String(e),
      ),
    }))

  if (fieldsWithErrors.length > 0) {
    console.group('⚠️ Field Validation Errors')
    console.table(fieldsWithErrors)
    console.groupEnd()
  }
}
