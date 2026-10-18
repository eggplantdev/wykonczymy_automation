import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  createTestInvestment,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { INVESTMENT_AI_STAGES, type InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import { authState } from '@/__tests__/stubs/require-auth'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
vi.mock('@/lib/auth/require-auth', () => import('@/__tests__/stubs/require-auth'))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const MARKER = 'investment-ai-stage-action-db'

describe.skipIf(!ENV_READY)('setInvestmentAiStageAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let setStage: typeof import('@/lib/actions/investments').setInvestmentAiStageAction
  let id: number

  const storedStage = async () => {
    const result = await db.execute(sql`SELECT ai_stage FROM investments WHERE id = ${id}`)
    return result.rows[0]?.ai_stage
  }

  const purge = () => db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${MARKER} %`}`)

  beforeAll(async () => {
    authState.role = 'ADMIN'
    payload = await bootTestPayload()
    db = await getDb(payload)
    setStage = (await import('@/lib/actions/investments')).setInvestmentAiStageAction
    await purge()
  })

  beforeEach(async () => {
    await purge()
    id = await createTestInvestment(payload, `${MARKER} stage`)
  })

  afterAll(async () => {
    await purge()
  })

  it.each(INVESTMENT_AI_STAGES)('stores %s', async (stage) => {
    await setStage(id, stage)
    expect(await storedStage()).toBe(stage)
  })

  it('clears the stage with null', async () => {
    await setStage(id, 'review_done')
    await setStage(id, null)
    expect(await storedStage()).toBeNull()
  })

  it('refuses a value outside the list and writes nothing', async () => {
    await setStage(id, 'review_done')
    const result = await setStage(id, 'published' as InvestmentAiStageT)

    expect(result.success).toBe(false)
    expect(await storedStage()).toBe('review_done')
  })

  it('sets the stage on a zakończona inwestycja', async () => {
    await db.execute(sql`UPDATE investments SET status = 'completed' WHERE id = ${id}`)
    await setStage(id, 'knowledge_extracted')
    expect(await storedStage()).toBe('knowledge_extracted')
  })

  it('refuses a trashed investment', async () => {
    await trashDaysAgo(db, id, WITHIN_RETENTION_DAYS)
    const result = await setStage(id, 'review_done')

    expect(result.success).toBe(false)
    expect(await storedStage()).toBeNull()
  })
})
