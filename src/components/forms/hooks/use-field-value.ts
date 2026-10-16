import { useStore } from '@/components/forms/hooks/form-hooks'

// `name` is assumed to be a flat key — a nested path ('a.b') would index `values` literally and
// return undefined, silently dropping the selection.
export function useFieldValue<ValueT = string>(
  form: { store: unknown },
  name: string,
): ValueT | undefined {
  return useStore(
    form.store as Parameters<typeof useStore>[0],
    (state: unknown) => (state as { values: Record<string, ValueT> }).values[name],
  )
}
