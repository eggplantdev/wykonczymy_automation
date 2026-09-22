---
change_id: fullscreen-zoom-preview
title: Pełnoekranowy podgląd z zoomem w InvoicePreviewDialog
status: implemented
created: 2026-09-21
updated: 2026-09-21
archived_at: null
branch: null
worktree: null
---

## Notes

Pełnoekranowy podgląd z zoomem w `InvoicePreviewDialog` — **globalnie**, czyli dla wszystkich trzech
konsumentów naraz (faktury w transferach, galeria inwestycji, załączniki zgłoszeń). Nie osobna
warstwa nad dialogiem, tylko sam dialog (decyzja właściciela, 2026-09-21).

Powód: załączniki zgłoszeń to często **rzuty i plany** — trzeba je obejrzeć w powiększeniu, a dziś
nie ma jak.

Trzy rzeczy, które trzeba rozdzielić, bo tylko jedna z nich to „widżet zoomu":

1. **Źródło, nie widżet, jest blokadą.** Obrazek leci przez optymalizator Next z `quality={50}`
   i `sizes="(max-width: 767.98px) calc(100vw - 2rem), 848px"` — przeglądarka trzyma rendition
   ~848 px, mocno skompresowany. Zoom na tym powiększa artefakty; linie wymiarowe rzutu nie staną
   się czytelne od żadnego widżetu. Warstwa zoomu musi celować w **oryginał** z Bloba.
2. **PDF-y już mają zoom i nie wezmą w tym udziału.** Gałąź `isPdf` to `<iframe>` z natywną
   przeglądarką PDF (zoom, dopasuj do szerokości, nawigacja stron z pudełka). Zoom dotyczy więc
   wyłącznie `isImage`; dla PDF-a wygraną jest samo powiększenie okna.
   **Założenie do potwierdzenia:** pełnoekranowa ramka wystarczy, nie renderujemy PDF-ów u siebie
   (pdf.js to zupełnie inna skala roboty).
3. **Pełny ekran jest osobną, najtańszą wygraną.** `DialogContent` ma `sm:max-w-4xl`, czyli sufit
   896 px — na 1440-tce rzut dostaje ~60% mniej pikseli, niż mógłby. Pomaga też PDF-om.

**Swiper odrzucony (2026-09-21).** Moduł `Zoom` by działał, ale Swiper przynosi własny slider, a ten
dialog trzyma indeks strony sam (`pageIndex`, pager 1/5, chevrony) i na tym indeksie wiszą wydruk,
zip i „Usuń plik". Wejście Swipera przenosi indeks do niego i przepina wszystkie te akcje na jego
stan — przepisanie dialogu pod funkcję, która dotyka jednego `<Image>`. Do pinch/wheel/pan wystarczy
wrapper na samym obrazku, który o paginacji nic nie wie.

## Decisions

- **2026-09-21 — 90 jest globalną jakością, nie propem jednego okna.** Zdjęcia są już skompresowane
  **na wejściu, w obu apkach**, więc `quality={50}` w podglądzie to druga stratna kompresja na czymś,
  co stratność ma za sobą. Zamiast podnieść prop w jednym oknie: `qualities: [90]` w `next.config.ts`
  i **żadnego** propa `quality` w kodzie.
  - **Dlaczego jednoelementowa lista, a nie „default".** Next nie ma pokrętła na domyślną jakość —
    75 jest zaszyte. Jedynym mechanizmem jest allowlista: wartość spoza niej **nie jest błędem,
    tylko jest dociągana do najbliższej dozwolonej**. Przy jednym wpisie każde żądanie — łącznie
    z niepodanym 75 — ląduje na 90. To jest sposób, w jaki Next pozwala ustawić default.
  - **Pułapka na przyszłość:** dopisanie drugiej wartości do listy po cichu kończy tę gwarancję.
    Dlatego uzasadnienie stoi komentarzem przy samej liście, a nie tylko tutaj.

- **2026-09-21 — `sizes` zmienia się razem z kontenerem, nie osobno.** Dziś
  `sizes="(max-width: 767.98px) calc(100vw - 2rem), 848px"` jest **poprawne** dla obecnego layoutu
  (`sm:max-w-4xl` = 896 px minus padding). Samo podniesienie jakości nie da rzutowi ani jednego
  piksela więcej — źródło nadal ma 848 px szerokości. `sizes` idzie więc w tej samej edycji co
  zdjęcie sufitu `max-w-4xl`, bo inaczej albo przepłacamy transferem, albo skalujemy w górę mydło.

- **2026-09-21 — zoom opakowuje obrazek, nie okno.** `react-zoom-pan-pinch` wchodzi jako wrapper na
  samym `<Image>`. `pageIndex` zostaje własnością okna, więc wydruk, zip i „Usuń plik" nie są
  przepinane na cudzy stan. To jest ta sama linia argumentu, która odrzuciła Swipera — tylko
  rozstrzygnięta po stronie „co wchodzi", a nie „co odpada".

- **2026-09-21 — pełny ekran jest problemem desktopowym.** Poniżej `sm` (768 px) `DialogContent` jest
  już płachtą `h-dvh w-full max-w-none`, więc zmiana dotyczy wyłącznie `sm:` w górę i musi pokonać
  bazę okna (`top-1/2 h-fit max-h-[90vh] -translate-y-1/2 rounded-lg`) — samo `sm:max-w-none` nie
  wystarczy.

- **2026-09-21 — dwie warstwy źródła, przełączane pierwszym powiększeniem.** Przy skali 1 leci
  zoptymalizowany rendition; po pierwszym zoomie komponent ustawia `unoptimized`, co sięga po oryginał
  z Bloba. Powód: żaden widżet nie zrobi czytelnych linii wymiarowych z renditionu 848 px, a ładowanie
  oryginału od razu obciążałoby każde otwarcie okna za coś, z czego prawie nikt nie skorzysta.
  **Pułapka:** prop `unoptimized` przychodzący z góry (lokalny `blob:` URL pliku jeszcze
  niewysłanego) musi nadal wygrywać.

- **2026-09-21 — reset do 1× przy zmianie strony, przez `key`.** Następny plik ma inne wymiary, więc
  zachowana skala otwierałaby go wykadrowanego w losowym miejscu. Realizacja: `key={active.url}` na
  komponencie zoomu — remount kasuje skalę, przesunięcie i flagę „już powiększono" jednym
  mechanizmem, zamiast trzema efektami.

- **2026-09-21 — przyciski `+` / `−` / „Dopasuj", widoczne zawsze.** Same gesty są niewykrywalne —
  nikt nie wie, że okno to potrafi, dopóki przypadkiem nie kręci kółkiem. „Dopasuj" jest przy tym
  jedynym wyjściem z zagubienia w kadrze.

- **2026-09-21 — kompresja na wejściu poza zakresem.** `compress-image.ts` (`q = 0.6`, pudełko
  `1920×1080`) zostaje nietknięty: `MAX_UPLOAD_BYTES = 4 MB` opiera się o limit ciała requestu
  Vercela, który trzeba najpierw zweryfikować na żywo, a ta zmiana dowozi wartość tam, gdzie
  oryginały są całe (załączniki zgłoszeń).

- **2026-09-21 — spec DOM, bez długu E2E.** Reset skali, podmiana źródła i brak zoomu na PDF-ie to
  logika stanu i jsdom łapie je w sekundy. Gest pinch i klamrowanie panningu zostają niesprawdzone
  świadomie — to ryzyko wizualne, weryfikowalne ręcznie w kilka sekund, a przebieg E2E kosztuje
  ~godzinę.

## Findings

- **2026-09-21 — załączniki zgłoszeń NIE przechodzą przez naszą kompresję, faktury i galeria
  inwestycji tak.** Dwie różne drogi do tej samej kolekcji `media`:
  - `processUploadFile` → `compressImage` (`lib/utils/compress-image.ts`) — **q = 0.6 ORAZ
    `maxWidth: 1920` / `maxHeight: 1080`**. To dotyczy faktur i plików dodawanych z apki.
  - `fetchLandingAsset` (`lib/leads/fetch-landing-asset.ts`) — strumień z Bloba landingu prosto do
    `payload.create`, bez kompresji i bez skalowania, sufit 8 MB. To dotyczy załączników zgłoszeń.
- **Konsekwencja, która decyduje o tym, czy zoom ma sens.** Dla plików wgrywanych **z apki** rzut
  jest nie do uratowania żadnym zoomem: skala 1920×1080 to pudełko, więc portretowy skan A4
  (2480×3508) ląduje na dysku jako **763×1080** — i to bezpowrotnie, przed wysyłką. Dla załączników
  **ze zgłoszenia** oryginał jest cały (tyle, ile zostawił z niego landing), więc to właśnie tam
  zoom coś daje — i tam `quality={50}` @ 848 px było jedyną realną stratą.
