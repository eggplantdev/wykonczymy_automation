---
change_id: worker-single-view
title: One worker view — „Zgłoszenie prac" absorbs the /p link and its Podsumowanie
status: implemented
created: 2026-10-05
updated: 2026-10-05
archived_at: null
branch: staging
worktree: null
---

## Notes

worker-single-view — EX-966: merge the /p worker link into „Zgłoszenie prac" as the single worker view (Podsumowanie button + WorkerSummary in report mode, /p removed, Podgląd pracownika opens it, panel works at 390px); translations of the merged view follow

Linear: **EX-966** under umbrella **EX-946**. Must land before **EX-949** (paper → AI), which rebuilds the worker PDF.

### Decided with the owner (2026-10-05)

The owner had parked the question on EX-966 on 2026-10-01: merge the two worker links, or translate `/p` on its own? Answer: **one view**. The view's shape comes first, translations after.

„Zgłoszenie prac" with „Wszystkie kolumny" on already shows `/p`'s grid plus „Zgłaszam". Both screens render through `KosztorysEditorBody`. The differences are the „Podsumowanie" panel and the „Opcje" button, which the report view does not have.

1. **„Zgłoszenie prac" becomes the single worker view.** It gets a „Podsumowanie" button that opens the worker's own balance, `WorkerSummary`, which today is gated off in report mode (`kosztorys-editor-body.tsx`, `worker && !report`). The report page has to start loading the worker's figures.
2. **No „Opcje" button.** On the worker's link it holds only „Pokaż wszystkie pozycje (+n)", which the report view's „Wszystkie prace" switch already covers.
3. **`/p` goes away, with no redirect.** The owner does not care about links already sent (2026-10-05). The `/p` route, the `rozpiska` link kind and its token collection (`kosztorys-worker-shares`) are removed; dropping the table is a destructive migration, so it follows the AGENTS.md push-first order.
4. **„Podgląd pracownika" in the editor opens the merged view**, so the owner sees what the worker sees. The worker PDF is unchanged here; EX-949 rebuilds it.
5. **The „Podsumowanie" panel must work at 390px.** The report page is the phone-scope exception (EX-947). `/p` was never in phone scope, so the panel has not been checked on a phone.
6. **One link per worker in the menu.** The editor's „Pracownicy" menu (`kosztorys-workers-menu.tsx`) offers each worker two links today, „Link dla pracownika" (`/p`) and „Link do zgłoszeń". It keeps one. Podgląd and the PDF stay.

Translations of the merged view (EX-966's original scope) follow once the shape is in.
