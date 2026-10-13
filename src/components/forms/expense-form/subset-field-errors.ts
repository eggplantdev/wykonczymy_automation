import type { z } from 'zod'

// A paragon is validated on its own, so the schema numbers its rows within the subset; the error
// goes back to the row's place in the form. An issue on the list itself names no field.
export function subsetFieldErrors(
  issues: z.core.$ZodIssue[],
  formIndexOf: (subsetIndex: number) => number,
): [name: string, message: string][] {
  return issues.flatMap(({ path, message }): [string, string][] => {
    const [head, subsetIndex, field] = path
    if (head !== 'lineItems') return typeof head === 'string' ? [[head, message]] : []
    if (typeof subsetIndex !== 'number' || typeof field !== 'string') return []
    return [[`lineItems[${formIndexOf(subsetIndex)}].${field}`, message]]
  })
}
