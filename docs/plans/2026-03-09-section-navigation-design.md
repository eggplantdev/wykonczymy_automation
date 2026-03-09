# Dashboard Section Navigation

## Problem

No way to quickly jump to a specific section on the manager dashboard. All 4 collapsible sections are open by default, requiring manual scrolling.

## Solution

Add hash-based navigation links in the top nav (desktop only, `lg:` breakpoint) that smooth-scroll to a target section and force-open it if closed.

## Section IDs

| Section             | Hash ID       |
| ------------------- | ------------- |
| Kasy                | `#kasy`       |
| Pracownicy          | `#pracownicy` |
| Inwestycje          | `#inwestycje` |
| Ostatnie transakcje | `#transakcje` |

## Implementation

### `CollapsibleSection` changes

- Add optional `id` prop (rendered on wrapper)
- Support controlled open state via new optional `forceOpen` or external trigger
- Listen for hash match to force-open on mount/navigation

### `useHashNavigation()` hook

- On mount: read `window.location.hash`
- If hash matches a section ID: set that section to open + `scrollIntoView({ behavior: 'smooth' })`
- Works for both in-page clicks and cross-page navigation (e.g., `/#kasy`)

### Top nav changes

- Add 4 links after logo/badge area: Kasy, Pracownicy, Inwestycje, Transakcje
- Visible only `hidden lg:flex`
- Use `<Link href="/#kasy">` etc. for cross-page support
- Visually consistent with existing nav styling

## What stays the same

- Default behavior (all sections open) unchanged when no hash
- URL search params for filters untouched
- Mobile nav unchanged
- Other sections not affected when one is targeted (no accordion collapse)
