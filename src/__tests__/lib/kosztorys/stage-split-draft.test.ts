import { describe, expect, it } from 'vitest'
import {
  addMember,
  draftError,
  draftFrom,
  draftToSave,
  removeMember,
  setMode,
  setRestHolder,
  setValue,
} from '@/lib/kosztorys/stage-split-draft'

const ANNA = 1
const BOB = 2
const CEZARY = 3

const twoPeople = () => setValue(addMember(addMember(draftFrom(null), ANNA), BOB), BOB, 30)

describe('the split draft', () => {
  it('puts the first person on the rest', () => {
    expect(addMember(draftFrom(null), ANNA).members).toEqual([
      { workerId: ANNA, value: 0, takesRest: true },
    ])
  })

  it('brings a newcomer in at 0 and leaves the rest holder where it was', () => {
    const draft = addMember(twoPeople(), CEZARY)
    expect(draft.members).toEqual([
      { workerId: ANNA, value: 0, takesRest: true },
      { workerId: BOB, value: 30, takesRest: false },
      { workerId: CEZARY, value: 0, takesRest: false },
    ])
  })

  it('zeroes every value on a mode switch', () => {
    const draft = setMode(twoPeople(), 'amount')
    expect(draft.mode).toBe('amount')
    expect(draft.members.map((member) => member.value)).toEqual([0, 0])
  })

  it('refuses to save without a rest holder until one is picked', () => {
    const orphaned = removeMember(twoPeople(), ANNA)
    expect(draftError(orphaned, 1000)).not.toBeNull()
    expect(draftError(setRestHolder(orphaned, BOB), 1000)).toBeNull()
  })

  it('saves an emptied etap as unassigned, not as an invalid split', () => {
    const empty = removeMember(addMember(draftFrom(null), ANNA), ANNA)
    expect(draftError(empty, 1000)).toBeNull()
    expect(draftToSave(empty)).toBeNull()
  })
})
