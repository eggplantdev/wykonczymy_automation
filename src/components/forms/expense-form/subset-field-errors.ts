import type { z } from 'zod'

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
