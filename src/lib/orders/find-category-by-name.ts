// The owner names categories freely („Big bag 1 m³"), and an exact match would leave the order's
// category blank.
export function findCategoryIdByName(
  fragment: string,
  categories: { id: number; name: string }[],
): string {
  const needle = fragment.trim().toLowerCase()
  const match = categories.find((category) => category.name.toLowerCase().includes(needle))
  return match ? String(match.id) : ''
}
