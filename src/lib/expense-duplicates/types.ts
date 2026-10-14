import type { DatedDocT, MatchReasonT } from './match'

// The origin fields the sibling rules read. A merged transakcja's paragony share its `id`; a
// transakcja booked from a zgłoszenie and that zgłoszenie's read rows share `draftId`.
export type DocumentT = DatedDocT & {
  key: string
  source: 'transaction' | 'draft'
  id: number
  draftId: number | null
  // 0-based positions in the zgłoszenie's AI read; a pending read row carries its own.
  readRows: number[]
}

export type DuplicatePairT<D extends DocumentT> = { a: D; b: D; reasons: MatchReasonT[] }

export type DuplicateGroupT<D extends DocumentT> = {
  key: string
  reasons: MatchReasonT[]
  members: D[]
}
