import { foldText } from '@/lib/utils/fold-text'
import { hasLegacyMarker, stripLegacyMarker } from '@/lib/kosztorys/work-catalogue/legacy-marker'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// TEMPORARY (EX-748 review): the katalog was filled from old client sheets, so it carries rows that
// are not prace at all — notes, estimates, a single flat's rooms — plus twins that differ only by
// j.m. This paints them so the owner can delete them by eye; it decides nothing and is deleted with
// the review.
export type SuspectLevelT = 'junk' | 'duplicate'

export type SuspectT = { level: SuspectLevelT; reason: string }

const normalize = (description: string) =>
  foldText(stripLegacyMarker(description))
    .replace(/[^a-z0-9]+/gu, ' ')
    .trim()

// A rule reaches the first three; the rest is a hand-picked list, because „Montaż" alone being
// useless while „Montaż lamp" is fine is not a pattern.
const JUNK_RULES: readonly { test: RegExp; reason: string }[] = [
  { test: /\?/u, reason: 'pytanie do klienta, nie praca' },
  {
    test: /do ustalenia|do uzgodnienia|po obejrzeniu|przyjmujemy|w zależności|zależy od|sugeruję|polecam|szacunkowo|minimum/iu,
    reason: 'notatka handlowa w opisie',
  },
  { test: /\d+\s?%/u, reason: 'procent z jednego kosztorysu' },
  {
    test: /\b\d+\s?(szt|m2|mb|paczek|piętra|jednostek)\b/iu,
    reason: 'ilość z jednego kosztorysu w opisie',
  },
  {
    // Not „balkon" / „strych": those change the PRACA (inna hydroizolacja, inne dojście), where
    // „salon" or „pralnia" only says which flat it was priced for.
    test: /\b(salon|salonie|sypialni\w*|gabinet|gabinecie|garderob\w*|pralni\w*|kotlown\w*|kotłown\w*|spiżarni\w*|garaż\w*|korytarz\w*|parter|parterze|poziom -1)\b/iu,
    reason: 'pomieszczenie konkretnego mieszkania',
  },
]

const JUNK_DESCRIPTIONS: readonly string[] = [
  'montaz',
  'zabudowa',
  'zabudowa gk',
  'wycena',
  'szacunkowo',
  'kamery',
  'wsporniki',
  'akrylowanie',
  'fugowanie',
  'gruntowanie',
  'tapetowanie',
  'cyklinowanie',
  'silikonowanie',
  'montaz led',
  'montaz listwy',
  'sufit gk',
  'suchy syfon',
  'jednostka',
  'jednostka clivia',
  'mocowanie rur',
  'ukladanie rur',
  'skucie wylewki 100',
  'prace projektowe',
  'paliwo dwa wyjazdy minimum',
]

// Numbers stay in the token set: „do 12 cm" and „12-20 cm" are different prace, and dropping the
// digits would collapse them into one.
const tokens = (normalized: string) =>
  [...new Set(normalized.split(' ').filter((word) => word.length > 2 || /\d/u.test(word)))].sort()

const junkReason = (description: string, normalized: string) => {
  if (JUNK_DESCRIPTIONS.includes(normalized)) return 'opis zbyt ogólny'
  return JUNK_RULES.find((rule) => rule.test.test(description))?.reason
}

/**
 * Two passes, and „bez sensu" wins over „duplikat" — a row that is not a praca goes regardless of
 * whether it has a twin.
 *
 * ONLY rows still carrying „[stary arkusz]" are flagged: zdjęcie dopisku is the owner's „sprawdzone"
 * gesture, so the same click that clears the note drops the row out of these lists. A wzór row was
 * reviewed before it ever reached the katalog and is never coloured.
 */
export function findSuspects(items: readonly WorkCatalogueItemT[]): Map<number, SuspectT> {
  const suspects = new Map<number, SuspectT>()
  const byText = new Map<string, WorkCatalogueItemT[]>()

  for (const item of items) {
    const normalized = normalize(item.description)
    if (hasLegacyMarker(item.description)) {
      const reason = junkReason(item.description, normalized)
      if (reason) suspects.set(item.id, { level: 'junk', reason })
    }

    // The wzór rows join the twin groups they are not flagged in: „ten sam opis" is a fact about the
    // PAIR, and the import is the half that has to go.
    const key = tokens(normalized).join(' ')
    byText.set(key, [...(byText.get(key) ?? []), item])
  }

  for (const twins of byText.values()) {
    if (twins.length < 2) continue
    const units = [...new Set(twins.map((item) => item.unit))].join(', ')
    for (const item of twins)
      if (!suspects.has(item.id) && hasLegacyMarker(item.description))
        suspects.set(item.id, {
          level: 'duplicate',
          reason: `${twins.length}× ten sam opis (${units})`,
        })
  }

  return suspects
}
