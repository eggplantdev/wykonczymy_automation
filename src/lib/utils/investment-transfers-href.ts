import type { TransferTypeT } from '@/lib/constants/transfers'

type TransfersFilterT = {
  // Must be the types the linked-to rows actually carry: `buildTransferFilters` turns this into
  // `where.type = { in: [...] }`, so a wrong or guessed type filters out the very row linked to.
  // Omit it (or pass an empty list) for an unfiltered list rather than guessing.
  types?: readonly TransferTypeT[]
  id?: number
  worker?: number
  // The list hides cancelled rows by default, so a link to one finds nothing without it.
  showCancelled?: boolean
}

// The one place that spells the transfers list's query contract (`buildTransferFilters`). Every
// caller went through a template literal before, which is how a hardcoded `type` drifted from the
// rows it was supposed to reach.
export function investmentTransfersHref(
  investmentId: number,
  filter: TransfersFilterT = {},
): string {
  // Built by hand rather than through URLSearchParams, which percent-escapes the separator of a
  // multi-type filter (`type=A%2CB`) — it still parses, but the links stop being readable.
  const params: string[] = []
  if (filter.types?.length) params.push(`type=${filter.types.join(',')}`)
  if (filter.worker != null) params.push(`worker=${filter.worker}`)
  if (filter.id != null) params.push(`id=${filter.id}`)
  if (filter.showCancelled) params.push('showCancelled=1')

  return params.length
    ? `/inwestycje/${investmentId}?${params.join('&')}`
    : `/inwestycje/${investmentId}`
}
