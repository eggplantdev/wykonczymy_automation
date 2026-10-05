---
change_id: ai-translations
title: AI fills missing and stale uk/ru translations
status: implementing
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: ai-translations
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/ai-translations
---

## Notes

— Tłumaczenia AI (EX-992, under EX-946, blocks EX-949): AI fills missing/stale uk/ru translations of opisy, section names and translates prace spoza rozpiski into Polish

Linear: **EX-992** under umbrella **EX-946**. Lands **before EX-949** (kartka → AI). EX-949 then only
reads the scan and reuses this change's translation function for prace written in Ukrainian.

### Decisions (user, 2026-10-05)

- **Reverses EX-948's "no AI call in the app".** Translations are generated in the app, through the
  existing OpenRouter setup (`src/lib/ai/openrouter.ts`).
- **No review step.** The AI's translation is final; the owner corrects mistakes by hand.
- **Kosztorys: „Problemy → Tłumaczenia" gains a „bez tłumaczenia (UA/RU)" condition.** This reverses
  the earlier choice to list only stale translations there
  (`src/lib/kosztorys/row-conditions/registry.ts`, "a missing translation is not listed").
- **Kosztorys: „Opcje" gets a bulk action** that fills missing and stale translations for the whole
  kosztorys — opisy and section names.
- **Katalog prac: the same bulk action for the whole katalog**, so it is fixed at once, not entry by
  entry. Its „bez tłumaczenia" / „z nieaktualnym tłumaczeniem" filters already exist
  (`src/lib/kosztorys/work-catalogue/catalogue-conditions.ts`).
- **Adding a praca (rozpiska and katalog):** a „Tłumacz automatycznie przy pomocy AI" checkbox,
  translating on save when checked.
- **Section names are translated too.**
- **One button in „Opcje" covers opisy and section names of that kosztorys** — no separate section
  item, and no global section-name action. Section translations are one shared list keyed by the
  name template (`kosztorys_section_translations`), so a fill from one kosztorys also serves every
  other kosztorys with the same section name. An AI translation must pass the same number check as
  the manual dialog (`toSectionTemplate`); one that fails stays missing.
- **„Prace spoza rozpiski" typed in uk/ru are translated into Polish automatically, when the worker
  sends the zgłoszenie.** The manager sees the Polish with the worker's original beside it.

- **The checkbox is on by default and remembered.**
- **Every translation language (uk + ru) is filled.**
- **A failed AI call still saves the row**, without a translation; it then shows as missing.
- **Section names are translated automatically on create / rename**, and the bulk action covers them.

- **The bulk action fills only missing and stale translations**; it never overwrites an up-to-date
  one, a hand-corrected one included.
- **The checkbox translates only when a praca is created** (the „Nowa pozycja" dialog, and adding to
  the katalog). Editing an opis later — inline in the grid, or a katalog entry — makes no AI call: the
  translation goes stale, shows in „Problemy" as „z nieaktualnym tłumaczeniem", and the bulk action
  fixes it. Why: the grid autosaves per cell, so an AI call per opis save would land seconds later and
  could race the next edit, and an opis edited in small steps would cost one call per step.

### Decisions (user, 2026-10-05, /10x-plan)

- **Prace spoza rozpiski are translated in `after()` the send**, so the worker's send stays fast.
- **Katalog first, AI for the rest:** a current katalog translation of the same praca is reused
  before the AI is asked.
- **Accepting an extra makes the Polish the opis and the worker's original its uk/ru translation**,
  current against that Polish.
- **The bulk buttons run immediately and report counts in a toast.**
- **The manager can retranslate any pending extra from the review dialog** („Przetłumacz" /
  „Przetłumacz ponownie"). This also works when the automatic translation failed and the line has
  no Polish at all, so a Polish manager can always get a reading. The button and any translation
  state are **manager-only**; the worker's page shows his own text and nothing else.
