import 'server-only'
import { serializeKosztorys } from './serialize-kosztorys'
import type { SnapshotPayloadT } from './snapshot-format'

// A preset = a snapshot with the job-specific fields stripped, so it seeds a DIFFERENT investment
// with only the reusable skeleton (sekcje + prace + prices + coefficients/overrides). Wraps
// serializeKosztorys (pure read) and zeroes the per-job fields at serialize time. The payload keeps
// full snapshot shape-parity — `settings` (VAT/coeffs) is retained but IGNORED on apply, since a
// preset must not carry one job's pricing config onto another investment.
export async function serializeKosztorysAsPreset(investmentId: number): Promise<SnapshotPayloadT> {
  const snapshot = await serializeKosztorys(investmentId)
  return {
    ...snapshot,
    items: snapshot.items.map((item) => ({
      ...item,
      plannedQty: 0,
      measuredQty: 0,
      discountType: null,
      discountValue: 0,
      hiddenInExport: false,
      note: null,
    })),
    // Stages themselves (labels/ordinals) are structure and stay; only their recorded progress goes.
    progress: [],
  }
}
