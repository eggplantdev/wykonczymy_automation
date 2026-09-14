import { describe, it, expect } from 'vitest'
import {
  equipmentTransferFormSchema,
  equipmentTransferSchema,
} from '@/components/forms/equipment-transfer-form/equipment-transfer-schema'
import {
  MULTIPLE_TARGETS_MESSAGE,
  NO_TARGET_MESSAGE,
} from '@/lib/equipment/target-invariant'

// The collection hook is the row's guard, but the action's payload is parsed before it ever gets
// there — so the same „exactly one target" has to hold at this door too, or a two-target payload
// reaches Postgres and comes back as a bare 400.

const FORM_VALUES = {
  equipment: '7',
  occurredAt: '2026-09-01',
  targetKind: 'holder' as const,
  holder: '3',
  warehouse: '',
  serviceProvider: '',
  investment: '',
  cost: '',
  note: '',
}

const DATA = {
  equipment: 7,
  occurredAt: '2026-09-01',
  holder: 3,
  warehouse: null,
  serviceProvider: null,
  investment: null,
  cost: null,
  note: '',
}

const firstError = (result: { success: false; error: { issues: { message: string }[] } }) =>
  result.error.issues[0]?.message

describe('equipmentTransferSchema — the action payload', () => {
  it('accepts exactly one target', () => {
    expect(equipmentTransferSchema.safeParse(DATA).success).toBe(true)
  })

  it('rejects a payload naming two targets', () => {
    const result = equipmentTransferSchema.safeParse({ ...DATA, warehouse: 2 })
    expect(result.success).toBe(false)
    expect(firstError(result as never)).toBe(MULTIPLE_TARGETS_MESSAGE)
  })

  it('rejects a payload naming no target', () => {
    const result = equipmentTransferSchema.safeParse({ ...DATA, holder: null })
    expect(result.success).toBe(false)
    expect(firstError(result as never)).toBe(NO_TARGET_MESSAGE)
  })

  it('reads a whitespace-only workshop as no target at all', () => {
    const result = equipmentTransferSchema.safeParse({
      ...DATA,
      holder: null,
      serviceProvider: '   ',
    })
    expect(result.success).toBe(false)
    expect(firstError(result as never)).toBe(NO_TARGET_MESSAGE)
  })

  it('keeps a cost off the payload as null rather than 0', () => {
    const parsed = equipmentTransferSchema.parse(DATA)
    expect(parsed.cost).toBeNull()
  })
})

describe('equipmentTransferFormSchema — the controls', () => {
  it('accepts a chosen kind whose field is filled', () => {
    expect(equipmentTransferFormSchema.safeParse(FORM_VALUES).success).toBe(true)
  })

  it.each([
    ['holder', 'holder'],
    ['warehouse', 'warehouse'],
    ['service', 'serviceProvider'],
  ] as const)('demands the field the „%s" choice needs', (targetKind, field) => {
    const result = equipmentTransferFormSchema.safeParse({
      ...FORM_VALUES,
      targetKind,
      holder: '',
      warehouse: '',
      serviceProvider: '',
    })
    expect(result.success).toBe(false)
    // On the field, not on the form: the user has to see WHICH control is empty.
    expect((result as { error: { issues: { path: PropertyKey[] }[] } }).error.issues[0]?.path).toEqual([
      field,
    ])
  })

  it('rejects a negative cost', () => {
    const result = equipmentTransferFormSchema.safeParse({ ...FORM_VALUES, cost: '-1' })
    expect(result.success).toBe(false)
  })
})
