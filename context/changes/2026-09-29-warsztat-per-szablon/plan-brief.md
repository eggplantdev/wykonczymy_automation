# Plan Brief: Szablon jest inwestycją

**Change**: `warsztat-per-szablon` · **Plan**: `plan.md` · **Research**: `research.md` (Follow-up F1–F8)

## Co i dlaczego

Szablon przestaje być wierszem jsonb (`kosztorys_presets`) edytowanym na jednym wspólnym warsztacie
(#151) przełączanym wskaźnikiem. Każdy szablon to inwestycja `status = 'szablon'`, a jej drzewo
kosztorysu jest treścią szablonu.

Ta zmiana zamyka całą rodzinę błędów o jednym źródle: numer warsztatu zmieniał znaczenie w czasie.
Należą do niej EX-893, eksmisja, strażnik wskaźnika w lustrze i ekran „Otwórz" dla starej karty.

## Kluczowe decyzje

| Decyzja                                 | Wybór                                                                                                   | Źródło      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------- |
| Model                                   | Szablon = inwestycja `szablon`; jsonb i lustro znikają                                                  | change.md   |
| „Przełącz na inny szablon…" w szablonie | Wraca jako „Wczytaj szablon…", zastępuje treść z punktem ochronnym                                      | change.md   |
| Migracja danych                         | Wszystkie 5 szablonów zakładane od nowa z jsonb; #151 zostaje do migracji B (szablon-duch akceptowany)  | change.md   |
| 59 nieprzypisanych „Przed wczytaniem"   | Kasowane w migracji A                                                                                   | change.md   |
| Unikalność nazw                         | `lower(trim(name))`, indeks częściowy `WHERE status='szablon'`                                          | change.md   |
| Tag cache                               | `presets` zostaje pod tą nazwą                                                                          | change.md   |
| Przypisane punkty przywracania (72)     | Przepięte `investment_id` na nowy szablon                                                               | Research F6 |
| Czytanie treści                         | `serializeKosztorysAsPreset` — odcina przedmiar, rabat, etapy i postęp przy odczycie                    | Research F3 |
| Sortowanie „Zmieniono"                  | Nowa kolumna `content_edited_at`, surowy SQL; `updated_at` (token remountu) nietknięte                  | Research F4 |
| Bramka                                  | `templatePresetId` → `isTemplate`; ogon podbija `content_edited_at` i wygasza `presets` po odpowiedzi   | Research F5 |
| Blokada statusu                         | `szablon` znika z formularza; hook `beforeChange` odrzuca update do i ze statusu `szablon`              | Plan        |
| Nadpisanie szablonu                     | Po id (nie po nazwie), bez siebie samego, przez `replaceTreeWithSnapshot` z punktem „Przed nadpisaniem" | Plan        |
| Usunięcie szablonu                      | Własna akcja owner-only, `payload.delete` z kaskadą, bez kosza                                          | Plan        |
| „Dodaj sekcje z szablonu"               | Wybór po żywym id sekcji; serwer weryfikuje, że właściciel jest szablonem                               | Plan        |
| Podział migracji                        | A addytywna (przed pushem kodu), B destrukcyjna (po wdrożeniu), osobny commit                           | Plan        |
| Pomocnik testów                         | `acquireTestWorkshop` → `createTestTemplate` (spec zakłada i sprząta własny szablon)                    | Research F8 |

## Fazy

1. **Migracja A + golden master.** 5 inwestycji-szablonów z jsonb, przepięcie punktów, skasowanie 59,
   zdjęcie indeksu singletonu, unikalność nazw, `content_edited_at`. Golden master zwalnia każdy
   `szablon`.
2. **Warstwa danych, czytelnicy, bramka.** `db/presets.ts` na inwestycjach; zasiew, „Wczytaj",
   „Dodaj sekcje" przez serializację; `isTemplate`; blokada statusu; `HELD_PRESET` out.
3. **Cykl życia i dialogi.** `createTemplate`, zapis jako nowy / nadpisanie po id, zmiana nazwy,
   usunięcie, „Wczytaj szablon…" w szablonie, kopia dialogów i kosza.
4. **Strona i edytor.** `/szablony/[id]` jako zwykły render; skasowanie „Otwórz", lustra, dopchnięcia,
   `provision-workshop`; pole `templatePresetId` znika z kolekcji.
5. **Migracja B + E2E spec + docs.** Kasuje #151, FK, kolumny `template_preset_id` i tabelę;
   spec E2E poprawiony (nieuruchamiany); domain-notes, lessons, manual-checks, test-plan.

## Ryzyka i pułapki

- **Kolejność wdrożenia:**
  - A na Neonie przed pushem kodu, B dopiero po wdrożeniu. B w repo wcześniej = 42703 w każdym
    `payload.find` na inwestycjach starego kodu.
  - Między A a wdrożeniem nie edytujemy szablonów, bo zapisy starego kodu trafiają do jsonb.
- **Token remountu:** każde podbicie przez Payload `updated_at` szablonu resetowałoby sortowanie
  i filtry w edytorze. `content_edited_at` i zmiana nazwy idą surowym SQL.
- **EX-597:** tag `presets` wygasa po odpowiedzi, nie w trakcie akcji.
- **`serializeKosztorysAsPreset` woła `requireAuth`:** tylko w akcjach, nigdy w `unstable_cache`.
- **Cudza migracja w drzewie:** `20260929_0` i hunk w `migrations/index.ts` należą do innego agenta.
  Commit po ścieżkach; jeśli hunk wciąż wisi, zapytać.
- **Migracja A nie importuje kodu aplikacji** (`server-only`, historyczna stabilność). Kolumny pozycji
  i wartości domyślne są przepisane literalnie.

## Weryfikacja

- Per faza: celowane `pnpm exec vitest run …` (listy w `plan.md`), migracje na 5433 z weryfikacją
  liczników SQL, `pnpm test:parity` po A i po B.
- Whole-tree gate raz na końcu: typecheck, lint, `pnpm test`, `pnpm test:integration`, `pnpm build`.
- E2E nie jest uruchamiane bez polecenia.

## Linear

- EX-893: zastąpione przez tę zmianę.
- EX-845: rozwiązane przez skasowanie `provision-workshop.ts`.
- EX-847: bezprzedmiotowe.
- Flip na In Progress przy starcie implementacji.
