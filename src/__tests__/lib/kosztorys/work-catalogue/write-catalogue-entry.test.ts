import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { applyCatalogueWrite } from '@/lib/kosztorys/work-catalogue/write-catalogue-entry'
import type {
  CatalogueCandidateT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// The Komentarz do pracy is the katalog's own: a candidate built from a kosztorys row has no comment,
// so every write from the editor must leave the stored one alone unless a comment was typed.

const CANDIDATE: CatalogueCandidateT = {
  description: 'Malowanie ścian',
  descriptionTranslations: {},
  category: 'Wykończenia',
  unit: 'm2',
  clientPrice: 30,
  wToolsRate: null,
  wToolsRateCoeff: null,
  ownToolsRate: null,
  ownToolsRateCoeff: null,
  matchKey: 'malowanie scian|m2',
}

const EXISTING: WorkCatalogueItemT = {
  ...CANDIDATE,
  id: 4,
  clientPrice: 25,
  workNote: 'Bez gruntowania',
}

function fakePayload() {
  const create = vi.fn()
  const update = vi.fn()
  return { payload: { create, update } as unknown as Payload, create, update }
}

const updateData = (update: ReturnType<typeof vi.fn>) => update.mock.calls[0][0].data

describe('applyCatalogueWrite — Komentarz do pracy', () => {
  it.each([undefined, '', '   '])('leaves the stored comment on an overwrite with %j', async (note) => {
    const { payload, update } = fakePayload()

    await applyCatalogueWrite(payload, undefined, {
      candidate: CANDIDATE,
      existing: EXISTING,
      keepCatalogueCategory: false,
      workNote: note,
    })

    expect(updateData(update)).not.toHaveProperty('workNote')
    expect(updateData(update)).toMatchObject({ clientPrice: 30 })
  })

  it('writes a typed comment, trimmed, over the stored one', async () => {
    const { payload, update } = fakePayload()

    await applyCatalogueWrite(payload, undefined, {
      candidate: CANDIDATE,
      existing: EXISTING,
      keepCatalogueCategory: false,
      workNote: '  Z gruntowaniem ',
    })

    expect(updateData(update)).toMatchObject({ workNote: 'Z gruntowaniem' })
  })

  it('creates a new entry with the typed comment, and without one when blank', async () => {
    const withNote = fakePayload()
    await applyCatalogueWrite(withNote.payload, undefined, {
      candidate: CANDIDATE,
      existing: null,
      keepCatalogueCategory: false,
      workNote: 'Z gruntowaniem',
    })
    expect(withNote.create.mock.calls[0][0].data).toMatchObject({ workNote: 'Z gruntowaniem' })

    const blank = fakePayload()
    await applyCatalogueWrite(blank.payload, undefined, {
      candidate: CANDIDATE,
      existing: null,
      keepCatalogueCategory: false,
    })
    expect(blank.create.mock.calls[0][0].data).not.toHaveProperty('workNote')
  })
})
