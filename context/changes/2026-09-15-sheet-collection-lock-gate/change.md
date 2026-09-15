---
change_id: sheet-collection-lock-gate
title: Bramka zamka zakończonej inwestycji obejmuje kolekcję `kosztoryses` w /admin
status: implementing
created: 2026-09-15
updated: 2026-09-15
archived_at: null
branch: staging
worktree: null
linear: EX-770
---

## Notes

Tracked as **EX-770** (in progress). Piąta kolekcja zamka — `kosztoryses` (`src/collections/sheets.ts:30`)
— nie ma bramki panelowej, więc `/admin` jest drogą wokół zamka: MANAGER przepnie albo wyczyści
`investment` na arkuszu zakończonej inwestycji, OWNER go skasuje. Warstwa akcji tę samą operację
odbija (`lockedSheetError`, `src/lib/actions/sheets.ts`), panel jej nie dotyka.

Trudność, przez którą finding nie został naprawiony przy bramce EX-748: FK `investment` jest
nullable (`ON DELETE SET NULL`), a niepowiązany arkusz jest pierwszoklasowy — gotowe
`unlessInvestmentLocked` zwraca `Where` traversujący `investment.status`, co odsiałoby również
arkusze bez inwestycji.

Research: `research.md` (2026-09-15).

## Rozstrzygnięcia (2026-09-15)

1. **Obie przesłanki z issue okazały się fałszywe.** `not_equals` na złączonej nullowalnej relacji
   NIE odsiewa arkuszy bez inwestycji — `parseParams` emituje `col IS NULL OR col <> …`, a traversal
   relacji idzie LEFT JOINem (potwierdzone źródłem i sondą na bazie). Proponowane w issue `or` +
   `exists: false` jest zbędne. Panel nie mówi też „nie znaleziono": odmowa przez `Where` daje 403
   `Forbidden`, a w praktyce formularz tylko do odczytu z wyszarzonym „Save".
2. **Bramka regułą `access`, nie hookiem.** Każda akcja aplikacji jedzie `overrideAccess: true`, więc
   reguła `access` bramkuje dokładnie `/admin` — czyli tę jedną dziurę. Hook odpalałby się zawsze
   i objąłby `unlinkSheetFromInvestmentAction` / `deleteSheetAction`, które już dziś odmawiają
   czytelnym `ActionResult`.
3. **Przepisanie czterech pozostałych kolekcji na hooki — odrzucone.** Dla `create`/`update` jest
   niewykonalne (`executeAccess` leci PRZED `beforeChange`), a zdjęcie reguł `access` zepsułoby pięć
   skryptów seeda i dołożyło zapytanie na dokument przy operacjach masowych, nic nie domykając —
   ścieżki masowe idą surowym SQL-em, niewidocznym dla obu kształtów.
4. **Reguła ról jest parametrem fabryki, bez wartości domyślnej.** `unlessInvestmentLocked` miała
   zaszyte `isAdminOrOwnerOrManager`; wpięcie jej na `kosztoryses.delete` po cichu dałoby MANAGEROWI
   prawo kasowania arkuszy. **Decyzja właściciela: `delete` zostaje przy ADMIN/OWNER.** Brak
   wartości domyślnej wymusza, by każda z pięciu kolekcji wypowiedziała swoją rolę wprost.

## Wykonane

- `src/access/investment-lock.ts` — obie fabryki biorą regułę ról jako pierwszy argument.
- Cztery istniejące kolekcje kosztorysu przepisane na nową sygnaturę (bez zmiany zachowania).
- `src/collections/sheets.ts` — `create` / `update` bramkowane rolą MANAGER-ową, `delete` przez
  `isAdminOrOwner`.
- `src/__tests__/access/investment-lock.test.ts` — spec pilnujący, że fabryka zawęża regułą, którą
  dostała.
- `src/__tests__/collections/sheets-investment-lock.db.test.ts` — spec na bazie: zakończona odmawia,
  aktywna przepuszcza, **arkusz bez inwestycji przepuszcza**; plus obie strony bramki `delete`.
  Zweryfikowany kontrolnie: bez bramki padają dokładnie dwa jego przypadki.
