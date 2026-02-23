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
| `src/app/(frontend)/inwestycje/[id]/page.tsx`        | `getInvestment + fetchInvestmentFinancials`                                          |
| `src/components/user-transfer-view.tsx`              | `getUserDetail`                                                                      |
| `src/components/dashboard/manager-dashboard.tsx`     | `fetchManagerDashboardData`                                                          |
| `src/components/transfers/transfer-table-server.tsx` | `findTransfersRaw + fetchReferenceData`, `fetchMediaByIds`, `buildLookups + mapRows` |

---

## Baseline Metrics

### Local (`next build && next start`)

> Date: \_**\_
> Node: \_\_**
> Dataset: \_**\_ transactions, \_\_** registers, \_\_\_\_ investments

| Page                | Operation                                                   | Cold (ms) | Warm (ms) |
| ------------------- | ----------------------------------------------------------- | --------- | --------- |
| `/` (dashboard)     | `fetchManagerDashboardData`                                 |           |           |
| `/` (dashboard)     | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/` (dashboard)     | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/` (dashboard)     | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/` (dashboard)     | **Full page** (`GET / render:`)                             |           |           |
| `/kasa/[id]`        | `getCashRegister + fetchRegisterBalances`                   |           |           |
| `/kasa/[id]`        | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/kasa/[id]`        | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/kasa/[id]`        | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/kasa/[id]`        | **Full page** (`GET /kasa/... render:`)                     |           |           |
| `/inwestycje/[id]`  | `getInvestment + fetchInvestmentFinancials`                 |           |           |
| `/inwestycje/[id]`  | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/inwestycje/[id]`  | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/inwestycje/[id]`  | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/inwestycje/[id]`  | **Full page** (`GET /inwestycje/... render:`)               |           |           |
| `/uzytkownicy/[id]` | `getUserDetail`                                             |           |           |
| `/uzytkownicy/[id]` | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/uzytkownicy/[id]` | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/uzytkownicy/[id]` | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/uzytkownicy/[id]` | **Full page** (`GET /uzytkownicy/... render:`)              |           |           |

### Production (Bursle)

> Date: \_**\_
> Dataset: \_\_** transactions, \_**\_ registers, \_\_** investments

| Page                | Operation                                                   | Cold (ms) | Warm (ms) |
| ------------------- | ----------------------------------------------------------- | --------- | --------- |
| `/` (dashboard)     | `fetchManagerDashboardData`                                 |           |           |
| `/` (dashboard)     | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/` (dashboard)     | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/` (dashboard)     | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/` (dashboard)     | **Full page**                                               |           |           |
| `/kasa/[id]`        | `getCashRegister + fetchRegisterBalances`                   |           |           |
| `/kasa/[id]`        | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/kasa/[id]`        | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/kasa/[id]`        | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/kasa/[id]`        | **Full page**                                               |           |           |
| `/inwestycje/[id]`  | `getInvestment + fetchInvestmentFinancials`                 |           |           |
| `/inwestycje/[id]`  | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/inwestycje/[id]`  | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/inwestycje/[id]`  | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/inwestycje/[id]`  | **Full page**                                               |           |           |
| `/uzytkownicy/[id]` | `getUserDetail`                                             |           |           |
| `/uzytkownicy/[id]` | `TransferTableServer findTransfersRaw + fetchReferenceData` |           |           |
| `/uzytkownicy/[id]` | `TransferTableServer fetchMediaByIds`                       |           |           |
| `/uzytkownicy/[id]` | `TransferTableServer buildLookups + mapRows`                |           |           |
| `/uzytkownicy/[id]` | **Full page**                                               |           |           |

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

### Round 2+

_Copy the Round 1 template for each subsequent optimization round._
