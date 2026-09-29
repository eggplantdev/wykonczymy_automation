import { foldUnit } from '@/lib/kosztorys/sheet-import/columns'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { compareDescriptions } from '@/lib/kosztorys/work-catalogue/compare-descriptions'
import type {
  NearDuplicateKindT,
  NearDuplicateT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

const FUNCTION_WORDS = new Set([
  'a',
  'bez',
  'dla',
  'do',
  'etc',
  'i',
  'lub',
  'na',
  'np',
  'o',
  'od',
  'oraz',
  'po',
  'pod',
  'u',
  'w',
  'we',
  'wraz',
  'z',
  'ze',
])

// A decimal stays one token, so „7,5 cm" never shares its „5" with „5 cm".
const TOKEN = /[\p{L}\p{N}]+(?:[.,]\d+)*/gu

type ShapeT = { entry: WorkCatalogueItemT; numbers: string; words: string[] }

// Numbers are kept apart and must match exactly: in this cennik a number is how a variant is written
// („do 12 / 18 / 24 modułów", „5 / 7,5 cm", „Q3 / Q4"), which is why letter similarity was useless
// here — it scores those pairs highest of all.
function shapeOf(entry: WorkCatalogueItemT, units: ReadonlySet<string>): ShapeT {
  const numbers: string[] = []
  const words = new Set<string>()
  for (const token of foldDescription(entry.description).match(TOKEN) ?? []) {
    const folded = foldUnit(token)
    if (units.has(folded) || FUNCTION_WORDS.has(folded)) continue
    if (/\d/.test(folded)) numbers.push(folded)
    else words.add(folded)
  }
  return { entry, numbers: numbers.sort().join(' '), words: [...words] }
}

const sharedPrefix = (left: string, right: string) => {
  let length = 0
  while (length < left.length && left[length] === right[length]) length += 1
  return length
}

// The Polish ending is at most ~3 letters, so a word counts as the same once all but those agree —
// „syfonu" / „syfonów", „kratki" / „kratek". The floor of 4 keeps „podłodze" off „podłączenie"; the
// ending rule keeps „przedłużek" off „przedpokoju", which share five.
const sameWord = (left: string, right: string) => {
  if (left === right) return true
  const prefix = sharedPrefix(left, right)
  return prefix >= 4 && prefix >= Math.min(left.length, right.length) - 3
}

const unmatched = (words: readonly string[], against: readonly string[]) =>
  words.filter((word) => !against.some((other) => sameWord(word, other))).length

function kindOf(left: ShapeT, right: ShapeT): NearDuplicateKindT | null {
  if (Math.min(left.words.length, right.words.length) < 2) return null
  if (Math.abs(left.words.length - right.words.length) > 1) return null
  const onlyLeft = unmatched(left.words, right.words)
  const onlyRight = unmatched(right.words, left.words)
  if (onlyLeft + onlyRight === 0) return 'same'
  return onlyLeft + onlyRight === 1 ? 'oneWord' : null
}

const KIND_ORDER: Record<NearDuplicateKindT, number> = { same: 0, oneWord: 1 }

/**
 * Catalogue prace that are probably one praca written twice. Exact twins cannot exist — the cennik is
 * unique on folded opis + j.m. — so this catches what folding misses, whatever the j.m., kategoria or
 * cena. Only wpisy with a twin are keys.
 */
export function findNearDuplicates(
  catalogue: readonly WorkCatalogueItemT[],
): ReadonlyMap<number, NearDuplicateT[]> {
  // The cennik's own j.m. are what an opis spells „Skucie posadzki mb" with.
  const units = new Set(catalogue.map((entry) => foldUnit(entry.unit)).filter(Boolean))

  const byNumbers = new Map<string, ShapeT[]>()
  for (const entry of catalogue) {
    const shape = shapeOf(entry, units)
    byNumbers.set(shape.numbers, [...(byNumbers.get(shape.numbers) ?? []), shape])
  }

  const twins = new Map<number, NearDuplicateT[]>()
  const add = (of: WorkCatalogueItemT, twin: NearDuplicateT) =>
    twins.set(of.id, [...(twins.get(of.id) ?? []), twin])

  for (const shapes of byNumbers.values()) {
    for (let i = 0; i < shapes.length; i += 1) {
      for (let j = i + 1; j < shapes.length; j += 1) {
        const kind = kindOf(shapes[i], shapes[j])
        if (!kind) continue
        add(shapes[i].entry, { entry: shapes[j].entry, kind })
        add(shapes[j].entry, { entry: shapes[i].entry, kind })
      }
    }
  }

  for (const list of twins.values()) {
    list.sort(
      (left, right) =>
        KIND_ORDER[left.kind] - KIND_ORDER[right.kind] ||
        compareDescriptions(left.entry.description, right.entry.description),
    )
  }
  return twins
}
