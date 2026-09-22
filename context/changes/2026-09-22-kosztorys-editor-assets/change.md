---
change_id: kosztorys-editor-assets
title: Zdjęcia i pliki inwestycji dostępne z poziomu edytora kosztorysu v2
status: implementing
created: 2026-09-22
updated: 2026-09-22
archived_at: null
branch: kosztorys-editor-assets
worktree: null
---

## Notes

Galeria „Zdjęcia i pliki" żyje dziś tylko na karcie inwestycji
(`src/components/investments/investment-assets.tsx`, montowana przez serwerową sekcję w
`<Suspense>`) oraz jako pole w dialogu „Edytuj inwestycję". Pracując w edytorze kosztorysu v2
nie da się ani zobaczyć, ani dorzucić zdjęcia — trzeba wrócić na kartę inwestycji.

Oczekiwanie właściciela: **identycznie jak z karty inwestycji** — podgląd, dodawanie i usuwanie,
ten sam flow, nie okrojona wersja.

Research: `research.md`.

## Decyzje z rozmowy (2026-09-22)

- **Miejsce: prawa grupa toolbara edytora.** Zatłoczenie przyjęte świadomie — „jak będzie, to
  będziemy się martwić, gdzie to przesunąć".
- **EX-832 nie blokuje tej zmiany.** Wyścig `setUploadField` jest realny (dwie zakładki: karta
  inwestycji + edytor), skutek cichy — osierocony plik w Blobie. Przy pięciu użytkownikach
  prawdopodobieństwo niskie. Wystarczy dopisek do issue, że doszła trzecia powierzchnia pisząca.
- **`manual-checks.md:493` do przepisania.** Odhaczone zdanie „Inwestycja bez plików nie pokazuje
  w sekcji żadnego przycisku" jest już nieprawdziwe po odwróceniu pustego stanu. Nieprzepisane
  zaprasza kogoś do „naprawienia" świadomej zmiany z powrotem.
