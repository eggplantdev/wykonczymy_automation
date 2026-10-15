import { cache } from 'react'
import { cached } from '@/lib/cache/cached'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import type { RoleT } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { isoOrNull } from '@/lib/db/row-coerce'
import { toLanguage } from '@/lib/i18n/languages'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { SETTLEMENT_MODE_DEFAULT, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { perfStart } from '@/lib/perf'

import type { InvestmentStatusT } from '@/lib/constants/investment-status'
import type { InvestmentAiStageT } from '@/lib/constants/investment-ai-stage'
import type {
  CashRegisterRefT,
  CashRegisterTypeT,
  InvestmentNotesT,
  InvestmentRefT,
  InvestmentWithNotesT,
  WorkerRefT,
  OtherCategoryRefT,
  ExpenseCategoryRefT,
  ReferenceDataBaseT,
} from '@/types/reference-data'

// `fetchReferenceData` also returns every user and every investment with their contact details —
// company-wide PII that must not be one identifier away on the unauthenticated share path.
export const fetchExpenseCategories = cached(
  async (): Promise<ExpenseCategoryRefT[]> => {
    const payload = await getPayload({ config })
    const db = await getDb(payload)
    const result = await db.execute(sql`
      SELECT id, name FROM expense_categories
      ORDER BY name
    `)
    return result.rows.map((row) => ({ id: Number(row.id), name: row.name as string }))
  },
  ['expense-categories'],
  { tags: [CACHE_TAGS.expenseCategories] },
)

function splitTrashed<T>(rows: { isTrashed: boolean; ref: T }[]): [live: T[], trashed: T[]] {
  const live: T[] = []
  const trashed: T[] = []
  for (const row of rows) (row.isTrashed ? trashed : live).push(row.ref)
  return [live, trashed]
}

// Both caches, because they dedupe on different axes: `unstable_cache` spans requests but re-runs on
// tag invalidation, while `cache()` collapses calls *within* one render — the page, the transfers
// table and the nav each call this, so it ran 3× per render (EX-597). Safe only because nothing reads
// reference data before a mutation in the same request.
export const fetchReferenceData = cache(
  cached(
    async (): Promise<ReferenceDataBaseT> => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      const db = await getDb(payload)

      const [crResult, invResult, usersResult, catResult, expCatResult] = await Promise.all([
        db.execute(sql`
        SELECT id, name, type::text, active::boolean, owner_id::integer,
               (trashed_at IS NOT NULL) AS trashed
        FROM cash_registers
        ORDER BY name
      `),
        // LEFT JOIN so investments without a kosztorys still appear, projecting a boolean rather than
        // leaking the sheet id into the cache.
        //
        // The szablon workbench is excluded HERE, once, rather than by every consumer: it is not an
        // investment, and filtering it per-surface had already leaked into the transfers filter
        // dropdowns and the investments listing. A trashed investment is split off below rather than
        // dropped: /kosz still opens it read-only, while every listing and picker reads the live half.
        db.execute(sql`
        SELECT i.id, i.name, i.status::text, (i.trashed_at IS NOT NULL) AS trashed,
               i.address, i.phone, i.email, i.contact_person, i.review_requested,
               i.materials_net_rate::float8, i.settlement_mode::text, i.vat_rate::float8, i.ai_stage::text,
               i.created_at, (k.google_sheet_id IS NOT NULL) AS has_sheet
        FROM investments i
        LEFT JOIN kosztoryses k ON k.investment_id = i.id
        ORDER BY i.name
      `),
        db.execute(sql`
        SELECT id, name, role::text, active::boolean, email, default_cash_register_id::integer,
               language, can_add_expenses_without_investment, (trashed_at IS NOT NULL) AS trashed
        FROM users
        ORDER BY name
      `),
        db.execute(sql`
        SELECT id, name FROM other_categories
        ORDER BY name
      `),
        db.execute(sql`
        SELECT id, name FROM expense_categories
        ORDER BY name
      `),
      ])

      const totalRows =
        crResult.rows.length +
        invResult.rows.length +
        usersResult.rows.length +
        catResult.rows.length +
        expCatResult.rows.length
      console.log(`[PERF] query.fetchReferenceData ${elapsed()}ms (5 SQL, ${totalRows} rows)`)

      const cashRegisterRows = crResult.rows.map((row) => ({
        isTrashed: Boolean(row.trashed),
        ref: {
          id: Number(row.id),
          name: row.name as string,
          type: (row.type as CashRegisterTypeT) ?? 'AUXILIARY',
          active: row.active as boolean,
          ownerId: row.owner_id ? Number(row.owner_id) : undefined,
        } satisfies CashRegisterRefT,
      }))
      // Split, not filtered: the list doubles as the name map for transaction rows, and a cancelled
      // row on a trashed kasa must keep saying which kasa it was. Every picker and listing reads the
      // live half, so a new consumer cannot forget to hide the trash.
      const [cashRegisters, trashedCashRegisters] = splitTrashed(cashRegisterRows)

      const investmentRows = invResult.rows.map((row) => ({
        isTrashed: Boolean(row.trashed),
        ref: {
          id: Number(row.id),
          name: row.name as string,
          status: (row.status as InvestmentStatusT) ?? 'active',
          active: row.status === 'active',
          address: (row.address as string) ?? '',
          phone: (row.phone as string) ?? '',
          email: (row.email as string) ?? '',
          contactPerson: (row.contact_person as string) ?? '',
          reviewRequested: row.review_requested === true,
          materialsNetRate: row.materials_net_rate == null ? null : Number(row.materials_net_rate),
          settlementMode: (row.settlement_mode as SettlementModeT) ?? SETTLEMENT_MODE_DEFAULT,
          vatRate: row.vat_rate == null ? DEFAULT_VAT : Number(row.vat_rate),
          hasSheet: Boolean(row.has_sheet),
          aiStage: (row.ai_stage as InvestmentAiStageT | null) ?? null,
          createdAt: isoOrNull(row.created_at) ?? '',
        } satisfies InvestmentRefT,
      }))
      const [investments, trashedInvestments] = splitTrashed(investmentRows)

      const workerRows = usersResult.rows.map((row) => ({
        isTrashed: Boolean(row.trashed),
        ref: {
          id: Number(row.id),
          name: row.name as string,
          role: (row.role as RoleT) ?? 'EMPLOYEE',
          active: row.active as boolean,
          email: (row.email as string) ?? '',
          defaultCashRegisterId: row.default_cash_register_id
            ? Number(row.default_cash_register_id)
            : undefined,
          language: toLanguage(row.language),
          canAddExpensesWithoutInvestment: row.can_add_expenses_without_investment === true,
        } satisfies WorkerRefT,
      }))
      const [workers, trashedWorkers] = splitTrashed(workerRows)

      const otherCategories: OtherCategoryRefT[] = catResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
      }))

      const expenseCategories: ExpenseCategoryRefT[] = expCatResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
      }))

      return {
        cashRegisters,
        trashedCashRegisters,
        investments,
        trashedInvestments,
        workers,
        trashedWorkers,
        otherCategories,
        expenseCategories,
      }
    },
    ['reference-data'],
    {
      tags: [
        CACHE_TAGS.cashRegisters,
        CACHE_TAGS.investments,
        CACHE_TAGS.users,
        CACHE_TAGS.otherCategories,
        CACHE_TAGS.expenseCategories,
        // hasSheet derives from kosztoryses via JOIN, so a create/link/unlink/delete there leaves the
        // listing's "kosztorys" badge stale.
        CACHE_TAGS.kosztoryses,
      ],
    },
  ),
)

type InvestmentNotesMapT = Record<number, InvestmentNotesT>

// Same tag as `fetchReferenceData`, so the two expire together — every notes writer goes through
// Payload, whose afterChange hook bumps `collection:investments`. Server-only by design: see
// `InvestmentWithNotesT`.
export const fetchInvestmentNotes = cache(
  cached(
    async (): Promise<InvestmentNotesMapT> => {
      const payload = await getPayload({ config })
      const db = await getDb(payload)
      const result = await db.execute(sql`
        SELECT id, notes, ai_notes FROM investments
        WHERE notes IS NOT NULL OR ai_notes IS NOT NULL
      `)
      return Object.fromEntries(
        result.rows.map((row) => [
          Number(row.id),
          { notes: (row.notes as string) ?? '', aiNotes: (row.ai_notes as string) ?? '' },
        ]),
      )
    },
    ['investment-notes'],
    { tags: [CACHE_TAGS.investments] },
  ),
)

const NO_NOTES: InvestmentNotesT = { notes: '', aiNotes: '' }

export function withNotes(
  investment: InvestmentRefT,
  notesById: InvestmentNotesMapT,
): InvestmentWithNotesT {
  return { ...investment, ...(notesById[investment.id] ?? NO_NOTES) }
}

export function findInvestmentRef(
  refData: Pick<ReferenceDataBaseT, 'investments' | 'trashedInvestments'>,
  investmentId: number,
): { investment: InvestmentRefT; trashed: boolean } | undefined {
  const live = refData.investments.find((i) => i.id === investmentId)
  if (live) return { investment: live, trashed: false }
  const trashed = refData.trashedInvestments.find((i) => i.id === investmentId)
  return trashed && { investment: trashed, trashed: true }
}

export function findWorkerRef(
  refData: Pick<ReferenceDataBaseT, 'workers' | 'trashedWorkers'>,
  workerId: number,
): WorkerRefT | undefined {
  return (
    refData.workers.find((w) => w.id === workerId) ??
    refData.trashedWorkers.find((w) => w.id === workerId)
  )
}
