# Bramki review z 22.09.2026 — praca bez folderu zmiany

Dwa przebiegi `slice-review-gate` puszczone na brudnym drzewie `staging`, zanim praca dostała własny
`context/changes/…`. Leżały w `.review-gate/`, czyli **poza gitem** (`.gitignore`) — a to jedyne
miejsce, gdzie te znaleziska były zapisane. Przeniesione tu 2026-09-23 przez bramkę obejmującą cały
zakres 22–23.09.

- `staging-2026-09-22.md` — całe drzewo, 95 plików: rename `lib/invoices` → `lib/media`, wspólny stub
  `cache-revalidate`, odświeżony golden master, EX-850.
- `staging-2026-09-22-kosztorys-grid.md` — siatka kosztorysu: kolumna „Sekcja", `price` we wszystkich
  widokach, lista kolumn warsztatu.

Oba mają komplet boksów odhaczonych — nic tu nie jest otwarte.
