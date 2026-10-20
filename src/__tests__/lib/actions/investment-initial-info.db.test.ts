import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import type { InvestmentFormDataT } from '@/components/forms/investment-form/investment-schema'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const MARKER = 'investment-initial-info-db'

const formData = (market: '' | 'primary' | 'secondary'): InvestmentFormDataT => ({
  name: `${MARKER} rynek`,
  address: '',
  phone: '',
  email: '',
  contactPerson: '',
  notes: '',
  reviewRequested: false,
  status: 'quote',
  presetId: '',
  initialInfo: { market },
})

describe.skipIf(!ENV_READY)('investment „Wstępne informacje” (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let updateInvestment: typeof import('@/lib/actions/investments').updateInvestmentAction
  let fetchDetails: typeof import('@/lib/queries/reference-data').fetchInvestmentDetails
  let id: number

  const storedMarket = async () => {
    const result = await db.execute(
      sql`SELECT initial_info_market::text AS market FROM investments WHERE id = ${id}`,
    )
    return result.rows[0]?.market ?? null
  }

  const purge = () => db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${MARKER} %`}`)

  beforeAll(async () => {
    authState.role = 'OWNER'
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)
    updateInvestment = (await import('@/lib/actions/investments')).updateInvestmentAction
    fetchDetails = (await import('@/lib/queries/reference-data')).fetchInvestmentDetails
  })

  beforeEach(async () => {
    await purge()
    id = await createTestInvestment(payload, `${MARKER} rynek`)
  })

  afterAll(async () => {
    await purge()
  })

  it('stores „Rynek wtórny” and the edit dialog reads it back', async () => {
    expect(await updateInvestment(id, formData('secondary'))).toEqual({ success: true })

    expect(await storedMarket()).toBe('secondary')
    expect((await fetchDetails())[id]?.initialInfo).toEqual({ market: 'secondary' })
  })

  it('stores an unchosen „Rynek” as unknown', async () => {
    await updateInvestment(id, formData('primary'))
    expect(await updateInvestment(id, formData(''))).toEqual({ success: true })

    expect(await storedMarket()).toBeNull()
    expect((await fetchDetails())[id]?.initialInfo).toEqual({ market: null })
  })
})
