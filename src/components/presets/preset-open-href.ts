// The flag asks the page to load the szablon into the warsztat once it is on screen. A flag and not
// a write on navigation, because DataTable prefetches a row href on hover and the page must stay
// read-only for that to be safe.
export const OPEN_FLAG = 'open'

export function presetOpenHref(presetId: number): string {
  return `/szablony/${presetId}?${OPEN_FLAG}=1`
}
