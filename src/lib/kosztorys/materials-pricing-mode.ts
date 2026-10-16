export type PricingModeT = 'gross' | 'net'

export function pricingModeOf(materialsNetRate: number | null): PricingModeT {
  return materialsNetRate == null ? 'gross' : 'net'
}

export function materialsNetRateForMode(mode: string, vatRate: number): number | null {
  return mode === 'net' ? vatRate : null
}
