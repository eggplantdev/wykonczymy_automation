import { foldUnit } from '@/lib/kosztorys/fold'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'

// A praca with no j.m. still needs a key member: Postgres compares NULLs as distinct, so an empty
// half would let two "same opis, no j.m." rows both pass the UNIQUE index.
const NO_UNIT = '~'

// Reuses the sheet import's `foldDescription` — the two must agree, or „Popraw literówki" would split
// a catalogue entry off from the rozpiska praca it was saved from.
export function catalogueKey(description: string, unit: string | null): string {
  return `${foldDescription(description)}|${foldUnit(unit) || NO_UNIT}`
}
