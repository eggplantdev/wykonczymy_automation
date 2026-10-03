---
change_id: worker-report-translations-ua
title: Ukrainian translations for the worker report surface
status: archived
created: 2026-10-01
updated: 2026-10-03
archived_at: 2026-10-03T05:53:00Z
branch: ex-948-worker-report-translations-ua
worktree: .claude/worktrees/ex-948-translations
---

## Notes

EX-948 (slice 2 of EX-946): Ukrainian translations of the work catalogue, worker language setting, UI strings on the worker report surface

Linear: **EX-948** under umbrella **EX-946**. Slice 1 (EX-947) is archived at
`context/archive/2026-09-30-worker-work-reports/`; slice 3 is **EX-949** (kartka → AI).

### Scope as agreed in slice 1 (`change.md` § The arc, point 2)

- A translation table keyed by **work-catalogue item × language**. A rozpiska pozycja resolves to its
  catalogue item by opis + j.m., the same way „Porównaj z katalogiem" does.
- The language is set on the worker.
- A small UI-string dictionary covers the report page's own labels.
- **Claude authors the translations as a data import** (export → translate → import script). There
  is no AI call in the app.
- New catalogue items get a manual „Tłumaczenie (UA)" field, plus a „bez tłumaczenia" filter in
  „Problemy".
- **Identity never goes through the translated text.** A report line points at the pozycja itself.

### Decisions (user, discussion 2026-10-01)

- **Identity stays text.** No pozycja → katalog id link; see
  `context/changes/2026-10-01-kosztorys-item-catalogue-link/research.md`. Translations of prace are
  keyed by the Polish text.
- **Built for more languages than UA.** Adding a language must be one list entry plus files, with no
  migration.
- **Why: ~90% of the crew is Ukrainian (user, 2026-10-01).** Every link, PDF and form a worker gets
  must be translated. Polish is the exception, not the default case.
- **Inventory of what a worker gets** (local prod-dump copy, 2026-10-01):
  - In scope: the rozpiska link `/p`, the report link `/zgloszenie-prac` with its forms (quantities,
    „Prace spoza rozpiski" dialog, send, sent history), and the worker PDF.
  - Not a worker surface today: the logged-in app. There are 46 `EMPLOYEE` accounts, but they booked
    0 of ~3,980 transactions in 180 days (3,062 by MANAGER, 914 by OWNER), with one employee session
    on record (2026-06-09). An employee would land on `/kasa/[id]`.
  - Not a worker surface: fleet and equipment (events created by OWNER; digests go to the
    management recipient lists), the acceptance protocol (a Zamawiający ↔ Wykonawca document for the
    client), and `/k` / „Podgląd inwestora" (the client's).
- **This slice: the scaffolding plus the report link only (user, 2026-10-01).** The scaffolding is
  the i18n core, the worker's language and the switcher. The surface is `/zgloszenie-prac/…` and
  everything it opens: the grid in both views, the „Prace spoza rozpiski" dialog, sending, the sent
  history and the notice pages. The other worker surfaces follow in later slices, on the same
  scaffolding.
- **Target scope across slices: every surface the worker reads.** That is the report page (`/zgloszenie-prac/…`), the
  rozpiska link (`/p/…`) and the worker PDF (`buildWorkerPrintHtml`). All three are built from one
  projection, `buildWorkerKosztorysData` (`src/lib/queries/worker-kosztorys.ts`), so opisy are
  translated there once.
- **„Wszystkie kolumny" is translated, not hidden.** This supersedes the earlier "hide it in a
  non-Polish language" decision. `/p` and the PDF show the worker's full column set (10 columns,
  `WORKER_DOCUMENT_COLUMNS`), so the column headers and tooltips must be translated anyway, and
  hiding the toggle no longer saves anything. Etapy names are owner-typed data and stay as typed.
- **There is a language switcher on the worker page.**
- **The UI-string mechanism follows the reference repos' hand-rolled `useTranslation`**
  (`~/workspace/yolo/landing_26/src/lib/i18n/`, `~/workspace/fest/fest-frontend/lib/i18n/`), not
  next-intl. Fit and gaps are still under discussion.
- **A worker's language is optional, and unset means Polish (user, 2026-10-01).** The manager doesn't
  have to fill it in. An unset worker reads Polish on `/p`, on the report link and in the PDF. The PDF
  takes the stored language, because it is printed from the editor and can't read the worker's
  switcher. On the two links, the switcher overrides the stored language.
- **„Podgląd pracownika" opens in the worker's language and shows the switcher (user, 2026-10-01).**
  It is the manager's way of checking exactly what the worker sees.
- **This slice lands before EX-949 (user, 2026-10-01).** Slice 3 then reshapes a worker PDF that is
  already translated, and builds on the dictionary instead of translating the layout afterwards.
- **The logged-in app is out of scope (user, 2026-10-01).** Worker accounts aren't in use yet. The
  i18n core lives in `src/lib/i18n/` and isn't tied to the share pages, so the app shell can be
  translated later with the same dictionaries, without rework.
- **„Prace spoza rozpiski" typed in Ukrainian stay as typed (user, 2026-10-01).** The manager reviews
  them as written. An AI translation is coming soon as a separate change; this slice adds no AI call.
- **New investments are built from the katalog, ~99%, apart from one-off prace (user, 2026-10-01).**
  Translating the katalog therefore covers new investments by itself. There is no recurring
  export → import cycle. Only one-off prace need another route.
- **Investments imported from Sheets are old work, even when imported recently (user, 2026-10-01).**
  An import date like Suwala's 28.09 doesn't make an investment new. These investments are where the
  ~311 opisy outside the katalog live, and they will close out over time.
- **Translations of prace live on the row, copied like the opis (user, 2026-10-01).** This replaces
  the separate text dictionary and the read-through from the katalog.
  - The pozycja and the katalog entry each carry their own translation, one value per language.
    Adding a language needs no migration.
  - The rozpiska gets one „Opis prac (<język>)" column per language, hidden by default.
  - Picking a praca from the katalog copies its translation into the row, together with the opis.
    After that it is plain text on the row. Nothing compares it with the katalog again, and fixing
    the katalog does not touch existing rows, the same as with the opis today.
  - Changing the Polish opis does NOT clear the translation (user, 2026-10-01). The rozpiska warns
    that the translation is out of date, and a button generates a new one with AI. The translation
    keeps the Polish text it was made from, so the warning is a comparison and clears itself when
    the opis is reverted.
    - The worker sees an out-of-date translation as it is. Only the manager is warned.
    - „Problemy" gets a „nieaktualne tłumaczenie" filter.
    - The AI button is out of scope for this slice. It ships with the AI translation change. This
      slice makes no AI call.
  - A one-off praca starts empty and is filled by hand, by a script, or later by the AI translation.
  - The worker's page reads the row's translation and falls back to the Polish opis when it is empty.
  - **Filling translations is a re-runnable script, not a one-time migration (user, 2026-10-01).**
    Old investments are still being imported, so the ~311 figure (local dump) is stale by the time
    it runs. The script must be safe to run again after every import:
    - It counts what is missing itself, from the current data. No figure is baked in.
    - It fills only empty translations and never overwrites a hand-typed one.
    - It matches by Polish text, not row id, so rows imported after the export are covered too.
    - It records the Polish text each translation was made from, for the stale warning.
    - Scope: katalog entries, plus the rows of open investments.
    - It reads from the local copy (`pnpm db:dump` first). A human applies it to production;
      dry-run by default, `--apply` to write.
  - **The sheet import copies the katalog translation for opisy that match the katalog (user,
    2026-10-01)**, the same as picking from the katalog does. After an import, only the one-off prace
    wait for the script.
  - Cost: about 20 files list a pozycja's fields one by one (snapshot format, insert, tree read,
    edit schema, szablony, accept-from-report, catalogue → kosztorys). Every one of them must carry
    the new field, or a copy silently drops it. A snapshot round-trip test guards this.
- **There is no Polish original under the translated opis (user, 2026-10-01).** The switcher already
  shows the Polish page whenever the worker or the manager needs the original wording.
- **„Popraw literówki" keeps a current translation current (user, 2026-10-01, /10x-plan).** A typo fix
  doesn't change meaning. A translation made from the old opis gets its source text moved to the
  corrected one. A translation that was already out of date stays out of date.
- **„Zapisz do katalogu" over an existing entry: the pozycja's translation wins if it has one (user,
  2026-10-01, /10x-plan).** This is decided per language. Where the pozycja has none, the katalog
  keeps its own.
- **Russian ships with this change, next to Ukrainian (user, 2026-10-01, during implementation).**
  It is the first proof of the „one list entry plus files" rule. A worker can be set to Русский,
  the switcher offers it, and the rozpiska and katalog get an „Opis prac (RU)" column and RU problems.
  The fill script runs once per language.
- **The worker's language is a plain text field, not a select (plan, 2026-10-01).** A Payload select
  always creates a Postgres enum, so every new language would need a migration. This supersedes the
  enum proposal in `research.md`.
