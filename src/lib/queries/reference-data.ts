import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-vercel-postgres'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import type { RoleT } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import { DEFAULT_VAT } from '@/lib/kosztorys/constants'
import { SETTLEMENT_MODE_DEFAULT, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { perfStart } from '@/lib/perf'

import type {
  CashRegisterRefT,
  CashRegisterTypeT,
  InvestmentRefT,
  InvestmentStatusT,
  WorkerRefT,
  OtherCategoryRefT,
  ExpenseCategoryRefT,
  ReferenceDataBaseT,
} from '@/types/reference-data'

// Categories alone, for callers that need only these. `fetchReferenceData` also returns every user
// (name, role, email) and every investment (address, phone, email, notes) — company-wide PII that
// must not be one identifier away on the unauthenticated share path.
export const fetchExpenseCategories = unstable_cache(
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

// `cache()` over `unstable_cache()` on purpose: the two dedupe on different axes. `unstable_cache`
// spans requests but re-runs whenever its tag is invalidated; `cache()` collapses the calls *within*
// one render, which is what actually hurt — the page, the transfers table and the root-layout nav
// each call this, so it ran 3× per render (EX-597 baseline). Safe here only because nothing reads
// reference data before a mutation in the same request, so the first call is always post-write.
export const fetchReferenceData = cache(
  unstable_cache(
    async (): Promise<ReferenceDataBaseT> => {
      const elapsed = perfStart()
      const payload = await getPayload({ config })
      const db = await getDb(payload)

      const [crResult, invResult, usersResult, catResult, expCatResult] = await Promise.all([
        db.execute(sql`
        SELECT id, name, type::text, active::boolean, owner_id::integer
        FROM cash_registers
        ORDER BY name
      `),
        // The sheet id lives on kosztoryses now (1:1 via partial unique index on
        // investment_id). LEFT JOIN so investments without a kosztorys still appear,
        // and we project a boolean instead of leaking the sheet id into the cache.
        //
        // The szablon workbench is excluded HERE, once, rather than by every consumer: it is not an
        // investment, so nothing that asks for „the investments" should ever see it. Filtering it
        // per-surface was one predicate per call site forever, with nothing forcing the next one —
        // and it had already leaked into the transfers filter dropdowns and the investments listing.
        db.execute(sql`
        SELECT i.id, i.name, i.status::text,
               i.address, i.phone, i.email, i.contact_person, i.notes, i.review,
               i.materials_net_rate::float8, i.settlement_mode::text, i.vat_rate::float8,
               (k.google_sheet_id IS NOT NULL) AS has_sheet
        FROM investments i
        LEFT JOIN kosztoryses k ON k.investment_id = i.id
        WHERE i.status <> ${TEMPLATE_INVESTMENT_STATUS}
        ORDER BY i.name
      `),
        db.execute(sql`
        SELECT id, name, role::text, active::boolean, email, default_cash_register_id::integer
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

      const cashRegisters: CashRegisterRefT[] = crResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
        type: (row.type as CashRegisterTypeT) ?? 'AUXILIARY',
        active: row.active as boolean,
        ownerId: row.owner_id ? Number(row.owner_id) : undefined,
      }))

      const investments: InvestmentRefT[] = invResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
        status: (row.status as InvestmentStatusT) ?? 'active',
        active: row.status === 'active',
        address: (row.address as string) ?? '',
        phone: (row.phone as string) ?? '',
        email: (row.email as string) ?? '',
        contactPerson: (row.contact_person as string) ?? '',
        notes: (row.notes as string) ?? '',
        review: (row.review as string) ?? '',
        materialsNetRate: row.materials_net_rate == null ? null : Number(row.materials_net_rate),
        settlementMode: (row.settlement_mode as SettlementModeT) ?? SETTLEMENT_MODE_DEFAULT,
        vatRate: row.vat_rate == null ? DEFAULT_VAT : Number(row.vat_rate),
        hasSheet: Boolean(row.has_sheet),
      }))

      const workers: WorkerRefT[] = usersResult.rows.map((row) => ({
        id: Number(row.id),
        name: row.name as string,
        role: (row.role as RoleT) ?? 'EMPLOYEE',
        active: row.active as boolean,
        email: (row.email as string) ?? '',
        defaultCashRegisterId: row.default_cash_register_id
          ? Number(row.default_cash_register_id)
          : undefined,
      }))

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
        investments,
        workers,
        otherCategories,
        expenseCategories,
      }
    },
    // Versioned key, bumped whenever the returned SHAPE changes (here: `vatRate` on the investment
    // ref). A tag only marks an entry stale — it still SERVES the old payload once, and a payload
    // missing a field the reader now dereferences is not stale, it is wrong: it crashes the page or
    // renders NaN. The bump makes the old entry unreachable instead.
    ['reference-data-v2'],
    {
      tags: [
        CACHE_TAGS.cashRegisters,
        CACHE_TAGS.investments,
        CACHE_TAGS.users,
        CACHE_TAGS.otherCategories,
        CACHE_TAGS.expenseCategories,
        // hasSheet derives from kosztoryses via JOIN — invalidate on kosztorys
        // create/link/unlink/delete too, otherwise the listing's "kosztorys" badge
        // stays stale.
        CACHE_TAGS.kosztoryses,
      ],
    },
  ),
)
