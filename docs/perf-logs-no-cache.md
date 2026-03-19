# Performance Logs — Without `cacheComponents` (No `'use cache'`)

Captured: 2026-03-19 ~22:52 UTC, production deployment on Vercel (iad1).
Database: Neon Postgres (eu-central-1), pooled connection.

## Dashboard (`/`)

| Query                      | Time      | Details          |
| -------------------------- | --------- | ---------------- |
| sumAllRegisterBalances     | 13–17ms   | 25 registers     |
| fetchReferenceData         | 21–26ms   | 5 SQL, 104 rows  |
| sumAllInvestmentFinancials | 23–54ms   | 27 investments   |
| fetchInvestmentFinancials  | 45ms      | 27 investments   |
| findTransfersRaw           | 37–38ms   | 20 docs, page=1  |
| **ManagerDashboard total** | **~66ms** | (first cold hit) |

## Investment Detail (`/inwestycje/37`)

| Query              | Time    | Details          |
| ------------------ | ------- | ---------------- |
| fetchReferenceData | 25–98ms | 5 SQL, 104 rows  |
| data fetch total   | 108ms   | (first cold hit) |
| findTransfersRaw   | 28ms    | 10 docs, page=1  |

## Cash Register Detail (`/kasa/20`, `/kasa/16`)

| Query                  | Time    | Details           |
| ---------------------- | ------- | ----------------- |
| sumAllRegisterBalances | 13–49ms | 25 registers      |
| fetchRegisterBalances  | 49ms    | 25 registers      |
| fetchReferenceData     | 14–73ms | 5 SQL, 104 rows   |
| findTransfersRaw       | 25–26ms | 6–10 docs, page=1 |

## Reports (`/raporty`)

| Query              | Time    | Details         |
| ------------------ | ------- | --------------- |
| fetchReferenceData | 22–64ms | 5 SQL, 104 rows |
| findTransfersRaw   | 36ms    | 20 docs, page=1 |

## Summary

- **Cold start** (first request): 60–110ms total
- **Warm requests**: 13–50ms per query
- **No caching** — every request hits the database
- **No errors** — zero 500s, all requests successful
- `fetchReferenceData` is called multiple times per page (by different server components) — candidate for deduplication or caching
