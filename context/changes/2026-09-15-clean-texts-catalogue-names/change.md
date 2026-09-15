---
change_id: clean-texts-catalogue-names
title: „Popraw literówki" przejmuje nazwy z tabeli poprawek katalogu prac
status: implementing
created: 2026-09-15
updated: 2026-09-15
archived_at: null
branch: clean-texts-catalogue-names
worktree: null
---

## Notes

Objaw: na `/szablony/4` okno „Porównaj z katalogiem prac" zgłasza **30 prac spoza katalogu**, gdzie
podpowiedź „może chodzi o…" różni się od nazwy w rozpisce kosmetycznie („Wyburzanie ścian 12-20cm"
vs „…12-20 cm", „Malowanie sufitu w kolor" vs „…w kolorze", „taśm ledowych" vs „taśm LED").

Przyczyna ustalona na danych (inw. 151 = warsztat szablonu 4, katalog 843 poz.):

- Nazwy w katalogu poprawił jednorazowy skrypt `src/scripts/fix-work-catalogue-texts.ts` wraz z
  `src/scripts/data/work-catalogue-fixes.tsv` (**938 ręcznie poprawionych par**, commit `61ae1aa5`).
- Skrypt z założenia pisał **tylko do `work_catalogue_items`** — rozpiski i szablony zostały
  nietknięte. Stąd asymetria.
- Poprawki **nigdy nie trafiły do reguł przycisku „Popraw literówki"**. Nagłówek skryptu mówi to
  wprost: „the corrections are data, not code". Żadna linia kodu nie łączy tabeli z
  `cleanItemTextsAction`.
- Oba pliki skasował `4de2666e` — commit z epilogiem **innej** zmiany (drag-drop-guard). Przegląd to
  odnotował (`context/archive/2026-09-14-drag-drop-guard/review-gate.md`, wpis „dropped").

Pomiar pokrycia 31 unikalnych braków szablonu 4 tabelą z historii:

|                                                                                         | ile |
| --------------------------------------------------------------------------------------- | --- |
| tabela trafia w nazwę **istniejącą dziś** w katalogu                                    | 24  |
| reguły literowe załatwiają j.m. (`klp` → `kpl`)                                         | 2   |
| tabela celuje w nazwę, której **już nie ma** (rozbita na warianty po przebiegu skryptu) | 5   |

Czyli **26 / 31 po jednym kliknięciu**.

Kształt rozwiązania (ustalony z właścicielem):

1. Tabela wraca jako **dane produktowe**, nie skrypt jednorazowy. 938 **unikalnych** kluczy, zero
   duplikatów → `Map` po całej nazwie, nie 938 przebiegów `split/join` (obecne reguły to podmianki
   **fragmentów** — inny kształt danych, stąd ostrożność typu ` parc` → ` prac`).
2. `cleanItemTextsAction` dostaje drugi krok: po regułach literowych podnieś nazwę z tabeli —
   **tylko jeśli ta nazwa dziś istnieje w katalogu**. To zabezpieczenie przed zamrożonym zdjęciem
   katalogu z 14.09; że to realne ryzyko, dowodzi tych 5 pozycji już rozbitych na warianty.
3. Opcjonalnie: wciągnąć tabelę też do klucza tożsamości (`foldDescription` → `catalogueKey`), żeby
   stary i nowy zapis keyowały się identycznie i okno przestało je zgłaszać **bez klikania**.
   Wymaga przeglądu kolizji (`UNIQUE` na `match_key`) — skasowany skrypt miał gotową obsługę, jest
   w historii.

Poza zakresem: te 5 wariantowych („Klejenie paneli winylowych" ma **remis 0.862 : 0.862** między
_jodełka_ a _mijanka_) — potrzebują decyzji człowieka, czyli osobnej akcji „przyjmij nazwę
z katalogu" w oknie porównania.

Stan przycisku: `86b40010` odkomentował go w menu, ale to siedzi **tylko na `staging`** — na
produkcji go nie ma (`origin/main` = `85ea3b88`). EX-778 („usunąć całkowicie tę ścieżkę") jest już
**Canceled**, więc nic nie koliduje — ścieżka zostaje i rośnie.
