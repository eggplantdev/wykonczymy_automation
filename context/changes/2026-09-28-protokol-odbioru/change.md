---
change_id: protokol-odbioru
title: Protokół odbioru prac generowany z menu „Inwestor”, wstępnie wypełniony danymi z apki
status: implemented
created: 2026-09-28
updated: 2026-09-28
archived_at: null
branch: staging
worktree: null
---

## Notes

protokol-odbioru — generowanie protokołu odbioru prac (PDF) z menu „Inwestor”, częściowo wypełnionego danymi z apki. Wzór: `protokol-odbioru-prac.pdf` w tym folderze (do usunięcia po implementacji).

### Decyzje (2026-09-28)

- **Zakres prac** = lista wszystkich pozycji kosztorysu z wykonaną pracą (Pomiar z natury > 0), nie wybór etapu.
- **Stopniowo.** Pierwszy krok: wstępnie wypełniony dialog z formularzem protokołu, otwierany z menu „Inwestor”.
- Do wyrzucenia ze wzoru: stopka denwi.pl, „Reprezentowany przez” (obie strony), „Inne osoby obecne”, pkt 7, „Kwota zatrzymana”. „Okres rękojmi od dnia” = data odbioru.
- **Wykonawca** = zawsze „Wykończymy”, na sztywno (stała w kodzie, bez pola w bazie).
- Braki w danych: adres (35/138) i osoba kontaktowa (9/138) inwestycji są rzadko wypełnione — stąd dialog z edytowalnymi podpowiedziami.
- **Krok 1 = dialog + wydruk.** „Generuj” otwiera protokół do druku / PDF (mechanizm oferty, `openPrintWindow`).
- **Dane klienta**: formularz nie zapisuje ich sam; osobny przycisk w dialogu w stylu „Zaktualizuj dane inwestycji” zapisuje Zamawiającego / adres do inwestycji.
- **Rozliczenie (pkt 5)**: netto, jak „Podsumowanie" — Robocizna, Materiały, Suma, Wpłaty (zaliczki), Strata (jeśli jest), Pozostało do zapłaty / Nadpłata. Termin zapłaty = pole daty; „Obniżenie wynagrodzenia" = pusta linia; rękojmia od = data odbioru.
- **Zakres prac w dialogu**: tylko podgląd.
