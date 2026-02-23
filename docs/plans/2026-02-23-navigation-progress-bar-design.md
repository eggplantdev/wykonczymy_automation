# Navigation Progress Bar

**Date:** 2026-02-23
**Status:** Approved

## Problem

Clicking a link to a detail page (`/kasa/[id]`, `/inwestycje/[id]`, `/uzytkownicy/[id]`) results in 1-2 seconds of no visual feedback. The browser stays on the current page until the server finishes rendering the new route. Users don't know if their click registered.

## Solution

Add a top progress bar (YouTube/GitHub style) that starts immediately on link click and completes when the new page renders.

## Technical Approach

- **Library:** `@bprogress/next` — TypeScript rewrite of NProgress with built-in Next.js App Router `ProgressProvider`
- **Integration:** Wrap `(frontend)/layout.tsx` children in `<ProgressProvider>` via a client `Providers` component
- **Styling:** Thin bar using `--primary` CSS variable, spinner disabled
- **Scope:** Only active within `(frontend)` route group (not Payload admin)

## Files

| File                               | Action                                           |
| ---------------------------------- | ------------------------------------------------ |
| `package.json`                     | Add `@bprogress/next`                            |
| `src/app/(frontend)/providers.tsx` | New client component wrapping `ProgressProvider` |
| `src/app/(frontend)/layout.tsx`    | Wrap children in `<Providers>`                   |

## Future (separate PR)

- Per-entity aggregate queries (replace fetch-all pattern on detail pages)
- Route-level `loading.tsx` skeletons for detail pages
