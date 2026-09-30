import { validateStageSplit } from '@/lib/kosztorys/stage-worker-split'
import type { StageSplitModeT, StageSplitT } from '@/lib/kosztorys/types'

// The „Pracownicy etapu…" dialog's editing rules, React-free (EX-943). The draft is a StageSplitT that
// may be empty and may lack a rest holder mid-edit; `draftToSave` and `draftError` are where it has to
// become a split the action accepts.

export function draftFrom(split: StageSplitT | null): StageSplitT {
  return split ?? { mode: 'percent', members: [] }
}

/** A newcomer enters at 0 and leaves the rest holder alone — unless nobody holds the rest yet. */
export function addMember(draft: StageSplitT, workerId: number): StageSplitT {
  if (draft.members.some((member) => member.workerId === workerId)) return draft
  return {
    ...draft,
    members: [...draft.members, { workerId, value: 0, takesRest: draft.members.length === 0 }],
  }
}

/** Removing the rest holder leaves nobody on the rest — the save stays refused until one is picked. */
export function removeMember(draft: StageSplitT, workerId: number): StageSplitT {
  return { ...draft, members: draft.members.filter((member) => member.workerId !== workerId) }
}

/** Percentages and złote don't translate into each other, so a switch starts every value from 0. */
export function setMode(draft: StageSplitT, mode: StageSplitModeT): StageSplitT {
  if (draft.mode === mode) return draft
  return { mode, members: draft.members.map((member) => ({ ...member, value: 0 })) }
}

export function setValue(draft: StageSplitT, workerId: number, value: number): StageSplitT {
  return {
    ...draft,
    members: draft.members.map((member) =>
      member.workerId === workerId ? { ...member, value } : member,
    ),
  }
}

export function setRestHolder(draft: StageSplitT, workerId: number): StageSplitT {
  return {
    ...draft,
    members: draft.members.map((member) =>
      member.workerId === workerId
        ? { ...member, value: 0, takesRest: true }
        : { ...member, takesRest: false },
    ),
  }
}

/** Nobody left on the etap is „Bez przypisania", not an invalid split. */
export function draftToSave(draft: StageSplitT): StageSplitT | null {
  return draft.members.length === 0 ? null : draft
}

export function draftError(draft: StageSplitT, pool: number): string | null {
  return draft.members.length === 0 ? null : validateStageSplit(draft, pool)
}
