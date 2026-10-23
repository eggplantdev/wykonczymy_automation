# v1 phase-out — analysis

Linear: EX-1126. Polish team-facing version: `analysis.html` (published as
https://claude.ai/artifact/XuUVCSsXiy1sci6ky1x5y6).

Goal: retire v1 (investment figures computed from transfers) in favour of v2 (figures read from the
in-app kosztorys). First step: hide the v1/v2 switch on `/inwestycje/[id]`.

Data: local DB restored from today's prod dump (2026-10-22), trashed investments excluded,
cancelled transfers excluded.

## What v1 is in the app

1. **Investment page** — the `?widok=v1` switch shows the transfer-based Bilans / Marża tiles. v2 is
   the default.
2. **Investments listing** — columns „Bilans netto v1", „Marża v1", „Robocizna v1", the v1/v2 column
   layer switch, and the rozjazd icon on „Robocizna v2" (compares against v1).
3. **Transfer dialog** — robocizna and rabat are still bookable as transfers (marked temporary).
4. **Calculations** — v1 bilans / marża functions exist only to feed 1 and 2.

Out of scope: the Google Sheets sync („Kosztorysy v1", EX-780).

## Where each investment's kosztorys lives

- **app** = has pozycje in the in-app kosztorys
- **sheet** = only a linked Google Sheet, no in-app pozycje
- **none** = neither

| Status    | Kosztorys in | Sheet linked | Count |
| --------- | ------------ | ------------ | ----- |
| active    | app          | no           | 16    |
| active    | app          | yes          | 19    |
| active    | sheet        | yes          | 3     |
| active    | none         | —            | 3     |
| completed | app          | no           | 3     |
| completed | app          | yes          | 19    |
| completed | sheet        | yes          | 22    |
| completed | none         | —            | 53    |
| planowana | app          | —            | 5     |
| planowana | none         | —            | 2     |
| quote     | app          | —            | 41    |
| quote     | none         | —            | 6     |
| rejected  | app          | —            | 4     |

## Active investments (41)

| Group                                                             | Count | Investments                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v2** — executed work entered in the app                         | 26    | e.g. Namysłowska, Gryka-Deszczyński Kopernika, Wesoła Kilińskiego, Południowa 30/31 — executed work entered as recently as today                                                                                       |
| **v1** — sheet only (or a 1-pozycja stub), robocizna as transfers | 4     | Dom Dziekanów Polski Czarodziejskie Góry, Okocimska 9, Sierakowskiego 3/81, 11 Listopada 40                                                                                                                            |
| **Unclear** — full app kosztorys, nothing executed yet            | 8     | Andrzej Wądołowski Żółkiewskiego, Jacek Gołoś Angorska, Magdalena Garbacik Tytoniowa, Marcin Tkaczuk Stanisławowska, Mateusz Ku Terespolska, Mateusz Polis Koprowskiego, Tomasz Woźniak Siedliska, Konrad Testy (test) |
| **No robocizna** — no kosztorys, no robocizna transfers           | 3     | Kijowska 17 dwa mieszkania materiały, Mieszkanie Bartek Chodakowska, telmak                                                                                                                                            |

- The 4 v1 investments look stale: newest robocizna transfer is 2026-08-06.
- The 8 unclear ones need the owner: work not started yet, or still tracked in the sheet?

## v2 investments that still carry robocizna transfers

24 transfers on 24 investments that have an in-app kosztorys. „Kosztorys since" = the oldest in-app
pozycja; 2026-08-27 is the bulk sheet → app import.

| Investment                           | Status    | Pozycje | Executed | Kosztorys since | Transfer date | Amount (zł) | Opis                                     | Booked by         | vs kosztorys |
| ------------------------------------ | --------- | ------- | -------- | --------------- | ------------- | ----------- | ---------------------------------------- | ----------------- | ------------ |
| 11 Listopada 40                      | active    | 1       | 0        | 2026-10-19      | 2026-03-18    | 471 819     | wszystkie etapy                          | Adrian Furmańczyk | before       |
| Al. Rzeczypospolitej 21/25           | completed | 373     | 0        | 2026-08-30      | 2026-03-18    | 41 782      | Wszystkie 3 etapy                        | Adrian Furmańczyk | before       |
| kiwi 8                               | completed | 302     | 63       | 2026-08-27      | 2026-03-18    | 65 921      | podsumowanie całości robocizna netto     | Adrian Furmańczyk | before       |
| Wołoska 3/302                        | completed | 309     | 99       | 2026-08-27      | 2026-03-18    | 95 004      | robocizna wszystkie etapy bez ostatniego | Bartek Antonik    | before       |
| Altowa 12                            | active    | 2       | 2        | 2026-10-02      | 2026-05-19    | 351 425     | robocizna netto                          | Bartek Antonik    | before       |
| Siennicka 50/152                     | completed | 293     | 65       | 2026-08-27      | 2026-06-05    | 80 251      | Wszystkie etapy                          | Adrian Furmańczyk | before       |
| Białostocka 5                        | completed | 5       | 5        | 2026-10-01      | 2026-06-18    | 149 255     | robocizna netto do 6 etapu               | Bartek Antonik    | before       |
| Włodarzewska 70j/8                   | completed | 300     | 18       | 2026-08-27      | 2026-06-18    | 3 786       | —                                        | Bartek Antonik    | before       |
| Potrzebna 55                         | completed | 1       | 1        | 2026-10-03      | 2026-07-08    | 32 070      | robocizna brutto                         | Bartek Antonik    | before       |
| Sulmierzycka 6/29 - poprawki         | completed | 380     | 19       | 2026-08-27      | 2026-07-13    | 14 493      | robocizna                                | Bartek Antonik    | before       |
| Kaloryczna 1/54                      | completed | 385     | 76       | 2026-09-30      | 2026-08-06    | 66 075      | etap 1 i 2                               | Adrian Furmańczyk | before       |
| Powsińska 70 + koński jar            | active    | 4       | 3        | 2026-10-01      | 2026-08-06    | 73 387      | —                                        | Adrian Furmańczyk | before       |
| Południowa 30/31 - kinga moszyńska   | active    | 386     | 93       | 2026-09-29      | 2026-08-06    | 80 206      | —                                        | Adrian Furmańczyk | before       |
| Przedpole 8a/28                      | active    | 5       | 1        | 2026-10-14      | 2026-08-06    | 93 374      | —                                        | Adrian Furmańczyk | before       |
| Rechniewskiego 13/68                 | completed | 1       | 1        | 2026-10-14      | 2026-08-06    | 39 303      | —                                        | Adrian Furmańczyk | before       |
| Ryżowa 44 Marcin Nurzyński           | completed | 301     | 49       | 2026-08-27      | 2026-08-06    | 61 305      | —                                        | Adrian Furmańczyk | before       |
| Siennicka 50/160 Iza Nowicka         | active    | 297     | 47       | 2026-09-30      | 2026-08-06    | 66 904      | —                                        | Adrian Furmańczyk | before       |
| Urocza 6a/1                          | completed | 330     | 110      | 2026-10-01      | 2026-09-11    | 136 184     | —                                        | Adrian Furmańczyk | before       |
| Ząbkowska Pan krokodyl - zastępcza   | completed | 1       | 1        | 2026-10-21      | 2026-09-23    | 984         | —                                        | Bartek Antonik    | before       |
| Sowińskiego 49b/ Daniel Sporysz      | active    | 380     | 51       | 2026-09-29      | 2026-09-24    | 67 330      | —                                        | Adrian Furmańczyk | before       |
| Ewa Biernat Bernardyńska 12/19       | completed | 377     | 37       | 2026-09-30      | 2026-10-01    | 26 887      | —                                        | Bartek Antonik    | **AFTER**    |
| Emilianów Zawadzka 37 / Urszula Duda | active    | 300     | 37       | 2026-09-28      | 2026-10-01    | 17 362      | —                                        | Bartek Antonik    | **AFTER**    |
| Bartosz Żelkowski Bernardyńska 12/13 | completed | 374     | 33       | 2026-10-09      | 2026-10-01    | 2 379       | —                                        | Bartek Antonik    | before       |
| Foksal 12/14                         | active    | 287     | 46       | 2026-09-29      | 2026-10-01    | 61 741      | —                                        | Bartek Antonik    | **AFTER**    |

### What it says

- **21 of 24 are legacy.** The transfer predates the in-app kosztorys — robocizna settled in the
  sheet era, the investment moved to the app later (mostly the 2026-08-27 import). Nobody booked them
  "into v2".
- **3 are real double entries:** Ewa Biernat Bernardyńska 12/19, Emilianów Zawadzka 37, Foksal 12/14 —
  all on **2026-10-01, all by Bartek Antonik**, in one batch with Bartosz Żelkowski (whose in-app
  kosztorys appeared a week later). Looks like a one-off end-of-September settlement, not a habit.
  Nothing has been booked since.
- **Eight investments carry a 1–5-pozycja kosztorys** (11 Listopada 40, Altowa 12, Białostocka 5,
  Potrzebna 55, Powsińska 70, Przedpole 8a/28, Rechniewskiego 13/68, Ząbkowska) — a lump-sum stub
  entered to move robocizna into v2, not a real kosztorys. 11 Listopada 40 has 0 executed, so on v2 it
  reads 0 zł robocizna against 471 819 zł on v1.
- v2 ignores robocizna transfers, so none of these move a v2 figure. They only feed v1 and the
  „Robocizna v1 / v2" rozjazd icon.

## Open questions for the owner

1. The 8 unclear active investments — not started, or still run in the sheet?
2. The 4 v1 active investments — finish them in the sheet, or enter a kosztorys?
3. The 3 double entries from 2026-10-01 — intended (e.g. a settlement marker) or a mistake to cancel?

## Plan sketch

1. Hide the v1/v2 switch on the investment page; `?widok=v1` keeps working by URL.
2. Close robocizna / rabat booking in the transfer dialog.
3. Decide the legacy investments (questions above).
4. Remove the v1 surfaces: page view, listing columns + layer switch, rozjazd icon, v1 calculations.
