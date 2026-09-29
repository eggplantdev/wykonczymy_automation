import {
  namesFigure,
  overrideCoeffFor,
  priceSourceOf,
  subcontractorPrice,
} from '@/lib/kosztorys/calc'
import { formatRate } from '@/lib/kosztorys/format'
import { isOverCeiling } from '@/lib/kosztorys/subcontractor-price-guard'
import type { PriceSourceT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

// One plane of a cennik wpis, as the two nullable columns hold it. At most one is set — the same
// invariant the rozpiska's pair carries, for the same reason.
export type CatalogueRateT = { rate: number | null; coeff: number | null }

export type CatalogueRateColumnsT = {
  wToolsRate: number | null
  wToolsRateCoeff: number | null
  ownToolsRate: number | null
  ownToolsRateCoeff: number | null
}

/**
 * Which źródło a cennik wpis names on one plane, decided in ONE place so the tabela, the dialog and
 * the porównanie cannot drift into three readings of the same two columns. Precedence matches
 * `priceSourceOf`: mnożnik, then kwota, then „auto".
 */
export const catalogueSourceOf = ({ rate, coeff }: CatalogueRateT): PriceSourceT => {
  if (namesFigure(coeff)) return 'coeff'
  if (namesFigure(rate)) return 'amount'
  return 'auto'
}

export const catalogueRateFor = (
  entry: CatalogueRateColumnsT,
  plane: ToolPlaneT,
): CatalogueRateT =>
  plane === 'w_tools'
    ? { rate: entry.wToolsRate, coeff: entry.wToolsRateCoeff }
    : { rate: entry.ownToolsRate, coeff: entry.ownToolsRateCoeff }

// What the ceiling judges: the złotówka the wpis would pay, whichever źródło names it. The mnożnik's
// kwota is its multiple of the cennik's own cena j.m. — here the two travel together, so the rule
// reads the same figure it does in the rozpiska.
export const catalogueRateAmount = (
  entry: CatalogueRateColumnsT & { clientPrice: number },
  plane: ToolPlaneT,
): number | null => {
  const { rate, coeff } = catalogueRateFor(entry, plane)
  return namesFigure(coeff) ? entry.clientPrice * coeff : rate
}

// The ONE question „is this cennik wpis over the ceiling" — the table's red udział cell and the
// „ponad" / „w granicy" filters both ask it here, so the colour and the filter cannot disagree.
export const isCatalogueOverCeiling = (
  entry: CatalogueRateColumnsT & { clientPrice: number },
  plane: ToolPlaneT,
): boolean => isOverCeiling(catalogueRateAmount(entry, plane), entry, plane)

// One stawka of a cennik wpis as one sentence — „auto", a kwota, or the mnożnik with the kwota it
// comes out to at the katalog's own cena j.m. The źródło has to show: 0,65 and 65 zł render the same
// money on a 100 zł cenie and mean different things the next time that cena moves.
export const catalogueRateText = (entry: CatalogueRateColumnsT, plane: ToolPlaneT): string => {
  const rate = catalogueRateFor(entry, plane)
  return formatRate(rate.rate, catalogueSourceOf(rate), rate.coeff)
}

/**
 * The złotówka a cennik wpis is worth against a given cena j.m. — what the tabela colours and what
 * the porównanie subtracts.
 *
 * `investmentCoeff` answers the „auto" case ONLY: there the cennik names no stawka, so the target
 * inwestycja's own współczynnik does. A wpis carrying a mnożnik of its own never consults it — that
 * is the whole point of storing one.
 */
export function catalogueRateValue(
  { rate, coeff }: CatalogueRateT,
  clientPrice: number,
  investmentCoeff: number,
): number {
  if (namesFigure(coeff)) return clientPrice * coeff
  return namesFigure(rate) ? rate : clientPrice * investmentCoeff
}

/**
 * The cennik stawka one plane of a rozpiska pozycja implies, and the ONE place that rule lives.
 *
 * Każde źródło jedzie do cennika jako to samo źródło. Kwota stała to decyzja, którą ktoś podjął, więc
 * zamraża się w cenniku. Własny mnożnik też jest decyzją — i to lepszą, bo przeżyje zmianę ceny w
 * inwestycji docelowej; zamrożenie go w kwotę byłoby zgubieniem jedynej rzeczy, której kwota nie umie
 * (EX-865). „Auto" znaczy, że pozycja jechała na globalnym współczynniku swojej inwestycji — wpisanie
 * go do cennika wspawałoby współczynnik jednej inwestycji w cennik czytany przez wszystkie, więc
 * płaszczyzna idzie jako `null` = „auto".
 */
export function impliedCatalogueRate(row: ViewPricingT, plane: ToolPlaneT): CatalogueRateT {
  switch (priceSourceOf(row, plane)) {
    case 'coeff':
      return { rate: null, coeff: overrideCoeffFor(row, plane) }
    case 'amount':
      return { rate: subcontractorPrice(row, plane), coeff: null }
    default:
      return { rate: null, coeff: null }
  }
}
