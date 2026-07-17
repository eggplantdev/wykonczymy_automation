---
change_id: kosztorys-column-order-sheet-parity
title: Align kosztorys grid column order with the source sheet
status: new
created: 2026-07-15
updated: 2026-07-15
archived_at: null
branch: null
worktree: null
---

## Notes

przestawić kolejność kolumn w siatce kosztorysu tak, by odwzorowała arkusz: etapy (ilość) zaraz po Opisie prac, J.m. po Pomiarze, Netto przed Brutto/Pozostało

### Ustalenia z rozmowy (2026-07-15)

Arkusz (`context/reference/kosztorys-editor-domain-notes.md:40-44`):

```
A ordinal | B opis | C–H etapy (ILOŚĆ) | I Przedmiar | J Pomiar | K j.m.
L Cena | M rabat % | N Wartość netto | O komentarz | P–U etapy (WARTOŚĆ) | V pozostało
```

Kolejność obecna (`src/lib/tables/kosztorys-v2-columns.tsx:398-470`):

```
Akcje | Sekcja | Opis prac | J.m. | Przedmiar | Pomiar | [Cena] | Rabat | Rabat wart.
| etapy (ilość) | Netto | Brutto | Pozostało
```

Kolejność docelowa:

```
Akcje | Sekcja | Opis prac | etapy (ilość) | Przedmiar | Pomiar | J.m.
| [Źródło ceny] | Cena | Rabat | Rabat wart. | Netto | Brutto | Pozostało
```

Decyzje użytkownika:

- **Etapy zaraz po Opisie prac** — 1:1 z arkuszem. Rekomendacja agenta (zostawić etapy na końcu, bo przy 6 etapach Przedmiar/Pomiar wylatują w prawo, a to najczęściej wypełniane pola) została świadomie odrzucona.
- **Sekcja zostaje pierwszą kolumną** — w arkuszu kolumna A niesie nazwę sekcji na wierszu-nagłówku (`domain-notes.md:47`). Bez zmian.
- **Źródło ceny wykonawcy** renderuje się tylko w widokach podwykonawcy (`view !== 'client'`, `kosztorys-v2-columns.tsx:385-397`) — w widoku Klient go nie ma. Niedawno przemianowane z „Tryb liczenia ceny".

Nie mapuje się na arkusz (poza zakresem tej zmiany, do ewentualnego osobnego zadania):

| Kolumna                 | Status                                     |
| ----------------------- | ------------------------------------------ |
| `Akcje`                 | nasze, arkusz nie ma                       |
| `Brutto`                | nasze, arkusz nie ma per wiersz            |
| `Rabat` + `Rabat wart.` | u nas dwie kolumny, w arkuszu jedna (M, %) |
| `O komentarz`           | arkusz ma, my nie                          |
| `P–U etapy (wartość)`   | arkusz ma, my nie — mamy jedno `Netto`     |

### Uwagi techniczne

- Szerokości kolumn są przypięte per `col.id` w localStorage (`use-column-widths.ts`) — kolejność ich nie dotyka, ale warto sprawdzić po przestawieniu.
- Sortowanie/`widths` idą przez `withResize` (`:469`) po złożeniu tablicy — zmiana kolejności to przestawienie elementów w `left` / `stageCols` / `computed`, nie zmiana zachowania.
