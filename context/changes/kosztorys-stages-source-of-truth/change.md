---
change_id: kosztorys-stages-source-of-truth
title: „Pomiar z natury" liczony z sumy etapów; „Pozostało" zakotwiczone w Przedmiarze
status: planned
created: 2026-07-15
updated: 2026-07-16
archived_at: null
branch: null
worktree: null
---

## Notes

> ## ✅ ODBLOKOWANE 2026-07-16 — [EX-494](https://linear.app/ex-plant/issue/EX-494) rozstrzygnięte
>
> Pytanie z 15 lipca („pomiar czy suma etapów?") było **źle postawione**. Rozstrzygnął je świeży
> arkusz właściciela, nie dyskusja. `plan.md` **nie idzie do kosza, ale traci kotwicę** — patrz
> „Co się zmienia w planie" na dole.
>
> Otwarte świadomie: **[EX-495](https://linear.app/ex-plant/issue/EX-495)** — „Pozostało" jako kwota
> z minusem czy sam procent. Nie blokuje; to decyzja czysto prezentacyjna.

### Model właściciela — dwa wejścia, nie trzy

Źródło: arkusz `1kEWaMv9KRRXVaSMu3AJRw_ptxucnF4oafLR74VWeRHg`, zakładka `kosztorys_robocizny`
(„Kopia aktualny arkusz 16 lipca 2026 - wersja w jakiej klient dostaje to wstępnie"). Odczyt
i screenshoty: patrz `AGENTS.md` → „The Owner's Reference Sheet".

**„Pomiar z natury" nie jest wpisywany — jest formułą.** Zweryfikowane na **435 z 435** wierszy
pozycyjnych, nie na próbce:

```
O5 = =SUM(D5:M5)        # D:M = „1 etap ilość" … „10 etap ilość"
```

| kolumna                             | skąd               | znaczenie                               |
| ----------------------------------- | ------------------ | --------------------------------------- |
| **Przedmiar** `N`                   | wpisywany ręcznie  | oferta → `S = Przedmiar × cena − rabat` |
| **etapy** `D:M`                     | wpisywane ręcznie  | faktycznie wykonana praca               |
| **Pomiar z natury** `O`             | **`=SUM(D:M)`**    | pochodna — nie wejście                  |
| „Wartość netto pomiar z natury" `T` | `O × cena − rabat` | ile wykonano                            |

**Pomiar JEST sumą etapów.** Nie mogą ze sobą konkurować — to jedna liczba, nie dwie. Stopka trzyma
**oba totale naraz**: `S456` (przedmiar) i `T456` (wykonano); na screenshocie oferty `S456` = 34 117 zł,
`T456` = 0 zł, bo nic jeszcze nie zrobiono.

Nasza aplikacja ma **trzy niezależne pola tam, gdzie arkusz ma dwa** — „Pomiar z natury" jest u nas
wpisywany ręcznie. To jest cała rozbieżność. Pierwotne zdanie właściciela („suma etapów jest źródłem
prawdy") było **poprawne od początku**.

### Decyzje właściciela (2026-07-16)

| #   | decyzja                                                                                                            | stan                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1   | **„Pomiar z natury" przestaje być wpisywany** — liczony z sumy etapów; kolumna w siatce zostaje jako **read-only** | ustalone                                                                          |
| 2   | **„Wartość netto przedmiar" ma obejmować rabat** (dziś nie obejmuje) — z **wyraźnym tooltipem**                    | ustalone, ale właściciel zostawia „mały znak zapytania, może się jeszcze zmienić" |
| 3   | **Czerwień wiersza** → „suma etapów przekroczyła Przedmiar"                                                        | ustalone                                                                          |
| 4   | **„Pozostało do rozliczenia"** = `Przedmiar − suma etapów`; minus zostaje **na razie**                             | **ON HOLD** → EX-495                                                              |

Punkt 2 na liczbach: przy rabacie 10% na pozycji za 1000 zł arkusz pokazuje **900 zł**, my **1000 zł**
(`Przedmiar × cena`, bez rabatu). W tym arkuszu **każdy rabat = 0%**, więc żadna wyświetlona liczba
tego nie rozstrzyga — rozstrzyga formuła `S5 = =N5*Q5-(Q5*R5)*N5`.

### Skamielina `AF` — czego NIE importować

Skoro `O = SUM(D:M)`, to `AF = T − SUM(V:AE)` wychodzi **tożsamościowo zero** — z algebry, nie z danych:

```
SUM(V:AE) = Σ (etapᵢ × Q − etapᵢ × Q × R)
          = Q × Σetapᵢ − Q × R × Σetapᵢ
          = Q × O − Q × R × O                 ← bo O JEST Σetapᵢ
          = T
```

Kolumna „pozostało do rozliczenia" w arkuszu jest **martwa** — pozostałość po czasach, gdy `O` było
wpisywane ręcznie i mogło rozjechać się z etapami. Zera na screenshocie tego **nie dowodzą** (tam
wszystko jest zerem, bo nic nie zrobiono); dowodzi formuła.

To jest **dokładnie ta degeneracja**, którą 15 lipca przewidziałem dla naszego „Pozostało" (`x − x = 0`)
i z której wyciągnąłem zły wniosek — uznałem, że skoro degeneracja, to model jest zły. Właściciel po
prostu ten koszt poniósł. My go nie ponosimy: kotwica idzie na **Przedmiar** i kolumna ożywa.

### Błąd w arkuszu — dowód rzeczowy na kruchość

Audyt wszystkich 435 wierszy × 10 kolumn wartości etapów. Jedna komórka czyta nie tę kolumnę:

```
Z8 = =G8*$Q8-(G8*$Q8*$R8)     ← „5 etap", ma czytać H8, czyta G8
Y8 = =G8*$Q8-(G8*$Q8*$R8)     ← „4 etap", poprawnie G8
```

Efekt: w wierszu 8 **4 etap liczony dwa razy, 5 etap wcale**, a `AF8` przestaje być zerem i pokazuje
fałszywy „bilans" wzięty z literówki. Niewykrywalne wzrokiem, cicho przekłamuje pieniądze. To jest
uzasadnienie całego portu (właściciel: _„arkusz jest kruchy"_) — u nas suma etapów to pętla, nie 4 350
ręcznie sklejonych formuł, więc tej klasy błędu **nie da się popełnić**.

### Co się zmienia w planie

`plan.md` powstał 15 lipca pod fałszywym modelem („Pozostało" na pomiarze). Zostaje w mocy jego
szkielet — prymityw w warstwie cenowej, ilość podawana z zewnątrz, granica warstw z EX-489 — ale:

| założenie `plan.md`                                    | po EX-494                                         |
| ------------------------------------------------------ | ------------------------------------------------- |
| „Pozostało" kotwiczy w **pomiarze**                    | kotwiczy w **Przedmiarze**                        |
| licznik „Wykonano" dzieli przez pomiar (`measuredNet`) | dzieli przez **total Przedmiaru**                 |
| podsumy niosą jeden total + `measuredNet`              | niosą **dwa totale**, jak `S456`/`T456` w arkuszu |
| „Pomiar z natury" zostaje polem wpisywanym             | staje się **read-only, liczony z etapów**         |
| czerwień = „pomiar nieaktualny"                        | czerwień = **„etapy przekroczyły Przedmiar"**     |
| „Wartość netto przedmiar" poza zakresem                | **wchodzi w zakres** — dochodzi rabat + tooltip   |

Otwarte pytanie implementacyjne, **nie rozstrzygnięte przez właściciela**: skoro „Pomiar z natury"
jest zawsze sumą etapów, to kolumna `measuredQty` w bazie jest redundantna. Zostawić i liczyć, czy
skasować migracją? Właściciel odpowiadał o **kolumnie w siatce** (read-only), nie o schemacie.

### Meta-lekcja — do nie powtórzenia

Wziąłem jedno zdanie właściciela za ustaloną regułę i zbudowałem na nim frame-skip + 3-fazowy plan,
ani razu nie sprawdzając **na danych**, co ono znaczy. Gdy właściciel się wycofał, uznałem, że
przesłanka upadła — a ona była prawdziwa; upadło moje **założenie doklejone do niej** (że wartość
kontraktu = pomiar). Rozstrzygnął dopiero arkusz: jedna formuła `=SUM(D:M)`, której nikt nie przeczytał
przez dwa dni dyskusji.

Ten sam błąd trzy razy w tej samej sesji: `RABAT` wzięty za przemyślany model (jest zatyczką na bilans),
„Pozostało" założone jako idące za nową regułą (właściciel nigdy tego nie powiedział), i przesłanka
„totals". Wzorzec: **zastany albo wypowiedziany kształt brany za przemyślany, bez konfrontacji
z danymi.** Arkusz był dostępny przez cały czas — wystarczyło go przeczytać.

Zapis w pamięci: `feedback_verify_premise_on_common_case`.

### Archiwum — czytania A/B (nieaktualne, zachowane dla kontekstu)

15 lipca postawiłem pytanie „czy `total` na pracach w toku to kwota kontraktu (A) czy kwota zarobiona
(B)?" i policzyłem, że pod A Altowa 12 spadnie klientowi z 302 349,51 zł na ~151 000 zł. **To było
fałszywe** — 302 349 to `S` (przedmiar), zostaje bez ruchu; `T` (wykonano) rośnie od zera. Oba totale
istnieją równolegle, więc dylemat A/B nie istniał. Pełny wywód: EX-494 (opis + komentarz zamykający).

### Nie mylić z roadmap 12(b)

`roadmap.md:547` („suma etapu" / „ile zapłacić za etap") to **nowa kolumna-figura**; ta zmiana odwraca
źródło prawdy pod figurami istniejącymi. 12(b) zostaje otwarte.
