import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { getDb } from '@/lib/db/get-db'
import {
  createTestInvestment,
  trashDaysAgo,
  WITHIN_RETENTION_DAYS,
} from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// „Kosztorysy" counts a praca as used only where real work was offered or measured; a szablon or
// an inwestycja in the kosz counted in would inflate every figure with pozycje nobody sold. The
// kosz exclusion can only be proved here — the local dump has no trashed inwestycje.

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PREFIX = 'katalog-uzycia usage-db'

describe.skipIf(!ENV_READY)('selectUsedKosztorysItems (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let usedDescriptions: Set<string>
  let blankInvestmentRows: number

  const purge = () => db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${PREFIX}%`}`)

  const withItem = async (name: string, description: string, spec: object = {}) => {
    const id = await createTestInvestment(payload, `${PREFIX} ${name}`)
    await createKosztorysTree(payload, id, {
      sections: [{ name: 'S', items: [{ description, unit: 'm2', plannedQty: 1 }] }],
      ...spec,
    })
    return id
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const { selectUsedKosztorysItems } = await import('@/lib/db/catalogue-usage')
    await purge()

    await withItem('planned', `${PREFIX} planned`)
    await withItem('measured', `${PREFIX} measured`, {
      sections: [{ name: 'S', items: [{ description: `${PREFIX} measured`, plannedQty: 0 }] }],
      stages: [{}],
      progress: [{ item: 0, stage: 0, qtyDone: 2 }],
    })
    const quote = await withItem('quote', `${PREFIX} quote`)
    await db.execute(sql`UPDATE investments SET status = 'quote' WHERE id = ${quote}`)
    await withItem('zero', `${PREFIX} zero`, {
      sections: [{ name: 'S', items: [{ description: `${PREFIX} zero`, plannedQty: 0 }] }],
      stages: [{}],
      progress: [{ item: 0, stage: 0, qtyDone: 0 }],
    })
    const template = await withItem('template', `${PREFIX} template`)
    await db.execute(
      sql`UPDATE investments SET status = ${TEMPLATE_INVESTMENT_STATUS} WHERE id = ${template}`,
    )
    const trashed = await withItem('trashed', `${PREFIX} trashed`)
    await trashDaysAgo(db, trashed, WITHIN_RETENTION_DAYS)
    const blank = await withItem('blank', '  ')

    const used = await selectUsedKosztorysItems(db)
    usedDescriptions = new Set(
      used.map((row) => row.description).filter((description) => description.startsWith(PREFIX)),
    )
    blankInvestmentRows = used.filter((row) => row.investmentId === blank).length
  })

  afterAll(purge)

  it('counts a Przedmiar above zero', () => {
    expect(usedDescriptions.has(`${PREFIX} planned`)).toBe(true)
  })

  it('counts work measured on an etap with Przedmiar 0', () => {
    expect(usedDescriptions.has(`${PREFIX} measured`)).toBe(true)
  })

  it('counts a wycena', () => {
    expect(usedDescriptions.has(`${PREFIX} quote`)).toBe(true)
  })

  it('skips a pozycja with nothing offered or measured', () => {
    expect(usedDescriptions.has(`${PREFIX} zero`)).toBe(false)
  })

  it('skips szablony and inwestycje in the kosz', () => {
    expect(usedDescriptions.has(`${PREFIX} template`)).toBe(false)
    expect(usedDescriptions.has(`${PREFIX} trashed`)).toBe(false)
  })

  // A row added in the editor carries its Przedmiar before anyone names it, and a nameless praca
  // would surface in „Używane, a brak w katalogu" as a bare j.m.
  it('skips a pozycja without an opis', () => {
    expect(blankInvestmentRows).toBe(0)
  })
})
