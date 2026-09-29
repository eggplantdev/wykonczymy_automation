---
change_id: worker-link-revoke
title: Worker link revocable when scope is blocked or the worker has no etapy (EX-888)
status: implemented
created: 2026-09-29
updated: 2026-09-29
archived_at: null
branch: null
worktree: null
---

## Notes

EX-888: link pracownika da się unieważnić przy zablokowanym zakresie i dla pracownika bez etapów.

- Zablokowany zakres: „Unieważnij link" dostępne zawsze; wyłączone tylko generowanie/kopiowanie.
- Pracownik z wydanym linkiem, ale bez etapów: pojawia się w menu „Pracownicy" (tylko z odwołaniem).
- Test: DOM spec menu „Pracownicy" — odwołanie dostępne w obu przypadkach.
