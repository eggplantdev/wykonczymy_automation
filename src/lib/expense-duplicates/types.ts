import type { PreviewFileT } from '@/types/media'
import type { DatedDocT, MatchReasonT, MatchVerdictT } from './match'

export type DocumentT = DatedDocT & {
  key: string
  source: 'transaction' | 'draft'
  id: number
  draftId: number | null
  // 0-based positions in the zgłoszenie's AI read
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

export type CandidateT = DocumentT & {
  date: string
  investmentId: number | null
  submitterName: string | null
  registerName: string | null
  investmentName: string | null
  pages: PreviewFileT[]
}

export type DuplicateMatchT = MatchVerdictT & CandidateT
