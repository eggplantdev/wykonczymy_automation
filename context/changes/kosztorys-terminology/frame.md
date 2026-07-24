# Frame Brief: Kosztorys domain terminology cleanup (l5 „język" step / EX-548)

> Framing step before /10x-plan. Co jest _naprawdę_ na stole, oddzielone od tego, co założono.

## Reported Observation

Domain-name drift: jedno pojęcie biznesowe nosi w kodzie polski generyk re-typowany per subsystem, a
po stronie transferów ten sam koncept jest już po angielsku — kolizja na szwie recon (kosztorys ↔
`src/collections/transfers.ts` / `src/lib/db`). Inwentarz EX-548: 27 symboli driftu / ~32 pliki.
Właściciel: refaktor jest **urgent** — nie chce dokładać kodu, który trzeba będzie potem zmieniać.

## Initial Framing (preserved)

- **User's stated cause or approach**: wykonać rename Polish→English (EX-548), ale najpierw „ogarnąć
  terminologię"; zrobić to jako śledzony change z referencjami do lekcji l5 i wymuszonym researchem.
- **User's proposed direction**: change.md → sekwencja terminologia → niezmienniki → ACL; niezmienniki
  „porządnie w oparciu o kod nie z pamięci"; raport destylacji do regeneracji.
- **Pre-dispatch narrowing**: „na pewno zaczniemy od ogarnięcia terminologii" — terminologia jest
  pierwszym i jedynym zakresem tego slice'a; niezmienniki/agregat/ACL to osobne slice'y w dół łuku.

## Dimension Map

Gdzie „problem terminologii" faktycznie żyje — osie, które plan musi rozstrzygnąć:

1. **Kompletność inwentarza** — czy 27 symboli to całość, czy są nieskatalogowani kandydaci
   (`sumaPrac`, `pozaEtapem`, `combined`/`lacznie`)? ← częściowo poza obecnym framingiem
2. **Poprawność kategorii A/B** — czy `przedmiar`/`pomiar` naprawdę zostają Category A (proper noun),
   czy to drift? `etap`/`podsumowanie` już zdemotowane do B.
3. **Kolizje płaszczyzn (B2)** — recon-counterparts, które MUSZĄ zostać rozdzielone plane-suffiksem
   (`FromKosztorys`/`FromTransactions`); language-swap byłby dla nich BŁĘDNY.
4. **Nieaktualność modelu** — `01-domain-distillation.md` (2026-07-08) sprzed budowy v2; każdy framing
   oparty o niego jest wadliwy. ← korzeń, dlaczego research musi być z kodu, nie z pamięci

## Hypothesis Investigation

Kod-grounded weryfikacja jest **świadomie odłożona do wymuszonej fazy researchu** (bramka #1 właściciela)
— poniższe werdykty to stan z rozmowy + istniejących artefaktów, nie z fresh sub-agent readów.

| Hypothesis                                                  | Evidence                                                                                                           | Verdict                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1. Inwentarz niekompletny (kandydaci poza 7 rdzeniami)      | Runda 1 wywiadu wskazała `sumaPrac`/`pozaEtapem`/`combined`; nie zweryfikowane grepem/tsc                          | WEAK — do potwierdzenia w researchu                |
| 2. `przedmiar`/`pomiar` mylnie A                            | AGENTS.md/glossary trzymają je jako A; owner-decision otwarty; `pomiar` ma rozjazd nazwa-vs-znaczenie (O=SUM(D:M)) | WEAK — czeka na ruling właściciela                 |
| 3. B2 wymaga plane-suffiksu, nie language-swapu             | EX-548 tabela recon-counterparts + reguła plane-suffix w AGENTS.md                                                 | STRONG (z dokumentów) — do potwierdzenia na kodzie |
| 4. Model (`01-...`) nieaktualny → framing z pamięci wadliwy | Plik 2026-07-08 < build v2; KROK 3E „BRAK w kodzie" fałszywe (agregat istnieje)                                    | STRONG                                             |

## Narrowing Signals

- Właściciel: terminologia pierwsza, **na pewno** — rozstrzyga sekwencję (dimension 2/3 przed
  niezmiennikami, nie równolegle).
- Właściciel: niezmienniki „z kodu nie z pamięci" — potwierdza, że I1–I5 z rozmowy to hipotezy, nie
  ustalenia, i należą do osobnego slice'a.
- Właściciel: raport „i tak nieaktualny, trzeba wygenerować raz jeszcze" — potwierdza dimension 4 jako
  korzeń; regeneracja jest częścią researchu tego slice'a.

## Cross-System Convention

Rename domenowy w tym repo to ustalona praktyka: kanoniczny mapping żyje w `02-glossary.md`, guard
`local/no-domain-drift` czeka zakomentowany na re-enable (`TODO(EX-548)`), a AGENTS.md koduje 4 reguły
nazewnicze + wyjątek plane-suffix. Framing zgadza się z konwencją: rename type-aware + `tsc`-gated,
ast-grep tylko read/verify.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: ustawić ubiquitous language na **świeżej, kod-groundowanej**
> destylacji (nie na modelu z 2026-07-08 ani z pamięci), a potem wykonać **type-aware, `tsc`-gated**
> rename EX-548 — jako **pierwszy z czterech osobnych slice'ów** (terminologia → niezmienniki → agregat
> → ACL), nie zbundlowany z utwardzeniem niezmienników.

Początkowy framing (rename EX-548) trzyma — nie manufacturuję reframe'u. Frame doprecyzowuje dwie rzeczy,
które łatwo zgubić: (a) **sekwencję** (język przed niezmiennikami, każdy krok osobno — inaczej diff jest
nie-do-zreviewowania), i (b) **bramkę** (research z kodu + regeneracja `01-domain-distillation.md`, bo
stary model kłamie). Bez (b) plan zbudowałby rename na nieaktualnej mapie.

## Confidence

- **MEDIUM** — kierunek jest jasny i zgodny z konwencją, ale kod-groundowany research (wymuszona faza)
  jeszcze nie ruszył; kompletność inwentarza (dim 1) i ruling'i kategorii (dim 2: `przedmiar`/`pomiar`)
  wymagają weryfikacji na `plik:linia` **przed** planem egzekucji rename. Verification step przed
  /10x-plan: uruchomić m4l5-1 na kodzie, zregenerować destylację, potwierdzić inwentarz grepem+tsc.

## What Changes for /10x-plan

Plan dotyczy DWÓCH rzeczy w kolejności: (1) **wymuszona faza researchu** — m4l5-1 na kodzie, regeneracja
`01-domain-distillation.md`, potwierdzenie inwentarza + kategorii + kolizji B2 na `plik:linia`; potem
(2) **mechanika rename** — type-aware/`tsc`-gated, plane-suffix dla B2, re-enable guarda eslint jako DoD.
Plan **NIE** obejmuje niezmienników/agregatu/ACL — to osobne slice'y.

## References

- Source: Linear EX-548; `context/domain/02-glossary.md`; `context/domain/01-domain-distillation.md`
  (do regeneracji); `AGENTS.md` („Naming a financial figure", „The Owner's Reference Sheet");
  `eslint.config.mjs` (guard zakomentowany, `TODO(EX-548)`).
- Lekcje l5: `.claude/prompts/m4l5-{1,2,3}-*.md`; `~/workspace/10x_devs/lessons/m4/m4_l5*.md`.
- Related: `context/changes/kosztorys-terminology/change.md` (kręgosłup łuku).
- Investigation tasks: brak — kod-groundowany research świadomie odłożony do wymuszonej fazy /10x-plan.
