import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { fold } from '@/lib/kosztorys/sheet-import/columns'

// Text cleanup for „Opis prac". Every rule is idempotent, so re-running over already-clean text is a
// no-op — the owner can press the button as often as they like, and the same rules can be replayed
// over a whole database without compounding.

// Ordered: `podwieszanych (obcięcie` un-closes before it re-closes, which is what keeps the closing
// paren from stacking up one per run.
export const TYPO_FIXES: readonly (readonly [string, string])[] = [
  ['fisnish', 'finish'],
  ['ścianch', 'ścianach'],
  ['sylikonow', 'silikonow'],
  ['farba silikonowa lub akrylowa', 'farbą silikonową lub akrylową'],
  ['gruntowanie farba podkładową', 'gruntowanie farbą podkładową'],
  ['na bało', 'na biało'],
  ['warstwe podkładową', 'warstwę podkładową'],
  ['smaopoziomująca', 'samopoziomująca'],
  ['skomlikowania', 'skomplikowania'],
  [' parc', ' prac'],
  ['połaczeń', 'połączeń'],
  ['( (', '('],
  ['przygotwanie', 'przygotowanie'],
  ['estetyke', 'estetykę'],
  ['tapete', 'tapetę'],
  ['lazienkach', 'łazienkach'],
  ['bialy montaz', 'biały montaż'],
  ['razem z sluchawka i deszczawnica', 'razem ze słuchawką i deszczownicą'],
  ['podlaczeniem', 'podłączeniem'],
  ['zalezy', 'zależy'],
  ['zalezno', 'zależno'],
  ['zależnosci', 'zależności'],
  ['nadproza', 'nadproża'],
  ['Przesuniecie', 'Przesunięcie'],
  ['ukrutych', 'ukrytych'],
  ['niezbdnych', 'niezbędnych'],
  ['okleajnie', 'oklejanie'],
  ['obciecie', 'obcięcie'],
  ['podwieszanych (obcięcie)', 'podwieszanych (obcięcie'],
  ['podwieszanych (obcięcie', 'podwieszanych (obcięcie)'],
  ['hydroizolacyjniej', 'hydroizolacyjnej'],
  ['listw sztukateryjnych', 'listew sztukateryjnych'],
  ['układania gresu', 'układanie gresu'],
  ['Montaż WC z podwieszanego', 'Montaż WC podwieszanego'],
  ['licowanie ścian płytkami gk', 'licowanie ścian płytami gk'],
  ['montaż płyt gk w na klej', 'montaż płyt gk na klej'],
  ['do 18modułów', 'do 18 modułów'],
  ['ścian(pianka', 'ścian (pianka'],
  ['sufitowych(osłona', 'sufitowych (osłona'],
  ['lamp(bez', 'lamp (bez'],
  ['elektrycznych:gniazdka', 'elektrycznych: gniazdka'],
  ['kanału TV -wykucie', 'kanału TV - wykucie'],
  [
    'Instalacja wod kan nowy punkty, przeniesienie, lub przedłużenie',
    'Instalacja wod-kan nowe punkty, przeniesienie lub przedłużenie',
  ],
  ['wniosek do eon', 'wniosek do E.ON'],
  ['pod prysznicem 1 półką', 'pod prysznicem z 1 półką'],
  ['złożenie i Montaż', 'złożenie i montaż'],
]

// A kropka in these does not end a sentence, so what follows it stays as written — without the list
// „układanie płytek w glifach, półeczkach itp. do 20 cm" would grow a „Do 20 cm" mid-sentence.
const ABBREVIATIONS = new Set([
  'etc.',
  'itp.',
  'itd.',
  'np.',
  'ok.',
  'tj.',
  'm.in.',
  'szt.',
  'ul.',
  'nr.',
  'max.',
  'min.',
  'śr.',
  'sr.',
  'pom.',
  'c.o.',
  'pow.',
  'ew.',
  'mb.',
  'cm.',
  'mm.',
  'szer.',
  'wys.',
  'dł.',
  'dl.',
  'gr.',
  'zł.',
  'zl.',
])

// Uppercase words that are not shouting: acronyms and product names, which must survive a CAPS LOCK
// pass verbatim („płyt GK", „RIGIPS GYPTONE"). Anything not listed here is treated as shouting.
const UPPERCASE_WORDS = new Set([
  'WC',
  'GK',
  'TV',
  'RTV',
  'AGD',
  'LED',
  'PVC',
  'PCV',
  'PCW',
  'MDF',
  'HDF',
  'XPS',
  'EPS',
  'YTONG',
  'RIGIPS',
  'GYPTONE',
  'NIDA',
  'KNAUF',
  'ATLAS',
  'CERESIT',
  'MAPEI',
  'SOPRO',
  'NPS',
  'III',
])

type WordKindT = 'shouty' | 'neutral' | 'other'

function wordKind(word: string): WordKindT {
  const letters = word.replace(/[^\p{L}]/gu, '')
  if (letters === '' || letters !== letters.toUpperCase()) {
    // No letters at all (numbers, dashes) or already carrying lowercase — neither shouts nor breaks
    // a shout, so „ZGODNIE Z PROJEKTEM" stays one run across the „Z".
    return letters === '' ? 'neutral' : 'other'
  }
  if (letters.length === 1 || UPPERCASE_WORDS.has(letters)) return 'neutral'
  return 'shouty'
}

/**
 * Lowercases CAPS LOCK stretches, leaving the leading capital to sentenceCase — so
 * „TRANSPORT I WNIESIENIE MATERIAŁÓW - stawki…" ends up „Transport i wniesienie materiałów - stawki…".
 *
 * A stretch has to be at least two shouty words, one of them 4+ letters, before it counts as
 * shouting. That floor is what keeps „Montaż WC podwieszanego" and „płyt GK" intact when a listed
 * acronym is not enough on its own.
 */
function unshout(text: string): string {
  const words = text.split(' ')
  const kinds = words.map(wordKind)
  const out = [...words]

  let start = 0
  while (start < words.length) {
    if (kinds[start] === 'other') {
      start += 1
      continue
    }
    let end = start
    while (end + 1 < words.length && kinds[end + 1] !== 'other') end += 1

    const shouted = words
      .slice(start, end + 1)
      .filter((_, index) => kinds[start + index] === 'shouty')
    const isShouting =
      shouted.length >= 2 && shouted.some((word) => word.replace(/[^\p{L}]/gu, '').length >= 4)
    if (isShouting)
      for (let index = start; index <= end; index += 1)
        if (kinds[index] !== 'neutral' || words[index].replace(/[^\p{L}]/gu, '').length <= 1)
          out[index] = words[index].toLowerCase()

    start = end + 1
  }
  return out.join(' ')
}

function capitalizeFirst(text: string): string {
  return text.slice(0, 1).toUpperCase() + text.slice(1)
}

function sentenceCase(text: string): string {
  return capitalizeFirst(text).replace(
    /(\S*[.!?])\s(\p{Ll})/gu,
    (whole, tail: string, letter: string) =>
      ABBREVIATIONS.has(tail.toLowerCase()) ? whole : `${tail} ${letter.toUpperCase()}`,
  )
}

export function cleanDescription(text: string): string {
  const spelled = TYPO_FIXES.reduce((acc, [from, to]) => acc.split(from).join(to), text)
  // The whole-name corrections the owner made in the katalog, which no substring rule reaches:
  // missing ogonki, a KNR line break healed mid-word, „taśm ledowych" → „taśm LED". They win over
  // `unshout`/`sentenceCase` because they are already written in their target casing — and they run
  // last among the rewrites so a SHOUTED opis still finds its entry, which `fold` case-flattens.
  const named = CATALOGUE_NAME_FIXES.get(fold(spelled))
  if (named) return named
  return sentenceCase(unshout(spelled.replace(/\s+/g, ' ').trim()))
}
