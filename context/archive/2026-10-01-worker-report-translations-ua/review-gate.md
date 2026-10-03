# Review-gate ledger — worker-report-translations-ua (EX-948) · 2026-10-01

Scope: `9bf9b36a` (merge-base with `staging`)…`HEAD` on `ex-948-worker-report-translations-ua`, 171 files.
Step 0.5 (browser verification) skipped: the owner is verifying in the running app by hand; the
agent does not drive the browser unasked.

Fan-out: impl-review, code-review, tailwind-v4-audit, feature-first-structure, module-cohesion-audit,
structure-scatter-audit (diff-scoped), comment-noise-audit (flag-only).

## Findings

- [x] 🟡 WARNING · dismissed · impl-review · `src/lib/actions/worker-report.ts:18,19,35` · empty report / >2000 lines / duplicate pozycja have no messageKey — unreachable from the UI: send is disabled at 0 lines, the grid keys by pozycja, 2000 is a DoS cap
- [x] 🔵 OBSERVATION · dismissed · impl-review · `catalogue-item-from-kosztorys-dialog.tsx:24` · the dialog prefills `existing ?? candidate` (katalog whole-map) while the blind save merges per language — deliberate: the dialog is the owner looking at what the katalog already says and editing it; the blind save has no one to look
- [x] fixed · code-review · `src/lib/i18n/failure-message.ts:9` · matched `pl.common.databaseError` by string, duplicating `DATABASE_ERROR` — a `DATABASE_ERROR` failure code
- [x] fixed · code-review · `src/lib/kosztorys/translation-column-keys.ts:33` · `baseTranslationColumnKey` dead export — deleted
- [x] fixed · impl-review · `src/app/(frontend)/pracownicy/[id]/page.tsx` · `worker.language ?? 'pl'` — `DEFAULT_LANGUAGE` (and the other literal `'pl'` defaults)
- [x] fixed · module-cohesion-audit · 5 files · `const POLISH_GRID = createTranslator(DEFAULT_LANGUAGE, 'grid')` duplicated — one export
- [x] fixed · module-cohesion-audit · `src/lib/kosztorys/worker-report/refusals.ts` · `WORKER_SCOPE_BLOCK_NOTICE_KEYS` moved beside the scope it maps (`worker-view/labels.ts`)
- [x] fixed · feature-first-structure · `src/lib/i18n/translate-tree.ts` · one consumer → `lib/kosztorys/worker-report/translate-tree.ts`, spec moved to match
- [x] fixed · feature-first-structure · `src/lib/i18n/use-translation.ts`, `i18n-context.ts` · React hooks in `lib/`, consumers in 2 directories → merged into `src/hooks/use-translation.ts`
- [x] fixed · feature-first-structure · `src/lib/i18n/translations-provider.tsx` · a component in `lib/`, one consumer → `components/kosztorys/worker-report/translations-provider.tsx`, spec moved to match
- [x] fixed · comment-noise-audit · deletes, trims, judgment deletes, stale „(Polish locale)" JSDoc in `format-date.ts` — applied; kept with rationale: `translation-fill.ts`, `worker-report-page.ts` `ReportLocaleT`, `work-catalogue-item-form.tsx` baseline JSDoc, `translationsFromTexts`
- [x] fixed · impl-review · `src/scripts/fill-description-translations.ts:18` · the header said any rozpiska cell edit flushes the cache — a tłumaczenie cell writes back the whole stale map; reworded to name the edits that are safe
- [x] fixed · simplify · `src/components/kosztorys/worker-report/translations-provider.tsx` · hand-rolled localStorage read/write — `usePersistedEnum`
- [x] fixed · simplify · `src/lib/i18n/description-translations.ts` · `translationsFromTexts` re-checked languages `changedTranslationTexts` already narrowed — loop over `TRANSLATION_LANGUAGES`
- [x] fixed · simplify · `src/lib/kosztorys/translation-column-keys.ts` · key type spelled out by hand — template-literal type from `PREFIX`
- [x] fixed · simplify · `catalogue-missing-list.tsx` · the accepted-name shape was a local type — `CatalogueNameT` shared with the editor hook
- [x] fixed · simplify · `src/lib/actions/work-catalogue.ts:68` · a price-only update re-read its own row after `findCatalogueItemByKey` already returned it — reuse the holder
- [x] dropped · simplify · `CatalogueHintT` now carries translations to the client — tens of bytes per candidate
- [x] dropped · simplify · second efficiency nit — negligible
- [x] skipped · simplify · rozpiska tłumaczenie cell writes the whole map it holds — moving it to server-side `translationEdits` reaches the item patch schema and the undo stack; a review-worthy refactor, and the only stale source is the one-off fill script (header now says so)
- [x] skipped · simplify · accept-name could send a katalog id and let the server copy name + translations — a server-side refactor of the compare dialog's write path; the client-side merge closes the gap
- [x] skipped · simplify · refusals carry a flat `messageKey` — a namespaced key is a redesign across every action; one namespace works today
- [x] dropped · simplify · opis normalisation duplicated between merge and restamp — two call sites, different intent
- [x] dropped · code-review · `src/components/kosztorys/worker-report/report-grid.tsx` · `key={seed.locale}` remount resets search and scroll on a language switch — a switch happens once per visit
- [x] dropped · code-review · undo coalesces a UK and an RU edit into one step; concurrent edits of two languages are whole-map last-write-wins — five users, one editor at a time
- [x] dropped · code-review · `worker-schema` requires `language`, so an old-build client's save fails mid-deploy — a reload fixes it
- [x] dismissed · code-review · `users.language` has no field-level access rule — the collection's own access already gates it
- [x] dismissed · code-review · `reportNoticeKeyOf` recovers the key from the Polish sentence — deliberate: Zod messages carry only text and the sentences come from the dictionary
- [x] dropped · code-review · katalog read on every import — one query per import
- [x] dismissed · impl-review · `generateMetadata` on the report page was on the plan's NOT-doing list — harmless, the tab title follows the worker's language
- [x] dropped · impl-review · `src/styles/globals.css:432` hard-codes the `__uk`/`__ru` selectors — a new language is a bigger change than one selector
- [x] dropped · impl-review · a stale katalog translation cannot be marked current without retyping it — retyping (or a typo-fix restamp) does it; a „mark current" control is a feature nobody asked for
- [x] dismissed · impl-review · `src/components/ui/language-label.tsx` imports `lib/i18n` — the `ui/` rule forbids importing feature component directories, not `lib`
- [x] dismissed · feature-first-structure · `description-translations.ts`, `translation-fill.ts` → `lib/kosztorys/` — they are the language layer's data shape, shared by katalog and kosztorys; `lib/i18n` is their home
- [x] dropped · feature-first-structure · `(share)/zgloszenie-prac/not-found.tsx` builds its own header — one-off
- [x] dismissed · tailwind-v4-audit · no findings

## Simplify pass

Ran /simplify (4 agents) — 6 applied, 0 proposed, 3 skipped, 4 dropped; folded into ## Findings (tagged `simplify`).

## Tests & suite

- typecheck — clean
- touched unit + DOM specs (`lib/i18n`, `lib/kosztorys/sheet-import`, `lib/kosztorys/worker-report`, `translation-column-keys`, `components/kosztorys`, `components/work-catalogue`, `hooks`) — 121 files, 805 tests green
- DB specs on 5435 (`work-catalogue`, `worker-report` actions) — 15/15 green
- full suite / integration / E2E — not run; the user's call
