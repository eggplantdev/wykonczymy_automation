import type { ExpenseCategoryRefT } from '@/types/reference-data'

// Map an extracted category NAME to the id-as-string the expenseCategory field expects
// (see expense-category-field.tsx — items use `String(cat.id)`). Exact-match-or-blank:
// a hallucinated name resolves to '' so the required-field validation forces a manual pick —
// a wrong category id can never be written.
export function resolveExpenseCategoryId(name: string, categories: ExpenseCategoryRefT[]): string {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return ''
  const match = categories.find((cat) => cat.name.trim().toLowerCase() === normalized)
  return match ? String(match.id) : ''
}
