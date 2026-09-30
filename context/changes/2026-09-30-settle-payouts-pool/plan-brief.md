# Kwota do rozdysponowania i saldo kasy — Plan Brief

> Full plan: `context/changes/2026-09-30-settle-payouts-pool/plan.md`

## What & Why

The owner pays workers out of a fixed sum in hand and wants the dialog to show how much of that sum
is still unallocated, plus the register's saldo like every other form.

## Starting Point

„Rozlicz wypłaty” shows per-pair figures and „Razem” only; the register field has no saldo. An
approved spike already implements the target in the working tree.

## Desired End State

Optional „Do rozdysponowania” → footer „Zostało do rozdysponowania”; over-allocation blocks „Wypłać”;
„Aktualne saldo” + „Saldo po wypłacie” under „Kasa”.

## Key Decisions Made

| Decision                 | Choice                                                        | Why                                                               |
| ------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Persistence of the kwota | None — client-side only                                       | It is a calculator, not a booking figure                          |
| Over-allocation          | Blocks „Wypłać”                                               | Typing the kwota states the cash limit; exceeding it is a mistake |
| Saldo after payout < 0   | Informational, never blocks                                   | A register may legitimately go negative                           |
| Row prefill              | Unchanged                                                     | Owner accepted it on the spike                                    |
| Saldo on open            | Returned with the rows by the open-time query, seeds the hook | Otherwise it never appears here; no effect, no second round trip  |

## Scope

**In scope:** the two settle-form files, DOM spec.
**Out of scope:** auto-distribution, action changes, other forms' saldo behaviour.

## Phases at a Glance

| Phase             | What it delivers            | Key risk                                                         |
| ----------------- | --------------------------- | ---------------------------------------------------------------- |
| 1. Harden + cover | Spike cleaned up, DOM specs | Stubbed `'use server'` saldo query throws in jsdom unless mocked |

**Estimated effort:** one short session.

## Success Criteria (Summary)

- 10 000 − 4 000 reads 6 000,00 zł in the footer; exceeding it disables „Wypłać”.
- Saldo visible on open without touching „Kasa”.
