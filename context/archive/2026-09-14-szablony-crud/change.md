---
change_id: szablony-crud
title: Podstrona /szablony — lista, otwieranie w warsztacie, edycja i usuwanie szablonów
status: archived
created: 2026-09-14
updated: 2026-09-14
archived_at: 2026-09-14T20:42:50Z
branch: szablony-crud
worktree: null
---

## Notes

podstrona /szablony: lista szablonów (kosztorys_presets) z otwieraniem w inwestycji-warsztacie, edycją i usuwaniem

## Decyzje właściciela (nie wynikają z kodu)

- **Źródło prawdy to `kosztorys_presets`.** Inwestycja jest wyłącznie warsztatem — nigdy drugim magazynem szablonów. Cała reszta konstrukcji (auto-provisioning po statusie, wskaźnik `template_preset_id`, zapis po id) obsługuje ten jeden ruling.
- **Asymetria uprawnień jest świadoma.** Zapis szablonu zostaje otwarty dla ról zarządczych, usunięcie i zmiana nazwy są owner-only — bo nadpisanie zostawia snapshot ochronny („Przed wczytaniem: …"), a usunięcie nie zostawia niczego.
- **Jeden warsztat na całą instalację.** Dwie osoby edytujące różne szablony w tej samej chwili nadpiszą sobie drzewo. Przy pięciu użytkownikach i ekranie używanym rzadko — akceptowalne; snapshot ochronny jest siatką bezpieczeństwa. Per-szablon warsztaty to osobna funkcja, nie poprawka bramki.
