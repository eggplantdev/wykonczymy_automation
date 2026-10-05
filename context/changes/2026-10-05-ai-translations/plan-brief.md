# AI translations — Plan Brief

> Full plan: `context/changes/2026-10-05-ai-translations/plan.md`

## What & Why

~90% of the crew reads Ukrainian or Russian, but uk/ru translations are filled by hand or by an
offline script, so new and edited prace reach workers untranslated or stale. Extras that workers
type in Ukrainian reach a Polish manager unreadable. This change makes the app fill them with AI
(EX-992), and EX-949 reuses the same function.

## Starting Point

Translations are stored per opis (`{text, source}`; stale when the opis moved on) and per section
name template (a shared list). Problemy flags only stale ones. The katalog has both filters. There
is no AI call. Worker extras are reviewed and accepted as typed.

## Desired End State

One button in „Opcje" and one in Katalog prac fill every missing/stale translation. New prace are
translated on save, behind a remembered checkbox. Section names get templates on create/rename.
Worker extras arrive in Polish with the original beside them, and the manager can retranslate any
pending one from the review dialog, also when the automatic translation failed. Accepting makes the
Polish the opis and the worker's text its translation.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Review of AI output | None | The owner fixes mistakes by hand |
| Bulk scope | Missing + stale only | Never overwrite a current or hand-corrected one |
| Opis edits later | No AI call; stale → Problemy → bulk | Grid autosaves per cell; race + cost |
| Section names | Covered by the kosztorys button + auto on create/rename | Shared list; must pass the number check |
| Sources | Katalog translation first, AI for the rest | Free, consistent with the katalog |
| Extras timing | `after()` the send | The worker's send stays fast |
| Extras failure | Untranslated + „Przetłumacz" button in review | A Polish manager can always get a reading |
| Retry model | Straight to the stronger fallback model | A retry follows a bad answer |
| Accept | Polish opis + original as current uk/ru translation | The crew reads the worker's own words |
| Late AI answers | Compare-and-set writes | A newer opis or a hand edit always wins |

## Scope

**In scope:** AI module + planners; kosztorys bulk (opisy + sections); „bez tłumaczenia" in
Problemy; katalog bulk; creation checkbox (2 dialogs); section auto-templates; extras → Polish,
with review display, retry button and accept.

**Out of scope:** AI on later opis edits; global section action; Problemy for section names;
etapy/notes/UI strings; review step; rate limiting; the TSV script.

## Architecture / Approach

`src/lib/ai/translate.ts` (`translateTexts` pl→uk/ru, `translateToPolish` with detection; batched,
fallback model, results mapped back by id or left blank) → pure planners in
`src/lib/i18n/ai-translation-fill.ts` → translation-only guarded DB writers → actions
(`investmentAction` / management / `after()`) → existing UI surfaces.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. AI layer | Translator + planners, mocked tests | Model output mapping drifts |
| 2. Kosztorys bulk | „Opcje" button, Problemy condition | Clobbering a concurrent grid edit |
| 3. Katalog bulk | Toolbar button | Same guard on another table |
| 4. Creation | Checkbox + section templates | AI latency on save; after() spec stubs |
| 5. Extras → Polish | Migration, after(), review + retry, accept | Retry vs after() write order |

**Prerequisites:** `OPENROUTER_API_KEY` set (already used by receipts). Prod migration before the
Phase 5 push (human).
**Estimated effort:** ~3 sessions.

## Open Risks & Assumptions

- Flash-lite translation quality of trade vocabulary is unproven. The model is one constant, and
  retry uses the stronger one.
- Language detection can misfire on a short or mixed extra. The button covers it.
- Bulk run time on a 1000-row kosztorys is estimated, not measured.

## Success Criteria (Summary)

- Problemy → Tłumaczenia is empty after one click, and no hand-typed translation changed.
- A Ukrainian extra reads in Polish in review, or one click makes it so.
- No AI failure ever blocks a save or a send.
