# Plan: catalogue-auto-translate (EX-1065)

Scope is settled in `change.md`. One phase.

## Phase 1: Daily cron fills the katalog's translations

1. `src/lib/ai/fill-catalogue-translations.ts` — `fillCatalogueTranslations(db)`: the body of
   `fillCatalogueTranslationsAction` (`translateRows` over `listCatalogueItems`, then
   `fillDescriptionTranslations`), returning `{ items, failed }`. The action calls it.
2. `src/app/(payload)/api/cron/translate-catalogue/route.ts` — `isAuthorizedCronRequest` gate,
   `getPayload` → `getDb` → the shared function; expires `CACHE_TAGS.workCatalogue` with
   `revalidateTag(…, EXPIRE_NOW)` only when something was written; 500 on a thrown error.
   An empty run makes no AI call: `inBatches` builds no batch for zero texts.
3. `vercel.json` — `/api/cron/translate-catalogue` at `0 2 * * *`.
4. Route spec `src/__tests__/app/(payload)/api/cron/translate-catalogue/route.test.ts`: 401 without
   the secret, a run with writes expires the tag, a run with none does not, a throw is a 500.

## Progress

### Phase 1

#### Automated

- [x] 1.1 Shared fill function, action delegates
- [x] 1.2 Cron route + vercel.json
- [x] 1.3 Route spec
