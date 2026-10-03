export type ExtraWorkT = { key: string; description: string; unit: string; qty: string }

// Quantities stay the raw typed text, so a half-typed „1," survives a reload.
export type ReportDraftT = { qtyByItem: Record<number, string>; extras: ExtraWorkT[] }
