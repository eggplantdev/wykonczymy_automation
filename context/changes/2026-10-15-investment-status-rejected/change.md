---
change_id: investment-status-rejected
title: Status inwestycji „Odrzucona” + przelewy tylko na aktywnej (EX-1066)
status: implemented
created: 2026-10-15
updated: 2026-10-15
archived_at: null
branch: investment-status-rejected
worktree: ../wykonczymy-worktrees/investment-status-rejected
---

## Notes

Linear: EX-1066 — https://linear.app/ex-plant/issue/EX-1066

Decyzje właściciela (2026-10-15):

- Nowy status „Odrzucona” (`rejected`): klient zrezygnował na etapie wyceny/planowania. Domyślnie
  ukryty w filtrze statusów listy inwestycji. Zmiana statusu z niego (i z wyceny/planowanej) swobodna —
  odblokowanie tylko przez właściciela/admina dotyczy wyłącznie „Zakończonej”.
- Formularze przelewów (wpłata, wydatek, edycja) pokazują w wyborze inwestycji tylko „Aktywne” i
  „Planowane”, bez przełącznika „Wszystkie”. Planowana zostaje w formularzach (decyzja 2026-10-15) —
  w praktyce już się na nią księguje. **Bez blokady po stronie serwera** (decyzja po researchu,
  2026-10-15) — ukrycie w formularzach wystarcza. Kosztorys i istniejące przelewy nietknięte.

**Wstrzymane (2026-10-15) — czeka na decyzję właściciela:** czy Wycena ma znikać z wyboru inwestycji w
formularzach przelewów. Na produkcji są już przelewy na wycenach (Agatha 208: zaliczka + wypłata
projektanta; Żubrowa 177: wydatek), więc to może być realny przypadek. Plan na razie Wycenę ukrywa;
odwrócenie to jedna pozycja w zbiorze statusów. Od decyzji zależy tylko faza 2. Faza 1, czyli status
„Odrzucona”, jest od niej niezależna.
