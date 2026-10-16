import type { NO_AI_DRAFT } from '@/lib/kosztorys/constants'
import type { KosztorysItemT } from '@/lib/kosztorys/types'

type AiDraftT = Required<Pick<KosztorysItemT, keyof typeof NO_AI_DRAFT>>

// The flag reads false, never NULL: its column is NOT NULL.
export const aiDraftOf = (item: Partial<AiDraftT> | undefined): AiDraftT => ({
  aiPlannedQty: item?.aiPlannedQty ?? null,
  aiMissingData: item?.aiMissingData ?? null,
  aiAssumptions: item?.aiAssumptions ?? null,
  aiNewInformation: item?.aiNewInformation ?? null,
  aiRecheck: item?.aiRecheck ?? false,
})
