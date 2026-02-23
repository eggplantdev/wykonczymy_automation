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
| `src/app/(frontend)/kasa/[id]/page.tsx`              | `getCashRegister + fetchRegisterBalances`                                            |
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

### Round 1: TransferTableServer

**Target:** _TBD after baseline_

**Changes:**

| #   | Change | File(s) | Rationale |
| --- | ------ | ------- | --------- |
|     |        |         |           |

**After Metrics (Local):**

| Page | Operation | Before (ms) | After (ms) | Delta |
| ---- | --------- | ----------- | ---------- | ----- |
|      |           |             |            |       |

**After Metrics (Production):**

| Page | Operation | Before (ms) | After (ms) | Delta |
| ---- | --------- | ----------- | ---------- | ----- |
|      |           |             |            |       |

---

### Round 2+

_Copy the Round 1 template for each subsequent optimization round._
