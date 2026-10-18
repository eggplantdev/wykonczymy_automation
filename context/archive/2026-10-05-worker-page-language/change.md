---
change_id: worker-page-language
title: The worker's own page in Ukrainian / Russian — a current-language switch and a self-set default language
status: archived
created: 2026-10-05
updated: 2026-10-06
archived_at: 2026-10-06T09:04:20Z
branch: worker-page-language
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/worker-page-language
---

## Notes

worker-page-language: on `/pracownicy/[id]`, the account's owner sets their own „Domyślny język”, and the logged-in app follows it.
Follow-up to worker-self-credentials and worker-account.

### Decided with the owner (2026-10-05)

1. **One switch on the worker's page: „Domyślny język”** (supersedes the earlier "two separate switches"). Changing it saves the language on the account. The page and the worker's report both follow it. On the device where it was changed, it also overwrites the language the report remembers, so a stale device choice can't override it.
2. **A separate change from worker-self-credentials.** That change is implemented and only waiting on manual checks.
3. **A brief flash of the wrong language on load is acceptable.** Avoiding it is not a design criterion.
4. **„Podgląd pracownika” stays Polish.** The manager can't know what the worker picked on their device.
5. **Translate the whole page.** That includes the shared parts: the transfers table, filters, uploads and the menu.
6. **Amounts and dates keep the Polish format** in uk/ru.
7. **A manager gets the switcher on their own page too.**
