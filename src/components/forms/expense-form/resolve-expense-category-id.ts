// Exact-match-or-blank: a hallucinated name resolves to '' so the required-field validation forces a
// manual pick.
export function resolveExpenseCategoryId(
  name: string,
  categories: { id: number; name: string }[],
): string {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return ''
  const match = categories.find((cat) => cat.name.trim().toLowerCase() === normalized)
  return match ? String(match.id) : ''
}
