---
change_id: telmak-invoice-check
title: Sprawdzanie paczki faktur Telmak z transakcjami kasy Telmak
status: implemented
created: 2026-10-06
updated: 2026-10-06
archived_at: null
branch: spike/telmak-invoice-check
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/telmak-invoice-check
---

## Notes

Sprawdzanie faktur Telmak na stronie kasy (/kasa/[id], kasa Telmak). Utwardzenie klikalnego spike'a z worktree /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/telmak-invoice-check (branch spike/telmak-invoice-check, niezacommitowany): paczka PDF parsowana w przeglądarce (pdfjs-dist, deterministycznie, bez LLM), zakres dat wystawienia (DateRangePicker), porównanie z transakcjami kasy (server query), tabela „Faktury do weryfikacji” (DataTable: ID, Status, Dokument, Data wyst., Faktura, Aplikacja, Inwestycja, Uwagi, Podgląd, Akcje „Dołącz do #id”), pod nią „Transakcje do weryfikacji” (kolumny listy transakcji), toast na nieznany format + TODO(EX-449). Pliki spike'a: src/lib/telmak/{parse-telmak,pdf-lines,compare-telmak}.ts, src/lib/queries/telmak-check.ts, src/components/telmak-check/telmak-check-dialog.tsx, src/app/(frontend)/kasa/[id]/page.tsx, package.json (pdfjs-dist 6.4.299). UI zaakceptowane przez usera.
