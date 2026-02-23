# Performance Optimization — Baseline & Tracking

## Goal

Systematically measure and optimize page load performance across all frontend pages.
Starting with `TransferTableServer` (most reused async component), then expanding to all pages.

## Scope

### Phase 1: Transfer table & detail pages (current)

### Phase 2: All remaining pages (TBD)

## Instrumented Files

| File                                                 | Checkpoints                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/app/(frontend)/kasa/[id]/page.tsx`              | `fetchReferenceData + fetchRegisterBalances`                                         |
| `src/app/(frontend)/inwestycje/[id]/page.tsx`        | `fetchReferenceData + fetchInvestmentFinancials`                                     |
| `src/components/user-transfer-view.tsx`              | `refData + saldos` (+ `fetchWorkerPeriodBreakdown` on demand)                        |
| `src/components/dashboard/manager-dashboard.tsx`     | `fetchManagerDashboardData`                                                          |
| `src/components/transfers/transfer-table-server.tsx` | `findTransfersRaw + fetchReferenceData`, `fetchMediaByIds`, `buildLookups + mapRows` |

---

## Baseline Metrics

### Local (dev mode, after Rounds 1–2)

> Date: 2026-02-23
> Dataset: ~50 transactions, 5 registers, 4 investments, 2 workers

| Page                | Operation                                                   | Cold (ms) | Warm (ms) |
| ------------------- | ----------------------------------------------------------- | --------- | --------- |
| `/` (dashboard)     | `fetchManagerDashboardData`                                 | 93–179    | 18–29     |
| `/` (dashboard)     | `TransferTableServer findTransfersRaw + fetchReferenceData` | 8–12      | 8–12      |
| `/` (dashboard)     | `TransferTableServer fetchMediaByIds`                       | 4–7       | 4–7       |
| `/` (dashboard)     | `TransferTableServer buildLookups + mapRows`                | 0–1       | 0–1       |
| `/` (dashboard)     | **Full page** (`GET / render:`)                             | 535       | 155–326   |
| `/kasa/[id]`        | `fetchReferenceData + fetchRegisterBalances`                | 90–111    | 42–50     |
| `/kasa/[id]`        | `TransferTableServer findTransfersRaw + fetchReferenceData` | 9–69      | 8–11      |
| `/kasa/[id]`        | `TransferTableServer fetchMediaByIds`                       | 6–7       | 2–6       |
| `/kasa/[id]`        | `TransferTableServer buildLookups + mapRows`                | 0–1       | 0–1       |
| `/kasa/[id]`        | **Full page** (`GET /kasa/... render:`)                     | 314–479   | 98–169    |
| `/inwestycje/[id]`  | `fetchReferenceData + fetchInvestmentFinancials`            | 40–74     | 17–43     |
| `/inwestycje/[id]`  | `TransferTableServer findTransfersRaw + fetchReferenceData` | 21–63     | 4–9       |
| `/inwestycje/[id]`  | `TransferTableServer fetchMediaByIds`                       | 2–4       | 2–4       |
| `/inwestycje/[id]`  | `TransferTableServer buildLookups + mapRows`                | 0         | 0         |
| `/inwestycje/[id]`  | **Full page** (`GET /inwestycje/... render:`)               | 163–255   | 163–255   |
| `/uzytkownicy/[id]` | `refData + saldos`                                          | 8–145     | 8         |
| `/uzytkownicy/[id]` | `TransferTableServer findTransfersRaw + fetchReferenceData` | 59        | 3–5       |
| `/uzytkownicy/[id]` | `TransferTableServer fetchMediaByIds`                       | 0         | 0         |
| `/uzytkownicy/[id]` | `TransferTableServer buildLookups + mapRows`                | 0         | 0         |
| `/uzytkownicy/[id]` | **Full page** (`GET /uzytkownicy/... render:`)              | 522       | 522       |

### Production (Bursle)

> _TBD — fill after deploying Rounds 1–2_

---

## Optimization Log

### Round 1: `/kasa/[id]` — replace Payload ORM with reference data

**Target:** Eliminate `getCashRegister` (Payload ORM depth=1) by reusing `fetchReferenceData`

**Changes:**

| #   | Change                                                                | File(s)                                 | Rationale                                                                 |
| --- | --------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Replace `getCashRegister(id)` with `fetchReferenceData()` + lookup    | `src/app/(frontend)/kasa/[id]/page.tsx` | Eliminates 45–88ms Payload ORM call; primes cache for TransferTableServer |
| 2   | Resolve owner name from `refData.workers` instead of depth=1 relation | `src/app/(frontend)/kasa/[id]/page.tsx` | No need for `getRelationName` — data already in reference data            |

**After Metrics (Local — dev, dashboard pre-warmed):**

| Page         | Operation                                             | Before (ms) | After (ms) | Delta    |
| ------------ | ----------------------------------------------------- | ----------- | ---------- | -------- |
| `/kasa/[id]` | Page data fetch (getCashRegister → fetchRefData)      | 100–159     | 42–50      | -58–109  |
| `/kasa/[id]` | `TransferTableServer findTransfersRaw + fetchRefData` | 11–18       | 8–11       | ~-5      |
| `/kasa/[id]` | **Full page** (`GET /kasa/... render:`)               | 478–546     | 98–169     | -309–380 |

**After Metrics (Local — dev, cold start):**

| Page         | Operation                               | Before (ms) | After (ms) | Delta                                                        |
| ------------ | --------------------------------------- | ----------- | ---------- | ------------------------------------------------------------ |
| `/kasa/[id]` | Page data fetch                         | 62          | 111        | +49 (fetchRefData cold is heavier than getCashRegister cold) |
| `/kasa/[id]` | **Full page** (`GET /kasa/... render:`) | 1533        | 370        | -1163                                                        |

> Note: Cold-start page data fetch is slightly slower because `fetchReferenceData` (4 SQL) is heavier than `getCashRegister` (1 Payload findByID). However, total page render is dramatically faster because `fetchReferenceData` primes the cache for `TransferTableServer`, eliminating a redundant cold computation in the Suspense child.

---

### Round 2: `/inwestycje/[id]` — replace Payload ORM with reference data

**Target:** Eliminate `getInvestment` (Payload ORM) by reusing `fetchReferenceData`

**Changes:**

| #   | Change                                                             | File(s)                                                            | Rationale                                                         |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Add `notes` field to `InvestmentRefT` and `fetchReferenceData` SQL | `src/types/reference-data.ts`, `src/lib/queries/reference-data.ts` | Only field missing from reference data                            |
| 2   | Replace `getInvestment(id)` with `fetchReferenceData()` + lookup   | `src/app/(frontend)/inwestycje/[id]/page.tsx`                      | Eliminates Payload ORM call; primes cache for TransferTableServer |

**After Metrics (Local — dev, warm caches):**

| Page               | Operation                                             | After (ms) |
| ------------------ | ----------------------------------------------------- | ---------- |
| `/inwestycje/[id]` | Page data fetch (`fetchRefData + fetchInvFinancials`) | 17–74      |
| `/inwestycje/[id]` | `TransferTableServer findTransfersRaw + fetchRefData` | 4–63       |
| `/inwestycje/[id]` | **Full page** (`GET /inwestycje/... render:`)         | 163–255    |

> Note: With dashboard pre-warmed, page data fetch drops to 17–43ms. `findTransfersRaw` cache miss (new investment ID) adds ~60ms on first hit, then 4ms warm. Full page renders in 163–255ms depending on compile + proxy overhead.

---

### Round 3: `/uzytkownicy/[id]` — replace getUserDetail with reference data + cached saldos

**Target:** Eliminate `getUserDetail` (Payload ORM + per-user saldo query) by reusing `fetchReferenceData` + `fetchWorkerSaldos`. Period breakdown only fetched on demand (date range filter).

**Changes:**

| #   | Change                                                                           | File(s)                                 | Rationale                                                        |
| --- | -------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| 1   | Replace `getUserDetail` with `fetchReferenceData()` + `fetchWorkerSaldos()`      | `src/components/user-transfer-view.tsx` | All user fields + saldo already cached from dashboard            |
| 2   | Create `fetchWorkerPeriodBreakdown` — thin cached wrapper, called only on demand | `src/lib/queries/users.ts`              | Period breakdown only needed when user applies date range filter |
| 3   | Remove `getUserDetail` entirely                                                  | `src/lib/queries/users.ts`              | No longer used — all data comes from shared cached queries       |

**After Metrics (Local — dev):**

| Page                | Operation                                             | Before (ms) | After (ms) | Delta    |
| ------------------- | ----------------------------------------------------- | ----------- | ---------- | -------- |
| `/uzytkownicy/[id]` | Page data fetch (`getUserDetail` → refData + saldos)  | 139–256     | 8–145      | -131–111 |
| `/uzytkownicy/[id]` | `TransferTableServer findTransfersRaw + fetchRefData` | 109–174     | 5–59       | -104–115 |
| `/uzytkownicy/[id]` | **Full page** (`GET /uzytkownicy/... render:`)        | 1242–1422   | 522        | -720–900 |

> Note: Cold render still dominated by compile time (597ms). Warm render: 8ms page data + 5ms transfer table — effectively zero query cost. No `getPayload()` call needed at all when no date range filter is active.

---

### Round 4 (proposed): Test Payload ORM with current caching strategy

**Question:** The raw SQL in `fetchReferenceData` and `sumAll*` was written before the cache-priming optimization. Now that caching does the heavy lifting, would Payload ORM perform just as well — while being simpler to maintain?

**Plan:**

1. Create a branch
2. Replace raw SQL queries with Payload ORM equivalents (`find()`, `findByID()`), keeping the same `'use cache'` + `cacheLife('max')` + cache-priming pattern
3. Measure the same pages (dashboard, kasa, inwestycje, uzytkownicy) — cold and warm
4. If the cold-miss penalty is small enough, drop the raw SQL in favor of Payload ORM for maintainability

---

### Round 5+

_Copy the Round 1 template for each subsequent optimization round._
