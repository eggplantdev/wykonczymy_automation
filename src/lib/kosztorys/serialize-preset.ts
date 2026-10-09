import 'server-only'
import type { PayloadRequest } from 'payload'
import { serializeKosztorys } from './serialize-kosztorys'
import type { SnapshotPayloadT } from './snapshot-format'

// A preset = a snapshot with the job-specific fields stripped, so it seeds a DIFFERENT investment
// with only the reusable skeleton (sekcje + prace + prices + coefficients/overrides) and the katalog
// entry each praca came from. A remark about the WORK („cena zawiera transport") lives on that entry
// as its Komentarz do pracy, so the pozycja's own Komentarz is about one job and stays behind, with
// the przedmiar, the rabat and the etapy (owner, 2026-10-08). Wraps
// serializeKosztorys (pure read) and zeroes the per-job fields at serialize time. The payload keeps
// full snapshot shape-parity — `settings` (VAT/coeffs) is retained but IGNORED on apply, since a
// preset must not carry one job's pricing config onto another investment.
// `req` forwards the caller's transaction, so a mirror that reads the tree and rewrites the szablon
// in one transaction sees a consistent tree rather than one a parallel edit moved mid-read.
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
      // The agent's draft and its review are about one job's przedmiar, which the szablon zeroes.
      aiPlannedQty: null,
      changeReason: null,
      reviewStatus: null,
    })),
    // Etapy (stages + their recorded progress) are per-job execution structure, not reusable scope —
    // a preset carries none, and neither the seed nor the reload installs one: an etap's plane is
    // forced at creation, so the first etap is the user's explicit call through the picker.
    stages: [],
    progress: [],
  }
}
