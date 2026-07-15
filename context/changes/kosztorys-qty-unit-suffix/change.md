---
change-id: kosztorys-qty-unit-suffix
status: parked
created: 2026-07-15
updated: 2026-07-15
---

# Sufiks jednostki w komórce Pomiar (prototyp)

> **Zaparkowane 2026-07-15.** Prototyp był zaimplementowany i przechodził typecheck + lint, ale
> nigdy nie został obejrzany na żywo — sufiks wycofano z kolumny Pomiar, zanim zdążył zarobić na
> siebie wizualnie. Kod cofnięty; kolumna to znów `keyCol('measuredQty', floatColumnLeft, …)`.
> Dokument zostaje dla **mechaniki**, nie dla decyzji produktowej — patrz „Mechanika do reużycia"
> niżej i `plan.md` (Key Discoveries). Wzorzec przyda się wszędzie tam, gdzie komórka dsg musi
> czytać więcej niż jedno pole wiersza.

## Mechanika do reużycia

- `keyColumn` **zawęża `rowData` do jednego pola** — to jego optymalizacja re-renderu i zarazem
  powód, dla którego komórka pod nim nie widzi reszty wiersza. Komórka międzypolowa musi być
  złożona ręcznie.
- Ręczne złożenie: reużyj `floatColumn.component` z podstawionym `rowData` / `setRowData` /
  `columnData` zamiast przepisywać parsowanie liczb (przecinek dziesiętny, formatowanie, focus).
- Odtwórz **wszystkie cztery** funkcje kontraktu, które `keyColumn` daje za darmo: `copyValue`,
  `pasteValue`, `deleteValue`, `isCellEmpty`. Pominięcie któregokolwiek nie wywali typechecka —
  po cichu zepsuje kopiowanie albo Delete.
- `.dsg-cell` jest już flexem, a `.dsg-input` ma `flex:1; min-width:0` — sibling `<span>` nie
  potrzebuje żadnego wrappera.
- `floatColumn` zwraca `null` dla wyczyszczonej komórki, choć `KosztorysItemT.measuredQty` jest
  non-null; `keyCol` chowa to za mostkiem `any`. Normalizacja do `0` wyrenderuje dosłowne „0"
  w komórce, którą użytkownik właśnie wyczyścił.

Kolumna **Pomiar** (`measuredQty`) w edytorze kosztorysu renderuje gołą liczbę, a jednostka
miary siedzi w osobnej kolumnie **J.m.** kilka kolumn dalej. Ten change dokłada do komórki
Pomiar nieedytowalny sufiks z jednostką (`11,0  m²`), żeby wiersz dało się przeczytać bez
skakania wzrokiem w bok.

Prototyp na **jednej** kolumnie — świadomie. Rozlanie wzorca na `plannedQty`, kolumny etapów
i `discountValue` (`10 %` / `250 zł`) to osobna decyzja, podjęta po obejrzeniu tego na żywo.

- Design: `design.md`
- Plan: `plan.md` · Brief: `plan-brief.md`
