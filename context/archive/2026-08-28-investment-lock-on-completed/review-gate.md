# Review-gate ledger — 2026-08-28-investment-lock-on-completed (EX-748) · 2026-09-03

Scope: commits `2f3bbfdb`, `39eaea4b`, `28fc91f7`, `9e8542d8`, `678e7192`, `cdee7a10` on `staging`
(52 files). `3d080307` (worker-payouts-on-employee-card) is interleaved in the range but belongs to
another agent — excluded.

Step 0.5 (verification pass) skipped: no `verify-manual-checks` skill installed, and the browser is
not driven unprompted. Manual verification is tracked in `context/foundation/manual-checks.md`
§ EX-748.

Fan-out: `/10x-impl-review`, `/code-review`, `tailwind-v4-audit`, `feature-first-structure`,
`module-cohesion-audit`, `structure-scatter-audit`, `comment-noise-audit` — all seven applied.

## Findings

_Przycięte przy archiwizacji (2026-09-03)._ Tally przed przycięciem: **40 findingów — 27 fixed,
7 dropped, 3 skipped, 2 filed, 1 dismissed · 0 otwartych.** Findingi `fixed` usunięte: trwałym
zapisem naprawy jest commit `fb49d439` i sam kod. Zostaje negatywna przestrzeń, której git nie
trzyma — co świadomie odpuszczono, co uznano za nieszkodliwe i co odłożono.

- [x] skipped · `module-cohesion` · `src/hooks/transfers/validate.ts:64` · Bramka blokady wspawana w walidator kształtu pól: hook zrobił się `async`, wciągnął zależność od `lib/db` i ma teraz dwa powody do zmiany. Wydzielenie do osobnego `beforeValidate` jest słuszne, ale to refaktor wart własnego review — a w tym samym pliku ląduje właśnie poprawka krytyczna.
- [x] dropped · `code-review` · `src/lib/actions/investment-action.ts:35` · TOCTOU: status czytany poza transakcją handlera. Aplikacja ma pięciu użytkowników i dwie zakładki naraz to scenariusz teoretyczny — koszt przeniesienia checku do transakcji przewyższa ryzyko.
- [x] dropped · `tailwind` · `src/components/tables/transfers.tsx:51` · Inline `style={{ color: 'var(--color-…)' }}` zamiast literalnej mapy klas. Zastane, poza tematem slice'a, działa.
- [x] dropped · `tailwind` · `eslint.config.mjs` · Brak wtyczki ESLint świadomej Tailwinda — luka narzędziowa całego repo, nie tego slice'a.
- [x] filed · `10x-e2e` · E2E slice'a nierozliczone: brak specu w `e2e/`. Zgłoszone jako **EX-769** (label `e2e-backlog`, projekt Wykonczymy) — scenariusz spina trzy bramki w jedno przejście, czego żaden spec jednostkowy nie robi.
- [x] filed · `simplify`/`altitude` · `src/collections/sheets.ts:30` · Bramka `/admin` objęła cztery kolekcje kosztorysu, ale nie piątą — `kosztoryses`. MANAGER przepnie albo wyczyści `investment` na wierszu arkusza zakończonej inwestycji. Nie naprawione tutaj: FK `investment` jest nullable, więc gotowe `not_equals: 'completed'` odsiałoby również każdy arkusz **bez** inwestycji. Zgłoszone jako **EX-770**.
- [x] skipped · `altitude` · `src/access/investment-lock.ts` · Cztery kolekcje kosztorysu bronią się regułą `access` zwracającą `Where`, więc panel mówi „nie znaleziono" zamiast `INVESTMENT_LOCKED_MESSAGE`. Przepisanie na `beforeChange`/`beforeDelete` dałoby jeden idiom — refaktor wart własnego review, dopisany jako kierunek do **EX-770**.
- [x] skipped · `altitude` · `src/components/kosztorys/editor/toolbar/menus/` · Kontrolki zapisu chowane dwoma konkurencyjnymi idiomami (znikające wpisy vs `disabled`). Ujednolicenie to zmiana UI poza zakresem zamka.
- [x] dismissed · `efficiency` · `src/lib/actions/transfers.ts` · Propozycja skasowania `isTargetInvestmentLocked` i trzech pre-checków jako duplikatu bramki hooka. Pre-check istnieje po to, by odmowa wróciła jako czyste `ActionResult`, a nie jako błąd przepakowany przez `withPayloadTransaction` — intencja stoi w komentarzu obok.
- [x] dropped · `reuse-scan` · trzy formularze filtrujące inwestycje po `isBookableInvestment` · Wspólny selektor `bookableInvestments` oszczędziłby jedną linię na konsumenta.
- [x] dropped · `simplify` · `src/components/kosztorys/editor/kosztorys-editor-body.tsx:330` · `locked` vs `editor.readOnly` w jednym pliku — różnią się o `preview`, więc scalenie zmieniłoby publiczną stronę.
- [x] dropped · `efficiency` · `src/lib/actions/investment-action.ts` · Wciągnięcie predykatu zamka do samego `UPDATE`. Znosi TOCTOU, ale rozlewa bramkę po każdym handlerze zapisu.
- [x] dropped · `efficiency` · `src/access/investment-lock.ts` · Memoizacja odpowiedzi o zamku na `req.context` dla bulk-create. Płaci się przy imporcie, którego zablokowana inwestycja z definicji nie robi.

## Simplify pass

`/simplify` — 8 applied, 2 skipped, 1 dismissed, 4 dropped, 1 filed (EX-770); każdy finding wpięty w `## Findings` (tag `simplify` / `reuse-scan` / `efficiency` / `altitude`). Bez osobnego pliku raportu — ledger jest jedynym zapisem.

## Tests & suite

- `pnpm typecheck` — zielony.
- `pnpm lint` — 4 błędy i 86 ostrzeżeń, wszystkie zastane i poza slice'em (`app/(legal)/*` używa `<a>` zamiast `<Link>`, `test.js` w korzeniu). Żaden plik slice'a nie zgłasza nic.
- `pnpm test` — 3249 passed / 240 skipped, 0 failed. Pierwszy przebieg wywalił dwa specy (oba wpisane wyżej jako findingi `suite`); po poprawkach zielono.
- `pnpm build` — zielony.
- `pnpm test:e2e` — nieuruchamiane; E2E slice'a rozliczone jako **EX-769**.
