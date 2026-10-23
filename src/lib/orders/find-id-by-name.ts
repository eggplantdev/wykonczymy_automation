// The owner names categories and registers freely („Big bag 1 m³", „Kasa Big Bag"), and an exact
// match would leave the order's field blank.
export function findIdByName(fragment: string, items: { id: number; name: string }[]): string {
  const needle = fragment.trim().toLowerCase()
  const match = items.find((item) => item.name.toLowerCase().includes(needle))
  return match ? String(match.id) : ''
}
