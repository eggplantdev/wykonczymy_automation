import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import type { KosztorysItem } from '@/payload-types'

const { updateItemFieldAction } = await import('@/lib/actions/kosztorys-items')

type ItemRowT = {
  w_tools_override_value: string | null
  w_tools_override_coeff: string | null
  own_tools_override_value: string | null
  own_tools_override_coeff: string | null
  review_status: string | null
  change_reason: string | null
  ai_recheck: boolean
  note: string | null
}

describe.skipIf(!ENV_READY)('updateItemFieldAction — persisted item fields (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    investmentId = await createTestInvestment(payload, `item-field-test-TEST-${Date.now()}`)
    authState.userId = await firstUserId(payload)
  })

  afterAll(async () => {
    await deleteTestInvestment(payload, investmentId)
  })

  async function createItem(item: Partial<KosztorysItem>): Promise<number> {
    const {
      itemIds: [itemId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'item-field-test', items: [item] }],
    })
    return itemId
  }

  async function readItem(itemId: number): Promise<ItemRowT> {
    const { rows } = await db.execute(sql`
      SELECT w_tools_override_value, w_tools_override_coeff,
             own_tools_override_value, own_tools_override_coeff,
             review_status, change_reason, ai_recheck, note
      FROM kosztorys_items WHERE id = ${itemId}
    `)
    return rows[0] as ItemRowT
  }

  async function update(itemId: number, patch: Parameters<typeof updateItemFieldAction>[1]) {
    const result = await updateItemFieldAction(itemId, patch)
    expect(result.success).toBe(true)
  }

  it('a własny mnożnik clears the kwota stała it replaces, on that plane only', async () => {
    const itemId = await createItem({
      clientPrice: 100,
      wToolsOverrideValue: 60,
      ownToolsOverrideValue: 45,
    })

    await update(itemId, { wToolsOverrideCoeff: 0.55 })

    const row = await readItem(itemId)
    expect(Number(row.w_tools_override_coeff)).toBe(0.55)
    expect(row.w_tools_override_value).toBeNull()
    expect(Number(row.own_tools_override_value)).toBe(45)
    expect(row.own_tools_override_coeff).toBeNull()
  })

  it('a kwota stała clears the własny mnożnik it replaces', async () => {
    const itemId = await createItem({ clientPrice: 100, ownToolsOverrideCoeff: 0.4 })

    await update(itemId, { ownToolsOverrideValue: 38 })

    const row = await readItem(itemId)
    expect(Number(row.own_tools_override_value)).toBe(38)
    expect(row.own_tools_override_coeff).toBeNull()
  })

  it('going back to auto clears both columns of the pair', async () => {
    const itemId = await createItem({ clientPrice: 100, wToolsOverrideCoeff: 0.55 })

    await update(itemId, { wToolsOverrideValue: null })

    const row = await readItem(itemId)
    expect(row.w_tools_override_coeff).toBeNull()
    expect(row.w_tools_override_value).toBeNull()
  })

  it('the AI review fields come back on read, and a lowered recheck flag stays lowered', async () => {
    const itemId = await createItem({ aiRecheck: true })

    await update(itemId, { reviewStatus: 'edited' })
    await update(itemId, { changeReason: 'Inny zakres po wizji lokalnej' })
    await update(itemId, { aiRecheck: false })
    await update(itemId, { note: 'po przeglądzie' })

    const row = await readItem(itemId)
    expect(row.review_status).toBe('edited')
    expect(row.change_reason).toBe('Inny zakres po wizji lokalnej')
    expect(row.ai_recheck).toBe(false)
    expect(row.note).toBe('po przeglądzie')
  })
})
