import type { Payload } from 'payload'

// Resolve an investment's linked Google Sheet id, or undefined if it has none.
// The sheet id lives on the `kosztoryses` collection (one row per sheet, optional
// FK back to an investment), so we look up by relation rather than reading a
// field on investments — see migration 20260528_move_sheet_id_to_kosztoryses.
//
// This lives in a non-`'use server'` file so callers in any context (server
// actions, page server components, hooks) can import it as a plain function
// without the call going through the RSC server-action serialization boundary.
export async function getInvestmentSheetId(
  payload: Payload,
  investmentId: number,
): Promise<string | undefined> {
  const found = await payload.find({
    collection: 'kosztoryses',
    where: { investment: { equals: investmentId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return found.docs[0]?.googleSheetId ?? undefined
}
