---
change_id: kosz-inwestycji
title: Kosz inwestycji — odwracalne usuwanie inwestycji przez właściciela
status: implementing
created: 2026-09-24
updated: 2026-09-28
archived_at: null
branch: kosz-inwestycji
worktree: /Users/konradantonik/workspace/yolo/wykonczymy-worktrees/kosz-inwestycji
---

## Notes

Dziś inwestycji nie da się usunąć z aplikacji — tylko z nieużywanego `/admin`, i to twardo:
kaskada kasuje kosztorys, wersje, link dla inwestora i przypięcia zdjęć bez żadnego ostrzeżenia.
Jedyna bramka to „brak żywych transakcji" (`preventDeleteWithTransactions`).

## Decyzje z rozmowy (2026-09-24)

- **Tylko właściciel i administrator.** Manager nie usuwa ani nie przywraca.
- **Stan pośredni: kosz z przywracaniem.** „Usuń" z listingu przenosi do kosza; „Przywróć" oddaje
  inwestycję w stanie sprzed usunięcia; „Usuń na zawsze" dopiero kasuje.
- **Transakcje blokują zawsze.** Inwestycji z żywą (nieanulowaną) transakcją nie da się ani wrzucić
  do kosza, ani skasować.
- **Warsztat szablonów nigdy.**
- **Automatyczne opróżnianie po 30 dniach — ale nie kasuje kosztorysu.** Inwestycja z kosztorysem
  (pozycje albo wersje) zostaje w koszu, dopóki właściciel nie skasuje jej ręcznie, wpisując nazwę
  inwestycji; okno nazywa, co ginie: kosztorys (pozycje + wersje jako jedna linia), zdjęcia, link
  dla inwestora.
- **„Ma kosztorys" (2026-09-28) = kosztorys był realnie użyty: choć jedna praca ma Przedmiar albo
  Pomiar z natury ≠ 0** (pomiar to suma etapów). Nie liczą się: same pozycje (szablon wsadza ~310 pustych przy tworzeniu inwestycji),
  same wersje (powstają automatycznie), ręczna cena ani rabat bez ilości. Inwestycja z samym szablonem
  opróżnia się po 30 dniach jak pusta. Lokalnie (dump 23.09): z sześciu kandydatów tylko 155 wypada
  z ochrony.
- **Wpisywanie nazwy tylko przy realnie użytym kosztorysie (2026-09-28).** Bez niego „Usuń na zawsze"
  to zwykłe potwierdzenie — taka inwestycja i tak zniknęłaby sama po 30 dniach.
- **Pliki zostają (2026-09-28).** „Usuń na zawsze" i opróżnianie nie kasują zdjęć/rzutów z Bloba —
  zostają jako sieroty, które posprząta `kosz-plikow` (z własnym 7-dniowym oknem). Ten change nie
  robi nic nieodwracalnego z plikami.
- **Kosz to wspólna strona `/kosz` (2026-09-28)** — na razie z jedną sekcją „Inwestycje"; kolejne
  rodzaje (kasy, pracownicy…) dojdą później jako osobne sekcje, każdy z własnym mechanizmem (kolumna,
  ukrycie, blokady, kaskady) w osobnym change. Tu bez ogólnej abstrakcji „rodzaju w koszu".
  Wejście: pozycja „Kosz" w menu bocznym (na końcu, pod „Pracownicy"), widoczna tylko dla
  właściciela i admina — nowa, trzecia grupa linków obok „wszyscy" / „zarządzający". Wiersz: nazwa, data usunięcia, „usunie się samo za N dni" albo
  „kosztorys w użyciu — tylko ręcznie", akcje Przywróć / Usuń na zawsze. Lista inwestycji zostaje
  nietknięta.
- **Wersje w koszu przerzedzają się normalnie (2026-09-28)** — `gcSnapshots` bez zmian. Kosztorys
  (pozycje, ilości) jest nietknięty przez cały pobyt w koszu; ginie tylko starsza historia wersji,
  tak jak u żywej inwestycji. Wersje nie wchodzą do kryterium „realnie użyty", więc przerzedzanie nie
  zmienia, czy inwestycja opróżni się sama.
- **Okno „Usuń na zawsze" nie wymienia arkusza Google ani zgłoszenia (2026-09-28).** Kaskada
  i tak je odpina (arkusz zostaje bez inwestycji, lead wraca do promocji) — właściciel świadomie
  tego nie potrzebuje w oknie.
- **W koszu:** link `/k/<token>` przestaje działać (wraca po przywróceniu), kosztorys tylko do
  odczytu, inwestycja znika z listingu, pickerów i sum.
