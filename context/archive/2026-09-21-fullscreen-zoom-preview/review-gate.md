# Review-gate ledger — fullscreen-zoom-preview · 2026-09-21

Slice commits: `549bac78`, `6f6bdd5c`, `5e96e8ca` (branch `catalogue-compare-bulk-update`, adopted — see plan.md).
Slice files: `src/components/dialogs/zoomable-preview-image.tsx`, `src/components/dialogs/invoice-preview-dialog.tsx`,
`src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx`, `next.config.ts`, `package.json`.

Step 0.5 (verification pass): pierwotnie pominięty (brak skilla, zakaz ruszania przeglądarki MCP bez
prośby). **Dobity 2026-09-21 na staging** (`e5ae5ee5`) — Playwright sterowany bezpośrednio z
persistentnego profilu Chrome, który nosi cookie Vercel SSO; MCP był martwy. Wszystkie 13 checków
w `context/foundation/manual-checks.md` odhaczone, z wynikami pomiarów przy każdym.

## Findings

<!-- ONE checkbox per finding. Format: [box] · [severity, bug-finding checks only] · disposition · `source` · `file:line` · what — reason -->

**Przycięte przy archiwizacji (2026-09-22).** Wszystkie findingi `fixed` usunięte — trwałym zapisem
naprawy jest jej commit, a nie wiersz w ledgerze; co przeżywa, to negatywna przestrzeń, której git nie
utrzyma: co świadomie **odrzucono**, **porzucono** albo **odłożono**, i dlaczego. Stan sprzed
przycięcia: **16 fixed, 3 dismissed, 2 dropped, 3 skipped · 0 otwartych.**

### Poza slice'em — praca równoległej sesji (osierocona, domknięta w `7e59f68e`)

Obie równoległe sesje (`wykonczymy-3e`, `wykonczymy-db`) odpisały „nie moje" na zapytanie o własność,
a pliki były zimne od 45 minut — dopiero wtedy je tknąłem. Obie powiadomione po commicie.

_Cztery findingi tej sekcji (3× 🔴 CRITICAL w potoku uploadu + przeniesienie specek do mirrora) były
wszystkie `fixed`; zapis żyje w `7e59f68e`._

### Slice fullscreen-zoom-preview

- [x] 🟡 WARNING · dismissed · `impl-review` · `src/components/dialogs/invoice-preview-dialog.tsx:142` · rzekoma regresja: usunięcie `h-[70vh]` miało zmniejszyć kadr na telefonie. Nieprawda — div jest `flex-1 min-h-0` w `h-dvh flex-col`, a `flex-1` to `flex: 1 1 0%`, więc `height` był martwy także przed slice'em.
- [x] dismissed · `primitive-reuse` · `ui/loader/loader.tsx:14` · `Loader` to `fixed inset-0` na cały viewport z domyślną emoji 🚧, nie overlay w kontenerze — nie ta rola.
- [x] dropped · `primitive-reuse` · `media/media-strip.tsx:43` · `OVERLAY_BUTTON` to przepis na pojedynczy przycisk (`size-7 rounded-full`), nie kontener paska.
- [x] skipped · `simplify`(altitude) · `src/components/dialogs/invoice-preview-dialog.tsx:137` · pięć `sm:` nadpisań walczy z bazowym `DialogContent`; „właściwa" naprawa to wariant `fullscreen` w prymitywie. Jeden konsument — wariant byłby przedwczesny. Drugi konsument pełnego ekranu = moment na promocję.
- [x] skipped · `impl-review` · `next.config.ts` · `qualities: [90]` to zmiana globalna (przesuwa `media-strip` i `brand-logo` z efektywnego 80 na 90), bez kroku w Progress. To **udokumentowana decyzja właściciela** (tabela w `change.md`), więc nie cofam po cichu — dopisane do `plan.md` (addenda) + 2 manualne checki.
- [x] dropped · `code-review` · `next.config.ts` · po deployu zakładki otwarte sprzed niego dostaną HTTP 400 na `/_next/image` (serwerowy `validateParams` jest ścisły). Przejściowe, samo mija po odświeżeniu — zapisane w addendach planu, nie naprawiam.
- [x] skipped · `impl-review` · `zoomable-preview-image.tsx` · ścieżka gestów (kółko, pinch, dwuklik) nie ma testu automatycznego. Decyzja właściciela z 2026-09-21: **bez długu E2E** — ryzyko jest wizualne, przebieg E2E kosztuje ~godzinę. Pokryte manualnie.

### Weryfikacja na staging (2026-09-21)

- [x] dismissed · `verify` · `media-strip` + topbar · miniatury i logo po `qualities: [90]` —
      zero 4xx na `/zgloszenia`, logo `w=64|96&q=90` → 200/304. Obawa z audytu nie zmaterializowała się.

## Simplify pass

Uruchomione w głównym wątku, bez 4 agentów — diff to 4 pliki, które przeszły już przez 9 audytów
fan-outu; rozstawianie kolejnej czwórki byłoby ceremonią nieproporcjonalną do rozmiaru zmiany.
2 poprawki naniesione, 1 pominięta; skan prymitywów dorzucił 4 kolejne naprawy (wariant `fullscreen` w `DialogContent`). Wszystkie złożone
do `## Findings` z tagiem `simplify`. Pliki równoległej sesji były wyłączone ze skanu; domknięte osobno dopiero po tym, jak obie sesje
odpisały „nie moje" (patrz nagłówek pierwszej sekcji `## Findings`).

## Tests & suite

- `pnpm exec vitest run --project dom src/__tests__/components/dialogs/invoice-preview-dialog.test.tsx` → **6/6 pass** (5 + regresja błędu pobrania oryginału)
- `pnpm exec tsc --noEmit` → **czysty** (3 błędy w specce dekoderów naprawione, patrz `## Findings`)
- `pnpm exec vitest run src/__tests__/lib/utils/ src/__tests__/components/leads/…` → **106/106 pass**
- Pełny pakiet (`lint` / `test` / `build`) — **nie uruchomiony**. Drzewo jest już czyste, więc nic
  tego nie blokuje; nie puszczałem bez proszenia, bo `build` i pełny `test` to kilka minut.
- E2E — **nie uruchomione i nie zaległe**: decyzja właściciela „bez długu E2E" (patrz `## Findings`).

## Status

**Gotowe do archiwizacji.** Ledger zamknięty — **0 otwartych boxów**, a wszystkie 13 manualnych
checków odhaczone na staging (`e5ae5ee5`). Jeden z nich się wywalił (pusty kadr przy pobieraniu
oryginału) — naprawiony w tym samym przebiegu, z testem regresji; poprawka jest jeszcze niewypchnięta.

Commity: `4477195e` (slice), `7e59f68e` (upload pipeline), `44c73f4e` (etykieta w leadach).
