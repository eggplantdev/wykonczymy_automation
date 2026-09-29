---
change_id: worker-link-revoke
title: Worker link revocable when scope is blocked or the worker has no etapy (EX-888)
status: archived
created: 2026-09-29
updated: 2026-09-29
archived_at: 2026-09-29T06:46:20Z
branch: staging
worktree: null
---

## Notes

EX-888: link pracownika da się unieważnić przy zablokowanym zakresie i dla pracownika bez etapów.

- Zablokowany zakres: „Unieważnij link" dostępne zawsze; wyłączone tylko generowanie/kopiowanie.
- Pracownik z wydanym linkiem, ale bez etapów: pojawia się w menu „Pracownicy" (tylko z odwołaniem).
- Test: DOM spec menu „Pracownicy" — odwołanie dostępne w obu przypadkach.

Review record: context/archive/reviews/2026-09-29-staging.md (staging-wide gate, not a per-change reviews/impl-review\*.md).
