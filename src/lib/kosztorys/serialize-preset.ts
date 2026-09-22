import 'server-only'
import type { PayloadRequest } from 'payload'
import { serializeKosztorys } from './serialize-kosztorys'
import type { SnapshotPayloadT } from './snapshot-format'

// A preset = a snapshot with the job-specific fields stripped, so it seeds a DIFFERENT investment
// with only the reusable skeleton (sekcje + prace + prices + coefficients/overrides). `note` is part
// of that skeleton: „cena zawiera transport" is about the WORK, so it travels to the next budowa —
// unlike the przedmiar, the rabat and the etapy, which are about one job. Wraps
// serializeKosztorys (pure read) and zeroes the per-job fields at serialize time. The payload keeps
// full snapshot shape-parity — `settings` (VAT/coeffs) is retained but IGNORED on apply, since a
// preset must not carry one job's pricing config onto another investment.
// `req` forwards the caller's transaction, so a mirror that reads the tree and rewrites the szablon
// in one transaction sees a consistent tree rather than one a parallel edit moved mid-read.
export async function serializeKosztorysAsPreset(
  investmentId: number,
  req?: PayloadRequest,
): Promise<SnapshotPayloadT> {
  const snapshot = await serializeKosztorys(investmentId, req)
  return {
    ...snapshot,
    items: snapshot.items.map((item) => ({
      ...item,
      plannedQty: 0,
      sheetMeasuredQty: null,
      discountType: null,
      discountValue: 0,
    })),
    // Etapy (stages + their recorded progress) are per-job execution structure, not reusable scope —
    // a preset carries none, and neither the seed nor the reload installs one: an etap's plane is
    // forced at creation, so the first etap is the user's explicit call through the picker.
    stages: [],
    progress: [],
  }
}
