---
change_id: kosztorys-terminology
title: Domain terminology cleanup — l5 „język" step; execute EX-548 Polish→English identifier rename
status: preparing
created: 2026-07-20
updated: 2026-07-20
archived_at: null
branch: null
worktree: null
---

## Notes

Pierwszy slice większego łuku modernizacji domeny wg metody **l5** (DDD legacy modernization,
`m4_l5`): **terminologia → niezmienniki → agregat → ACL**. Każdy z czterech to osobny slice z własną
bramką review — nie jeden change. Ten change to **wyłącznie warstwa „język"**: ustawienie ubiquitous
language i egzekucja rename identyfikatorów Polish-generic → English (Linear **EX-548**), na styku
kosztorys ↔ transfery.

**Poza zakresem tego slice'a** (osobne changes w dół łuku, framing później): utwardzenie niezmienników

- agregat Kosztorys Item (compute-not-store wartość netto, niezmienność snapshotu ceny); anti-corruption
  layer.

### Dlaczego terminologia pierwsza (decyzja właściciela, 2026-07-20)

l5 mówi: **nazwy idą za modelem**, ale krok „język" (ustalenie ubiquitous language) **poprzedza** samą
egzekucję rename — i to od niego zaczynamy. „Ogarnięcie terminologii" = domknięcie wywiadu + świeża
destylacja, dopiero potem mechaniczny rename. Argument urgentności właściciela: _„nie chcemy dalej
dodawać kolejnych partii kodu, które będzie trzeba potem zmieniać"_ — każdy nowy plik kosztorysu
re-typuje drift, więc im później rename, tym więcej site'ów. Rename jest tani do zrobienia późno (`tsc`
łapie każdy site), ale nie chcemy, żeby dług rósł dalej.

### Bramki — nienegocjowalne (właściciel, 2026-07-20)

1. **Wymuszony research przed jakimkolwiek rename, oparty o KOD (`plik:linia`), nie o pamięć.** Rename
   ma być **type-aware** (IDE/tsserver albo ts-morph) i **`tsc`-gated**. **ast-grep zostaje narzędziem
   read/verify — nigdy driverem rewrite.** Niski wynik ast-grepa jest podejrzany do potwierdzenia
   grepem (`language: tsx` parsuje tylko `.tsx` — dla `.ts` trzeba `language: typescript`).
2. **Lekcje l5 jako required reading** przed dotknięciem refaktora: in-repo prompty
   `.claude/prompts/m4l5-1-domain-distillation.md`, `m4l5-2-invariant-aggregate-refactor.md`,
   `m4l5-3-anti-corruption-layer.md` (źródłowe lekcje: `~/workspace/10x_devs/lessons/m4/m4_l5*.md`,
   machine-local). Zastosować **m4l5-1** (domain distillation) na kodzie, nie tylko przeczytać.
3. **Zregenerować `context/domain/01-domain-distillation.md` od zera** w ramach researchu. Obecny plik
   jest datowany **2026-07-08**, sprzed budowy kosztorysu v2 (S-01…S-10 shipped), więc jego KROK 3E
   („Kosztorys item aggregate — **BRAK w kodzie**") i ranking KROK 5 (#1 = greenfield) są **nieaktualne
   / fałszywe** — agregat od tamtej pory istnieje w kodzie. **Nie łatać — zregenerować.**

### Stan wywiadu (Runda 1 — do przeniesienia do researchu, nie zgubić)

Trzy osie badania nazw:

- **Fałszywi kandydaci Category-A.** Po democie `etap`→`stage` i `podsumowanie`→`summary` (nie proper
  nouns) w Category A (Polish jako ubiquitous language) zostają tylko: `kosztorys` (slug `kosztoryses`),
  `przedmiar`, `pomiar`. Do potwierdzenia właściciela, czy `przedmiar`/`pomiar` naprawdę zostają A.
- **Kandydaci poza 7 rdzeniami** z inwentarza EX-548: `sumaPrac`, `pozaEtapem`, `combined`/`lacznie`
  („Łącznie" = Robocizna+Materiały, więc `combined`, **nie** `total`).
- **Rozjazdy nazwa-vs-znaczenie (l5 KROK 4).** Flagowany: **`pomiar`** — nazwa „Pomiar z natury"
  sugeruje pomiar w terenie, a kolumna `O` to formuła `=SUM(D:M)` = Σ etapów (AGENTS.md / EX-489,
  które dropnęło `measured_qty`). To rozjazd, który krok „niezmienniki" (osobny slice) rozstrzyga —
  tu tylko odnotowany jako sygnał, że nazwa może kłamać.

### Niezmienniki — DEFERRED do osobnego slice'a, robione z KODU

Hipotezy I1–I5 postawione w rozmowie (I1 `pomiar = Σetapów`; I2 „Pozostało" kotwiczy do Przedmiaru;
I3 baza rabatu globalnego = praca wykonana, override≠delete; I4 `worth = qty × cena − rabat`, dwa
totale jedno źródło; I5 snapshot ceny przy tworzeniu pozycji) to **hipotezy do spalenia na kodzie**,
nie ustalenia. Werdykt tylko z `plik:linia` (`use-kosztorys-editor.ts` + SQL kosztorysu). **Nie
zamykać ich w tym slice'ie** — należą do slice'a „niezmienniki".

**Pułapka do uszanowania (nie proponować jako zepsute niezmienniki):**

- **Ujemne saldo rejestru dozwolone** — świadoma decyzja klienta (git `76dd757`, EX-410 canceled),
  nie zgubiony guard.
- **kosztorys v2 celowo ROZŁĄCZONY od marży** (parked P5). Recon-seam robocizna-z-kosztorysu = Σ
  `LABOR_COST` jest dziś świadomym NIE-niezmiennikiem. Nie re-litygować linku.

### Anchory — linkować, nie duplikować

- **Linear EX-548** — pełny inwentarz driftu (27 symboli / ~32 pliki), framework kategorii A/B1/B2/gray,
  reguła plane-suffix (`FromKosztorys`/`FromTransactions`). Ma na górze „Required reading BEFORE
  planning the rename refactor" z l5 jako ⭐ PRIMARY.
- **`context/domain/02-glossary.md`** — kanoniczna mapa App↔Code, ruling'i właściciela: `bilans→balance`,
  `marza→margin`, `rabat→discount` (uppercase `RABAT` enum zostaje), `robocizna→laborCosts`,
  `etap→stage`, `podsumowanie→summary`, `lacznie→combined`, `zaliczki→deposit`/`stageDeposit`.
- **AGENTS.md** — „Naming a financial figure" (4 reguły + wyjątek plane-suffix) i „The Owner's Reference
  Sheet" (arkusz Google = domain authority; formuły przez `scripts/inspect-sheet.mjs`).

### Ograniczenia

- **Dane kosztorysu są throwaway do dogfoodingu na `main`** — żaden rename nie owe backfillu / shima.
- **Guard eslint `local/no-domain-drift` jest zakomentowany** z `TODO(EX-548)` w `eslint.config.mjs`
  (tablica `DOMAIN_DRIFT` + reguła + blok config) — re-enable to **czysty uncomment** po wylądowaniu
  rename'ów. To definition-of-done tego slice'a.
