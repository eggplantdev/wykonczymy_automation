import 'server-only'
import type { PayloadRequest } from 'payload'
import { serializeKosztorys } from './serialize-kosztorys'
import type { SnapshotPayloadT } from './snapshot-format'
import { NO_AI_DRAFT } from '@/lib/kosztorys/constants'

// `settings` (VAT/coeffs) is retained but IGNORED on apply, since a preset must not carry one job's
// pricing config onto another investment.
export async function serializeKosztorysAsPreset(
  investmentId: number,
  req?: PayloadRequest,
): Promise<SnapshotPayloadT> {
  const { globalDiscount: _globalDiscount, ...snapshot } = await serializeKosztorys(
    investmentId,
    req,
  )
  return {
    ...snapshot,
    // `ref` stays behind: every investment a szablon lands in is new work, and the number is unique
    // across all of them.
    items: snapshot.items.map(({ ref: _ref, ...item }) => ({
      ...item,
      plannedQty: 0,
      currentPlannedQty: null,
      sheetMeasuredQty: null,
      discountType: null,
      discountValue: 0,
      note: null,
      ...NO_AI_DRAFT,
      changeReason: null,
      reviewStatus: null,
    })),
    stages: [],
    progress: [],
  }
}
