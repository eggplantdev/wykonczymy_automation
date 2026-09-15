import { describe, it, expect } from 'vitest'
import { inspectionDraftId } from '@/lib/fleet/inspection-draft'

// Pins the cross-vehicle draft leak `inspection-draft.ts` describes.
describe('inspectionDraftId', () => {
  it('gives two vehicles two different draft slots', () => {
    expect(inspectionDraftId(2)).not.toBe(inspectionDraftId(3))
  })

  it('keeps one slot for the fleet-wide dialog, where no vehicle is preselected', () => {
    expect(inspectionDraftId(undefined)).toBe(inspectionDraftId(undefined))
    expect(inspectionDraftId(undefined)).not.toBe(inspectionDraftId(2))
  })
})
