import { OPEN_DRAFT_PARAM } from '@/lib/constants/worker-expense-drafts'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import type { DocumentT } from './types'

type LinkedDocumentT = Pick<DocumentT, 'source' | 'id'> & { investmentId: number | null }

export function documentHref({ source, id, investmentId }: LinkedDocumentT): string {
  if (source === 'draft') return `/zgloszenia-wydatkow?${OPEN_DRAFT_PARAM}=${id}`
  return investmentId === null ? `/?id=${id}` : investmentTransfersHref(investmentId, { id })
}
