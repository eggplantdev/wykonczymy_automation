# Zdjęcia i pliki w edytorze kosztorysu v2 — brief planu

> Pełny plan: `context/changes/2026-09-22-kosztorys-editor-assets/plan.md`
> Research: `context/changes/2026-09-22-kosztorys-editor-assets/research.md`

## Co i po co

Pracując w edytorze kosztorysu v2 nie da się ani zobaczyć, ani dorzucić zdjęcia inwestycji — trzeba
wrócić na kartę inwestycji. Galeria ma być dostępna z toolbara edytora: podgląd, dodawanie
i usuwanie, **identycznie** jak z karty, bo to ma być jeden i ten sam komponent.

## Punkt wyjścia

`InvestmentAssets` to sekcja z nagłówkiem, jednym przyciskiem i trzema dialogami, które montuje sama
— czyli kompozyt już przenośny. Żyje dziś na karcie inwestycji i jako pole w dialogu „Edytuj
inwestycję". Odczyt `fetchInvestmentAssets` jest cache'owany, a trasa `kosztorys_v2` ma już
sześciozapytaniowy fan-out. W drzewie roboczym siedzi niezacommitowane odwrócenie pustego stanu
(zero plików → przycisk „Dodaj pliki" zamiast niczego) — warunek konieczny tej funkcji.

## Stan docelowy

W prawej grupie toolbara edytora stoi ta sama kontrolka co na karcie: „Zdjęcia i pliki (N)" albo
„Dodaj pliki". Otwiera ten sam podgląd, z tymi samymi akcjami i tą samą blokadą na czas zapisu.
W warsztacie szablonów kontrolki nie ma; w podglądzie klienta nie ma całego toolbara.

## Podjęte decyzje

| Decyzja | Wybór | Dlaczego | Źródło |
|---|---|---|---|
| Miejsce | Prawa grupa toolbara edytora | Menu odpada — `DropdownMenuContent` odmontowuje dzieci, więc nie utrzyma dialogów galerii | Research |
| Współdzielenie | Wydzielić `InvestmentAssetsControl`, chrom `<section>`/`<h2>` zostaje na karcie | Jedna implementacja, zero rozjazdu nazewnictwa i zachowania | Plan (rozmowa) |
| Dane | Siódme zapytanie w istniejącym `Promise.all` | Odczyt jest cache'owany i nie może dostać `'use server'` (wołają go komponenty serwerowe) | Research |
| Bramka | `{assets && …}` u wołającego, nie `return null` w kontrolce | Kontrolka jest współdzielona z kartą, gdzie `assets` jest wymagane — osłabienie kontraktu byłoby regresją tamtej powierzchni | Plan |
| EX-832 | Zostaje w backlogu, dostaje dopisek o trzecim pisarzu | Wyścig realny, ale cichy i mało prawdopodobny przy pięciu użytkownikach | Rozmowa |
| Kontekst edytora | Nietknięty — prop idzie wprost do toolbara | Zakaz z AGENTS.md (regresja perf EX-496) | AGENTS.md |

## Zakres

**W zakresie:** wydzielenie kontrolki; `assets?` w `KosztorysEditorDataT`; siódme zapytanie w trasie;
prop do toolbara; render z bramką; spec DOM na bramce; przepisanie `manual-checks.md:493`; komentarz
do EX-832.

**Poza zakresem:** serializacja `setUploadField` po stronie serwera (EX-832); `router.refresh()`
w `useMediaUpload` (dotyczy wszystkich powierzchni medialnych); cache dla `getKosztorysTree`;
miniatury i jakakolwiek odmiana galerii; E2E.

## Podejście

```
kosztorys_v2/page.tsx ──(7. zapytanie: fetchInvestmentAssets)──► KosztorysEditorV2
                                                                      │ assets?
                                                                      ▼
                                         KosztorysEditorBody ──► KosztorysEditorToolbar
                                                                      │ {assets && …}
                                                                      ▼
                                        InvestmentAssetsControl ◄── InvestmentAssets (karta)
```

## Fazy

| Faza | Co dowozi | Główne ryzyko |
|---|---|---|
| 1. Wydzielenie kontrolki | `InvestmentAssetsControl` używany przez kartę | Zgubienie spinnera uploadu, który dziś wisi w nagłówku sekcji |
| 2. Podpięcie do edytora | Galeria w toolbarze + bramka + spec | Montaż toolbara w jsdom wymaga providera kontekstu, którego nikt jeszcze nie budował |
| 3. Domknięcie dokumentacji | `manual-checks.md`, komentarz do EX-832 | Linear MCP może być nieosiągalny — wtedy mówimy to wprost |

**Warunek wstępny:** niezacommitowane odwrócenie pustego stanu w drzewie roboczym musi zostać.
**Rozmiar:** jedna sesja, trzy fazy.

## Otwarte ryzyka i założenia

- Gwarancja „share nie dostaje `assets`" jest po stronie danych, nie typu — przyszły payload
  podglądu mógłby ją złamać. Toolbar i tak nie renderuje się pod `preview`, więc to druga linia
  obrony, nie jedyna.
- Prawa grupa toolbara jest ciasna (6 kontrolek) i zawija się na tablecie. Zatłoczenie przyjęte
  świadomie.
- Trzecia powierzchnia pisząca zaostrza EX-832; skutek w najgorszym razie to osierocony plik
  w Blobie, nie utrata danych widocznych dla użytkownika.

## Kryteria sukcesu

- Z edytora widać, dodaje się i usuwa pliki dokładnie tak jak z karty inwestycji — bo to ten sam
  komponent.
- Warsztat szablonów i podgląd klienta nie pokazują galerii.
- Licznik i lista są świeże po zapisie, a siatka edytora nie gubi stanu.
