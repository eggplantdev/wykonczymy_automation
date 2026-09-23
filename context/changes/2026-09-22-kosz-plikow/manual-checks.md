# Manual checks — kosz plików (do rejestru dopiero po implementacji)

Te boksy napisano z `plan.md`, **zanim powstał kod**. Wycięte z
`context/foundation/manual-checks.md` 2026-09-23: rejestr opisuje zachowanie działającej aplikacji,
a sprawdzenie funkcji, której nie ma na żadnym branchu, nie może ani przejść, ani paść — jest
fragmentem planu, nie wynikiem QA. Wracają do rejestru jako nowa sekcja w momencie, gdy
`/10x-implement` tego planu wyląduje w kodzie.

Stan w chwili wycięcia: `change.md` → `status: planned`, jedyny commit slice'a to
`cb2dda3f docs(kosz-plikow): research i plan…` (sam research+plan). Grep po repo nie znajduje
`detached_at` / `detachedAt` / `media_detachments` / „Kosz (”; `src/app/(payload)/api/cron/cleanup/route.ts`
woła dziś wyłącznie `gcSnapshots`.

Zamiatacz kasuje dopiero po siedmiu dniach, więc **pełnej pętli nie da się odhaczyć w jednym
przebiegu** — kroki 4–5 wymagają albo cofnięcia `detached_at` SQL-em na bazie testowej, albo powrotu
za tydzień. To nie jest blokada, tylko kształt sprawdzenia.

- [ ] Usunięcie pliku z galerii inwestycji pyta o potwierdzenie zdaniem o koszu i siedmiu dniach — nigdzie nie pada „bezpowrotnie"
- [ ] To samo zdanie w komórce faktury na transferach i przy plikach zgłoszenia
- [ ] Po usunięciu plik znika z galerii, a jego bajty **nadal otwierają się** spod URL-a z Bloba
- [ ] „Kosz (N)" pojawia się przy galerii dopiero, gdy coś w nim leży; przy pustym koszu nie ma przycisku
- [ ] „Przywróć" wraca plik do galerii, a licznik kosza spada o jeden
- [ ] Wgrywanie i przywracanie nie da się odpalić równocześnie (jedno rozbraja drugie)
- [ ] Po cofnięciu `detached_at` o osiem dni i ręcznym wywołaniu `/api/cron/cleanup` plik znika z `media` i z Bloba, a odpowiedź niesie rozbicie `{ recorded, healed, deleted, failed }`
- [ ] Drugi przebieg crona pod rząd kasuje zero i nie rusza ocalałych
- [ ] Skasowanie inwestycji z plikami: pliki trafiają do kosza z pustą prowenancją przy najbliższym przebiegu crona
- [ ] Skasowanie wydatku z fakturą kasuje fakturę **od razu** — bez kosza (świadomy wyjątek)
- [ ] Usunięcie pliku w panelu Payloada, gdy plik leży w koszu, przechodzi bez odmowy
