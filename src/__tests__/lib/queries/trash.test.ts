import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

import { shapeTrashRows } from '@/lib/queries/trash'
import type { TrashedInvestmentRowT } from '@/lib/db/investment-trash'
import type { TrashedCashRegisterRowT } from '@/lib/db/cash-register-trash'
import type { TrashedWorkerRowT } from '@/lib/db/worker-trash'
import type { RoleT } from '@/lib/auth/roles'

const NOW = new Date('2026-09-30T12:00:00Z').getTime()
const TRASHED_AT = new Date('2026-09-20T12:00:00Z')

const investment = (id: number, flags: Partial<TrashedInvestmentRowT>): TrashedInvestmentRowT => ({
  id,
  name: `Inwestycja ${id}`,
  trashedAt: TRASHED_AT,
  isKosztorysUsed: false,
  isTemplate: false,
  isUndeletable: false,
  hasSheet: false,
  ...flags,
})

const kasa = (id: number, type: TrashedCashRegisterRowT['type']): TrashedCashRegisterRowT => ({
  id,
  name: `Kasa ${id}`,
  type,
  trashedAt: TRASHED_AT,
})

const worker = (id: number, role: RoleT, registerNames: string[] = []): TrashedWorkerRowT => ({
  id,
  name: `Pracownik ${id}`,
  role,
  trashedAt: TRASHED_AT,
  registerNames,
})

describe('shapeTrashRows', () => {
  it('keeps the investment semantics: a used kosztorys asks for the name and never auto-purges', () => {
    const rows = shapeTrashRows(
      [
        investment(1, {}),
        investment(2, { isKosztorysUsed: true }),
        investment(3, { isTemplate: true }),
      ],
      [],
      [],
      { viewerRole: 'OWNER', now: NOW },
    )

    expect(
      rows.map(({ kind, id, autoPurges, mustTypeName }) => ({
        kind,
        id,
        autoPurges,
        mustTypeName,
      })),
    ).toEqual([
      { kind: 'investment', id: 1, autoPurges: true, mustTypeName: false },
      { kind: 'investment', id: 2, autoPurges: false, mustTypeName: true },
      { kind: 'template', id: 3, autoPurges: true, mustTypeName: true },
    ])
  })

  it('maps a kasa to an auto-purging row on a plain confirm, counting down the same retention', () => {
    const [row] = shapeTrashRows([], [kasa(10, 'AUXILIARY')], [], {
      viewerRole: 'OWNER',
      now: NOW,
    })

    expect(row).toEqual({
      kind: 'cash-register',
      id: 10,
      name: 'Kasa 10',
      trashedAt: TRASHED_AT,
      daysLeft: 20,
      autoPurges: true,
      mustTypeName: false,
      hasSheet: false,
      pairedRegisters: [],
    })
  })

  it('drops a MAIN kasa for a MANAGER, and keeps it for an owner', () => {
    const kasy = [kasa(10, 'MAIN'), kasa(11, 'AUXILIARY')]

    expect(
      shapeTrashRows([], kasy, [], { viewerRole: 'MANAGER', now: NOW }).map((r) => r.id),
    ).toEqual([11])
    expect(
      shapeTrashRows([], kasy, [], { viewerRole: 'OWNER', now: NOW }).map((r) => r.id),
    ).toEqual([10, 11])
  })

  it('maps a worker to a row that names his kasy and always asks for the name', () => {
    const [row] = shapeTrashRows([], [], [worker(20, 'EMPLOYEE', ['Kasa Jana'])], {
      viewerRole: 'OWNER',
      now: NOW,
    })

    expect(row).toEqual({
      kind: 'worker',
      id: 20,
      name: 'Pracownik 20',
      trashedAt: TRASHED_AT,
      daysLeft: 20,
      autoPurges: true,
      mustTypeName: true,
      hasSheet: false,
      pairedRegisters: ['Kasa Jana'],
    })
  })

  it('shows a MANAGER only the trashed EMPLOYEE accounts', () => {
    const workers = [worker(20, 'EMPLOYEE'), worker(21, 'OWNER'), worker(22, 'MANAGER')]

    expect(
      shapeTrashRows([], [], workers, { viewerRole: 'MANAGER', now: NOW }).map((r) => r.id),
    ).toEqual([20])
    expect(
      shapeTrashRows([], [], workers, { viewerRole: 'OWNER', now: NOW }).map((r) => r.id),
    ).toEqual([20, 21, 22])
  })
})
