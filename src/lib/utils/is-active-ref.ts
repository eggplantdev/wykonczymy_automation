// Reference-data rows carry `active` as OPTIONAL, and an absent flag means active — so the test is
// `!== false`, never `=== true`. Named once because getting it backwards silently empties a picker.
export const isActiveRef = (item: { active?: boolean }) => item.active !== false

// Whatever the field is ALREADY holding survives a picker's filter, even once that entity stops
// matching it. Dropping it renders the picker with no selection, and the user's next save silently
// writes the emptied value back (EX-643).
//
// Ids are compared as strings because form state keeps selections as strings while reference rows
// keep them numeric; the caller shouldn't have to remember which side it's on.
export function matchingOrSelected<ItemT extends { id: number }>(
  items: ItemT[],
  matches: (item: ItemT) => boolean,
  selectedId: string | number | null | undefined,
): ItemT[] {
  const selected = selectedId == null ? null : String(selectedId)
  return items.filter((item) => matches(item) || String(item.id) === selected)
}

export function activeOrSelected<ItemT extends { id: number; active?: boolean }>(
  items: ItemT[],
  activeOnly: boolean,
  selectedId: string | number | null | undefined,
): ItemT[] {
  return matchingOrSelected(items, (item) => !activeOnly || isActiveRef(item), selectedId)
}
