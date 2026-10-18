# Review-gate ledger — kosz-plikow · 2026-10-18

Scope: `2dceae2a5...ebbee1b9e` (branch `feat/kosz-plikow`, branch point from `staging`).
Step 0.5 (browser verification) skipped — no browser runs without an explicit ask; manual checks
live in `context/foundation/manual-checks.md` § kosz-plikow.

## Findings

- [x] 🟡 WARNING · fixed · impl-review · `src/lib/db/media-detachments.ts:fetchDetachedFiles` · a file another record still holds was listed in Kosz and could be restored onto a second record — the list now excludes referenced files (`NOT isReferenced`)
      test: TDD · integration — `media-detachments.test.ts` „leaves out a file another record still holds"
- [x] 🟡 WARNING · fixed · code-review · `src/lib/actions/media-trash.ts` · restoring a file already attached elsewhere left its trash entry open — same filter; the action now answers „Tego pliku nie ma już w Koszu."
      test: TDD · integration — covered by the same spec (the action reads through `fetchDetachedFiles`)
- [x] 🔵 OBSERVATION · fixed · code-review · `src/lib/leads/erase-lead.ts` · files a lead had already dropped stayed in the trash 7 days after its erasure — erase now deletes the lead's open entries too
      test: test-driven-debugging · integration — `erase-lead.db.test.ts`, red first, asserts the media row is gone
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review · `src/lib/media/relating-collections.ts` · holder tables listed by hand; a missing one reads as unattached and the sweep deletes it — `MEDIA_HOLDER_TABLES` derived from `MEDIA_RELATIONS` + raw tables
      test: TDD · integration — `gc-media.test.ts` „counts every table that links to a file" compares it with the FKs into `media`
- [x] 🔵 OBSERVATION · fixed · code-review + simplify (reuse, altitude) · `src/lib/media/delete-unreferenced-media.ts` · the „still attached" scan existed twice (5 Payload finds + 2 raw lookups vs the sweep's SQL) — now one `findReferencedMediaIds` on the shared `isReferenced` fragment; `findDraftHeldMedia` / `findReportHeldMedia` deleted
      test: no automated test needed beyond the existing — unit spec mocks the one call; FK guard + `worker-expense-drafts.db` cover the SQL
- [x] 🔵 OBSERVATION · dismissed · impl-review · `src/lib/media/gc-media.ts` · a run of failing deletes could starve the 100-per-night cap — failures are logged and counted in `media.failed`; check it after the first prod night
- [x] 🔵 OBSERVATION · dismissed · code-review · `src/lib/media/gc-media.ts` · check-then-delete race in the hook — a refused delete is retried the next night; nothing is lost
- [x] 🔵 OBSERVATION · dismissed · code-review · `.github/workflows/blob-backup.yml` · backup runs only 30 min before the sweep — the 7-day grace means earlier nightly backups already hold every expiring file
- [x] skipped · simplify (reuse, altitude) · `src/hooks/media/prevent-referenced-delete.ts` · the delete guard still names the two raw holder tables by hand — its Payload probes run access-scoped on the caller's `req` and feed labelled messages; rebuilding it on the raw list changes who it blocks and its mocked spec. Backstop only; the deciding checks now share one list
- [x] fixed · structure-scatter-audit · `src/lib/media/gc-media.ts` · raw SQL in a `lib/media` orchestrator — moved to `lib/db/media-detachments.ts`
- [x] fixed · module-cohesion-audit · `src/lib/media/file-trash.ts` · display label for /kosz lived beside domain rules — `fileSourceLabel` moved into `lib/queries/trash.ts`
- [x] fixed · simplify (simplification, reuse, altitude) · `src/lib/media/file-trash.ts` · `fileUploadTarget` re-derived collection/field from the parent kind while `from_field` was stored and never read — `DetachedFileRowT.source` read from the row, helper deleted
- [x] fixed · simplify (simplification, reuse, altitude) · `src/lib/actions/media-trash.ts` / `src/lib/queries/trash.ts` · register-visibility rule written twice — `canViewDetachedFile` in `file-trash.ts`
- [x] fixed · simplify (simplification, altitude) · `src/components/trash/delete-forever-dialog.tsx` · re-looked up `TRASH_KINDS` with an unreachable `return null` — takes `deleteForever` as a prop; `note` moved into `DeleteForeverConfigT`
- [x] fixed · simplify (simplification, reuse) · `src/lib/db/media-detachments.ts` · local `dateOrNull` — moved to `row-coerce.ts`, also used by `lead-trash.ts`
- [x] fixed · simplify (reuse) · four new DB specs · copied raw `INSERT INTO media` fixture — `__tests__/helpers/media.ts`; `media-trash.db` uses `createTestInvestment`
- [x] fixed · simplify · `src/lib/db/media-detachments.ts` · `import 'server-only'` dropped — the invoice-delete collection hook now reaches it, and the Payload CLI graph must not import `server-only`
- [x] dropped · simplify (simplification) · `src/lib/media/relating-collections.ts` · `relsTable` derivable from the slug — explicit names stay greppable and the FK guard spec catches drift
- [x] dismissed · simplify (efficiency) · sweep / Kosz list / erase · double 7-table check per night, unindexed `(from_collection, from_id)` lookup, per-delete tag expiry — all index lookups on ~2.4k rows or a rare click; 100 deletes fit the 300 s cron
- [x] fixed · comment-noise-audit · migration, workflow, `media-trash.ts`, `investment-assets.db.test.ts`, `recordDetachments` JSDoc · restated or historical comments deleted/trimmed
- [x] dismissed · comment-noise-audit · `src/lib/media/set-upload-field.ts` · flagged comment names a real failure (crash between record and update) — kept
- [x] dismissed · module-cohesion-audit / structure-scatter-audit · `relating-collections.ts`, trash files · remaining flags fit the existing homes
- [x] dismissed · tailwind-v4-audit · no findings
- [x] filed · slice · browser flow (remove → /kosz Pliki → restore / blocked) owes an E2E — filed EX-1085 (`e2e-backlog`)

## Simplify pass

Ran /simplify — 8 applied, 0 proposed, 3 dismissed/dropped/skipped; each finding folded into ## Findings (tagged simplify). Report: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.4Uj6GQ40sB.md`.

## Tests & suite

- Unit/DOM: `queries/trash`, `components/trash/*`, `delete-unreferenced-media`, `prevent-referenced-delete` — 45/45 green.
- DB (5435): `media-detachments`, `gc-media`, `media-trash.db`, `erase-lead.db`, `investment-assets.db`, `delete-orphaned-media.db`, `worker-expense-drafts.db`, `worker-expense-drafts-worker.db`, `worker-report-scan.db`, `lead-trash.db`, `leads/purge-trash.db` — 98/98 green.
- Typecheck: clean for the slice (one test literal typed after `DetachmentSourceT.collection` became `CollectionSlug`). Remaining errors are the worktree's missing generated `importMap.js` — not this slice.
- Lint: 0 errors in slice files. The one error (`use-investment-from-url.test.ts:21`, rules-of-hooks) and the 53 warnings predate the branch.
- Full suite and build: skipped by the user's call (typecheck + lint only).
