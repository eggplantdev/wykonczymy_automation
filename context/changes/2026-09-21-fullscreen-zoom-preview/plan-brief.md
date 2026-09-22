# Pełnoekranowy podgląd z zoomem — skrót planu

> Pełny plan: `context/changes/2026-09-21-fullscreen-zoom-preview/plan.md`

## Co i po co

`InvoicePreviewDialog` dostaje pełny ekran i zoom na obrazku — jako własność okna, więc naraz dla
faktur, galerii inwestycji i załączników zgłoszeń. Powód: załączniki zgłoszeń to często rzuty i plany,
których dziś nie da się obejrzeć w powiększeniu.

## Punkt wyjścia

Okno ma sufit 896 px (`sm:max-w-4xl`) i rendition 848 px. Poniżej 768 px `DialogContent` jest już
płachtą na cały ekran, więc pełny ekran jest problemem wyłącznie desktopowym. PDF-y idą przez
`<iframe>` z natywną przeglądarką i zoom mają z pudełka. `pageIndex` jest własnością okna i wiszą na
nim wydruk, zip i kasowanie.

## Stan docelowy

Okno na cały ekran. Obrazek: kółko, pinch, dwuklik, przyciski `+` / `−` / „Dopasuj". Pierwsze
powiększenie podmienia źródło na oryginał z Bloba. Chevron na następny plik otwiera go w 1×. PDF
zyskuje pełny ekran i nic poza tym.

## Podjęte decyzje

| Decyzja                   | Wybór                                        | Dlaczego                                                                            |
| ------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Mechanizm                 | `react-zoom-pan-pinch` na samym `<Image>`    | Nie dotyka `pageIndex`; Swiper przejąłby indeks i przepiąłby wydruk, zip, kasowanie |
| Kontener                  | Pełny ekran od `sm` w górę                   | Sufit 896 px oddaje ~60% pikseli monitora; pomaga też PDF-om                        |
| Źródło                    | Dwie warstwy — rendition, oryginał po zoomie | Zoom na renditionie 848 px powiększa artefakty, nie linie wymiarowe                 |
| PDF                       | Pełnoekranowa ramka, natywny zoom            | pdf.js to zupełnie inna skala roboty za zerowy przyrost                             |
| Reset przy zmianie strony | Do 1×                                        | Następny plik ma inne wymiary — zachowana skala otwiera go wykadrowanego losowo     |
| Sterowanie                | `+` / `−` / „Dopasuj", widoczne zawsze       | Same gesty są niewykrywalne; „Dopasuj" to jedyne wyjście z zagubienia w kadrze      |
| Jakość                    | `qualities: [90]` globalnie, bez propa       | Zdjęcia są kompresowane na wejściu w obu apkach; `quality={50}` to druga stratność  |
| Kompresja wejściowa       | Poza zakresem                                | `MAX_UPLOAD_BYTES` opiera się o limit ciała requestu Vercela — najpierw weryfikacja |
| Testy                     | Spec DOM, bez długu E2E                      | Ryzyko jest wizualne; przebieg E2E kosztuje ~godzinę                                |

## Zakres

**W zakresie:** kontener na pełny ekran + `sizes`, komponent zoomu z przyciskami, reset przez `key`,
podmiana na oryginał po pierwszym powiększeniu, spec DOM.

**Poza zakresem:** `compress-image.ts` (q = 0.6, pudełko 1920×1080), pdf.js, zmiany w paginacji, gest
przesuwania między stronami, E2E.

## Fazy

| Faza           | Co dowozi                                     | Główne ryzyko                                      |
| -------------- | --------------------------------------------- | -------------------------------------------------- |
| 1. Pełny ekran | Okno na cały ekran, `sizes` pod nowy kontener | Pas pustki pod obrazkiem przy `h-dvh`              |
| 2. Zoom        | Widżet, przyciski, reset przy zmianie strony  | `<Image fill>` w `TransformComponent` bez wymiarów |
| 3. Oryginał    | Podmiana źródła po pierwszym powiększeniu     | Zadeptanie `unoptimized` przychodzącego z góry     |
