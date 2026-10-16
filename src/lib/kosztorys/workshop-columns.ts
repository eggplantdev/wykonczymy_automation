import { ALL_PLANE_PRICE_KEYS } from '@/lib/kosztorys/plane-price-keys'
import { ALL_TRANSLATION_COLUMN_KEYS } from '@/lib/kosztorys/translation-column-keys'

// No `priceGross`: it is a COMPUTED column, netto × the row's VAT — and a preset's `settings` are
// retained but ignored on apply, so that VAT never travels to the next budowa.
export const WORKSHOP_VISIBLE_COLUMNS: ReadonlySet<string> = new Set([
  'actions',
  'sectionName',
  'description',
  ...ALL_TRANSLATION_COLUMN_KEYS,
  'unit',
  'price',
  ...ALL_PLANE_PRICE_KEYS,
  'workNote',
])

// Out of the workbench picker: „Ukryj wszystkie" would otherwise take away the only route to usuń /
// przesuń / wstaw a pozycja, with no sign on the grid of where it went.
export const WORKSHOP_UNPICKABLE_COLUMNS: ReadonlySet<string> = new Set(['actions'])
