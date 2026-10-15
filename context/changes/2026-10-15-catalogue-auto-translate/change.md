---
change_id: catalogue-auto-translate
title: Katalog prac — cron dotłumacza brakujące i nieaktualne tłumaczenia (EX-1065)
status: implemented
created: 2026-10-15
updated: 2026-10-15
archived_at: null
branch: null
worktree: null
---

## Notes

Linear: EX-1065.

A Vercel cron does what the katalog's „Uzupełnij tłumaczenia (AI)" button does: `translateRows` over the katalog entries, then `fillDescriptionTranslations`. A szablon edits its opisy in the katalog entries (EX-1017), so szablony are covered too. The button stays for an immediate fill.

- The body of `fillCatalogueTranslationsAction` is extracted into one shared function. The action and the cron route both call it.
- Once a day, `0 2 * * *` (UTC): the owner's call. A day's lag is fine, and an hourly run buys nothing.
- A run with nothing to translate makes no AI call.
- A write expires the katalog tag: `revalidateTag(…, EXPIRE_NOW)`, Route Handler context.
- The writer only lands a language while the row still carries the opis it was planned against, so an edit mid-run is safe.

Dropped by the owner:

- Translating on save: the 2–3 s wait in the dialogs isn't worth it.
- The folded-opis staleness rule. The exact compare stays.

Evidence from the dump of 2026-10-15: 5 / 583 katalog entries need translation.

- Ids 67, 678, 905 and 717 went stale after opis edits on 12–15.10.
- Id 955 was saved from kosztorys pozycja 58589 with no translations.
