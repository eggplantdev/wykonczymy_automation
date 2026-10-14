import type { PreviewFileT } from '@/types/media'
import type { DatedDocT, MatchReasonT, MatchVerdictT } from './match'

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

export type DuplicateGroupsT<D extends DocumentT> = {
  strong: DuplicateGroupT<D>[]
  weak: DuplicateGroupT<D>[]
}

// A pending zgłoszenie can match through several of its paragony, so `id` alone repeats — `key`
// tells them apart.
export type CandidateT = DocumentT & {
  date: string
  investmentId: number | null
  submitterName: string | null
  investmentName: string | null
  pages: PreviewFileT[]
}

export type DuplicateMatchT = MatchVerdictT & CandidateT
