# Accounts and access — accepted behaviour

Product decisions about user accounts that the code implements and an agent might otherwise "fix".
The enforceable rules (who may act on whom, which action owns a write) live in `AGENTS.md` → Auth And
Roles.

Full role inventory — every page, action and REST rule per role, plus the 37 open questions nobody has
ruled on yet: `roles-inventory.md` (read from `ca0c2aa34` on 2026-10-20 — verify against code before
quoting).

## Lockout

- A trashed or inactive account is refused at login, and trashing or deactivating it deletes
  its session rows (`src/lib/db/user-sessions.ts`). A demotion logs the account out on its next request.
- „Aktywny" answers to the same rules as the trash — switching it off locks an account out as surely.
- Demoting the last live OWNER/ADMIN through „Rola" is not refused — only deactivating, trashing and
  deleting are.
- A MANAGER may edit, switch „Aktywna", trash, restore and „Usuń na zawsze" only his own kasa and an
  EMPLOYEE's — never the główna or another manager's, the OWNER's or an ADMIN's (`canManageRegister`);
  the kasa form hides „Aktywna" from him. A new kasa or an edit may give the kasa only to himself or
  an EMPLOYEE (`canHandRegisterTo`).
- A worker goes to `/kosz` together with his kasy and comes back with them.
- A trashed worker keeps his e-mail (the unique index counts trashed rows), so a new account can't take
  it until „Usuń na zawsze"; `createWorkerAction` says so and points to the Kosz.

## Wypłaty

- Any management role may cancel a wypłata the worker rejected, whichever kasa it came from — it sits
  in every manager's queue (`canCancelTransfer`). Editing it stays with its author.

## Credentials

- Management sets e-mails — its own included — in „Edytuj pracownika" (`updateWorkerAction`), with no
  password asked.
- A change of e-mail or password revokes no session and leaves an already-sent reset-password link valid.
  Accepted: the link reaches only the mailbox owner, who could request a fresh one anyway.

## Language

- A manager on Українська sees the translated shared components (transfers table, filters, uploads,
  menu) on management screens too. „Podgląd pracownika" stays Polish on purpose — the manager
  can't know which language the worker chose on his phone.
