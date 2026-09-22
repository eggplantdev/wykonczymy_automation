import { foldUnit } from '@/lib/kosztorys/sheet-import/columns'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'

// A praca with no j.m. still needs a key member: Postgres compares NULLs as distinct, so an empty
// half would let two "same opis, no j.m." rows both pass the UNIQUE index.
const NO_UNIT = '~'

// The catalogue's identity for a praca. Deliberately reuses the sheet import's `foldDescription`
// rather than a second folding rule — the two must agree, or „Popraw literówki" would split a
// catalogue entry off from the rozpiska praca it was saved from.
//
// Unlike `itemKey` this drops the section: the katalog is global, so the same praca appearing in
// „Łazienka 1" and „Kuchnia" is ONE cennik entry. The j.m. joins the key instead, because the same
// opis priced per m² and per szt. is genuinely two prices.
export function catalogueKey(description: string, unit: string | null): string {
  return `${foldDescription(description)}|${foldUnit(unit) || NO_UNIT}`
}
