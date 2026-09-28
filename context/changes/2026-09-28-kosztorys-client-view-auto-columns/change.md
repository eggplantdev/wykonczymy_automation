---
change_id: kosztorys-client-view-auto-columns
title: Podgląd inwestora — jeden zestaw kolumn, kolumny rozliczenia pokazywane gdy są wpisy
status: implementing
created: 2026-09-28
updated: 2026-09-28
archived_at: null
branch: staging
worktree: null
---

## Notes

Ustalenia z rozmowy z ownerem (2026-09-28):

- **Znika przełącznik „Oferta / Rozliczenie"** (i jego ostrzeżenie „Uwaga — zmiana widoczna dla
  inwestora!"). Zostaje **jeden** zestaw kolumn w „Ustawieniach podglądu…" — okno pokazuje tylko,
  które kolumny MOGĄ być widoczne.
- **Kolumny rozliczenia pokazują się warunkowo — gdy cokolwiek jest wpisane:** „Pomiar z natury",
  każdy etap **osobno** (pusty etap ukryty, etap z wpisami widoczny), wartość netto per etap,
  „razem netto" (wykonane) i „% wykonania". Ustawienia decydują, czy kolumna może się pokazać;
  dane — czy się pokazuje.
- **W oknie ustawień opis**, że puste etapy (i reszta kolumn rozliczenia bez wpisów) będą ukryte.
- **„Udostępnij" bez kroku ustawień** — klik generuje link (jeśli go nie ma) i kopiuje go do
  schowka. Istniejącego linku nie rotuje. (Pośredni stan w kodzie: przycisk „Wygeneruj i skopiuj
  link" na kroku ustawień w `kosztorys-share-dialog.tsx` — do przepisania w ramach tej zmiany.)
- **Druk oferty (PDF) działa tak samo.**
- **„Pozostało" domyślnie ukryte** w jedynym zestawie domyślnym (owner, 2026-09-28). Nie podlega
  regule „pokaż, gdy są wpisy" — jeśli owner je włączy, jest widoczne zawsze.
- **Przyjęte (owner, 2026-09-28):** wpis w etapie — także testowy lub pomyłkowy — jest od razu
  widoczny pod linkiem inwestora, bez świadomego przełączenia trybu.
- **Przeniesienie zapisanych ustawień:** inwestycja w Rozliczeniu zostaje ze swoim zestawem;
  inwestycja w Ofercie zachowuje swoje ukrycia, ale kolumny rozliczenia dostają zgodę na pokazanie
  się (reguła wpisów decyduje). Dotyczy też ustawień domyślnych firmy.
- **Brutto idzie za netto:** „Razem brutto" i wartość brutto per etap — domyślnie ukryte jak dziś;
  po włączeniu pokazują się tylko razem ze swoim odpowiednikiem netto, gdy są wpisy.
- **Zakładka „Etapy" i licznik postępu** w podglądzie inwestora też chowają puste etapy.
