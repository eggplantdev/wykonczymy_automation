import type { AcceptanceKindT } from '@/lib/kosztorys/acceptance-protocol/types'

export const CONTRACTOR_NAME = 'Wykończymy sp. z o. o.'

export const ACCEPTANCE_KIND_LABELS: Record<AcceptanceKindT, string> = {
  partial: 'częściowy',
  final: 'końcowy',
  reinspection: 'ponowny',
}
