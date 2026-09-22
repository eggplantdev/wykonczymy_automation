# Znacznik „rzut", dwa profile kompresji i wysyłka klient→Blob — brief planu

> Pełny plan: `context/changes/2026-09-22-kategorie-assetow-i-kompresja/plan.md`
> Research: `context/changes/2026-09-22-kategorie-assetow-i-kompresja/research.md`

## Co i po co

Do inwestycji ma zostać podpięte AI, które przeczyta rzut i wstępnie wypełni kosztorys. Dziś nie da
się tego zrobić z dwóch powodów: nie wiadomo, który plik jest rzutem, a każdy plik jest duszony
kompresją tak ostro, że opisy wymiarów znikają. Trzeci powód wyszedł w trakcie — większy plik
w ogóle nie wchodzi, bo funkcja Vercela odbija ciało żądania powyżej 4,5 MB.

## Punkt wyjścia

Jedna rura dla wszystkich powierzchni medialnych: `InvoiceUploadDialog` → `useMediaUpload` →
`processUploadFile` (kompresja `1920×1080` / `q 0.6`, bramka 4 MB) → `POST /api/upload-file` →
`payload.create`. Kolumna `media.kind` z enumem istnieje od EX-802, ale aplikacja jej nie zapisuje.

## Stan docelowy

Pole wyboru „To jest rzut / projekt" przy dodawaniu plików do inwestycji. Zaznaczone → łagodna
kompresja **i** `kind = 'projekt'`. Niezaznaczone → dzisiejsza kompresja i `kind` nietknięty. Bajty
idą z przeglądarki prosto do Bloba, więc ściana 4,5 MB znika. Istniejący plik da się oznaczyć po
fakcie w galerii.

## Podjęte decyzje

| Decyzja            | Wybór                                                  | Dlaczego                                                                                  |
| ------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Model kategorii    | Znacznik, nie klasyfikacja — tylko `projekt`           | Istotne jest wyłącznie to, co AI ma czytać; `NULL` znaczy „nie do analizy"                |
| Powierzchnie       | Tylko inwestycyjne pytają; fakturowe nic nie ustawiają | Relacja `transactions.invoice` już mówi, czym plik jest — znacznik by ją powtórzył        |
| UI                 | Jedno pole wyboru na partię                            | Obie powierzchnie inwestycyjne montują ten sam `InvoiceUploadDialog`                      |
| Kompresja          | Dwa profile; łagodny tylko dla oznaczonych rzutów      | Znacznik pada przed wysłaniem, więc obie decyzje zapadają w tym samym miejscu             |
| Transport          | `clientUploads: true`, wszystkie powierzchnie naraz    | Limit 4,5 MB potwierdzony w dokumentacji; jedna brama, jedno zachowanie                   |
| Oznaczanie później | Tak, w galerii asetów                                  | Promocja leada nie ma dialogu wgrywania, a przynosi nieskompresowane oryginały z landingu |
| Stare pliki        | Nie rusza ich nic                                      | Rozstrzygnięcie stałe właściciela — nowy ficzer, nie sprzątanie historii                  |

## Fazy

| Faza                       | Co dowozi                        | Główne ryzyko                                                   |
| -------------------------- | -------------------------------- | --------------------------------------------------------------- |
| 1. Transport klient→Blob   | Plik >4,5 MB w ogóle wchodzi     | Autoryzacja zmienia egzekutora na `media.access.create` — cicho |
| 2. Dwa profile kompresji   | Rzut czytelny                    | `defaultDeps` to stała modułowa — profil nie ma którędy wejść   |
| 3. Znacznik przy wgrywaniu | AI dostaje po czym filtrować     | Wyciek pola wyboru na powierzchnie fakturowe                    |
| 4. Oznaczanie po fakcie    | Rzuty z promocji leada osiągalne | Poluzowanie `media.access.update` zmienia uprawnienia           |
| 5. Domknięcie              | `lessons.md`, `manual-checks.md` | —                                                               |

**Rozmiar:** większy niż zakładaliśmy na starcie — transport dokłada trzecią nogę i dotyka faktur.

## Otwarte ryzyka

- Miniatura (`upload.imageSizes.thumbnail`) powstaje serwerowo z bufora, którego serwer po zmianie
  nie zobaczy. Żaden kod aplikacji jej nie czyta — w najgorszym razie kosmetyka w `/admin`.
- `beforeChange` sanityzujące nazwę pliku czyta `req.file?.name`, które przy client upload może być
  puste.
- Lokalny dev musi dalej wgrywać do **preview** store, nie do produkcyjnego.

## Kryteria sukcesu

- Rzut A4 wchodzi w rozdzielczości, w której da się odczytać opisy wymiarów.
- Plik >4,5 MB nie odbija się błędem.
- Zaznaczone „to jest rzut" → `kind = 'projekt'`; niezaznaczone → `NULL`.
- Faktura transferu zachowuje się dokładnie jak przed zmianą.
