import {
  namesFigure,
  overrideCoeffFor,
  priceSourceOf,
  subcontractorPrice,
} from '@/lib/kosztorys/calc'
import { formatRate } from '@/lib/kosztorys/format'
import { isOverCeiling } from '@/lib/kosztorys/subcontractor-price-guard'
import type { PriceSourceT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'

export type CatalogueRateT = { rate: number | null; coeff: number | null }

export type CatalogueRateColumnsT = {
  wToolsRate: number | null
  wToolsRateCoeff: number | null
  ownToolsRate: number | null
  ownToolsRateCoeff: number | null
}

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

export const catalogueRateAmount = (
  entry: CatalogueRateColumnsT & { clientPrice: number },
  plane: ToolPlaneT,
): number | null => {
  const { rate, coeff } = catalogueRateFor(entry, plane)
  return namesFigure(coeff) ? entry.clientPrice * coeff : rate
}

export const isCatalogueOverCeiling = (
  entry: CatalogueRateColumnsT & { clientPrice: number },
  plane: ToolPlaneT,
): boolean => isOverCeiling(catalogueRateAmount(entry, plane), entry, plane)

export const catalogueRateText = (entry: CatalogueRateColumnsT, plane: ToolPlaneT): string => {
  const rate = catalogueRateFor(entry, plane)
  return formatRate(rate.rate, catalogueSourceOf(rate), rate.coeff)
}

export function catalogueRateValue(
  { rate, coeff }: CatalogueRateT,
  clientPrice: number,
  investmentCoeff: number,
): number {
  if (namesFigure(coeff)) return clientPrice * coeff
  return namesFigure(rate) ? rate : clientPrice * investmentCoeff
}

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
