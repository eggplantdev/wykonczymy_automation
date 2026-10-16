import type { TransferTypeT } from '@/lib/constants/transfers'

type TransfersFilterT = {
  // `buildTransferFilters` turns this into `where.type = { in: [...] }`, so a wrong or guessed type
  // filters out the very row linked to.
  types?: readonly TransferTypeT[]
  id?: number
  worker?: number
  showCancelled?: boolean
}

export function investmentTransfersHref(
  investmentId: number,
  filter: TransfersFilterT = {},
): string {
  const params: string[] = []
  if (filter.types?.length) params.push(`type=${filter.types.join(',')}`)
  if (filter.worker != null) params.push(`worker=${filter.worker}`)
  if (filter.id != null) params.push(`id=${filter.id}`)
  if (filter.showCancelled) params.push('showCancelled=1')

  return params.length
    ? `/inwestycje/${investmentId}?${params.join('&')}`
    : `/inwestycje/${investmentId}`
}
