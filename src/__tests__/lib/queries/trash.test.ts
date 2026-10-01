import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

import { shapeTrashRows } from '@/lib/queries/trash'
import type { TrashedInvestmentRowT } from '@/lib/db/investment-trash'
import type { TrashedCashRegisterRowT } from '@/lib/db/cash-register-trash'
import type { TrashedWorkerRowT } from '@/lib/db/worker-trash'
import type { TrashedVehicleRowT } from '@/lib/db/vehicle-trash'
import type { TrashedEquipmentRowT } from '@/lib/db/equipment-trash'
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

const NO_ROWS = { investments: [], cashRegisters: [], workers: [], vehicles: [], equipment: [] }

const vehicle = (id: number, flags: Partial<TrashedVehicleRowT> = {}): TrashedVehicleRowT => ({
  id,
  registration: `WX ${id}`,
  make: 'Ford',
  model: 'Transit',
  trashedAt: TRASHED_AT,
  ...flags,
})

const item = (id: number, flags: Partial<TrashedEquipmentRowT> = {}): TrashedEquipmentRowT => ({
  id,
  name: 'Szlifierka',
  make: 'Makita',
  model: 'GA5030',
  serialNumber: 'SN-1',
  trashedAt: TRASHED_AT,
  ...flags,
})

describe('shapeTrashRows', () => {
  it('keeps the investment semantics: a used kosztorys never auto-purges', () => {
    const rows = shapeTrashRows(
      {
        ...NO_ROWS,
        investments: [
          investment(1, {}),
          investment(2, { isKosztorysUsed: true }),
          investment(3, { isTemplate: true }),
        ],
      },
      { viewerRole: 'OWNER', now: NOW },
    )

    expect(rows.map(({ kind, id, autoPurges }) => ({ kind, id, autoPurges }))).toEqual([
      { kind: 'investment', id: 1, autoPurges: true },
      { kind: 'investment', id: 2, autoPurges: false },
      { kind: 'template', id: 3, autoPurges: true },
    ])
  })

  it('maps a kasa to an auto-purging row, counting down the same retention', () => {
    const [row] = shapeTrashRows(
      { ...NO_ROWS, cashRegisters: [kasa(10, 'AUXILIARY')] },
      {
        viewerRole: 'OWNER',
        now: NOW,
      },
    )

    expect(row).toEqual({
      kind: 'cash-register',
      id: 10,
      name: 'Kasa 10',
      trashedAt: TRASHED_AT,
      daysLeft: 20,
      autoPurges: true,
      hasSheet: false,
      pairedRegisters: [],
    })
  })

  it('drops a MAIN kasa for a MANAGER, and keeps it for an owner', () => {
    const kasy = [kasa(10, 'MAIN'), kasa(11, 'AUXILIARY')]

    expect(
      shapeTrashRows({ ...NO_ROWS, cashRegisters: kasy }, { viewerRole: 'MANAGER', now: NOW }).map(
        (r) => r.id,
      ),
    ).toEqual([11])
    expect(
      shapeTrashRows({ ...NO_ROWS, cashRegisters: kasy }, { viewerRole: 'OWNER', now: NOW }).map(
        (r) => r.id,
      ),
    ).toEqual([10, 11])
  })

  it('maps a worker to a row that names his kasy', () => {
    const [row] = shapeTrashRows(
      { ...NO_ROWS, workers: [worker(20, 'EMPLOYEE', ['Kasa Jana'])] },
      {
        viewerRole: 'OWNER',
        now: NOW,
      },
    )

    expect(row).toEqual({
      kind: 'worker',
      id: 20,
      name: 'Pracownik 20',
      trashedAt: TRASHED_AT,
      daysLeft: 20,
      autoPurges: true,
      hasSheet: false,
      pairedRegisters: ['Kasa Jana'],
    })
  })

  it('shows a MANAGER only the trashed EMPLOYEE accounts', () => {
    const workers = [worker(20, 'EMPLOYEE'), worker(21, 'OWNER'), worker(22, 'MANAGER')]

    expect(
      shapeTrashRows({ ...NO_ROWS, workers }, { viewerRole: 'MANAGER', now: NOW }).map((r) => r.id),
    ).toEqual([20])
    expect(
      shapeTrashRows({ ...NO_ROWS, workers }, { viewerRole: 'OWNER', now: NOW }).map((r) => r.id),
    ).toEqual([20, 21, 22])
  })

  it('maps a car to a row named by its plate, with make and model beneath', () => {
    const [row] = shapeTrashRows(
      { ...NO_ROWS, vehicles: [vehicle(30)] },
      { viewerRole: 'MANAGER', now: NOW },
    )

    expect(row).toEqual({
      kind: 'vehicle',
      id: 30,
      name: 'WX 30',
      trashedAt: TRASHED_AT,
      daysLeft: 20,
      autoPurges: true,
      hasSheet: false,
      pairedRegisters: [],
      detail: 'Ford Transit',
    })
  })

  it('tells two items of one name apart by make, model and serial, dropping what is blank', () => {
    const rows = shapeTrashRows(
      {
        ...NO_ROWS,
        equipment: [
          item(40),
          item(41, { make: '', serialNumber: '' }),
          item(42, { make: '', model: '', serialNumber: '' }),
        ],
      },
      { viewerRole: 'MANAGER', now: NOW },
    )

    expect(rows.map(({ kind, name, detail }) => ({ kind, name, detail }))).toEqual([
      { kind: 'equipment', name: 'Szlifierka', detail: 'Makita GA5030 · nr ser. SN-1' },
      { kind: 'equipment', name: 'Szlifierka', detail: 'GA5030' },
      { kind: 'equipment', name: 'Szlifierka', detail: undefined },
    ])
  })
})
