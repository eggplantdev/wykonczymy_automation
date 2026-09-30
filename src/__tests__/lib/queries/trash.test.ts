import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

import { shapeTrashRows } from '@/lib/queries/trash'
import type { TrashedInvestmentRowT } from '@/lib/db/investment-trash'
import type { TrashedCashRegisterRowT } from '@/lib/db/cash-register-trash'

const NOW = new Date('2026-09-30T12:00:00Z').getTime()
const TRASHED_AT = new Date('2026-09-20T12:00:00Z')

const investment = (id: number, flags: Partial<TrashedInvestmentRowT>): TrashedInvestmentRowT => ({
  id,
  name: `Inwestycja ${id}`,
  trashedAt: TRASHED_AT,
  isKosztorysUsed: false,
  isTemplate: false,
  ...flags,
})

const kasa = (id: number, type: TrashedCashRegisterRowT['type']): TrashedCashRegisterRowT => ({
  id,
  name: `Kasa ${id}`,
  type,
  trashedAt: TRASHED_AT,
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
      { isAdminOrOwner: true, now: NOW },
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
    const [row] = shapeTrashRows([], [kasa(10, 'AUXILIARY')], { isAdminOrOwner: true, now: NOW })

    expect(row).toEqual({
      kind: 'cash-register',
      id: 10,
      name: 'Kasa 10',
      trashedAt: TRASHED_AT,
      daysLeft: 20,
      autoPurges: true,
      mustTypeName: false,
    })
  })

  it('drops a MAIN kasa for a MANAGER, and keeps it for an owner', () => {
    const kasy = [kasa(10, 'MAIN'), kasa(11, 'AUXILIARY')]

    expect(shapeTrashRows([], kasy, { isAdminOrOwner: false, now: NOW }).map((r) => r.id)).toEqual([
      11,
    ])
    expect(shapeTrashRows([], kasy, { isAdminOrOwner: true, now: NOW }).map((r) => r.id)).toEqual([
      10, 11,
    ])
  })
})
